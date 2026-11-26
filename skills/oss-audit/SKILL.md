---
name: oss-audit
description: >-
  Audit open-source repositories and local developer machines for hidden or
  default-on telemetry, cross-tool credential/config snooping (e.g. ~/.claude,
  ~/.codex, ~/.ssh, ~/.aws, keychain), supply-chain hooks, security red flags,
  and contradictions between public privacy/zero-telemetry promises and actual
  code. Use when the user asks to audit, inspect, or investigate an open-source
  repo, GitHub URL, CLI/AI tool, or check their own machine for telemetry and
  privacy risks, or generate an evidence dossier / OSS Bureau case bundle.
---

# OSS Audit — Open-Source Privacy, Telemetry & Security Auditor

Evidence-first auditing workflow for open-source repositories and local developer machines. Combines zero-dependency static pre-scanning with manual code verification so every claim is backed by exact files, line numbers, and commits.

Read [rules.md](./references/rules.md) before assigning severity levels or writing verdicts.

---

## Mode Selection

Determine which mode(s) the user wants:

- **Mode A — Repository Audit**: User provides a GitHub/Git URL, local repository path, or asks "is tool X safe / collecting telemetry / reading my credentials / violating its README?"
- **Mode B — Local Machine Check**: User asks "check my computer / what AI tools on my machine have telemetry enabled / how do I turn telemetry off?"
- **Both**: Run Mode B first for immediate personal hygiene, then Mode A for targeted repositories.

---

## Mode A: Repository Audit SOP

### Step 1: Run Deterministic Pre-Scan

Run [scan_repo.py](./scripts/scan_repo.py) on the target repository (local directory or remote Git URL):

```bash
python3 ./scripts/scan_repo.py <path-or-git-url> --format json --out /tmp/oss-scan.json
```

Useful flags:
- `--keep-clone /tmp/oss-audit-repo` — keep a cloned remote repo on disk so you can read full source files in Step 2 (always clean it up when finished).
- `--full-history --trace-term "<keyword>"` — trace the earliest git commit that introduced a suspicious telemetry SDK, endpoint, or cross-tool path (e.g., `--trace-term "posthog"` or `--trace-term ".claude"`).
- `--include-tests` — include test/example directories if needed.

### Step 2: Verify Every Candidate Hit in Source Code

**Never report raw scanner hits as confirmed findings.** Open and read the relevant files around each high-signal hit (`sensitive_access`, `telemetry`, `supply_chain`, `security`, `promises`) and verify:

