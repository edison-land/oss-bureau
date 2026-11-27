# OSS Bureau Case Registry (`cases/`)

Every published dossier on [OSS Bureau](https://edison-land.github.io/oss-bureau/) lives as an individual public JSON file in this directory.

## Supported Formats

1. **Standard `case-bundle.v1.json` (Recommended for all Skills & Contributors)**
   - Produced directly by `oss-audit` or **any third-party / custom Skill** implementing [case-schema.json](../skills/oss-audit/references/case-schema.json).
   - Optional `bureau_meta` object stores public provenance (`evidence_issue_number`, `evidence_issue_url`, `submitted_by`, `stars`, `do_not_track`, `status`).
2. **Official Bilingual Dossier JSON (`CASE-001` .. `CASE-015`)**
   - Full Chinese/English curated dossiers maintained in this repo.

## How New Cases Enter the Board

1. **Via GitHub Issue (Zero Git friction, Recommended)**
   - Open a [Case Submission Issue](https://github.com/edison-land/oss-bureau/issues/new?template=case-submission.yml) (or click **Submit Tip** on the website) with your `case-bundle.json`.
   - The **OSS Bureau Intake Bot** automatically validates the schema, verifies that the target repository, commit hash, and referenced `file_path` entries actually exist on GitHub, and classifies the tier (`blacklist` / `watchlist` / `cleared`) using the public rule engine.
   - Once reviewed and labeled `approved` by a maintainer, the bot automatically opens a PR archiving the JSON here with a permanent backlink to the evidence Issue.
2. **Via Direct Pull Request**
   - Add `cases/COMMUNITY-<repo-slug>.json` following `case-bundle.v1.json` and open a PR.
   - CI validates schema + remote GitHub evidence automatically. Merging deploys directly to GitHub Pages.
