# OSS Bureau 🔍

<div align="center">

**依存ゼロ · 証拠ファースト · GitHub 公開監査ボード · オープン Skill プロトコル**

「テレメトリなし」の宣伝文句を鵜呑みにしない。ソースコードで検証し、証拠を GitHub Issue に固定し、自分のマシンを監査する。

[English](README.md) · [简体中文](README.zh-CN.md) · [**日本語**](README.ja.md)

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

🌐 **ホーム**: [https://edison-land.github.io/oss-bureau/](https://edison-land.github.io/oss-bureau/) · 📋 **[監査レジストリ](https://edison-land.github.io/oss-bureau/registry)** · 📝 **[証拠 Issue を提出](https://github.com/edison-land/oss-bureau/issues/new?template=case-submission.yml)** · ✅ **[修正報告 / 異議申立](https://github.com/edison-land/oss-bureau/issues/new?template=remediation-appeal.yml)**

</div>

---

## 公開レッド / ウォッチ / ブラックリスト一覧（検証済み 15 件）

すべての判定は正確なコミットハッシュとソースコード行番号に裏付けられており、[`cases/`](cases/) に公開 JSON として保存されています。[オンラインボード](https://edison-land.github.io/oss-bureau/) ではコード抜粋の閲覧、PNG 証拠カード出力、標準／厳格プロファイルの切替が可能です。

| 判定 | ケース | リポジトリ | 既定テレメトリ | `DO_NOT_TRACK` | 越境参照 | コード検証済みポイント |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| 🔴 **Blacklist** | [CASE-001](cases/CASE-001-kilocode.json) | `Kilo-Org/kilocode` | `FORCED` | `NO` | **あり** | PostHog 既定有効（GeoIP・メール紐付け）、JetBrains 版は強制有効、`DO_NOT_TRACK` 非対応、`~/.conda/aau_token` を取得。 |
| 🔴 **Blacklist** | [CASE-002](cases/CASE-002-t3code.json) | `pingdotgg/t3code` | `OPT_OUT_HARD` | `NEW` | 履歴あり | 以前は Codex JWT / Claude `accountUuid` を解析（`84e4264bb3` で削除済み）。既定有効のままでデスクトップ設定トグル未統合。 |
| 🟡 **Watchlist** | [CASE-003](cases/CASE-003-gemini-cli.json) | `google-gemini/gemini-cli` | `OPT_OUT_HARD` | `NO` | なし | Google Clearcut 既定有効（GPU 情報・リポジトリハッシュ）。設定 UI 非表示、`DO_NOT_TRACK` 非対応。 |
| 🟡 **Watchlist** | [CASE-004](cases/CASE-004-codex.json) | `openai/codex` | `OPT_OUT_EASY` | `NO` | なし | ファーストパーティ分析 + Statsig 既定有効。`DO_NOT_TRACK` 非対応だが `config.toml` で無効化可能。 |
| 🟡 **Watchlist** | [CASE-005](cases/CASE-005-cline.json) | `cline/cline` | `OPT_OUT_EASY` | `YES` | なし | PostHog + `node-machine-id` を明示、`DO_NOT_TRACK=1` 対応（無効化後も `/decide` へ distinctId 送信）。 |
| 🟡 **Watchlist** | [CASE-006](cases/CASE-006-orca.json) | `stablyai/orca` | `OPT_OUT_EASY` | `YES` | なし | 公式ビルドは PostHog 既定有効だが GeoIP 無効・ランダム UUIDv4・UI スイッチ・`DO_NOT_TRACK=1` 対応。 |
| 🟡 **Watchlist** | [CASE-007](cases/CASE-007-crush.json) | `charmbracelet/crush` | `OPT_OUT_EASY` | `YES` | なし | `machineid` ハッシュ付き PostHog を README で明示、`DO_NOT_TRACK=1` / `CRUSH_DISABLE_METRICS=1` 対応。 |
| 🟢 **Cleared** | [CASE-008](cases/CASE-008-aider.json) | `Aider-AI/aider` | `OPT_IN` | `NO` | なし | 厳格なオプトイン方式・サンプルログ公開（10% 確認プロンプトの既定値が `[Yes]`）。 |
| 🟢 **Cleared** | [CASE-009](cases/CASE-009-goose.json) | `aaif-goose/goose` | `OPT_IN` | `NO` | なし | Rust バックエンドは `unwrap_or(false)` で既定オフ（デスクトップ初回案内は既定チェック）。 |
| 🟢 **Cleared** | [CASE-010](cases/CASE-010-continue.json) | `continuedev/continue` | `NONE` | `NA` | なし | `core/` から PostHog/Sentry を削除済み。CLI は OTLP 設定時のみ送信。 |
| 🟢 **Cleared** | [CASE-011](cases/CASE-011-vibe-kanban.json) | `BloopAI/vibe-kanban` | `NONE` | `NA` | なし | ローカル版はバックエンド・フロントエンド・リリース検証すべてでテレメトリをハード無効化。 |
| 🟢 **Cleared** | [CASE-012](cases/CASE-012-opencode.json) | `anomalyco/opencode` | `NONE` | `NA` | なし | 既定ゼロテレメトリ。Sentry はクラッシュ画面で明示的に Report した場合のみ送信。 |
| 🟢 **Cleared** | [CASE-013](cases/CASE-013-roo-code.json) | `RooCodeInc/Roo-Code` | `NONE` | `NA` | なし | 現行 `main` ランタイムから PostHog / Sentry を完全除去済み。 |
| 🟢 **Cleared** | [CASE-014](cases/CASE-014-cc-switch.json) | `farion1231/cc-switch` | `NONE` | `NA` | なし | 完全ローカル動作。Claude Code 利用量確認時に `DISABLE_TELEMETRY=1` まで自動付与。 |
| 🟢 **Cleared** | [CASE-015](cases/CASE-015-claude-squad.json) | `smtg-ai/claude-squad` | `NONE` | `NA` | なし | 完全オフラインの Go ターミナルオーケストレーター。テレメトリ SDK・外部通信ゼロ。 |

---

## コミュニティ共創：`oss-audit` または独自 Skill で参加する

OSS Bureau は外部データベースを持たず、**すべての証拠と審査履歴をこの公開 GitHub リポジトリに固定**します。`oss-audit` だけでなく、**自作の監査 Skill やスクリプト**でも [`case-bundle.v1.json`](skills/oss-audit/references/case-schema.json) を出力すれば同じ公開ルールで自動検証・掲載できます。

```text
任意の Skill (oss-audit / 自作 Skill) ──▶ 公開 GitHub Issue（証拠固定 + Skill 名記載）
                                                │
                                                ▼
                              GitHub Actions 検証 Bot (scripts/bureau_bot.py)
                                • case-bundle.v1.json スキーマ検証
                                • GitHub API で対象リポジトリ・Commit・ファイル実在を確認
                                • 公開ルールで 🔴 Blacklist / 🟡 Watchlist / 🟢 Cleared を自動判定
                                                │
                                                ▼（メンテナーが `approved` ラベル付与）
                              自動アーカイブ PR → cases/CASE-ISS-<番号>-<リポジトリ>.json
                                                │
                                                ▼（PR マージ）
                              オンライン監査ボードへ自動反映！
```

### 参加方法
1. **Web から即時判定 & Issue 提出**：[オンラインボード](https://edison-land.github.io/oss-bureau/) に `case-bundle.json` をドロップしてローカル比較・PNG 出力・[Case Submission Issue](https://github.com/edison-land/oss-bureau/issues/new?template=case-submission.yml) へ提出。
2. **自作 Skill の接続**：Web サイトの *Rules & Protocol* タブから **Universal Output Contract** をコピーして自作 Skill に組み込むだけで対応 JSON を出力可能。
3. **直接 PR 提出**：[`cases/`](cases/) に `case-bundle.v1.json` を追加して PR を作成すると、CI が自動でスキーマとリモート証拠を検証します。

---

## クイックインストール

### 方法 1：`skills` CLI を使う（推奨）

```bash
npx skills add edison-land/oss-bureau
```

### 方法 2：手動クローン＆シンボリックリンク

```bash
git clone https://github.com/edison-land/oss-bureau.git
cd oss-bureau

# Antigravity（グローバル）
ln -s "$(pwd)/skills/oss-audit" ~/.gemini/config/skills/oss-audit

# Claude Code（グローバル）
ln -s "$(pwd)/skills/oss-audit" ~/.claude/skills/oss-audit

# Codex / 共通 .agents ディレクトリ
ln -s "$(pwd)/skills/oss-audit" ~/.agents/skills/oss-audit
```

---

## 使い方

### 1. AI エージェントに自然言語で依頼する（推奨）

- **GitHub リポジトリを監査する**：
  > `oss-audit` を使って `https://github.com/owner/repo` を監査して。デフォルト有効なテレメトリ、他ツールの認証情報読み取り、サプライチェーンフック、README の宣言との矛盾を確認し、検証済みの `case-bundle.json` を出力して。
- **自分のマシンを診断する**：
  > `oss-audit` でローカル環境をチェックして、デフォルトでテレメトリが有効な AI ツールや MCP 構成を確認し、無効化用の設定スニペットを出して。

### 2. スタンドアロン実行（Python 3.9+・外部依存ゼロ）

```bash
python3 skills/oss-audit/scripts/scan_repo.py https://github.com/owner/repo --format markdown
python3 skills/oss-audit/scripts/check_local.py --format markdown
python3 skills/oss-audit/scripts/validate_bundle.py path/to/case-bundle.json
python3 scripts/bureau_bot.py inspect-pr --all --no-network
```

---

## リポジトリ構成

```text
oss-bureau/
├── README.md / README.zh-CN.md / README.ja.md   # 3言語ドキュメント＆公開リスト
├── LICENSE                                      # MIT License
├── cases/                                       # 1件1ファイルの公開 JSON レジストリ
├── scripts/
│   └── bureau_bot.py                            # 依存ゼロの Issue/PR 自動検証・判定・同期 Bot
├── .github/
│   ├── ISSUE_TEMPLATE/                          # ケース提出 & 修正申立 Issue フォーム
│   └── workflows/
│       ├── audit-intake.yml                     # Issue/PR 自動検証・ラベル付与・承認時自動 PR
│       └── deploy-pages.yml                     # コミュニティ Issue 同期＆GitHub Pages デプロイ
├── web/                                         # OSS Bureau インタラクティブ Web ボード
└── skills/
    └── oss-audit/                               # SKILL.md, scripts/, references/
```

---

## ロードマップ

- [x] **`oss-audit` Skill v1.0** — 静的プリスキャン、宣言 vs 実装照合、コミット追跡、ローカル診断、`case-bundle.json` v1.0.0。
- [x] **OSS Bureau インタラクティブボード** — GitHub Pages 上の公開ボード（15 件の検証済み調書、PNG 出力、ローカル JSON サンドボックス、標準／厳格ルール切替）。
- [x] **GitHub Issue ↔ Bot ↔ PR 共創パイプライン** — Issue フォーム、Actions による自動証拠検証・ティア判定、コミュニティ公聴タブ、`approved` ラベルでの自動 PR アーカイブ。
- [ ] **定期再監査ウォッチ** — 対象リポジトリの修正コミットを自動検知して再評価を通知。

---

## ライセンス

[MIT License](LICENSE) の下で公開されています。
