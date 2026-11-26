# OSS Bureau 🔍

<div align="center">

**Zero Dependencies · Evidence-First · Read-Only Local Audit · Cross-Agent Skill**

Don't trust "zero telemetry" landing pages. Verify the code and audit your own machine.

[**English**](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

[![GitHub Stars](https://img.shields.io/github/stars/edison-land/oss-bureau?style=flat&color=f97316)](https://github.com/edison-land/oss-bureau/stargazers)
[![License: MIT](https://img.shields.io/badge/license-MIT-3b82f6?style=flat)](LICENSE)
[![Python 3.9+ Stdlib](https://img.shields.io/badge/Runtime-Python%203.9%2B%20Stdlib-22c55e?style=flat&logo=python&logoColor=white)](skills/oss-audit/scripts)
[![Cross-Agent Skill](https://img.shields.io/badge/Skill-Antigravity%20%7C%20Claude%20%7C%20Codex%20%7C%20Cursor-111827?style=flat)](skills/oss-audit/SKILL.md)
[![Case Bundle v1.0.0](https://img.shields.io/badge/Schema-Case%20Bundle%20v1.0.0-6366f1?style=flat)](skills/oss-audit/references/case-schema.json)

</div>

---

## Why OSS Bureau?

Modern developers install dozens of open-source AI coding tools, CLIs, editor extensions, and MCP servers every month. Occasionally, a tool that advertises **"zero telemetry"** or **"local-only"** ships default-on analytics, resists opt-out controls, or quietly inspects local credentials belonging to *other* tools (`~/.claude`, `~/.codex`, `~/.ssh`, `~/.aws`, OS keychains).

**`oss-audit`** turns your AI coding assistant into a disciplined, evidence-first privacy & security auditor. Instead of relying on raw prompt guesswork, it pairs **fast, zero-dependency Python pre-scanners** with a strict **AI verification SOP**—so every finding cites exact files, line numbers, and Git commits.

---

## Core Capabilities

| Capability | What It Does |
| :--- | :--- |
| **Telemetry & Dark-Pattern Detection** | Scans for PostHog, Sentry, Mixpanel, Segment, Amplitude, Scarf, custom tracking endpoints, and verifies whether collection is opt-in, opt-out, or missing `DO_NOT_TRACK` support. |
| **Cross-Tool & Credential Snooping** | Flags reads targeting other tools' config/auth directories (`~/.claude`, `~/.codex`, `~/.cursor`, `~/.gemini`, `~/.ssh`, `~/.aws`, browser profiles, keychains, hardware fingerprints). |
| **Promise vs. Reality Diff** | Extracts explicit privacy claims from `README.md`, `PRIVACY.md`, and docs, then compares them line-by-line against verified runtime code. |
| **Supply-Chain & Security Red Flags** | Inspects npm lifecycle hooks (`preinstall`/`postinstall`), `curl \| sh`, dynamic `eval`/base64 execution, disabled TLS checks, hardcoded secret patterns, and `0.0.0.0` binds. |
| **Git History Forensics** | Traces the earliest commit (`--trace-term`) that introduced suspicious telemetry or cross-tool path access, and distinguishes active issues from patched history. |
| **Read-Only Local Machine Check** | Audits installed AI tools, telemetry opt-out env vars, editor settings, and MCP server metadata on your own computer—then generates a tailored shell opt-out snippet. |
| **Standardized Case Bundles** | Exports both a human-readable **Audit Dossier (Markdown)** and a schema-validated `case-bundle.json` ready for the upcoming **OSS Bureau** community platform. |

---

## Quick Install

### Option 1: `skills` CLI (Recommended)

Works out of the box with Antigravity, Claude Code, Codex, Cursor, and other Agent Skills-compatible tools:

```bash
npx skills add edison-land/oss-bureau
```

### Option 2: Manual Clone & Symlink

```bash
git clone https://github.com/edison-land/oss-bureau.git
cd oss-bureau

# Antigravity (global)
ln -s "$(pwd)/skills/oss-audit" ~/.gemini/config/skills/oss-audit

# Claude Code (global)
ln -s "$(pwd)/skills/oss-audit" ~/.claude/skills/oss-audit

# Codex / shared .agents directory
ln -s "$(pwd)/skills/oss-audit" ~/.agents/skills/oss-audit
```

---

## Usage

### 1. Ask Your AI Agent (Recommended)

Once installed, simply prompt your AI coding agent in natural language:

- **Audit a GitHub repository:**
  > Use `oss-audit` to audit `https://github.com/owner/repo`. Check for default-on telemetry, cross-tool credential reads, supply-chain hooks, and any contradiction with its README claims. Export a validated `case-bundle.json`.
- **Trace when telemetry was introduced:**
  > Audit this local repository and trace which Git commit first introduced `.claude` reads or telemetry endpoints.
- **Check your own machine:**
  > Run `oss-audit` local check on my machine to see which AI tools may have default telemetry enabled, review my MCP servers, and give me an opt-out snippet.

### 2. Run Standalone Scripts Directly (Python 3.9+, Zero Dependencies)

```bash
# Pre-scan a remote GitHub repo or local directory
python3 skills/oss-audit/scripts/scan_repo.py https://github.com/owner/repo --format markdown

# Trace earliest Git commits introducing specific patterns (local repo or with --full-history)
python3 skills/oss-audit/scripts/scan_repo.py /path/to/repo --trace-term ".claude" --trace-term "posthog" --format markdown

# Strictly read-only local machine telemetry & AI tool check
python3 skills/oss-audit/scripts/check_local.py --format markdown

# Validate an exported OSS Bureau case bundle against v1.0.0 schema
python3 skills/oss-audit/scripts/validate_bundle.py path/to/case-bundle.json
```

---

## Privacy & Fair-Play Guarantees

A privacy auditor must hold itself to the highest standard:

- **Zero Network Calls & Strictly Read-Only Local Check**: `check_local.py` never modifies files and never makes outbound requests.
- **Zero Secret Exposure**: It NEVER reads, prints, or transmits `.ssh/*`, `.aws/credentials`, `.env`, API keys, auth tokens, cookies, or chat histories. It inspects only tool presence, an explicit allowlist of telemetry flags, and stripped MCP metadata.
- **No Unverified Accusations**: `SKILL.md` enforces exact file-path, line-number, and commit citations. Test fixtures, comments, dead code, and benign opt-in mechanisms are filtered out before reporting.
- **Facts Over Drama**: Reports focus strictly on public documentation and reproducible code behavior, crediting maintainers whenever issues are remediated in newer commits.

---

## Repository Structure

```text
oss-bureau/
├── README.md                          # English documentation (default)
├── README.zh-CN.md                    # 简体中文文档
├── README.ja.md                       # 日本語ドキュメント
├── LICENSE                            # MIT License
└── skills/
    └── oss-audit/
        ├── SKILL.md                   # Agent workflow, anti-hallucination rules & dossier template
        ├── scripts/
        │   ├── scan_repo.py           # Zero-dependency repo pre-scanner & Git commit tracer
        │   ├── check_local.py         # Strictly read-only local machine privacy check
        │   └── validate_bundle.py     # Zero-dependency case-bundle.json validator
        └── references/
            ├── rules.md               # Severity rubric & false-positive exclusion checklist
            └── case-schema.json       # OSS Bureau Case Bundle JSON Schema (v1.0.0)
```

---

## Roadmap

- [x] **`oss-audit` Skill v1.0** — Repository static pre-scanner, Promise-vs-Reality diff, Git commit tracing, read-only local machine check, and `case-bundle.json` v1.0.0 schema.
- [ ] **OSS Bureau Interactive Platform** — Public case board where developers can drop `case-bundle.json` files to submit evidence-backed reports, peer-verify reproductions, export "Promise vs. Code" comparison cards, and track official maintainer fixes.

---

## License

Released under the [MIT License](LICENSE).
