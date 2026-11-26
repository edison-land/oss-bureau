# OSS Bureau 🔍

<div align="center">

**依存ゼロ · 証拠ファースト · ローカル読み取り専用 · マルチエージェント対応 Skill**

「テレメトリなし」の宣伝文句を鵜呑みにしない。ソースコードで検証し、自分のマシンを監査する。

[English](README.md) · [简体中文](README.zh-CN.md) · [**日本語**](README.ja.md)

[![GitHub Stars](https://img.shields.io/github/stars/edison-land/oss-bureau?style=flat&color=f97316)](https://github.com/edison-land/oss-bureau/stargazers)
[![License: MIT](https://img.shields.io/badge/license-MIT-3b82f6?style=flat)](LICENSE)
[![Python 3.9+ Stdlib](https://img.shields.io/badge/Runtime-Python%203.9%2B%20Stdlib-22c55e?style=flat&logo=python&logoColor=white)](skills/oss-audit/scripts)
[![Cross-Agent Skill](https://img.shields.io/badge/Skill-Antigravity%20%7C%20Claude%20%7C%20Codex%20%7C%20Cursor-111827?style=flat)](skills/oss-audit/SKILL.md)
[![Case Bundle v1.0.0](https://img.shields.io/badge/Schema-Case%20Bundle%20v1.0.0-6366f1?style=flat)](skills/oss-audit/references/case-schema.json)

</div>

---

## なぜ OSS Bureau なのか？

開発者は日々、数多くのオープンソース AI コーディングツール、CLI、エディタ拡張機能、MCP サーバーをインストールしています。しかし時として、公式サイトで **「ゼロテレメトリ」** や **「完全ローカル動作」** を謳いながら、実際にはデフォルトでデータを送信していたり、オプトアウトを意図的に難しくしていたり、さらには**他ツールの認証情報ディレクトリ**（`~/.claude`、`~/.codex`、`~/.ssh`、`~/.aws`、OS キーチェーンなど）を読み取っているケースが発生します。

**`oss-audit`** は、あなたの AI コーディングアシスタントを厳格な証拠ベースのプライバシー・セキュリティ監査官へと変えます。プロンプト任せの推測ではなく、**外部依存ゼロの Python 静的プリスキャナー**と**AI コード検証 SOP** を組み合わせ、すべての指摘に正確なファイルパス・行番号・Git コミットを紐づけます。

---

## 主な機能

| 機能 | できること |
| :--- | :--- |
| **テレメトリ＆ダークパターン検出** | PostHog、Sentry、Mixpanel、Segment、Amplitude、Scarf および独自エンドポイントを検出し、オプトイン／オプトアウトの初期状態や `DO_NOT_TRACK` 対応を確認します。 |
| **他ツール設定・認証情報の越境参照** | 他ツールの設定や認証パス（`~/.claude`、`~/.codex`、`~/.cursor`、`~/.gemini`、`~/.ssh`、`~/.aws`、ブラウザプロファイル、キーチェーン、ハードウェア指紋）への参照をフラグ付けします。 |
| **公開宣言 vs 実装コード照合** | `README.md`、`PRIVACY.md`、ドキュメント内のプライバシー宣言を抽出し、検証済みのランタイムコードと突き合わせます。 |
| **サプライチェーン＆セキュリティ兆候** | npm ライフサイクルフック（`preinstall`/`postinstall`）、`curl \| sh`、動的 `eval`/Base64 実行、TLS 検証無効化、ハードコードされたシークレットパターン、`0.0.0.0` バインドを検出します。 |
| **Git 履歴フォレンジック** | `--trace-term` により、疑わしいテレメトリや越境参照を最初に導入したコミットを特定し、現在も有効な挙動と修正済み履歴を明確に区別します。 |
| **ローカルマシン監査（読み取り専用）** | 自分の PC に導入済みの AI ツール、テレメトリ無効化環境変数、エディタ設定、MCP サーバーのメタデータを安全に診断し、コピー＆ペースト可能なオプトアウト設定を生成します。 |
| **標準化ケースバンドル出力** | 人間向けの**監査調書（Markdown）**とスキーマ検証済みの `case-bundle.json` を同時出力し、公開予定の **OSS Bureau** コミュニティプラットフォームとシームレスに連携します。 |

---

## クイックインストール

### 方法 1：`skills` CLI を使う（推奨）

Antigravity、Claude Code、Codex、Cursor など Agent Skills 対応ツールですぐに利用できます：

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

インストール後、お使いの AI エージェントにそのまま指示してください：

- **GitHub リポジトリを監査する**：
  > `oss-audit` を使って `https://github.com/owner/repo` を監査して。デフォルト有効なテレメトリ、他ツールの認証情報読み取り、サプライチェーンフック、README の宣言との矛盾を確認し、検証済みの `case-bundle.json` を出力して。
- **問題コードの導入コミットを特定する**：
  > このローカルリポジトリを監査し、`.claude` 参照やテレメトリ送信が最初にどの Git コミットで追加されたか追跡して。
- **自分のマシンを診断する**：
  > `oss-audit` でローカル環境をチェックして、デフォルトでテレメトリが有効な AI ツールや MCP 構成を確認し、無効化用の設定スニペットを出して。

### 2. スタンドアロン実行（Python 3.9+・外部依存ゼロ）

```bash
# リモート GitHub リポジトリまたはローカルディレクトリをプリスキャン
python3 skills/oss-audit/scripts/scan_repo.py https://github.com/owner/repo --format markdown

# 特定パターンの初回導入コミットを追跡（リモートの場合は --full-history を併用）
python3 skills/oss-audit/scripts/scan_repo.py /path/to/repo --trace-term ".claude" --trace-term "posthog" --format markdown

# 完全読み取り専用のローカルマシン診断
python3 skills/oss-audit/scripts/check_local.py --format markdown

# 出力された case-bundle.json を v1.0.0 スキーマで検証
python3 skills/oss-audit/scripts/validate_bundle.py path/to/case-bundle.json
```

---

## プライバシーと公正な監査の原則

プライバシーを監査するツール自身に、最も厳しい基準を課しています：

- **完全ローカル・読み取り専用**：`check_local.py` は一切のファイル変更もネットワーク通信も行いません。
- **シークレット非接触**：`.ssh/*`、`.aws/credentials`、`.env`、API キー、認証トークン、Cookie、チャット履歴は一切読み取らず、出力もしません。確認するのはツールの存在、許可リスト内のテレメトリ設定キー、環境変数／ヘッダーを除去した MCP メタデータのみです。
- **未検証の断定を禁止**：`SKILL.md` により、正確なファイルパス・行番号・コミットの裏付けを必須としています。テストコード・コメント・デッドコード・適切なオプトイン機能は報告前に除外します。
- **事実ベース・修正への配慮**：公開ドキュメントと再現可能なコードの事実のみを記述し、最新コミットで修正済みの場合はその旨を明記します。

---

## リポジトリ構成

```text
oss-bureau/
├── README.md                          # English documentation (default)
├── README.zh-CN.md                    # 简体中文文档
├── README.ja.md                       # 日本語ドキュメント
├── LICENSE                            # MIT License
└── skills/
    └── oss-audit/
        ├── SKILL.md                   # エージェント監査 SOP・誤検知防止ルール・調書テンプレート
        ├── scripts/
        │   ├── scan_repo.py           # 依存ゼロのリポジトリプリスキャナー＆コミット追跡
        │   ├── check_local.py         # 完全読み取り専用のローカルプライバシー診断
        │   └── validate_bundle.py     # 依存ゼロの case-bundle.json バリデーター
        └── references/
            ├── rules.md               # 重大度基準＆誤検知除外チェックリスト
            └── case-schema.json       # OSS Bureau Case Bundle JSON Schema (v1.0.0)
```

---

## ロードマップ

- [x] **`oss-audit` Skill v1.0** — リポジトリ静的プリスキャン、公開宣言 vs 実装照合、Git コミット追跡、ローカル読み取り専用診断、`case-bundle.json` v1.0.0 スキーマ。
- [ ] **OSS Bureau インタラクティブプラットフォーム** — `case-bundle.json` をドラッグ＆ドロップで提出できる公開ケースボード、コミュニティによる再現検証、「宣言 vs コード」比較カード出力、メンテナー向け修正報告・解決ステータス管理。

---

## ライセンス

[MIT License](LICENSE) の下で公開されています。
