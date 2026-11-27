# OSS Bureau 🔍

<div align="center">

**Zero Dependencies · Evidence-First · GitHub-Backed Public Audit Board · Open Skill Protocol**

Don't trust "zero telemetry" landing pages. Verify the source code, pin evidence in public GitHub Issues, and audit your own machine.

[**English**](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

[![Live Case Board](https://img.shields.io/badge/Live%20Board-edison--land.github.io%2Foss--bureau-dc2626?style=flat&logo=githubpages&logoColor=white)](https://edison-land.github.io/oss-bureau/)
[![Deploy Pages](https://github.com/edison-land/oss-bureau/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/edison-land/oss-bureau/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-3b82f6?style=flat)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/edison-land/oss-bureau?style=flat&color=f97316)](https://github.com/edison-land/oss-bureau/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/edison-land/oss-bureau?style=flat&color=64748b)](https://github.com/edison-land/oss-bureau/network/members)
[![GitHub Issues](https://img.shields.io/github/issues/edison-land/oss-bureau?style=flat)](https://github.com/edison-land/oss-bureau/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-16a34a?style=flat)](https://github.com/edison-land/oss-bureau/pulls)

[![Python 3.9+ Stdlib](https://img.shields.io/badge/Runtime-Python%203.9%2B%20Stdlib-22c55e?style=flat&logo=python&logoColor=white)](skills/oss-audit/scripts)
[![Cross-Agent Skill](https://img.shields.io/badge/Skill-Antigravity%20%7C%20Claude%20%7C%20Codex%20%7C%20Cursor-111827?style=flat)](skills/oss-audit/SKILL.md)
[![Case Bundle v1.0.0](https://img.shields.io/badge/Protocol-Case%20Bundle%20v1.0.0-6366f1?style=flat)](skills/oss-audit/references/case-schema.json)

🌐 **Home**: [https://edison-land.github.io/oss-bureau/](https://edison-land.github.io/oss-bureau/) · 📋 **[Live Registry](https://edison-land.github.io/oss-bureau/registry)** · 📝 **[Submit Evidence Issue](https://github.com/edison-land/oss-bureau/issues/new?template=case-submission.yml)** · ✅ **[Maintainer Fix Appeal](https://github.com/edison-land/oss-bureau/issues/new?template=remediation-appeal.yml)**

</div>

---

## Live Red / Watch / Blacklist Snapshot (15 Verified Dossiers)

Every entry below is backed by an exact commit hash and source permalinks stored publicly in [`cases/`](cases/). Browse full code snippets, export PNG evidence cards, or switch between **Standard** and **Strict Purist** rule profiles on the [Live Board](https://edison-land.github.io/oss-bureau/).

| Tier | Case | Repository | Default Telemetry | `DO_NOT_TRACK` | Cross-Tool | Core Code-Verified Fact |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| 🔴 **Blacklist** | [CASE-001](cases/CASE-001-kilocode.json) | `Kilo-Org/kilocode` | `FORCED` | `NO` | **YES** | Default-on PostHog (GeoIP + email alias), forced in JetBrains, rejects `DO_NOT_TRACK`, harvests `~/.conda/aau_token` via `conda info --json`. |
| 🔴 **Blacklist** | [CASE-002](cases/CASE-002-t3code.json) | `pingdotgg/t3code` | `OPT_OUT_HARD` | `NEW` | Historical | Previously parsed Codex JWT & Claude `accountUuid` (removed `84e4264bb3`); still default-on with no merged desktop Settings toggle (`PARTIALLY_PATCHED`). |
| 🟡 **Watchlist** | [CASE-003](cases/CASE-003-gemini-cli.json) | `google-gemini/gemini-cli` | `OPT_OUT_HARD` | `NO` | No | Default-on Clearcut (GPU model + repo hash); toggle hidden from `/settings` (`showInDialog: false`), ignores `DO_NOT_TRACK`. |
| 🟡 **Watchlist** | [CASE-004](cases/CASE-004-codex.json) | `openai/codex` | `OPT_OUT_EASY` | `NO` | No | Default-on first-party analytics + Statsig metrics; ignores `DO_NOT_TRACK`, cleanly disabled via `config.toml`. |
| 🟡 **Watchlist** | [CASE-005](cases/CASE-005-cline.json) | `cline/cline` | `OPT_OUT_EASY` | `YES` | No | Disclosed PostHog + `node-machine-id`, honors `DO_NOT_TRACK=1`; still sends distinctId to `/decide` for feature flags. |
| 🟡 **Watchlist** | [CASE-006](cases/CASE-006-orca.json) | `stablyai/orca` | `OPT_OUT_EASY` | `YES` | No | Official builds ship opt-out PostHog with `disableGeoip: true`, random UUIDv4, UI toggle, and `DO_NOT_TRACK=1`. |
| 🟡 **Watchlist** | [CASE-007](cases/CASE-007-crush.json) | `charmbracelet/crush` | `OPT_OUT_EASY` | `YES` | No | Transparently disclosed PostHog with hashed `machineid`; honors `DO_NOT_TRACK=1` and `CRUSH_DISABLE_METRICS=1`. |
| 🟢 **Cleared** | [CASE-008](cases/CASE-008-aider.json) | `Aider-AI/aider` | `OPT_IN` | `NO` | No | Strictly opt-in PostHog with public sample logs (minor note: 10% prompt defaults to `[Yes]`). |
| 🟢 **Cleared** | [CASE-009](cases/CASE-009-goose.json) | `aaif-goose/goose` | `OPT_IN` | `NO` | No | Rust backend strictly enforces `unwrap_or(false)` opt-in (desktop onboarding checkbox pre-checked). |
| 🟢 **Cleared** | [CASE-010](cases/CASE-010-continue.json) | `continuedev/continue` | `NONE` | `NA` | No | PostHog/Sentry removed from core; OTel only runs when user configures an OTLP endpoint. |
| 🟢 **Cleared** | [CASE-011](cases/CASE-011-vibe-kanban.json) | `BloopAI/vibe-kanban` | `NONE` | `NA` | No | Local backend, frontend, and release checks hard-disable PostHog & Sentry (`None`). |
| 🟢 **Cleared** | [CASE-012](cases/CASE-012-opencode.json) | `anomalyco/opencode` | `NONE` | `NA` | No | Zero default telemetry; Sentry triggers only when clicking Report on crash page. |
| 🟢 **Cleared** | [CASE-013](cases/CASE-013-roo-code.json) | `RooCodeInc/Roo-Code` | `NONE` | `NA` | No | Zero active telemetry or analytics SDKs in current `main` runtime codebase. |
| 🟢 **Cleared** | [CASE-014](cases/CASE-014-cc-switch.json) | `farion1231/cc-switch` | `NONE` | `NA` | No | Local-only CLI switcher; even injects `DISABLE_TELEMETRY=1` when checking Claude Code usage. |
| 🟢 **Cleared** | [CASE-015](cases/CASE-015-claude-squad.json) | `smtg-ai/claude-squad` | `NONE` | `NA` | No | Pure offline Go terminal orchestrator with zero telemetry SDKs or outbound HTTP calls. |

---

## Community Co-Creation: Use `oss-audit` or Your Own Skill

OSS Bureau keeps **100% of evidence and governance inside this public GitHub repository** — zero black-box databases. Any developer can audit a project using **`oss-audit`** OR **their own custom Skill/script**, as long as it outputs a valid [`case-bundle.v1.json`](skills/oss-audit/references/case-schema.json):

```text
Your Skill (oss-audit or custom) ──▶ Public GitHub Issue (permanent timestamped evidence)
                                              │
                                              ▼
                               GitHub Actions Intake Bot (scripts/bureau_bot.py)
                                 • Validates case-bundle.v1.json schema
                                 • Verifies target repo, commit SHA & file paths via GitHub API
                                 • Computes 🔴 Blacklist / 🟡 Watchlist / 🟢 Cleared transparently
                                              │
                                              ▼ (Maintainer adds `approved` label)
                               Auto Archive PR → cases/CASE-ISS-<n>-<repo>.json
                                              │
                                              ▼ (Merge PR)
                        Auto-deploys to Live Board + Community Hearings tab!
```

### Public Tier Rules (Deterministic & Open)
- 🔴 **Blacklist**: Triggers if `cross_tool_access = true`, `promise_vs_reality = DIRECT_CONTRADICTION`, `default_telemetry = FORCED`, or verified `risk_level` is `HIGH` / `CRITICAL`.
- 🟡 **Watchlist**: Triggers if `default_telemetry` is `OPT_OUT_HARD` / `OPT_OUT_EASY`, `promise_vs_reality = PARTIAL_MISMATCH`, or `risk_level = MEDIUM`.
- 🟢 **Cleared**: `NONE` or strict `OPT_IN`, zero cross-tool snooping, no doc contradiction, `CLEAN` / `LOW`.

**Ways to Participate:**
1. **Zero-Git Submission (Recommended)**: Drop your `case-bundle.json` on the [Live Board](https://edison-land.github.io/oss-bureau/) to preview its tier locally, or open a [Case Submission Issue](https://github.com/edison-land/oss-bureau/issues/new?template=case-submission.yml).
2. **Bring Your Own Skill**: Copy the **Universal Output Contract** from the website's *Rules & Protocol* tab so your own Agent Skill emits compatible `case-bundle.v1.json` with your Skill credited in `auditor_tool`.
3. **Direct PR**: Add a `case-bundle.v1.json` under [`cases/`](cases/) and open a PR — CI verifies schema & remote GitHub evidence automatically.
4. **Peer Review & Maintainer Fixes**: Vote (`👍`/`👎`) or post counter-evidence on open `case-submission` Issues, or file a [Remediation Appeal](https://github.com/edison-land/oss-bureau/issues/new?template=remediation-appeal.yml) when a fix commit lands.

---

## Core Capabilities of `oss-audit`

| Capability | What It Does |
| :--- | :--- |
| **Telemetry & Dark-Pattern Detection** | Scans for PostHog, Sentry, Mixpanel, Segment, Amplitude, Scarf, custom tracking endpoints, and verifies opt-in vs. opt-out and `DO_NOT_TRACK` support. |
| **Cross-Tool & Credential Snooping** | Flags reads targeting other tools' config/auth directories (`~/.claude`, `~/.codex`, `~/.cursor`, `~/.gemini`, `~/.ssh`, `~/.aws`, browser profiles, keychains, hardware fingerprints). |
| **Promise vs. Reality Diff** | Extracts explicit privacy claims from `README.md`, `PRIVACY.md`, and docs, then compares them line-by-line against verified runtime code. |
| **Supply-Chain & Security Red Flags** | Inspects npm lifecycle hooks (`preinstall`/`postinstall`), `curl \| sh`, dynamic `eval`/base64 execution, disabled TLS checks, hardcoded secret patterns, and `0.0.0.0` binds. |
| **Git History Forensics** | Traces the earliest commit (`--trace-term`) that introduced suspicious telemetry or cross-tool path access, separating active issues from patched history. |
| **Read-Only Local Machine Check** | Audits installed AI tools, telemetry opt-out env vars, editor settings, and MCP server metadata on your own computer—then generates a tailored shell opt-out snippet. |
| **Standardized Case Bundles** | Exports both a human-readable **Audit Dossier (Markdown)** and a schema-validated `case-bundle.json` compatible with the OSS Bureau board & GitHub Intake Bot. |

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

# Trace earliest Git commits introducing specific patterns
python3 skills/oss-audit/scripts/scan_repo.py /path/to/repo --trace-term ".claude" --trace-term "posthog" --format markdown

# Strictly read-only local machine telemetry & AI tool check
python3 skills/oss-audit/scripts/check_local.py --format markdown

# Validate an exported OSS Bureau case bundle against v1.0.0 schema
python3 skills/oss-audit/scripts/validate_bundle.py path/to/case-bundle.json

# Validate all archived cases in cases/
python3 scripts/bureau_bot.py inspect-pr --all --no-network
```

---

## Privacy & Fair-Play Guarantees

- **Zero Network Calls & Strictly Read-Only Local Check**: `check_local.py` never modifies files and never makes outbound requests.
- **Zero Secret Exposure**: Never reads, prints, or transmits `.ssh/*`, `.aws/credentials`, `.env`, API keys, auth tokens, cookies, or chat histories.
- **No Unverified Accusations**: `SKILL.md` and `bureau_bot.py` enforce exact file-path, line-number, and commit verification against public GitHub repositories.
- **Facts Over Drama**: Reports focus strictly on public documentation and reproducible code behavior, crediting maintainers promptly when fixes ship.

---

## Repository Structure

```text
oss-bureau/
├── README.md / README.zh-CN.md / README.ja.md   # Trilingual documentation + live board snapshot
├── LICENSE                                      # MIT License
├── cases/                                       # Public one-file-per-case JSON registry (official + community PRs)
├── scripts/
│   └── bureau_bot.py                            # Zero-dependency Issue/PR verifier, tier classifier & Issue syncer
├── .github/
│   ├── ISSUE_TEMPLATE/                          # Case Submission & Maintainer Remediation Issue Forms
│   └── workflows/
│       ├── audit-intake.yml                     # Auto-verify Issues/PRs, label tiers & open archive PRs on approval
│       └── deploy-pages.yml                     # Sync open community Issues & deploy web board to GitHub Pages
├── web/                                         # Interactive OSS Bureau React + Vite + Tailwind public board
└── skills/
    └── oss-audit/
        ├── SKILL.md                             # Agent workflow, anti-hallucination rules & dossier template
        ├── scripts/                             # scan_repo.py, check_local.py, validate_bundle.py
        └── references/                          # rules.md & case-schema.json (v1.0.0)
```

---

## Roadmap

- [x] **`oss-audit` Skill v1.0** — Repository static pre-scanner, Promise-vs-Reality diff, Git commit tracing, read-only local machine check, and `case-bundle.json` v1.0.0 schema.
- [x] **OSS Bureau Interactive Board** — Public Red/Watch/Blacklist deployed on GitHub Pages with 15 verified dossiers, PNG evidence card export, local JSON sandbox, and Standard/Strict rule profiles.
- [x] **GitHub-Native Issue ↔ Bot ↔ PR Co-Creation** — Public Issue Forms, automated GitHub API evidence verification, deterministic tier labeling, Community Hearings sync, and one-label `approved` archive PRs for `oss-audit` and third-party Skills.
- [ ] **Automated Re-Audit Watch** — Periodic commit-diff watch to notify when blacklisted/watchlisted repos ship telemetry fixes.

---

## License

Released under the [MIT License](LICENSE).
