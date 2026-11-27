#!/usr/bin/env python3
"""
OSS Bureau GitHub Intake, Verification, Attachment Archiving & AX Sync Bot
(Python 3.9+, zero external dependencies).

Subcommands:
  inspect-issue   Validate a GitHub Issue body containing case-bundle.json,
                  block shortlinks & leaked secrets, verify remote GitHub
                  repo/commit/file paths & snippet lines, detect image
                  attachments, and classify tier.
  inspect-pr      Validate cases/*.json files (or --all) plus 100% evidence/
                  attachment accounting, shortlink & secret hygiene checks.
  archive-issue   Archive an approved Issue's case-bundle.json into cases/
                  and download validated Issue image attachments into evidence/.
  sync-issues     Sync open `case-submission` / `case-tip` GitHub Issues into
                  web/src/data/communityIssues.json.
  export-ax       Export static AX endpoints (llms.txt, registry.json, schema)
                  and copy evidence/ assets into web/public/.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
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
    "blacklist": {"emoji": "🔴", "zh": "黑榜", "en": "Flagged", "label": "tier:blacklist"},
    "watchlist": {"emoji": "🟡", "zh": "灰榜", "en": "Watch", "label": "tier:watchlist"},
    "cleared": {"emoji": "🟢", "zh": "红榜", "en": "Clean", "label": "tier:cleared"},
}

SHORTLINK_RE = re.compile(
    r"\bhttps?://(?:t\.co|bit\.ly|tinyurl\.com|goo\.gl|ow\.ly|is\.gd|rb\.gy|buff\.ly)/\S+",
    re.IGNORECASE,
)

SECRET_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("GitHub classic token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b")),
    ("GitHub fine-grained token", re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}\b")),
    ("AWS access key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("Private key block", re.compile(r"-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----")),
    ("Slack token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b")),
    ("OpenAI/Anthropic style key", re.compile(r"\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{24,}\b")),
]

ALLOWED_IMG_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
ALLOWED_IMG_CONTENT_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
}
MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024  # 5 MB

MD_IMAGE_RE = re.compile(r"!\[([^\]]*)\]\((https://[^)\s]+)\)")
HTML_IMG_RE = re.compile(r"""<img[^>]+src=["'](https://[^"'\s]+)["'][^>]*>""", re.IGNORECASE)
ALLOWED_ISSUE_ATTACHMENT_HOSTS = (
    "github.com",
    "user-images.githubusercontent.com",
    "raw.githubusercontent.com",
    "private-user-images.githubusercontent.com",
)


def github_api_request(
    url: str,
    token: str | None = None,
    timeout: int = 12,
    raw_text: bool = False,
) -> tuple[int, Any]:
    headers = {
        "Accept": "application/vnd.github.raw+json" if raw_text else "application/vnd.github+json",
        "User-Agent": "oss-bureau-bot/1.1",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            if raw_text:
                return resp.status, raw
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


def find_shortlinks(text: str) -> list[str]:
    return sorted(set(SHORTLINK_RE.findall(text or "")))


def find_leaked_secrets(text: str) -> list[str]:
    hits: list[str] = []
    if not text:
        return hits
    for label, pattern in SECRET_PATTERNS:
        if pattern.search(text):
            hits.append(label)
    return hits


def extract_issue_images(body: str) -> list[dict[str, str]]:
    """Extract canonical HTTPS image attachments uploaded to a GitHub Issue."""
    found: list[dict[str, str]] = []
    seen: set[str] = set()
    if not body:
        return found

    for alt, url in MD_IMAGE_RE.findall(body):
        if url not in seen:
            seen.add(url)
            found.append({"url": url, "caption": alt.strip() or "Evidence screenshot"})
    for url in HTML_IMG_RE.findall(body):
        if url not in seen:
            seen.add(url)
            found.append({"url": url, "caption": "Evidence screenshot"})
    return found


def extract_json_from_text(text: str) -> tuple[dict[str, Any] | None, str | None]:
    """Extract the first JSON object from fenced code blocks or raw text."""
    if not text or not text.strip():
        return None, "Issue body is empty."

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
    """Canonical public OSS Bureau tier classifier (mirrors web/src/utils/bundleParser.ts)."""
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


def snippet_matches_source(snippet: str, raw_source: str) -> bool | None:
    """Check whether at least one meaningful line of code_snippet appears in the remote file."""
    candidates = [
        line.strip()
        for line in (snippet or "").splitlines()
        if len(line.strip()) >= 12 and not line.strip().startswith(("//", "#", "/*", "*"))
    ]
    if not candidates:
        return None
    normalized_src = " ".join(raw_source.split())
    for line in candidates[:3]:
        if line in raw_source or " ".join(line.split()) in normalized_src:
            return True
    return False


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

    checked_paths: dict[str, tuple[int, str]] = {}
    for f in findings[:8]:
        if not isinstance(f, dict):
            continue
        fp = str(f.get("file_path") or "").strip().lstrip("/")
        if not fp:
            continue
        if fp not in checked_paths:
            quoted_path = urllib.parse.quote(fp, safe="/")
            quoted_ref = urllib.parse.quote(str(ref))
            f_status, raw_body = github_api_request(
                f"https://api.github.com/repos/{owner_repo}/contents/{quoted_path}?ref={quoted_ref}",
                token,
                raw_text=True,
            )
            checked_paths[fp] = (f_status, raw_body if isinstance(raw_body, str) else "")

        f_status, raw_body = checked_paths[fp]
        exists = f_status == 200
        snip_match = snippet_matches_source(str(f.get("code_snippet") or ""), raw_body) if exists else None
        result["file_checks"].append(
            {
                "file_path": fp,
                "exists": exists,
                "status": f_status,
                "snippet_matched": snip_match,
            }
        )
        if f_status == 404:
            result["warnings"].append(
                f"Referenced file `{fp}` not found at ref `{ref}` (may have been removed in a later commit)."
            )
        elif snip_match is False:
            result["warnings"].append(
                f"Snippet in `{fp}` did not verbatim-match remote file content (please verify line excerpt)."
            )

    return result


def build_issue_comment(
    bundle: dict[str, Any] | None,
    schema_errors: list[str],
    schema_warnings: list[str],
    hygiene_errors: list[str],
    remote: dict[str, Any] | None,
    tier: str | None,
    reasons: list[dict[str, str]],
    images: list[dict[str, str]],
) -> tuple[str, list[str]]:
    """Build Markdown triage comment and desired bot labels."""
    lines = ["<!-- oss-bureau-bot -->", "### OSS Bureau Automated Verification Report", ""]

    blocking = list(hygiene_errors) + list(schema_errors)
    if bundle is None or blocking:
        lines.append("❌ **Checks Failed** — please fix the blocking items below and edit this Issue to re-run:")
        lines.append("")
        for err in blocking:
            lines.append(f"- `{err}`")
        lines.extend(
            [
                "",
                "Reference: [`case-schema.json`](https://github.com/edison-land/oss-bureau/blob/main/skills/oss-audit/references/case-schema.json)",
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
            f"**Computed Tier**: {meta['emoji']} **{meta['en']} / {meta['zh']}**",
            "",
            "| Check | Status |",
            "| :--- | :--- |",
            "| Schema `v1.0.0` | ✅ Valid |",
            "| Canonical URLs (zero shortlinks) | ✅ Pass |",
            "| Secret hygiene scan | ✅ Clean |",
            f"| Image attachments detected | `{len(images)}` (auto-archived to `evidence/` on approval) |",
            "",
            "| Field | Value |",
            "| :--- | :--- |",
            f"| **Target** | `{target.get('name')}` |",
            f"| **Commit** | `{target.get('commit_hash') or 'unspecified'}` |",
            f"| **Auditor Skill** | `{auditor}` |",
            f"| **Default Telemetry** | `{verdict.get('default_telemetry')}` |",
            f"| **Cross-Tool Access** | `{'YES' if verdict.get('cross_tool_access') else 'NO'}` |",
            f"| **Promise vs. Code** | `{verdict.get('promise_vs_reality')}` |",
            f"| **Findings** | `{len(bundle.get('findings') or [])}` |",
            "",
            "#### Rule Engine Reasoning",
        ]
    )
    for r in reasons:
        lines.append(f"- **`{r['rule']}`**: {r['en']} / {r['zh']}")

    if remote and not remote.get("skipped"):
        lines.extend(["", "#### Remote GitHub Source Verification"])
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
            snip_note = (
                " · snippet matched"
                if fc.get("snippet_matched") is True
                else " · snippet unverified"
                if fc.get("snippet_matched") is False
                else ""
            )
            lines.append(f"- File `{fc['file_path']}`: {icon} (HTTP {fc['status']}){snip_note}")

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
            "> ✅ **Ready for Peer Review**: Maintainers can add the **`approved`** label to automatically archive the JSON into `cases/` and any uploaded screenshots into `evidence/` via pull request."
        )
        labels = [meta["label"], "evidence:verified"]
    else:
        lines.append(
            "> ❌ **Needs Fix**: Fix the blocking errors above and edit this Issue to re-run verification."
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

    hygiene_errors: list[str] = []
    shortlinks = find_shortlinks(body)
    if shortlinks:
        hygiene_errors.append(
            f"Shortened redirect URLs are prohibited (use canonical https:// URLs): {', '.join(shortlinks[:3])}"
        )
    leaked = find_leaked_secrets(body)
    if leaked:
        hygiene_errors.append(
            f"Potential secret/token detected ({', '.join(leaked)}). Redact before submitting."
        )

    images = extract_issue_images(body)
    bundle, extract_err = extract_json_from_text(body)

    if bundle is None:
        comment, labels = build_issue_comment(
            None, [extract_err or "Missing JSON"], [], hygiene_errors, None, None, [], images
        )
        report = {
            "ok": False,
            "tier": None,
            "labels": labels,
            "comment": comment,
            "hygiene_errors": hygiene_errors,
            "attachments_detected": len(images),
        }
    else:
        errors, warnings = validate_v1_bundle(bundle)
        if errors or hygiene_errors:
            comment, labels = build_issue_comment(
                bundle, errors, warnings, hygiene_errors, None, None, [], images
            )
            report = {
                "ok": False,
                "tier": None,
                "labels": labels,
                "comment": comment,
                "hygiene_errors": hygiene_errors,
                "attachments_detected": len(images),
            }
        else:
            tier, reasons = evaluate_tier(bundle)
            token = os.environ.get("GITHUB_TOKEN")
            remote = verify_remote_evidence(bundle, token=token, skip_network=args.no_network)
            comment, labels = build_issue_comment(
                bundle, [], warnings, [], remote, tier, reasons, images
            )
            ok = len(remote.get("errors") or []) == 0
            report = {
                "ok": ok,
                "tier": tier,
                "labels": labels,
                "comment": comment,
                "target": bundle["target"]["name"],
                "auditor_tool": bundle.get("auditor_tool"),
                "attachments_detected": len(images),
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


def collect_case_attachments(data: dict[str, Any]) -> list[str]:
    paths: list[str] = []
    raw_list = data.get("attachments") or (data.get("bureau_meta") or {}).get("attachments") or []
    if isinstance(raw_list, list):
        for item in raw_list:
            if isinstance(item, dict) and isinstance(item.get("path"), str):
                paths.append(item["path"].lstrip("/"))
            elif isinstance(item, str):
                paths.append(item.lstrip("/"))
    return paths


def verify_evidence_accounting(all_case_paths: list[Path]) -> list[str]:
    """100% evidence/ attachment accounting (no missing files, no invalid formats, no orphan images)."""
    errors: list[str] = []
    evidence_dir = REPO_ROOT / "evidence"
    referenced: set[str] = set()

    for cp in all_case_paths:
        try:
            data = json.loads(cp.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        for rel in collect_case_attachments(data):
            if not rel.startswith("evidence/"):
                errors.append(f"`{cp.name}` references attachment outside `evidence/`: `{rel}`")
                continue
            full = REPO_ROOT / rel
            referenced.add(rel)
            if not full.exists() or not full.is_file():
                errors.append(f"`{cp.name}` references missing attachment: `{rel}`")
            else:
                if full.suffix.lower() not in ALLOWED_IMG_EXTS:
                    errors.append(f"Unsupported attachment extension for `{rel}` (allowed: {sorted(ALLOWED_IMG_EXTS)})")
                if full.stat().st_size > MAX_ATTACHMENT_BYTES:
                    errors.append(f"Attachment `{rel}` exceeds 5 MB limit ({full.stat().st_size} bytes)")

    if evidence_dir.exists():
        for file_path in sorted(evidence_dir.rglob("*")):
            if not file_path.is_file() or file_path.name in {"README.md", ".gitkeep", ".DS_Store"}:
                continue
            rel = str(file_path.relative_to(REPO_ROOT)).replace("\\", "/")
            if file_path.suffix.lower() not in ALLOWED_IMG_EXTS:
                errors.append(f"Disallowed file type in `evidence/`: `{rel}`")
            if file_path.stat().st_size > MAX_ATTACHMENT_BYTES:
                errors.append(f"Attachment `{rel}` exceeds 5 MB limit")
            if rel not in referenced:
                errors.append(f"Unreferenced orphan file in `evidence/`: `{rel}`")

    return errors


def cmd_inspect_pr(args: argparse.Namespace) -> int:
    all_cases = sorted((REPO_ROOT / "cases").glob("*.json"))
    if args.all:
        paths = all_cases
    else:
        paths = [Path(p) for p in args.files if p.endswith(".json") and Path(p).exists()]

    token = os.environ.get("GITHUB_TOKEN")
    has_failure = False
    md_lines = ["<!-- oss-bureau-pr-bot -->", "### OSS Bureau Case & Evidence Verification", ""]
    md_lines.append("| File | Format | Target | Tier | Schema & Hygiene | Remote Check |")
    md_lines.append("| :--- | :--- | :--- | :--- | :--- | :--- |")

    for p in paths:
        rel = str(p.relative_to(REPO_ROOT)) if p.is_absolute() and REPO_ROOT in p.parents else str(p)
        try:
            raw_text = p.read_text(encoding="utf-8")
            data = json.loads(raw_text)
        except Exception as exc:
            has_failure = True
            md_lines.append(f"| `{rel}` | invalid | - | - | ❌ JSON error: {exc} | - |")
            continue

        shortlinks = find_shortlinks(raw_text)
        secrets = find_leaked_secrets(raw_text)
        hygiene_errs: list[str] = []
        if shortlinks:
            hygiene_errs.append(f"shortlink ({shortlinks[0]})")
        if secrets:
            hygiene_errs.append(f"secret ({secrets[0]})")

        if isinstance(data, dict) and "schema_version" in data:
            errs, warns = validate_v1_bundle(data)
            all_errs = errs + hygiene_errs
            if all_errs:
                has_failure = True
                md_lines.append(
                    f"| `{rel}` | `v1.0.0` | `{data.get('target', {}).get('name', '?')}` | - | ❌ {'; '.join(all_errs[:2])} | skipped |"
                )
                continue
            tier, _ = evaluate_tier(data)
            meta = TIER_META[tier]
            remote = verify_remote_evidence(data, token=token, skip_network=args.no_network)
            r_errs = remote.get("errors") or []
            if r_errs:
                has_failure = True
                r_cell = "❌ " + "; ".join(r_errs)
            elif remote.get("skipped"):
                r_cell = "skipped"
            else:
                r_cell = "✅ verified"
            warn_note = f" ({len(warns)} warn)" if warns else ""
            md_lines.append(
                f"| `{rel}` | `v1.0.0` | `{data['target']['name']}` | {meta['emoji']} {meta['en']} | ✅ valid{warn_note} | {r_cell} |"
            )
        elif isinstance(data, dict) and "caseId" in data:
            errs = validate_official_dossier(data) + hygiene_errs
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

    ev_errors = verify_evidence_accounting(all_cases)
    if ev_errors:
        has_failure = True
        md_lines.extend(["", "#### ❌ Evidence Attachment Accounting Errors"])
        for e in ev_errors:
            md_lines.append(f"- {e}")
    else:
        md_lines.extend(["", "✅ **Evidence attachment accounting**: 0 missing files, 0 orphan files, 0 shortlinks, 0 secrets."])

    summary = "\n".join(md_lines) + "\n"
    if args.out_md:
        Path(args.out_md).write_text(summary, encoding="utf-8")
    print(summary)
    return 1 if has_failure else 0


def download_issue_attachments(
    images: list[dict[str, str]],
    case_id: str,
    token: str | None,
) -> list[dict[str, str]]:
    """Download validated image attachments from an approved Issue into evidence/<case_id>/."""
    archived_attachments: list[dict[str, str]] = []
    if not images:
        return archived_attachments

    dest_dir = REPO_ROOT / "evidence" / case_id
    for idx, img in enumerate(images[:8], start=1):
        url = img["url"]
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != "https" or not any(
            parsed.netloc == host or parsed.netloc.endswith(f".{host}")
            for host in ALLOWED_ISSUE_ATTACHMENT_HOSTS
        ):
            print(f"WARN: Skipping non-GitHub attachment host: {url}", file=sys.stderr)
            continue

        headers = {"User-Agent": "oss-bureau-bot/1.1"}
        if token and "github" in parsed.netloc:
            headers["Authorization"] = f"Bearer {token}"
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                ctype = (resp.headers.get("Content-Type") or "").split(";")[0].strip().lower()
                ext = ALLOWED_IMG_CONTENT_TYPES.get(ctype)
                if not ext:
                    url_ext = Path(parsed.path).suffix.lower()
                    ext = url_ext if url_ext in ALLOWED_IMG_EXTS else None
                if not ext:
                    print(f"WARN: Skipping unsupported attachment content-type '{ctype}' ({url})", file=sys.stderr)
                    continue
                payload = resp.read(MAX_ATTACHMENT_BYTES + 1)
                if len(payload) > MAX_ATTACHMENT_BYTES or len(payload) == 0:
                    print(f"WARN: Skipping oversized/empty attachment ({len(payload)} bytes)", file=sys.stderr)
                    continue
                dest_dir.mkdir(parents=True, exist_ok=True)
                filename = f"{idx:02d}{ext}"
                out_file = dest_dir / filename
                out_file.write_bytes(payload)
                rel_path = f"evidence/{case_id}/{filename}"
                archived_attachments.append(
                    {
                        "path": rel_path,
                        "caption": img.get("caption") or f"Receipt {idx}",
                        "sourceUrl": url,
                    }
                )
        except Exception as exc:
            print(f"WARN: Failed to archive attachment {url}: {exc}", file=sys.stderr)

    return archived_attachments


def cmd_archive_issue(args: argparse.Namespace) -> int:
    event = json.loads(Path(args.event_path).read_text(encoding="utf-8"))
    issue = event.get("issue") or {}
    issue_number = issue.get("number")
    issue_url = issue.get("html_url")
    submitted_by = (issue.get("user") or {}).get("login", "community")
    body = issue.get("body") or ""

    if find_shortlinks(body) or find_leaked_secrets(body):
        print("ERROR: Hygiene check failed (shortlinks or secrets present).", file=sys.stderr)
        return 1

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

    images = extract_issue_images(body)
    archived_attachments = (
        [] if args.no_network else download_issue_attachments(images, case_id, token)
    )

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
        "attachments": archived_attachments,
        "archived_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(archived, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    rel_path = f"cases/{filename}"
    print(f"Archived {target_name} -> {rel_path} (tier={tier}, attachments={len(archived_attachments)})")
    gh_out = os.environ.get("GITHUB_OUTPUT")
    if gh_out:
        with open(gh_out, "a", encoding="utf-8") as fh:
            fh.write(f"file_path={rel_path}\n")
            fh.write(f"evidence_dir=evidence/{case_id}\n")
            fh.write(f"attachments_count={len(archived_attachments)}\n")
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
            images = extract_issue_images(body)

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
                "attachmentsCount": len(images),
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


def cmd_export_ax(args: argparse.Namespace) -> int:
    """Export machine-readable static AX endpoints and copy evidence/ images into web/public/."""
    public_dir = Path(args.out_dir)
    schema_out = public_dir / "schema" / "case-bundle.v1.json"
    registry_out = public_dir / "registry.json"
    llms_out = public_dir / "llms.txt"

    public_dir.mkdir(parents=True, exist_ok=True)
    schema_out.parent.mkdir(parents=True, exist_ok=True)

    schema_src = REPO_ROOT / "skills" / "oss-audit" / "references" / "case-schema.json"
    if schema_src.exists():
        schema_out.write_text(schema_src.read_text(encoding="utf-8"), encoding="utf-8")

    # Sync evidence/ images into web/public/evidence/
    src_evidence = REPO_ROOT / "evidence"
    dst_evidence = public_dir / "evidence"
    if dst_evidence.exists():
        shutil.rmtree(dst_evidence)
    if src_evidence.exists():
        for file_path in src_evidence.rglob("*"):
            if file_path.is_file() and file_path.suffix.lower() in ALLOWED_IMG_EXTS:
                rel = file_path.relative_to(src_evidence)
                target = dst_evidence / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(file_path, target)

    cases_list: list[dict[str, Any]] = []
    for p in sorted((REPO_ROOT / "cases").glob("*.json")):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        if isinstance(data, dict) and "schema_version" in data:
            tier, _ = evaluate_tier(data)
            meta = data.get("bureau_meta") or {}
            cases_list.append(
                {
                    "caseId": meta.get("case_id") or data.get("case_id") or p.stem,
                    "name": data["target"]["name"],
                    "repoUrl": data["target"].get("repo_url"),
                    "commitHash": data["target"].get("commit_hash"),
                    "tier": meta.get("tier") or tier,
                    "status": meta.get("status") or "VERIFIED",
                    "defaultTelemetry": data["verdict"]["default_telemetry"],
                    "doNotTrack": meta.get("do_not_track", "NA"),
                    "crossToolAccess": data["verdict"]["cross_tool_access"],
                    "promiseVsReality": data["verdict"]["promise_vs_reality"],
                    "stars": meta.get("stars"),
                    "summary": data["verdict"]["one_liner"],
                    "auditorTool": data.get("auditor_tool"),
                    "evidenceIssueUrl": meta.get("evidence_issue_url"),
                    "attachments": meta.get("attachments") or [],
                    "sourceFile": f"cases/{p.name}",
                }
            )
        elif isinstance(data, dict) and "caseId" in data:
            one_liner = data.get("oneLiner")
            cases_list.append(
                {
                    "caseId": data["caseId"],
                    "name": data["name"],
                    "repoUrl": data.get("repoUrl"),
                    "commitHash": data.get("commitHash"),
                    "tier": data["tier"],
                    "status": data.get("status"),
                    "defaultTelemetry": data.get("defaultTelemetry"),
                    "doNotTrack": data.get("doNotTrack"),
                    "crossToolAccess": data.get("crossToolAccess"),
                    "promiseVsReality": data.get("promiseVsReality"),
                    "stars": data.get("stars"),
                    "summary": one_liner.get("en") if isinstance(one_liner, dict) else one_liner,
                    "auditorTool": data.get("auditorTool", "oss-audit v1.0.0"),
                    "evidenceIssueUrl": data.get("evidenceIssueUrl"),
                    "attachments": data.get("attachments") or [],
                    "sourceFile": f"cases/{p.name}",
                }
            )

    pending_issues: list[dict[str, Any]] = []
    issues_file = REPO_ROOT / "web" / "src" / "data" / "communityIssues.json"
    if issues_file.exists():
        try:
            snap = json.loads(issues_file.read_text(encoding="utf-8"))
            pending_issues = [
                {k: v for k, v in item.items() if k != "bundle"}
                for item in (snap.get("issues") or [])
            ]
        except Exception:
            pass

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    registry_payload = {
        "schema_version": "1.0.0",
        "generated_at": now_iso,
        "repo": "https://github.com/edison-land/oss-bureau",
        "site": "https://edison-land.github.io/oss-bureau/",
        "tier_rules": {
            "blacklist": [
                "cross_tool_access == true",
                "promise_vs_reality == DIRECT_CONTRADICTION",
                "default_telemetry == FORCED",
                "risk_level in [HIGH, CRITICAL]",
            ],
            "watchlist": [
                "default_telemetry in [OPT_OUT_HARD, OPT_OUT_EASY]",
                "promise_vs_reality == PARTIAL_MISMATCH",
                "risk_level == MEDIUM",
            ],
            "cleared": [
                "default_telemetry in [NONE, OPT_IN]",
                "cross_tool_access == false",
                "risk_level in [CLEAN, LOW]",
            ],
        },
        "cases": cases_list,
        "pending_issues": pending_issues,
    }
    registry_out.write_text(json.dumps(registry_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    llms_txt = """# oss-bureau

