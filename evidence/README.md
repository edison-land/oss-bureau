# Evidence Attachments (`evidence/`)

Public visual receipts (screenshots of privacy claims, terminal scans, network captures, or GitHub PR diffs) archived alongside `cases/*.json`.

## Rules Enforced by CI (`scripts/bureau_bot.py`)

1. **Allowed formats**: `.png`, `.jpg`, `.jpeg`, `.webp` only (max 5 MB per file).
2. **100% Accounting**: Every image in `evidence/` must be referenced by a case in `cases/*.json`, and every `attachments[].path` referenced by a case must exist here.
3. **Automated Archiving**: Screenshots attached to an approved `case-submission` GitHub Issue are automatically validated, downloaded into `evidence/<CASE-ID>/`, linked in `cases/<CASE-ID>-<slug>.json`, and committed via pull request so evidence never breaks on external image hosts.
