#!/usr/bin/env python3
"""
OSS Bureau — Repository Static Pre-Scanner (Zero External Dependencies)

Fast, deterministic first-pass scanner for open-source repositories.
Detects telemetry/analytics SDKs & endpoints, cross-tool sensitive file access,
privacy/telemetry promises in docs, supply-chain hooks, and security red flags.

Output is designed to be verified by an AI auditor (or human reviewer) to
eliminate false positives and produce exact, line-cited evidence.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCANNER_VERSION = "1.0.0"

IGNORED_DIRS = {
    ".git",
    ".hg",
    ".svn",
    "node_modules",
    "dist",
    "build",
    "out",
    ".next",
    ".nuxt",
    ".svelte-kit",
    ".turbo",
    ".cache",
    ".parcel-cache",
    ".venv",
    "venv",
    "env",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "target",
    "vendor",
    "coverage",
    ".idea",
    ".vscode",
    "Pods",
    "DerivedData",
    ".gradle",
}

IGNORED_FILENAMES = {
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lockb",
    "bun.lock",
    "Cargo.lock",
    "poetry.lock",
    "uv.lock",
    "Pipfile.lock",
    "composer.lock",
    "Gemfile.lock",
    "go.sum",
    "flake.lock",
}

BINARY_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp", ".tiff", ".psd",
    ".mp3", ".mp4", ".wav", ".mov", ".avi", ".mkv", ".webm", ".ogg", ".flac",
    ".zip", ".tar", ".gz", ".bz2", ".xz", ".7z", ".rar", ".jar", ".war",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".woff", ".woff2", ".ttf", ".otf", ".eot",
    ".exe", ".dll", ".so", ".dylib", ".bin", ".o", ".a", ".pyc", ".pyo",
    ".wasm", ".sqlite", ".db", ".dmg", ".pkg", ".deb", ".rpm",
}

MAX_FILE_BYTES = 512 * 1024  # 512 KB
MAX_AVG_LINE_LEN = 500       # Skip minified single-line bundles

KNOWN_TELEMETRY_PACKAGES = {
    "posthog-js", "posthog-node", "posthog", "@posthog/core",
    "@sentry/node", "@sentry/browser", "@sentry/react", "@sentry/nextjs",
    "@sentry/electron", "@sentry/tracing", "sentry-sdk", "sentry",
    "mixpanel", "mixpanel-browser",
    "@segment/analytics-next", "@segment/analytics-node", "analytics-node",
    "@amplitude/analytics-browser", "@amplitude/analytics-node", "amplitude-js",
    "@datadog/browser-rum", "@datadog/browser-logs", "dd-trace",
    "react-ga", "react-ga4", "@vercel/analytics", "plausible-tracker",
    "umami", "telemetrydeck", "@telemetrydeck/sdk",
    "statsig-js", "statsig-node", "launchdarkly-js-client-sdk", "launchdarkly-node-server-sdk",
    "@bugsnag/js", "rollbar", "scarf-js", "@scarf/scarf",
    "node-machine-id", "machine-id",
    "keytar",
}


@dataclass
class Rule:
    id: str
    category: str          # telemetry | sensitive_access | supply_chain | security | promises
    severity_hint: str     # CRITICAL | HIGH | MEDIUM | LOW | INFO
    title: str
    pattern: re.Pattern[str]
    docs_only: bool = False
    source_only: bool = False
    redact_match: bool = False


def _rx(pat: str, ignore_case: bool = True) -> re.Pattern[str]:
    flags = re.IGNORECASE if ignore_case else 0
    return re.compile(pat, flags)


RULES: list[Rule] = [
    # --- 1. Telemetry & Analytics ---
    Rule(
        id="TEL-SDK-ENDPOINT",
        category="telemetry",
        severity_hint="MEDIUM",
        title="Known telemetry/analytics SDK or endpoint",
        pattern=_rx(
            r"\b(posthog|mixpanel|segment\.io|api\.segment\.io|amplitude\.com|"
            r"telemetrydeck|sentry\.io|ingest\.sentry\.io|datadoghq\.com|"
            r"google-analytics\.com|googletagmanager\.com|plausible\.io|"
            r"clarity\.ms|scarf\.sh|statsigapi\.net|api\.honeycomb\.io|"
            r"heapanalytics\.com|bugsnag\.com|rollbar\.com)\b"
        ),
        source_only=True,
    ),
    Rule(
        id="TEL-CUSTOM-TRACK",
        category="telemetry",
        severity_hint="LOW",
        title="Telemetry or event tracking function/endpoint",
        pattern=_rx(
            r"\b(sendTelemetry|reportTelemetry|trackEvent|captureEvent|"
            r"posthog\.capture|sentry\.init|sentry\.capture|navigator\.sendBeacon|"
            r"analytics\.track|telemetryEndpoint|TELEMETRY_URL|ANALYTICS_ENDPOINT)\b"
        ),
        source_only=True,
    ),
    Rule(
        id="TEL-TOGGLE",
        category="telemetry",
        severity_hint="INFO",
        title="Telemetry opt-in/opt-out toggle or environment check",
        pattern=_rx(
            r"\b(DO_NOT_TRACK|TELEMETRY_DISABLED|DISABLE_TELEMETRY|NO_TELEMETRY|"
            r"ENABLE_TELEMETRY|OPT_OUT_TELEMETRY|telemetryEnabled|disableTelemetry|"
            r"optOutTelemetry|optInTelemetry)\b"
        ),
        source_only=True,
    ),

    # --- 2. Cross-Tool & Sensitive Local Access ---
    Rule(
        id="SENS-AI-TOOL-CREDS",
        category="sensitive_access",
        severity_hint="HIGH",
        title="Reference to another AI coding tool's config/auth directory",
        pattern=_rx(
            r"(['\"`~\/\\])(\.claude|\.codex|\.cursor|\.gemini|\.windsurf|"
            r"\.copilot|\.aider|\.continue|\.opencode|\.codeium|\.t3)\b"
        ),
        source_only=True,
    ),
    Rule(
        id="SENS-SYSTEM-CREDS",
        category="sensitive_access",
        severity_hint="CRITICAL",
        title="Reference to sensitive OS/developer credential path",
        pattern=_rx(
            r"(['\"`~\/\\])(\.ssh|\.aws|\.kube|\.gnupg|\.npmrc|\.pypirc|"
            r"\.netrc|\.git-credentials|\.docker/config\.json|id_rsa|id_ed25519)\b"
        ),
        source_only=True,
    ),
    Rule(
        id="SENS-KEYCHAIN-BROWSER",
        category="sensitive_access",
        severity_hint="HIGH",
        title="Keychain, browser credential DB, or clipboard access",
        pattern=_rx(
            r"\b(find-generic-password|find-internet-password|keytar|"
            r"Login Data|Web Data|Local State|Cookies\.binarycookies|"
            r"Security\.framework|SecKeychainFindGenericPassword|pbpaste)\b"
        ),
        source_only=True,
    ),
    Rule(
        id="SENS-FINGERPRINT",
        category="sensitive_access",
        severity_hint="MEDIUM",
        title="Machine/hardware fingerprinting signal",
        pattern=_rx(
            r"\b(IOPlatformUUID|IOPlatformSerialNumber|machine-id|"
            r"node-machine-id|machineIdSync|MachineGuid|getmac|"
            r"system_profiler\s+SPHardwareDataType|wmic\s+csproduct)\b"
        ),
        source_only=True,
    ),

    # --- 3. Supply Chain & Obfuscation ---
    Rule(
        id="SUP-PIPE-SHELL",
        category="supply_chain",
        severity_hint="HIGH",
        title="Remote script piped directly to shell",
        pattern=_rx(r"\b(curl|wget)\b[^|\n]{0,160}\|\s*(ba|z|da)?sh\b"),
        source_only=True,
    ),
    Rule(
        id="SUP-DYNAMIC-EXEC",
        category="supply_chain",
        severity_hint="MEDIUM",
        title="Dynamic code execution or encoded payload execution",
        pattern=_rx(
            r"(\beval\s*\(|\bnew\s+Function\s*\(|exec\s*\(\s*base64|"
            r"Buffer\.from\([^)]+['\"]base64['\"]\)|atob\s*\()"
        ),
        source_only=True,
    ),

    # --- 4. Security Red Flags ---
    Rule(
        id="SEC-TLS-DISABLED",
        category="security",
        severity_hint="MEDIUM",
        title="TLS certificate verification disabled",
        pattern=_rx(
            r"(NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['\"]?0|"
            r"rejectUnauthorized\s*:\s*false|"
            r"verify\s*=\s*False|"
            r"InsecureSkipVerify\s*:\s*true)"
        ),
        source_only=True,
    ),
    Rule(
        id="SEC-SECRET-PATTERN",
        category="security",
        severity_hint="CRITICAL",
        title="Potential hardcoded secret or private key",
        pattern=_rx(
            r"(AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|"
            r"sk-ant-[A-Za-z0-9_-]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|"
            r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----)",
            ignore_case=False,
        ),
        source_only=True,
        redact_match=True,
    ),
    Rule(
        id="SEC-SHELL-TRUE",
        category="security",
        severity_hint="MEDIUM",
        title="Subprocess execution with shell=True",
        pattern=_rx(r"\bsubprocess\.\w+\([^)]*shell\s*=\s*True"),
        source_only=True,
    ),
    Rule(
        id="SEC-BIND-ALL",
        category="security",
        severity_hint="LOW",
        title="Server listening on all interfaces (0.0.0.0)",
        pattern=_rx(r"(['\"])0\.0\.0\.0\1"),
        source_only=True,
    ),

    # --- 5. Privacy / Telemetry Promises in Docs & Landing Pages ---
    Rule(
        id="PROMISE-PRIVACY",
        category="promises",
        severity_hint="INFO",
        title="Explicit privacy, local-only, or zero-telemetry claim",
        pattern=_rx(
            r"(no telemetry|zero telemetry|without telemetry|never collect|"
            r"do not collect|don't collect|unless you opt[\s-]?in|opt[\s-]?in only|"
            r"100%\s*local|local[\s-]?only|never leaves your|no tracking|"
            r"zero tracking|privacy[\s-]?first|full stop|"
            r"零遥测|无遥测|不收集任何|不会收集|纯本地|完全本地|不上报)"
        ),
        docs_only=True,
    ),
]


def classify_file_role(rel_path: str) -> str:
    lower = rel_path.lower()
    parts = Path(lower).parts
    name = Path(lower).name
    suffix = Path(lower).suffix

    if any(p in {"test", "tests", "__tests__", "spec", "specs", "fixtures", "__mocks__", "e2e"} for p in parts):
        return "test"
    if re.search(r"(\.test\.|\.spec\.|_test\.go$|_test\.py$|^test_.*\.py$)", name):
        return "test"
    if any(p in {"example", "examples", "demo", "demos", "samples"} for p in parts):
        return "example"
    if suffix in {".md", ".mdx", ".rst", ".txt"} or name in {"readme", "privacy", "security", "license"}:
        return "docs"
    if any(p in {"docs", "doc", "website", "landing", "marketing"} for p in parts) and suffix in {".html", ".tsx", ".jsx", ".astro", ".vue", ".svelte"}:
        # Landing pages often contain both promises and analytics scripts
        return "docs_or_web"
    if name in {"package.json", "pyproject.toml", "setup.py", "setup.cfg", "cargo.toml", "go.mod", "dockerfile", "makefile"} or suffix in {".json", ".yaml", ".yml", ".toml", ".ini", ".env"}:
        return "config"
    return "source"


def is_text_and_reasonable(path: Path) -> bool:
    if path.name in IGNORED_FILENAMES:
        return False
    if path.suffix.lower() in BINARY_EXTENSIONS:
        return False
    try:
        size = path.stat().st_size
    except OSError:
        return False
    if size == 0 or size > MAX_FILE_BYTES:
        return False
    try:
        with path.open("rb") as f:
            head = f.read(4096)
        if b"\x00" in head:
            return False
    except OSError:
        return False
    return True


def normalize_github_url(remote_url: str | None) -> str | None:
    if not remote_url:
        return None
    u = remote_url.strip()
    m = re.match(r"^git@github\.com:([^/]+/[^/]+?)(?:\.git)?$", u)
    if m:
        return f"https://github.com/{m.group(1)}"
    m = re.match(r"^https?://github\.com/([^/]+/[^/]+?)(?:\.git)?/?$", u)
    if m:
        return f"https://github.com/{m.group(1)}"
    return u


def run_git(repo_dir: Path, args: list[str]) -> str | None:
    try:
        proc = subprocess.run(
            ["git", *args],
            cwd=str(repo_dir),
            capture_output=True,
            text=True,
            timeout=15,
        )
        if proc.returncode == 0:
            return proc.stdout.strip()
    except Exception:
        pass
    return None


def collect_git_metadata(repo_dir: Path, original_target: str) -> dict[str, Any]:
    remote = run_git(repo_dir, ["config", "--get", "remote.origin.url"])
    commit_hash = run_git(repo_dir, ["rev-parse", "HEAD"])
    branch = run_git(repo_dir, ["rev-parse", "--abbrev-ref", "HEAD"])
    commit_date = run_git(repo_dir, ["show", "-s", "--format=%cI", "HEAD"])
    repo_url = normalize_github_url(remote) or (
        normalize_github_url(original_target)
        if original_target.startswith(("http://", "https://", "git@"))
        else None
    )
    name = repo_dir.name
    if repo_url and "github.com/" in repo_url:
        name = repo_url.rstrip("/").split("github.com/", 1)[1]
    return {
        "name": name,
        "repo_url": repo_url,
        "commit_hash": commit_hash,
        "branch": branch,
        "commit_date": commit_date,
    }


def make_permalink(repo_url: str | None, commit_hash: str | None, rel_path: str, line: int) -> str | None:
    if repo_url and commit_hash and "github.com/" in repo_url:
        return f"{repo_url.rstrip('/')}/blob/{commit_hash}/{rel_path}#L{line}"
    return None


def redact_line(line: str, pattern: re.Pattern[str]) -> str:
    return pattern.sub(lambda m: m.group(0)[:6] + "***REDACTED***", line)


def scan_package_manifests(repo_dir: Path, git_meta: dict[str, Any]) -> list[dict[str, Any]]:
    hits: list[dict[str, Any]] = []
    for root, dirs, files in os.walk(repo_dir):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
        for fname in files:
            fpath = Path(root) / fname
            rel_path = fpath.relative_to(repo_dir).as_posix()
            role = classify_file_role(rel_path)

            if fname == "package.json":
                try:
                    raw = fpath.read_text(encoding="utf-8", errors="replace")
                    data = json.loads(raw)
                except Exception:
                    continue
                if not isinstance(data, dict):
                    continue

                # Check lifecycle hooks
                scripts = data.get("scripts")
                if isinstance(scripts, dict):
                    for hook in ("preinstall", "install", "postinstall", "preuninstall", "postuninstall"):
                        if hook in scripts and isinstance(scripts[hook], str):
                            line_no = find_key_line(raw, f'"{hook}"')
                            hits.append({
                                "rule_id": "SUP-NPM-HOOK",
                                "category": "supply_chain",
                                "severity_hint": "HIGH",
                                "title": f"npm lifecycle hook '{hook}' in package.json",
                                "file_path": rel_path,
                                "file_role": role,
                                "line": line_no,
                                "snippet": f'"{hook}": "{scripts[hook][:240]}"',
                                "permalink": make_permalink(git_meta["repo_url"], git_meta["commit_hash"], rel_path, line_no),
                            })

                # Check telemetry/keychain dependencies
                for dep_section in ("dependencies", "optionalDependencies"):
                    deps = data.get(dep_section)
                    if not isinstance(deps, dict):
                        continue
                    for pkg_name, ver in deps.items():
                        if pkg_name.lower() in KNOWN_TELEMETRY_PACKAGES:
                            line_no = find_key_line(raw, f'"{pkg_name}"')
                            cat = "sensitive_access" if pkg_name.lower() in {"keytar", "node-machine-id", "machine-id"} else "telemetry"
                            hits.append({
                                "rule_id": "TEL-DEPENDENCY",
                                "category": cat,
                                "severity_hint": "MEDIUM",
                                "title": f"Telemetry/fingerprint/keychain dependency '{pkg_name}' in {dep_section}",
                                "file_path": rel_path,
                                "file_role": role,
                                "line": line_no,
                                "snippet": f'"{pkg_name}": "{ver}"',
                                "permalink": make_permalink(git_meta["repo_url"], git_meta["commit_hash"], rel_path, line_no),
                            })

            elif fname in {"pyproject.toml", "requirements.txt", "Cargo.toml", "go.mod"}:
                try:
                    lines = fpath.read_text(encoding="utf-8", errors="replace").splitlines()
                except Exception:
                    continue
                dep_rx = _rx(r"\b(posthog|sentry-sdk|sentry|mixpanel|amplitude|datadog|ddtrace|keyring|telemetrydeck)\b")
                for idx, line in enumerate(lines, start=1):
                    if dep_rx.search(line):
                        hits.append({
                            "rule_id": "TEL-DEPENDENCY",
                            "category": "sensitive_access" if "keyring" in line.lower() else "telemetry",
                            "severity_hint": "MEDIUM",
                            "title": f"Telemetry or keyring dependency referenced in {fname}",
                            "file_path": rel_path,
                            "file_role": role,
                            "line": idx,
                            "snippet": line.strip()[:240],
                            "permalink": make_permalink(git_meta["repo_url"], git_meta["commit_hash"], rel_path, idx),
                        })
    return hits


def find_key_line(raw: str, needle: str) -> int:
    for idx, line in enumerate(raw.splitlines(), start=1):
        if needle in line:
            return idx
    return 1


def scan_files(
    repo_dir: Path,
    git_meta: dict[str, Any],
    include_tests: bool = False,
    max_hits: int = 300,
) -> dict[str, Any]:
    hits: list[dict[str, Any]] = scan_package_manifests(repo_dir, git_meta)
    scanned_files = 0
    skipped_files = 0
    per_file_rule_counts: dict[tuple[str, str], int] = {}

    for root, dirs, files in os.walk(repo_dir):
        dirs[:] = sorted(d for d in dirs if d not in IGNORED_DIRS)
        for fname in sorted(files):
            fpath = Path(root) / fname
            rel_path = fpath.relative_to(repo_dir).as_posix()
            role = classify_file_role(rel_path)
            if not include_tests and role in {"test", "example"}:
                skipped_files += 1
                continue
            if not is_text_and_reasonable(fpath):
                skipped_files += 1
                continue

            try:
                content = fpath.read_text(encoding="utf-8", errors="replace")
            except OSError:
                skipped_files += 1
                continue

            lines = content.splitlines()
            if not lines:
                continue
            if (len(content) / max(len(lines), 1)) > MAX_AVG_LINE_LEN:
                skipped_files += 1
                continue

            scanned_files += 1
            is_doc = role in {"docs", "docs_or_web"}
            is_src = role in {"source", "config", "docs_or_web", "test", "example"}

            for idx, line in enumerate(lines, start=1):
                if len(line) > 1000:
                    continue
                for rule in RULES:
                    if rule.docs_only and not is_doc:
                        continue
                    if rule.source_only and not is_src:
                        continue
                    if rule.pattern.search(line):
                        key = (rel_path, rule.id)
                        count = per_file_rule_counts.get(key, 0)
                        if count >= 5:
                            continue
                        per_file_rule_counts[key] = count + 1

                        snippet_line = redact_line(line, rule.pattern) if rule.redact_match else line
                        ctx_start = max(0, idx - 2)
                        ctx_end = min(len(lines), idx + 1)
                        context_lines = []
                        for c_idx in range(ctx_start, ctx_end):
                            raw_ctx = lines[c_idx][:240]
                            if rule.redact_match:
                                raw_ctx = redact_line(raw_ctx, rule.pattern)
                            context_lines.append(f"{c_idx + 1}: {raw_ctx}")

                        hits.append({
                            "rule_id": rule.id,
                            "category": rule.category,
                            "severity_hint": rule.severity_hint,
                            "title": rule.title,
                            "file_path": rel_path,
                            "file_role": role,
                            "line": idx,
                            "snippet": snippet_line.strip()[:240],
                            "context": "\n".join(context_lines),
                            "permalink": make_permalink(git_meta["repo_url"], git_meta["commit_hash"], rel_path, idx),
                        })

    # Prioritize: runtime source/config first, then severity
    role_rank = {"source": 0, "config": 1, "docs_or_web": 2, "docs": 3, "example": 4, "test": 5}
    sev_rank = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}
    hits.sort(key=lambda h: (role_rank.get(h["file_role"], 9), sev_rank.get(h["severity_hint"], 9), h["file_path"], h["line"]))

    total_hits = len(hits)
    truncated = total_hits > max_hits
    if truncated:
        hits = hits[:max_hits]

    summary_by_category: dict[str, int] = {}
    for h in hits:
        summary_by_category[h["category"]] = summary_by_category.get(h["category"], 0) + 1

    return {
        "scanner": f"oss-audit/scan_repo.py v{SCANNER_VERSION}",
        "scanned_at": datetime.now(timezone.utc).isoformat(),
        "target": git_meta,
        "stats": {
            "scanned_files": scanned_files,
            "skipped_files": skipped_files,
            "total_hits_before_cap": total_hits,
            "returned_hits": len(hits),
            "truncated": truncated,
            "by_category": summary_by_category,
        },
        "hits": hits,
    }


def trace_git_term(repo_dir: Path, term: str) -> list[dict[str, str]]:
    out = run_git(
        repo_dir,
        ["log", "-S", term, "--reverse", "--max-count=10", "--format=%H|%cI|%an|%s"],
    )
    if not out:
        return []
    commits = []
    for line in out.splitlines():
        parts = line.split("|", 3)
        if len(parts) == 4:
            commits.append({
                "commit": parts[0],
                "date": parts[1],
                "author": parts[2],
                "subject": parts[3],
            })
    return commits


def format_markdown(result: dict[str, Any]) -> str:
    t = result["target"]
    s = result["stats"]
    lines = [
        f"# Pre-Scan Summary: {t['name']}",
        "",
        f"- **Repo URL**: {t.get('repo_url') or 'local'}",
        f"- **Commit**: `{t.get('commit_hash') or 'N/A'}` ({t.get('branch') or 'N/A'})",
        f"- **Scanned Files**: {s['scanned_files']} (skipped {s['skipped_files']})",
        f"- **Candidate Hits**: {s['returned_hits']}" + (" (truncated)" if s["truncated"] else ""),
        f"- **By Category**: {json.dumps(s['by_category'], ensure_ascii=False)}",
        "",
    ]
    if result.get("git_trace"):
        lines.append("## Git History Trace")
        for term, commits in result["git_trace"].items():
            lines.append(f"### Term `{term}`")
            if not commits:
                lines.append("- No commits found (repo may be shallow-cloned with `--depth 1`).")
            for c in commits:
                lines.append(f"- `{c['commit'][:10]}` ({c['date']}) — {c['subject']}")
        lines.append("")

    for cat in ("promises", "sensitive_access", "telemetry", "supply_chain", "security"):
        cat_hits = [h for h in result["hits"] if h["category"] == cat]
        if not cat_hits:
            continue
        lines.append(f"## Category: `{cat}` ({len(cat_hits)})")
        for h in cat_hits:
            loc = f"`{h['file_path']}:{h['line']}`"
            if h.get("permalink"):
                loc = f"[{h['file_path']}:{h['line']}]({h['permalink']})"
            lines.append(f"- **[{h['severity_hint']}] {h['rule_id']}** ({h['file_role']}) — {h['title']} at {loc}")
            lines.append(f"  `{h['snippet']}`")
        lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Zero-dependency static pre-scanner for open-source privacy, telemetry, and security audits.")
    parser.add_argument("target", help="Local directory path or Git repository URL (HTTPS/SSH).")
    parser.add_argument("--format", choices=["json", "markdown"], default="json", help="Output format (default: json).")
    parser.add_argument("--out", help="Write output to file instead of stdout.")
    parser.add_argument("--max-hits", type=int, default=300, help="Maximum candidate hits to return (default: 300).")
    parser.add_argument("--include-tests", action="store_true", help="Include test/example directories in scan.")
    parser.add_argument("--keep-clone", help="Directory path to keep cloned remote repository (for follow-up inspection).")
    parser.add_argument("--full-history", action="store_true", help="Clone full git history instead of --depth 1 (needed for --trace-term on remote URLs).")
    parser.add_argument("--trace-term", action="append", default=[], help="Trace earliest git commits introducing a string (repeatable).")
    args = parser.parse_args()

    is_remote = args.target.startswith(("http://", "https://", "git@"))
    tmp_dir: Path | None = None

    try:
        if is_remote:
            if args.keep_clone:
                repo_dir = Path(args.keep_clone).expanduser().resolve()
                if repo_dir.exists() and any(repo_dir.iterdir()):
                    print(f"Error: --keep-clone target already exists and is non-empty: {repo_dir}", file=sys.stderr)
                    return 2
                repo_dir.parent.mkdir(parents=True, exist_ok=True)
            else:
                tmp_dir = Path(tempfile.mkdtemp(prefix="oss-audit-"))
                repo_dir = tmp_dir / "repo"

            clone_cmd = ["git", "clone", "--quiet"]
            if not args.full_history and not args.trace_term:
                clone_cmd.extend(["--depth", "1"])
            clone_cmd.extend([args.target, str(repo_dir)])

            proc = subprocess.run(clone_cmd, capture_output=True, text=True, timeout=180)
            if proc.returncode != 0:
                print(f"Error cloning repository: {proc.stderr.strip()}", file=sys.stderr)
                return 1
        else:
            repo_dir = Path(args.target).expanduser().resolve()
            if not repo_dir.exists() or not repo_dir.is_dir():
                print(f"Error: target path does not exist or is not a directory: {repo_dir}", file=sys.stderr)
                return 2

        git_meta = collect_git_metadata(repo_dir, args.target)
        result = scan_files(repo_dir, git_meta, include_tests=args.include_tests, max_hits=args.max_hits)

        if args.trace_term:
            result["git_trace"] = {term: trace_git_term(repo_dir, term) for term in args.trace_term}

        output = json.dumps(result, indent=2, ensure_ascii=False) if args.format == "json" else format_markdown(result)
        if args.out:
            out_path = Path(args.out).expanduser().resolve()
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_text(output, encoding="utf-8")
            print(f"Wrote scan output to {out_path}", file=sys.stderr)
        else:
            print(output)
        return 0
    finally:
        if tmp_dir and tmp_dir.exists():
            shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