Open-source privacy & telemetry registry backed by public source code, exact commit hashes, GitHub Issues, archived evidence screenshots, and pull requests.

## Machine-Readable Endpoints

- Registry JSON (all archived cases + pending issues): https://edison-land.github.io/oss-bureau/registry.json
- Case Bundle Schema v1.0.0: https://edison-land.github.io/oss-bureau/schema/case-bundle.v1.json
- Source Repository: https://github.com/edison-land/oss-bureau
- Case Files: https://github.com/edison-land/oss-bureau/tree/main/cases
- Archived Evidence Attachments: https://github.com/edison-land/oss-bureau/tree/main/evidence

## Install Skill

```bash
npx skills add edison-land/oss-bureau
```

## Submit Evidence & Attachments (Any Skill or Agent)

1. Emit a JSON object conforming to `schema/case-bundle.v1.json` with canonical `https://` URLs (no shortlinks), exact `commit_hash`, `file_path`, `line_start`, `line_end`, and verbatim `code_snippet`.
2. Open a Case Submission Issue (and optionally attach PNG/JPG/WebP screenshots): https://github.com/edison-land/oss-bureau/issues/new?template=case-submission.yml
3. Or open a Pull Request adding `cases/<slug>.json` and `evidence/<case-id>/*.png`.
4. CI validates schema, blocks shortlinks and leaked secrets, verifies target repo/commit/file paths & snippet lines via GitHub API, enforces 100% attachment accounting, and classifies tier deterministically (`blacklist`, `watchlist`, `cleared`).
"""
    llms_out.write_text(llms_txt, encoding="utf-8")
    print(f"Exported AX endpoints ({len(cases_list)} cases, {len(pending_issues)} issues) -> {public_dir}")
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

    p_ax = sub.add_parser("export-ax")
    p_ax.add_argument("--out-dir", default=str(REPO_ROOT / "web" / "public"))
    p_ax.set_defaults(func=cmd_export_ax)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
