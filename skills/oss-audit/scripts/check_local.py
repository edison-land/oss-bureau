#!/usr/bin/env python3
"""
OSS Bureau — Strictly Read-Only Local Machine Telemetry & AI Tool Check

PRIVACY GUARANTEE:
- 100% read-only; makes zero network requests and modifies zero files.
- NEVER reads or prints API keys, auth tokens, cookies, SSH keys, or transcripts.
- Checks ONLY:
  1. Presence of well-known AI coding tools / dev CLIs & config directories.
  2. Explicitly allowlisted telemetry opt-out environment variables.
  3. Explicitly allowlisted non-secret telemetry keys in editor/tool config files.
  4. Configured MCP server names and command/host metadata (env/headers stripped).
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

CHECKER_VERSION = "1.0.0"

# Explicit allowlist of non-secret telemetry opt-out environment variables.
# Arbitrary environment variables are NEVER inspected or printed.
TELEMETRY_ENV_ALLOWLIST: list[dict[str, str]] = [
    {"var": "DO_NOT_TRACK", "recommended": "1", "scope": "Universal (Console Do Not Track standard)"},
    {"var": "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "recommended": "1", "scope": "Claude Code"},
    {"var": "DISABLE_TELEMETRY", "recommended": "1", "scope": "Claude Code / general CLI"},
    {"var": "DISABLE_ERROR_REPORTING", "recommended": "1", "scope": "Claude Code / general CLI"},
    {"var": "HOMEBREW_NO_ANALYTICS", "recommended": "1", "scope": "Homebrew"},
    {"var": "NEXT_TELEMETRY_DISABLED", "recommended": "1", "scope": "Next.js"},
    {"var": "TURBO_TELEMETRY_DISABLED", "recommended": "1", "scope": "Turborepo"},
    {"var": "ASTRO_TELEMETRY_DISABLED", "recommended": "1", "scope": "Astro"},
    {"var": "NUXT_TELEMETRY_DISABLED", "recommended": "1", "scope": "Nuxt"},
    {"var": "STORYBOOK_DISABLE_TELEMETRY", "recommended": "1", "scope": "Storybook"},
    {"var": "WRANGLER_SEND_METRICS", "recommended": "false", "scope": "Cloudflare Wrangler"},
    {"var": "HF_HUB_DISABLE_TELEMETRY", "recommended": "1", "scope": "Hugging Face Hub"},
    {"var": "SCARF_NO_ANALYTICS", "recommended": "true", "scope": "Scarf npm/Python analytics"},
    {"var": "POSTHOG_DISABLED", "recommended": "true", "scope": "PostHog-enabled tools"},
    {"var": "DOTNET_CLI_TELEMETRY_OPTOUT", "recommended": "1", "scope": ".NET CLI"},
    {"var": "SAM_CLI_TELEMETRY", "recommended": "0", "scope": "AWS SAM CLI"},
    {"var": "POWERSHELL_TELEMETRY_OPTOUT", "recommended": "1", "scope": "PowerShell"},
    {"var": "GATSBY_TELEMETRY_DISABLED", "recommended": "1", "scope": "Gatsby"},
    {"var": "EXPO_NO_TELEMETRY", "recommended": "1", "scope": "Expo CLI"},
    {"var": "VITE_TELEMETRY_DISABLED", "recommended": "1", "scope": "Vite ecosystem"},
]

ALLOWED_SAFE_FLAG_VALUES = {"0", "1", "true", "false", "yes", "no", "off", "on", "all", "error", "crash", "none"}

# Known AI coding tools & dev CLIs (existence check ONLY — auth files are NEVER opened).
TOOL_SIGNATURES: list[dict[str, Any]] = [
    {
        "id": "claude-code",
        "name": "Claude Code",
        "binaries": ["claude"],
        "dirs": ["~/.claude"],
        "opt_out_envs": ["CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "DISABLE_TELEMETRY", "DISABLE_ERROR_REPORTING"],
    },
    {
        "id": "codex",
        "name": "OpenAI Codex CLI",
        "binaries": ["codex"],
        "dirs": ["~/.codex"],
        "opt_out_envs": ["DO_NOT_TRACK"],
    },
    {
        "id": "antigravity-gemini",
        "name": "Antigravity / Gemini CLI",
        "binaries": ["agy", "gemini"],
        "dirs": ["~/.gemini"],
        "opt_out_envs": ["DO_NOT_TRACK"],
    },
    {
        "id": "cursor",
        "name": "Cursor",
        "binaries": ["cursor"],
        "dirs": ["~/.cursor", "~/Library/Application Support/Cursor", "~/.config/Cursor"],
        "opt_out_envs": ["DO_NOT_TRACK"],
    },
    {
        "id": "vscode",
        "name": "VS Code",
        "binaries": ["code"],
        "dirs": ["~/Library/Application Support/Code", "~/.config/Code"],
        "opt_out_envs": ["DO_NOT_TRACK"],
    },
    {
        "id": "windsurf",
        "name": "Windsurf / Codeium",
        "binaries": ["windsurf"],
        "dirs": ["~/.codeium", "~/Library/Application Support/Windsurf", "~/.config/Windsurf"],
        "opt_out_envs": ["DO_NOT_TRACK"],
    },
    {
        "id": "t3-code",
        "name": "T3 Code",
        "binaries": ["t3", "t3code"],
        "dirs": ["~/.t3", "~/.config/t3", "~/.config/t3code", "~/Library/Application Support/T3 Code"],
        "opt_out_envs": ["DO_NOT_TRACK"],
    },
    {
        "id": "opencode",
        "name": "OpenCode",
        "binaries": ["opencode"],
        "dirs": ["~/.opencode", "~/.config/opencode"],
        "opt_out_envs": ["DO_NOT_TRACK"],
    },
    {
        "id": "aider",
        "name": "Aider",
        "binaries": ["aider"],
        "dirs": ["~/.aider"],
        "opt_out_envs": ["DO_NOT_TRACK"],
    },
    {
        "id": "goose",
        "name": "Goose",
        "binaries": ["goose"],
        "dirs": ["~/.config/goose"],
        "opt_out_envs": ["DO_NOT_TRACK"],
    },
    {
        "id": "continue",
        "name": "Continue",
        "binaries": [],
        "dirs": ["~/.continue"],
        "opt_out_envs": ["DO_NOT_TRACK"],
    },
    {
        "id": "homebrew",
        "name": "Homebrew",
        "binaries": ["brew"],
        "dirs": [],
        "opt_out_envs": ["HOMEBREW_NO_ANALYTICS"],
    },
    {
        "id": "wrangler",
        "name": "Cloudflare Wrangler",
        "binaries": ["wrangler"],
        "dirs": ["~/.wrangler"],
        "opt_out_envs": ["WRANGLER_SEND_METRICS"],
    },
]


def expand(p: str) -> Path:
    return Path(os.path.expanduser(p))


def safe_flag_display(val: str | None) -> str | None:
    if val is None:
        return None
    v = val.strip()
    if v.lower() in ALLOWED_SAFE_FLAG_VALUES:
        return v
    return "<set (non-boolean value redacted)>"


def strip_jsonc_comments(text: str) -> str:
    # Lightweight JSONC cleaner for VS Code / Cursor settings.json
    out = re.sub(r"(?m)^\s*//.*$", "", text)
    out = re.sub(r"/\*.*?\*/", "", out, flags=re.DOTALL)
    out = re.sub(r",\s*([}\]])", r"\1", out)
    return out


def inspect_detected_tools() -> list[dict[str, Any]]:
    detected: list[dict[str, Any]] = []
    for sig in TOOL_SIGNATURES:
        found_bins = [b for b in sig["binaries"] if shutil.which(b)]
        found_dirs = [d for d in sig["dirs"] if expand(d).exists()]
        if found_bins or found_dirs:
            detected.append({
                "id": sig["id"],
                "name": sig["name"],
                "binaries": found_bins,
                "config_dirs_present": found_dirs,
                "recommended_opt_out_envs": sig["opt_out_envs"],
            })
    return detected


def inspect_telemetry_env_vars() -> list[dict[str, Any]]:
    results = []
    for item in TELEMETRY_ENV_ALLOWLIST:
        var = item["var"]
        raw = os.environ.get(var)
        is_set = raw is not None and raw.strip() != ""
        results.append({
            "var": var,
            "scope": item["scope"],
            "is_set": is_set,
            "value": safe_flag_display(raw),
            "recommended": item["recommended"],
        })
    return results


def inspect_safe_editor_configs() -> list[dict[str, Any]]:
    """Read ONLY allowlisted telemetry keys from known editor/tool settings files."""
    checks: list[dict[str, Any]] = []

    # 1. VS Code & Cursor settings.json
    editor_paths = [
        ("VS Code", "~/Library/Application Support/Code/User/settings.json"),
        ("VS Code", "~/.config/Code/User/settings.json"),
        ("Cursor", "~/Library/Application Support/Cursor/User/settings.json"),
        ("Cursor", "~/.config/Cursor/User/settings.json"),
        ("Windsurf", "~/Library/Application Support/Windsurf/User/settings.json"),
    ]
    allow_keys = (
        "telemetry.telemetryLevel",
        "telemetry.enableTelemetry",
        "telemetry.enableCrashReporter",
        "redhat.telemetry.enabled",
    )
    for app_name, raw_path in editor_paths:
        p = expand(raw_path)
        if not p.is_file():
            continue
        try:
            data = json.loads(strip_jsonc_comments(p.read_text(encoding="utf-8", errors="replace")))
        except Exception:
            checks.append({"tool": app_name, "config_file": raw_path, "status": "parse_error", "telemetry_keys": {}})
            continue
        if not isinstance(data, dict):
            continue
        found = {}
        for k in allow_keys:
            if k in data:
                found[k] = data[k] if isinstance(data[k], (bool, str)) and str(data[k]).lower() in ALLOWED_SAFE_FLAG_VALUES else "<redacted>"
        level = str(found.get("telemetry.telemetryLevel", "unset (defaults to 'all')"))
        checks.append({
            "tool": app_name,
            "config_file": raw_path,
            "telemetry_keys": found,
            "assessment": "disabled" if level == "off" else "potentially_enabled_by_default",
        })

    # 2. Claude Code ~/.claude/settings.json (allowlisted env telemetry flags only)
    claude_settings = expand("~/.claude/settings.json")
    if claude_settings.is_file():
        try:
            data = json.loads(claude_settings.read_text(encoding="utf-8", errors="replace"))
            env_obj = data.get("env", {}) if isinstance(data, dict) else {}
            if not isinstance(env_obj, dict):
                env_obj = {}
            claude_allow = (
                "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
                "DISABLE_TELEMETRY",
                "DISABLE_ERROR_REPORTING",
                "DO_NOT_TRACK",
            )
            found = {k: safe_flag_display(str(env_obj[k])) for k in claude_allow if k in env_obj}
            disabled = any(str(found.get(k, "")).lower() in {"1", "true"} for k in claude_allow[:2])
            checks.append({
                "tool": "Claude Code",
                "config_file": "~/.claude/settings.json",
                "telemetry_keys": found,
                "assessment": "disabled" if disabled else "not_explicitly_disabled_in_settings",
            })
        except Exception:
            checks.append({"tool": "Claude Code", "config_file": "~/.claude/settings.json", "status": "parse_error"})

    # 3. Codex ~/.codex/config.toml (strict regex for analytics/otel flags only)
    codex_cfg = expand("~/.codex/config.toml")
    if codex_cfg.is_file():
        try:
            text = codex_cfg.read_text(encoding="utf-8", errors="replace")
            matches = {}
            for key in ("analytics", "log_user_prompt", "telemetry"):
                m = re.search(rf"(?m)^\s*{key}\s*=\s*(true|false)\b", text, re.IGNORECASE)
                if m:
                    matches[key] = m.group(1).lower()
            has_otel = bool(re.search(r"(?m)^\s*\[otel\b", text))
            if has_otel:
                matches["otel_section_present"] = True
            checks.append({
                "tool": "OpenAI Codex CLI",
                "config_file": "~/.codex/config.toml",
                "telemetry_keys": matches,
                "assessment": "configured" if matches else "default_settings",
            })
        except Exception:
            checks.append({"tool": "OpenAI Codex CLI", "config_file": "~/.codex/config.toml", "status": "parse_error"})

    return checks


def sanitize_url_host(url: str) -> str:
    try:
        parsed = urlparse(url)
        if parsed.scheme and parsed.netloc:
            host = parsed.hostname or parsed.netloc
            port = f":{parsed.port}" if parsed.port else ""
            return f"{parsed.scheme}://{host}{port}{parsed.path}"
    except Exception:
        pass
    return "<url>"


def inspect_mcp_inventory() -> list[dict[str, Any]]:
    """List configured MCP server names & transport type ONLY. Strips all env vars, headers, and args."""
    mcp_files = [
        ("Antigravity", "~/.gemini/antigravity/mcp_config.json"),
        ("Cursor", "~/.cursor/mcp.json"),
        ("Claude Desktop", "~/Library/Application Support/Claude/claude_desktop_config.json"),
        ("Claude Code", "~/.claude.json"),
    ]
    inventory: list[dict[str, Any]] = []
    for source, raw_path in mcp_files:
        p = expand(raw_path)
        if not p.is_file():
            continue
        try:
            data = json.loads(p.read_text(encoding="utf-8", errors="replace"))
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        servers = data.get("mcpServers")
        if not isinstance(servers, dict) or not servers:
            continue
        entries = []
        for srv_name, cfg in servers.items():
            if not isinstance(cfg, dict):
                continue
            if "command" in cfg:
                entries.append({
                    "name": srv_name,
                    "transport": "stdio",
                    "command": str(cfg["command"]),
                    "has_env_vars": bool(cfg.get("env")),
                })
            elif "url" in cfg or "serverUrl" in cfg:
                raw_url = str(cfg.get("url") or cfg.get("serverUrl"))
                entries.append({
                    "name": srv_name,
                    "transport": "remote",
                    "endpoint": sanitize_url_host(raw_url),
                    "has_headers": bool(cfg.get("headers")),
                })
            else:
                entries.append({"name": srv_name, "transport": "unknown"})
        inventory.append({
            "source": source,
            "config_file": raw_path,
            "server_count": len(entries),
            "servers": entries,
        })
    return inventory


def build_opt_out_snippet(detected_tools: list[dict[str, Any]], env_checks: list[dict[str, Any]]) -> list[str]:
    already_set = {e["var"] for e in env_checks if e["is_set"]}
    rec_map = {e["var"]: e["recommended"] for e in TELEMETRY_ENV_ALLOWLIST}

    needed: list[str] = ["DO_NOT_TRACK"]
    for tool in detected_tools:
        for var in tool["recommended_opt_out_envs"]:
            if var not in needed:
                needed.append(var)

    # Always include common JS/Python ecosystem opt-outs if unset
    for common in ("NEXT_TELEMETRY_DISABLED", "TURBO_TELEMETRY_DISABLED", "SCARF_NO_ANALYTICS"):
        if common not in needed:
            needed.append(common)

    lines = ["# Add to ~/.zshrc or ~/.bashrc (generated by oss-audit check_local.py)"]
    for var in needed:
        if var in already_set:
            continue
        val = rec_map.get(var, "1")
        lines.append(f'export {var}="{val}"')
    if len(lines) == 1:
        lines.append("# All recommended telemetry opt-out variables for detected tools are already set.")
    return lines


def format_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# Local Machine Privacy & Telemetry Check",
        "",
        f"- **OS**: {report['platform']}",
        f"- **Checked At**: {report['checked_at']}",
        f"- **Privacy Mode**: Strictly read-only, zero network calls, zero secret reads.",
        "",
        f"## 1. Detected AI Tools & Dev CLIs ({len(report['detected_tools'])})",
    ]
    if not report["detected_tools"]:
        lines.append("- None of the known AI coding tool signatures were detected.")
    for t in report["detected_tools"]:
        bins = ", ".join(t["binaries"]) or "none"
        dirs = ", ".join(t["config_dirs_present"]) or "none"
        lines.append(f"- **{t['name']}** — CLI: `{bins}` | Config dirs: `{dirs}`")

    lines.extend(["", "## 2. Editor & Tool Telemetry Configs"])
    if not report["config_checks"]:
        lines.append("- No known editor/tool telemetry settings files found.")
    for c in report["config_checks"]:
        lines.append(f"- **{c['tool']}** (`{c['config_file']}`): `{c.get('assessment', c.get('status'))}` — `{json.dumps(c.get('telemetry_keys', {}), ensure_ascii=False)}`")

    set_envs = [e for e in report["telemetry_env_vars"] if e["is_set"]]
    unset_envs = [e for e in report["telemetry_env_vars"] if not e["is_set"]]
    lines.extend([
        "",
        f"## 3. Shell Telemetry Opt-Out Variables ({len(set_envs)} set / {len(unset_envs)} unset)",
    ])
    if set_envs:
        for e in set_envs:
            lines.append(f"- [SET] `{e['var']}={e['value']}` ({e['scope']})")
    else:
        lines.append("- None of the standard telemetry opt-out environment variables are currently set in this shell.")

    lines.extend(["", "## 4. Configured MCP Servers (Metadata Only)"])
    if not report["mcp_inventory"]:
        lines.append("- No MCP server configurations detected.")
    for m in report["mcp_inventory"]:
        lines.append(f"- **{m['source']}** (`{m['config_file']}`): {m['server_count']} server(s)")
        for s in m["servers"]:
            target = s.get("command") or s.get("endpoint") or ""
            lines.append(f"  - `{s['name']}` ({s['transport']}: `{target}`)")

    lines.extend([
        "",
        "## 5. Recommended Copy-Paste Opt-Out Snippet",
        "```bash",
        *report["recommended_shell_snippet"],
        "```",
    ])
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Strictly read-only local machine telemetry & AI tool check.")
    parser.add_argument("--format", choices=["json", "markdown"], default="json", help="Output format (default: json).")
    parser.add_argument("--out", help="Write output to file instead of stdout.")
    args = parser.parse_args()

    detected_tools = inspect_detected_tools()
    env_checks = inspect_telemetry_env_vars()
    config_checks = inspect_safe_editor_configs()
    mcp_inventory = inspect_mcp_inventory()
    snippet = build_opt_out_snippet(detected_tools, env_checks)

    report = {
        "checker": f"oss-audit/check_local.py v{CHECKER_VERSION}",
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "platform": f"{platform.system()} {platform.release()} ({platform.machine()})",
        "privacy_guarantee": "Read-only local scan; zero network calls; zero secret/token reads.",
        "detected_tools": detected_tools,
        "config_checks": config_checks,
        "telemetry_env_vars": env_checks,
        "mcp_inventory": mcp_inventory,
        "recommended_shell_snippet": snippet,
    }

    output = json.dumps(report, indent=2, ensure_ascii=False) if args.format == "json" else format_markdown(report)
    if args.out:
        out_path = Path(args.out).expanduser().resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(output, encoding="utf-8")
        print(f"Wrote local check report to {out_path}", file=sys.stderr)
    else:
        print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
