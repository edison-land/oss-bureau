#!/usr/bin/env python3
"""
OSS Bureau GitHub Intake, Verification & Sync Bot (Python 3.9+, zero dependencies).

Subcommands:
  inspect-issue   Validate a GitHub Issue body containing case-bundle.json,
                  verify remote GitHub repo/commit/file paths, and classify tier.
  inspect-pr      Validate one or more cases/*.json files in a PR (or --all).
  archive-issue   Convert an approved Issue's case-bundle.json into cases/*.json.
  sync-issues     Sync open `case-submission` / `case-tip` GitHub Issues into
                  web/src/data/communityIssues.json for zero-rate-limit display.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
VALIDATOR_DIR = REPO_ROOT / "skills" / "oss-audit" / "scripts"
if str(VALIDATOR_DIR) not in sys.path:
    sys.path.insert(0, str(VALIDATOR_DIR))

from validate_bundle import validate as validate_v1_bundle  # noqa: E402


TIER_META = {
    "blacklist": {"emoji": "🔴", "zh": "黑榜", "en": "BLACKLIST", "label": "tier:blacklist"},
    "watchlist": {"emoji": "🟡", "zh": "灰榜", "en": "WATCHLIST", "label": "tier:watchlist"},
    "cleared": {"emoji": "🟢", "zh": "红榜", "en": "CLEARED", "label": "tier:cleared"},
}


def github_api_request(
    url: str,
    token: str | None = None,
    timeout: int = 12,
) -> tuple[int, Any]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "oss-bureau-bot/1.0",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        try:
            body = json.loads(exc.read().decode("utf-8", errors="replace"))
        except Exception:
            body = {"message": str(exc)}
        return exc.code, body
    except Exception as exc:
        return 0, {"message": str(exc)}


def parse_github_owner_repo(repo_url: str | None, name: str | None) -> str | None:
    for candidate in (repo_url or "", name or ""):
        m = re.search(r"github\.com/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)", candidate)
        if m:
            return m.group(1).removesuffix(".git").rstrip("/")
        if re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", candidate.strip()):
            return candidate.strip()
    return None


def extract_json_from_text(text: str) -> tuple[dict[str, Any] | None, str | None]:
    """Extract the first JSON object from fenced code blocks or raw text."""
    if not text or not text.strip():
        return None, "Issue body is empty."

    # 1. Try fenced ```json ... ``` blocks first
    for pattern in (
        r"```json\s*(\{.*?\})\s*```",
        r"```[a-zA-Z0-9_-]*\s*(\{.*?\})\s*```",
    ):
        for match in re.finditer(pattern, text, flags=re.DOTALL | re.IGNORECASE):
            snippet = match.group(1).strip()
            try:
                parsed = json.loads(snippet)
                if isinstance(parsed, dict):
                    return parsed, None
            except json.JSONDecodeError:
                continue

    # 2. Fallback: find balanced JSON object containing "schema_version"
    idx = text.find("{")
    while idx != -1:
        depth = 0
        in_str = False
        esc = False
        for end in range(idx, len(text)):
            ch = text[end]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == '"':
                    in_str = False
            else:
                if ch == '"':
                    in_str = True
                elif ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        candidate = text[idx : end + 1]
                        if "schema_version" in candidate or "verdict" in candidate:
                            try:
                                parsed = json.loads(candidate)
                                if isinstance(parsed, dict):
                                    return parsed, None
                            except json.JSONDecodeError:
                                pass
                        break
        idx = text.find("{", idx + 1)

    return None, "No valid JSON object found in text (expected a case-bundle.v1.json block)."


def evaluate_tier(bundle: dict[str, Any]) -> tuple[str, list[dict[str, str]]]:
    """
    Canonical public OSS Bureau tier classifier (mirrors web/src/utils/bundleParser.ts).
    Returns (tier, reasons).
    """
    verdict = bundle.get("verdict") or {}
    risk = verdict.get("risk_level", "UNKNOWN")
    promise = verdict.get("promise_vs_reality", "NO_CLAIM_FOUND")
    tel = verdict.get("default_telemetry", "UNKNOWN")
    cross = bool(verdict.get("cross_tool_access", False))

    black_reasons: list[dict[str, str]] = []
    if cross:
        black_reasons.append(
            {
                "rule": "CROSS_TOOL_ACCESS",
                "en": "Cross-tool credential or config snooping detected (`cross_tool_access = true`).",
                "zh": "存在跨工具窃密或静默读取外部工具凭证/配置 (`cross_tool_access = true`)。",
            }
        )
    if promise == "DIRECT_CONTRADICTION":
        black_reasons.append(
            {
                "rule": "PROMISE_DIRECT_CONTRADICTION",
                "en": "Runtime code directly contradicts explicit privacy/zero-telemetry claims (`DIRECT_CONTRADICTION`).",
                "zh": "源码行为与公开“零遥测/纯本地”承诺直接矛盾 (`DIRECT_CONTRADICTION`)。",
            }
        )
    if tel == "FORCED":
        black_reasons.append(
            {
                "rule": "FORCED_TELEMETRY",
                "en": "Forced telemetry with no built-in disable mechanism (`default_telemetry = FORCED`).",
                "zh": "强制开启遥测且无内置关闭开关 (`default_telemetry = FORCED`)。",
            }
        )
    if risk in {"CRITICAL", "HIGH"}:
        black_reasons.append(
            {
                "rule": "HIGH_OR_CRITICAL_RISK",
                "en": f"Verified high-impact privacy or security risk (`risk_level = {risk}`).",
                "zh": f"存在经核实的高危/严重隐私或安全风险 (`risk_level = {risk}`)。",
            }
        )
    if black_reasons:
        return "blacklist", black_reasons

    watch_reasons: list[dict[str, str]] = []
    if tel == "OPT_OUT_HARD":
        watch_reasons.append(
            {
                "rule": "OPT_OUT_HARD",
                "en": "Default-on telemetry with high opt-out friction or hidden toggles (`OPT_OUT_HARD`).",
                "zh": "默认开启遥测且关闭门槛高或开关隐蔽 (`OPT_OUT_HARD`)。",
            }
        )
    elif tel == "OPT_OUT_EASY":
        watch_reasons.append(
            {
                "rule": "OPT_OUT_EASY",
                "en": "Default-on opt-out telemetry enabled out of the box (`OPT_OUT_EASY`).",
                "zh": "默认开启遥测（需用户主动关闭，`OPT_OUT_EASY`）。",
            }
        )
    if promise == "PARTIAL_MISMATCH":
        watch_reasons.append(
            {
                "rule": "PROMISE_PARTIAL_MISMATCH",
                "en": "Documentation omits or downplays material telemetry behavior (`PARTIAL_MISMATCH`).",
                "zh": "文档披露不完整或轻描淡写 (`PARTIAL_MISMATCH`)。",
            }
        )
    if risk == "MEDIUM":
        watch_reasons.append(
            {
                "rule": "MEDIUM_RISK",
                "en": "Moderate telemetry or security hardening concerns (`risk_level = MEDIUM`).",
                "zh": "存在中等风险的遥测或安全默认项 (`risk_level = MEDIUM`)。",
            }
        )
    if watch_reasons:
        return "watchlist", watch_reasons

    return "cleared", [
        {
            "rule": "CLEARED_BASELINE",
            "en": f"No default-on telemetry (`{tel}`), no cross-tool access, and no privacy contradiction.",
            "zh": f"无默认遥测（`{tel}`）、无跨工具越权且无承诺矛盾，符合红榜标准。",
        }
    ]


def verify_remote_evidence(
    bundle: dict[str, Any],
    token: str | None = None,
    skip_network: bool = False,
) -> dict[str, Any]:
    target = bundle.get("target") or {}
    owner_repo = parse_github_owner_repo(target.get("repo_url"), target.get("name"))
    commit_hash = target.get("commit_hash")
    branch = target.get("branch")
    findings = bundle.get("findings") or []

    result: dict[str, Any] = {
        "owner_repo": owner_repo,
        "skipped": skip_network,
        "repo_exists": None,
        "stars": None,
        "default_branch": None,
        "commit_exists": None,
        "file_checks": [],
        "errors": [],
        "warnings": [],
    }

    if skip_network:
        result["warnings"].append("Remote GitHub verification skipped (--no-network).")
        return result

    if not owner_repo:
        result["warnings"].append("Target is not a GitHub owner/repo; remote file check skipped.")
        return result

    status, repo_data = github_api_request(f"https://api.github.com/repos/{owner_repo}", token)
    if status == 200 and isinstance(repo_data, dict):
        result["repo_exists"] = True
        result["stars"] = repo_data.get("stargazers_count")
        result["default_branch"] = repo_data.get("default_branch")
    elif status == 404:
        result["repo_exists"] = False
        result["errors"].append(f"GitHub repository `{owner_repo}` returned 404 Not Found.")
        return result
    else:
        result["warnings"].append(f"Could not verify repo `{owner_repo}` (HTTP {status}).")
        return result

    ref = commit_hash or branch or result["default_branch"] or "main"
    if commit_hash:
        c_status, _ = github_api_request(
            f"https://api.github.com/repos/{owner_repo}/commits/{urllib.parse.quote(str(commit_hash))}",
            token,
        )
        if c_status == 200:
            result["commit_exists"] = True
        elif c_status in (404, 422):
            result["commit_exists"] = False
            result["errors"].append(
                f"Commit `{commit_hash}` not found in `{owner_repo}` (HTTP {c_status})."
            )
        else:
            result["warnings"].append(f"Could not verify commit `{commit_hash}` (HTTP {c_status}).")

    checked_paths: set[str] = set()
    for f in findings[:8]:
        if not isinstance(f, dict):
            continue
        fp = str(f.get("file_path") or "").strip().lstrip("/")
        if not fp or fp in checked_paths:
            continue
        checked_paths.add(fp)
        quoted_path = urllib.parse.quote(fp, safe="/")
        quoted_ref = urllib.parse.quote(str(ref))
        f_status, _ = github_api_request(
            f"https://api.github.com/repos/{owner_repo}/contents/{quoted_path}?ref={quoted_ref}",
            token,
        )
        exists = f_status == 200
        result["file_checks"].append({"file_path": fp, "exists": exists, "status": f_status})
        if f_status == 404:
            result["warnings"].append(
                f"Referenced file `{fp}` not found at ref `{ref}` (may have been removed in a later commit)."
            )

    return result


def build_issue_comment(
    bundle: dict[str, Any] | None,
    schema_errors: list[str],
    schema_warnings: list[str],
    remote: dict[str, Any] | None,
    tier: str | None,
    reasons: list[dict[str, str]],
) -> tuple[str, list[str]]:
    """Build Markdown triage comment and desired bot labels."""
    lines = ["<!-- oss-bureau-bot -->", "### 🔍 OSS Bureau Automated Intake Report", ""]

    if bundle is None or schema_errors:
        lines.append("❌ **Schema Validation Failed** — 请修正以下字段后编辑本 Issue，Bot 会自动重新校验：")
        lines.append("")
        for err in schema_errors:
            lines.append(f"- `{err}`")
        lines.extend(
            [
                "",
                "📖 Reference: [`case-schema.json`](https://github.com/edison-land/oss-bureau/blob/main/skills/oss-audit/references/case-schema.json)",
            ]
        )
        return "\n".join(lines), ["evidence:needs-fix"]

    assert tier is not None
    meta = TIER_META[tier]
    target = bundle["target"]
    verdict = bundle["verdict"]
    auditor = bundle.get("auditor_tool", "unknown")

    remote_errors = (remote or {}).get("errors") or []
    remote_warnings = (remote or {}).get("warnings") or []
    verified_ok = len(remote_errors) == 0

    lines.extend(
        [
            f"**Computed Tier (公开规则自动定级)**: {meta['emoji']} **{meta['zh']} / {meta['en']}**",
            "",
            "| Field | Value |",
            "| :--- | :--- |",
            f"| **Target** | `{target.get('name')}` |",
            f"| **Commit** | `{target.get('commit_hash') or 'unspecified'}` |",
            f"| **Auditor Skill** | `{auditor}` |",
            f"| **Default Telemetry** | `{verdict.get('default_telemetry')}` |",
            f"| **Cross-Tool Access** | `{'YES' if verdict.get('cross_tool_access') else 'NO'}` |",
            f"| **Promise vs. Code** | `{verdict.get('promise_vs_reality')}` |",
            f"| **Findings Count** | `{len(bundle.get('findings') or [])}` |",
            "",
            "#### ⚖️ Public Rule Engine Reasoning",
        ]
    )
    for r in reasons:
        lines.append(f"- **`{r['rule']}`**: {r['zh']} / {r['en']}")

    if remote and not remote.get("skipped"):
        lines.extend(["", "#### 🛰️ Remote GitHub Evidence Verification"])
        lines.append(
            f"- Repository `{remote.get('owner_repo')}`: "
            + ("✅ Found" if remote.get("repo_exists") else "❌ Not Found")
            + (f" (★ {remote['stars']:,})" if isinstance(remote.get("stars"), int) else "")
        )
        if remote.get("commit_exists") is not None:
            lines.append(
                f"- Commit `{target.get('commit_hash')}`: "
                + ("✅ Verified" if remote["commit_exists"] else "❌ Not Found")
            )
        for fc in remote.get("file_checks") or []:
            icon = "✅" if fc["exists"] else "⚠️"
            lines.append(f"- File `{fc['file_path']}`: {icon} (HTTP {fc['status']})")

    if remote_errors:
        lines.extend(["", "#### ❌ Blocking Verification Errors"])
        for e in remote_errors:
            lines.append(f"- {e}")

    all_warnings = list(schema_warnings) + list(remote_warnings)
    if all_warnings:
        lines.extend(["", "#### ⚠️ Warnings"])
        for w in all_warnings:
            lines.append(f"- {w}")

    lines.append("")
    if verified_ok:
        lines.append(
            "> ✅ **Ready for Peer Review**: Community members and maintainers can discuss or post follow-up evidence below. "
            "Maintainers can add the **`approved`** label to automatically open an archive PR into `cases/`."
        )
        labels = [meta["label"], "evidence:verified"]
    else:
        lines.append(
            "> ❌ **Needs Fix**: Please fix the blocking verification errors above and edit this Issue to re-trigger validation."
        )
        labels = [meta["label"], "evidence:needs-fix"]

    return "\n".join(lines), labels


def cmd_inspect_issue(args: argparse.Namespace) -> int:
    body = ""
    if args.event_path:
        event = json.loads(Path(args.event_path).read_text(encoding="utf-8"))
        body = (event.get("issue") or {}).get("body") or ""
    elif args.body_file:
        body = Path(args.body_file).read_text(encoding="utf-8")
    else:
        body = sys.stdin.read()

    bundle, extract_err = extract_json_from_text(body)
    if bundle is None:
        comment, labels = build_issue_comment(None, [extract_err or "Missing JSON"], [], None, None, [])
        report = {"ok": False, "tier": None, "labels": labels, "comment": comment}
    else:
        errors, warnings = validate_v1_bundle(bundle)
        if errors:
            comment, labels = build_issue_comment(bundle, errors, warnings, None, None, [])
            report = {"ok": False, "tier": None, "labels": labels, "comment": comment}
        else:
            tier, reasons = evaluate_tier(bundle)
            token = os.environ.get("GITHUB_TOKEN")
            remote = verify_remote_evidence(bundle, token=token, skip_network=args.no_network)
            comment, labels = build_issue_comment(bundle, [], warnings, remote, tier, reasons)
            ok = len(remote.get("errors") or []) == 0
            report = {
                "ok": ok,
                "tier": tier,
                "labels": labels,
                "comment": comment,
                "target": bundle["target"]["name"],
                "auditor_tool": bundle.get("auditor_tool"),
            }

    if args.out_json:
        Path(args.out_json).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    else:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def validate_official_dossier(data: dict[str, Any]) -> list[str]:
    required = ["caseId", "tier", "status", "name", "repoUrl", "commitHash", "oneLiner", "findings"]
    errs = [f"Missing required official dossier field '{k}'" for k in required if k not in data]
    if data.get("tier") not in {"blacklist", "watchlist", "cleared"}:
        errs.append(f"Invalid tier: {data.get('tier')!r}")
    return errs


def cmd_inspect_pr(args: argparse.Namespace) -> int:
    paths: list[Path] = []
    if args.all:
        paths = sorted((REPO_ROOT / "cases").glob("*.json"))
    else:
        paths = [Path(p) for p in args.files if p.endswith(".json") and Path(p).exists()]

    if not paths:
        print("No cases/*.json files to inspect.")
        return 0

    token = os.environ.get("GITHUB_TOKEN")
    has_failure = False
    md_lines = ["<!-- oss-bureau-pr-bot -->", "### 🔍 OSS Bureau Case PR Verification", ""]
    md_lines.append("| File | Format | Target | Tier | Schema | Remote Check |")
    md_lines.append("| :--- | :--- | :--- | :--- | :--- | :--- |")

    for p in paths:
        rel = str(p.relative_to(REPO_ROOT)) if p.is_absolute() and REPO_ROOT in p.parents else str(p)
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except Exception as exc:
            has_failure = True
            md_lines.append(f"| `{rel}` | invalid | - | - | ❌ JSON error: {exc} | - |")
            continue

        if isinstance(data, dict) and "schema_version" in data:
            errs, warns = validate_v1_bundle(data)
            if errs:
                has_failure = True
                md_lines.append(
                    f"| `{rel}` | `v1.0.0` | `{data.get('target', {}).get('name', '?')}` | - | ❌ {len(errs)} error(s) | skipped |"
                )
                for e in errs:
                    md_lines.append(f"\n> ❌ `{rel}`: {e}")
                continue
            tier, _ = evaluate_tier(data)
            meta = TIER_META[tier]
            remote = verify_remote_evidence(data, token=token, skip_network=args.no_network)
            r_errs = remote.get("errors") or []
            if r_errs:
                has_failure = True
                r_cell = "❌ " + "; ".join(r_errs)
            elif remote.get("skipped"):
                r_cell = "⏭️ skipped"
            else:
                r_cell = "✅ verified"
            warn_note = f" ({len(warns)} warn)" if warns else ""
            md_lines.append(
                f"| `{rel}` | `v1.0.0` | `{data['target']['name']}` | {meta['emoji']} {meta['en']} | ✅ valid{warn_note} | {r_cell} |"
            )
        elif isinstance(data, dict) and "caseId" in data:
            errs = validate_official_dossier(data)
            if errs:
                has_failure = True
                md_lines.append(f"| `{rel}` | official | `{data.get('name', '?')}` | - | ❌ {'; '.join(errs)} | - |")
            else:
                meta = TIER_META[data["tier"]]
                md_lines.append(
                    f"| `{rel}` | official | `{data['name']}` | {meta['emoji']} {meta['en']} | ✅ valid | curated |"
                )
        else:
            has_failure = True
            md_lines.append(f"| `{rel}` | unknown | - | - | ❌ Unrecognized case JSON format | - |")

    summary = "\n".join(md_lines) + "\n"
    if args.out_md:
        Path(args.out_md).write_text(summary, encoding="utf-8")
    print(summary)
    return 1 if has_failure else 0


def cmd_archive_issue(args: argparse.Namespace) -> int:
    event = json.loads(Path(args.event_path).read_text(encoding="utf-8"))
    issue = event.get("issue") or {}
    issue_number = issue.get("number")
    issue_url = issue.get("html_url")
    submitted_by = (issue.get("user") or {}).get("login", "community")
    body = issue.get("body") or ""

    bundle, extract_err = extract_json_from_text(body)
    if bundle is None:
        print(f"ERROR: {extract_err}", file=sys.stderr)
        return 1

    errors, _ = validate_v1_bundle(bundle)
    if errors:
        print("ERROR: Schema validation failed: " + "; ".join(errors), file=sys.stderr)
        return 1

    tier, _ = evaluate_tier(bundle)
    token = os.environ.get("GITHUB_TOKEN")
    remote = verify_remote_evidence(bundle, token=token, skip_network=args.no_network)
    if remote.get("errors"):
        print("ERROR: Remote verification failed: " + "; ".join(remote["errors"]), file=sys.stderr)
        return 1

    target_name = bundle["target"]["name"]
    slug = re.sub(r"[^a-z0-9-]+", "-", target_name.lower().replace("/", "-")).strip("-") or f"case-{issue_number}"
    case_id = f"CASE-ISS-{issue_number}"
    filename = f"CASE-ISS-{issue_number}-{slug}.json"
    out_path = REPO_ROOT / "cases" / filename

    archived = dict(bundle)
    archived["case_id"] = case_id
    archived["bureau_meta"] = {
        "case_id": case_id,
        "tier": tier,
        "status": "CLEARED" if tier == "cleared" else "VERIFIED",
        "stars": remote.get("stars"),
        "submitted_by": submitted_by,
        "evidence_issue_number": issue_number,
        "evidence_issue_url": issue_url,
        "source_type": "community",
        "archived_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(archived, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    rel_path = f"cases/{filename}"
    print(f"Archived {target_name} -> {rel_path} (tier={tier})")
    gh_out = os.environ.get("GITHUB_OUTPUT")
    if gh_out:
        with open(gh_out, "a", encoding="utf-8") as fh:
            fh.write(f"file_path={rel_path}\n")
            fh.write(f"target_name={target_name}\n")
            fh.write(f"tier={tier}\n")
            fh.write(f"case_id={case_id}\n")
            fh.write(f"issue_number={issue_number}\n")
            fh.write(f"submitted_by={submitted_by}\n")
    return 0


def cmd_sync_issues(args: argparse.Namespace) -> int:
    repo = args.repo
    token = os.environ.get("GITHUB_TOKEN")
    records_by_num: dict[int, dict[str, Any]] = {}

    for label in ("case-submission", "case-tip"):
        url = (
            f"https://api.github.com/repos/{repo}/issues"
            f"?state=open&labels={urllib.parse.quote(label)}&per_page=50"
        )
        status, payload = github_api_request(url, token=token)
        if status != 200 or not isinstance(payload, list):
            print(f"WARN: Failed to fetch issues for label '{label}' (HTTP {status})", file=sys.stderr)
            continue

        for item in payload:
            if not isinstance(item, dict) or "pull_request" in item:
                continue
            num = item["number"]
            if num in records_by_num:
                continue

            labels = [lb.get("name", "") for lb in item.get("labels") or [] if isinstance(lb, dict)]
            body = item.get("body") or ""
            bundle, _ = extract_json_from_text(body)
            valid_bundle: dict[str, Any] | None = None
            tier: str | None = None
            if bundle is not None:
                errs, _ = validate_v1_bundle(bundle)
                if not errs:
                    valid_bundle = bundle
                    tier, _ = evaluate_tier(bundle)

            if not tier:
                if "tier:blacklist" in labels:
                    tier = "blacklist"
                elif "tier:watchlist" in labels:
                    tier = "watchlist"
                elif "tier:cleared" in labels:
                    tier = "cleared"

            evidence_status = (
                "verified"
                if "evidence:verified" in labels
                else "needs_fix"
                if "evidence:needs-fix" in labels
                else "valid_json"
                if valid_bundle
                else "manual_tip"
            )

            target_repo = (
                valid_bundle["target"]["name"]
                if valid_bundle
                else re.sub(r"^\[(?:Case|Case Tip)\]\s*", "", item.get("title", ""), flags=re.IGNORECASE).strip()
            )
            auditor_tool = valid_bundle.get("auditor_tool") if valid_bundle else None
            summary = (
                valid_bundle["verdict"]["one_liner"]
                if valid_bundle
                else (body.strip().splitlines()[0][:200] if body.strip() else item.get("title", ""))
            )
            reactions = item.get("reactions") or {}

            records_by_num[num] = {
                "number": num,
                "title": item.get("title", ""),
                "htmlUrl": item.get("html_url", ""),
                "author": (item.get("user") or {}).get("login", "unknown"),
                "authorAvatar": (item.get("user") or {}).get("avatar_url", ""),
                "createdAt": item.get("created_at", ""),
                "updatedAt": item.get("updated_at", ""),
                "comments": item.get("comments", 0),
                "thumbsUp": reactions.get("+1", 0),
                "thumbsDown": reactions.get("-1", 0),
                "labels": labels,
                "tier": tier,
                "evidenceStatus": evidence_status,
                "targetRepo": target_repo,
                "auditorTool": auditor_tool,
                "summary": summary,
                "bundle": valid_bundle,
            }

    issues_sorted = sorted(records_by_num.values(), key=lambda x: x["number"], reverse=True)
    out_obj = {
        "syncedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "repo": repo,
        "issues": issues_sorted,
    }
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out_obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Synced {len(issues_sorted)} open community issue(s) to {out_path}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="OSS Bureau GitHub Intake & Sync Bot")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_iss = sub.add_parser("inspect-issue")
    p_iss.add_argument("--event-path", help="Path to GITHUB_EVENT_PATH JSON")
    p_iss.add_argument("--body-file", help="Path to raw issue body markdown file")
    p_iss.add_argument("--out-json", help="Write inspection report JSON to file")
    p_iss.add_argument("--no-network", action="store_true")
    p_iss.set_defaults(func=cmd_inspect_issue)

    p_pr = sub.add_parser("inspect-pr")
    p_pr.add_argument("files", nargs="*", help="Changed cases/*.json files")
    p_pr.add_argument("--all", action="store_true", help="Inspect all cases/*.json files")
    p_pr.add_argument("--out-md", help="Write Markdown report to file")
    p_pr.add_argument("--no-network", action="store_true")
    p_pr.set_defaults(func=cmd_inspect_pr)

    p_arc = sub.add_parser("archive-issue")
    p_arc.add_argument("--event-path", required=True)
    p_arc.add_argument("--no-network", action="store_true")
    p_arc.set_defaults(func=cmd_archive_issue)

    p_sync = sub.add_parser("sync-issues")
    p_sync.add_argument("--repo", default="edison-land/oss-bureau")
    p_sync.add_argument("--out", default=str(REPO_ROOT / "web" / "src" / "data" / "communityIssues.json"))
    p_sync.set_defaults(func=cmd_sync_issues)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