1. **Reachability**: Is the code actually invoked at runtime (not dead code, docs, tests, or a security-scanner rule definition)?
2. **Default Behavior (Telemetry)**:
   - Is telemetry **opt-in** (disabled by default) or **opt-out** (enabled by default)?
   - What exact payload fields are collected? (Events only, machine ID, OS/version, repo/file paths, prompts/code, or hashes derived from other tools' files?)
   - How easy is it to disable? Does it honor `DO_NOT_TRACK=1` or an obvious config/CLI flag?
3. **Cross-Tool & Sensitive Access**:
   - Does the tool read files belonging to *other* tools (`~/.claude`, `~/.codex`, `~/.cursor`, `~/.gemini`, `~/.ssh`, `~/.aws`, browser cookies, OS keychain)?
   - If yes, why? Is it explicitly disclosed to the user, or silently read/hashed/transmitted?
4. **Promise vs. Reality Diff**:
   - Read `README.md`, `PRIVACY.md`, `SECURITY.md`, or landing-page copy (and user-provided website URLs if mentioned).
   - Compare exact verbatim quotes against verified runtime behavior.
5. **History Check (Optional but High Value)**:
   - For confirmed telemetry or cross-tool reads in a git repo with history, trace the introducing commit (and any later removal/fix commit) so the report distinguishes **currently active** vs **historically present and fixed**.

Apply the severity rubric and false-positive checklist in [rules.md](./references/rules.md).

### Step 3: Produce Outputs

Always produce a **Human-Readable Dossier (Markdown)** directly in your response (or save to file when requested). When the user wants a shareable/submittable evidence package, also write a `case-bundle.json` conforming to [case-schema.json](./references/case-schema.json) and validate it:

```bash
python3 ./scripts/validate_bundle.py <path-to-case-bundle.json>
```

#### Dossier Markdown Template

```markdown
# OSS Audit Dossier: <project-name>

- **Repository**: <url or local path>
- **Commit Audited**: `<commit-hash>` (<branch>, <commit-date>)
- **Overall Risk**: `<CLEAN | LOW | MEDIUM | HIGH | CRITICAL>`
- **Default Telemetry**: `<NONE | OPT_IN | OPT_OUT_EASY | OPT_OUT_HARD | FORCED | UNKNOWN>`
- **Cross-Tool Credential/Config Access**: `<Yes / No>`
- **Promise vs. Reality**: `<CONSISTENT | PARTIAL_MISMATCH | DIRECT_CONTRADICTION | NO_CLAIM_FOUND>`

> **One-Liner Verdict**: <1-2 objective, fact-based sentences summarizing what the code actually does.>

## Promise vs. Reality Comparison
| Public Claim (Source & Line) | Verified Code Behavior (File & Line) | Status |
| :--- | :--- | :--- |
| "..." (`README.md:L12`) | ... (`src/telemetry.ts:L40-L62`) | Contradiction / Match |

## Verified Findings
### [SEVERITY] F-001: <Short factual title>
- **Category**: `telemetry` / `sensitive_access` / `supply_chain` / `security`
- **Location**: `<file_path>:<line_start>-<line_end>` (or GitHub permalink)
- **Introduced Commit**: `<sha>` (if traced)
- **What the code does**: <factual explanation>
- **Evidence**:
  ```<lang>
  <verbatim code snippet from file>
  ```
- **How to Disable / Mitigate**: <exact env var, config flag, or action>

## If You Have This Tool Installed (Practical Mitigations)
1. <Exact env var / config edit / firewall rule / credential rotation advice>

## Scope & Fair-Play Notice
This audit reflects static inspection of `<commit-hash>` only. Code changes after this commit may modify or remediate these behaviors.
```

---

## Mode B: Local Machine Check SOP

### Strict Privacy Iron Law
- **100% read-only**: Never modify user shell profiles or tool configs unless the user explicitly asks you to apply changes.
- **Zero secret exposure**: NEVER read, print, summarize, or transmit `.ssh/*`, `.aws/credentials`, `.env`, API keys, auth tokens, cookies, or chat logs.

### Step 1: Run the Safe Local Checker

Run [check_local.py](./scripts/check_local.py):

```bash
python3 ./scripts/check_local.py --format markdown
```

(Or `--format json` if you want to combine it with follow-up analysis.)

### Step 2: Interpret & Guide the User

Present a concise, actionable **Local Privacy Checkup**:
1. **Detected AI Tools & CLIs**: List what was found on the machine.
2. **Telemetry Switch Status**: Highlight which editors/tools currently rely on default-on telemetry vs. explicitly disabled.
3. **MCP Inventory Review**: List configured MCP servers (names + command/host only) and flag any unfamiliar remote endpoints or third-party stdio packages worth auditing via Mode A.
4. **Copy-Paste Hardening Snippet**: Provide the tailored `export ...` snippet for `~/.zshrc` / `~/.bashrc` and exact VS Code / Cursor / Claude / Codex settings changes. Ask before editing any config file on the user's behalf.

---

## Non-Negotiable Audit Rules

1. **Never fabricate evidence**: Every file path, line number, commit hash, and code snippet must come directly from files you actually read in this session.
2. **Verify before accusing**: Raw regex hits are leads, never proof. If a hit is inside tests, comments, dead code, or a linter/scanner rule, drop it.
3. **Facts only, zero personal attacks**: Stick strictly to public documentation, source code, and reproducible behavior.
4. **Always give a practical exit**: Every finding should tell the user how to verify, disable, or mitigate it.
