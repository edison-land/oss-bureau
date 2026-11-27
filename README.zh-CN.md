# OSS Bureau 开源调查局 🔍

<div align="center">

**零外部依赖 · 证据优先 · GitHub 公开固证红黑榜 · 开放 Skill 取证协议**

别轻信官网的“零遥测”承诺。用源码自证，把证据固定在公开 GitHub Issue，顺手体检你自己的电脑。

[English](README.md) · [**简体中文**](README.zh-CN.md) · [日本語](README.ja.md)

[![在线红黑榜](https://img.shields.io/badge/在线红黑榜-edison--land.github.io%2Foss--bureau-dc2626?style=flat&logo=githubpages&logoColor=white)](https://edison-land.github.io/oss-bureau/)
[![Deploy Pages](https://github.com/edison-land/oss-bureau/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/edison-land/oss-bureau/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-3b82f6?style=flat)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/edison-land/oss-bureau?style=flat&color=f97316)](https://github.com/edison-land/oss-bureau/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/edison-land/oss-bureau?style=flat&color=64748b)](https://github.com/edison-land/oss-bureau/network/members)
[![GitHub Issues](https://img.shields.io/github/issues/edison-land/oss-bureau?style=flat)](https://github.com/edison-land/oss-bureau/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-16a34a?style=flat)](https://github.com/edison-land/oss-bureau/pulls)

[![Python 3.9+ Stdlib](https://img.shields.io/badge/Runtime-Python%203.9%2B%20Stdlib-22c55e?style=flat&logo=python&logoColor=white)](skills/oss-audit/scripts)
[![Cross-Agent Skill](https://img.shields.io/badge/Skill-Antigravity%20%7C%20Claude%20%7C%20Codex%20%7C%20Cursor-111827?style=flat)](skills/oss-audit/SKILL.md)
[![Case Bundle v1.0.0](https://img.shields.io/badge/Protocol-Case%20Bundle%20v1.0.0-6366f1?style=flat)](skills/oss-audit/references/case-schema.json)

🌐 **在线互动红黑榜**：[https://edison-land.github.io/oss-bureau/](https://edison-land.github.io/oss-bureau/) · 📝 **[提交新案宗 Issue](https://github.com/edison-land/oss-bureau/issues/new?template=case-submission.yml)** · ✅ **[维护者整改销案](https://github.com/edison-land/oss-bureau/issues/new?template=remediation-appeal.yml)**

</div>

---

## 开源 AI 工具红黑灰榜速览（15 份源码实锤案宗）

下方每一条定级均对应精确 Commit Hash 与可复现源码行号，原始 JSON 全部公开存放在 [`cases/`](cases/) 目录。前往 [在线红黑榜网站](https://edison-land.github.io/oss-bureau/) 可查看完整代码片段、导出 X 证据图，并切换 **「标准标尺 / 隐私洁癖标尺」** 或拖入你自己的 `case-bundle.json` 实时定级对比。

| 榜单 | 案宗 | 项目仓库 | 默认遥测 | `DO_NOT_TRACK` | 跨工具窥探 | 核心源码实锤 |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| 🔴 **黑榜** | [CASE-001](cases/CASE-001-kilocode.json) | `Kilo-Org/kilocode` | `FORCED` | `NO` | **是** | 默认开 PostHog（开 IP 定位 + 绑定邮箱）、JetBrains 端强制无法关闭、明文拒绝 `DO_NOT_TRACK`，且绕过脱敏偷抽 `~/.conda/aau_token`。 |
| 🔴 **黑榜** | [CASE-002](cases/CASE-002-t3code.json) | `pingdotgg/t3code` | `OPT_OUT_HARD` | `NEW` | 历史实锤 | 曾静默解析 Codex JWT 与 Claude `accountUuid`（提交 `84e4264bb3` 已移除）；截至 11/26 仍默认开遥测，桌面端未合并设置开关（`部分整改`）。 |
| 🟡 **灰榜** | [CASE-003](cases/CASE-003-gemini-cli.json) | `google-gemini/gemini-cli` | `OPT_OUT_HARD` | `NO` | 否 | 默认开 Google Clearcut（采集 GPU 型号 + 仓库哈希）；设置弹窗隐藏开关 (`showInDialog: false`)，不认 `DO_NOT_TRACK`。 |
| 🟡 **灰榜** | [CASE-004](cases/CASE-004-codex.json) | `openai/codex` | `OPT_OUT_EASY` | `NO` | 否 | 默认开第一方分析与 Statsig 指标，不认 `DO_NOT_TRACK`；可通过 `config.toml` 干净关闭，无跨工具窥探。 |
| 🟡 **灰榜** | [CASE-005](cases/CASE-005-cline.json) | `cline/cline` | `OPT_OUT_EASY` | `YES` | 否 | 默认开 PostHog + 硬件指纹，文档坦白且认 `DO_NOT_TRACK=1`；关闭遥测后仍带硬件指纹调 `/decide` 拉开关。 |
| 🟡 **灰榜** | [CASE-006](cases/CASE-006-orca.json) | `stablyai/orca` | `OPT_OUT_EASY` | `YES` | 否 | 官方发行版默认开 PostHog，但主动禁 GeoIP 与 person profile、随机 UUIDv4，有 UI 开关并认 `DO_NOT_TRACK=1`。 |
| 🟡 **灰榜** | [CASE-007](cases/CASE-007-crush.json) | `charmbracelet/crush` | `OPT_OUT_EASY` | `YES` | 否 | 默认开 PostHog 并使用 `machineid` 哈希，README 坦诚公开源码链接，支持 `DO_NOT_TRACK=1` 与 `CRUSH_DISABLE_METRICS=1`。 |
| 🟢 **红榜** | [CASE-008](cases/CASE-008-aider.json) | `Aider-AI/aider` | `OPT_IN` | `NO` | 否 | 严格先问再开（Opt-in）并公开样本日志（小扣分：10% 抽样弹窗默认 `[Yes]`）。 |
| 🟢 **红榜** | [CASE-009](cases/CASE-009-goose.json) | `aaif-goose/goose` | `OPT_IN` | `NO` | 否 | Rust 后端严格默认关闭（`unwrap_or(false)`），无硬件指纹与跨工具窥探（桌面引导框默认打勾）。 |
| 🟢 **红榜** | [CASE-010](cases/CASE-010-continue.json) | `continuedev/continue` | `NONE` | `NA` | 否 | `core/` 已清除 PostHog 与 Sentry，CLI 仅在用户自配 OTel 端点时上报。 |
| 🟢 **红榜** | [CASE-011](cases/CASE-011-vibe-kanban.json) | `BloopAI/vibe-kanban` | `NONE` | `NA` | 否 | 本地端前后端与发布脚本硬禁用 PostHog/Sentry，零活跃遥测。 |
| 🟢 **红榜** | [CASE-012](cases/CASE-012-opencode.json) | `anomalyco/opencode` | `NONE` | `NA` | 否 | 默认零遥测，Sentry 仅在崩溃页用户主动点 Report 时发送。 |
| 🟢 **红榜** | [CASE-013](cases/CASE-013-roo-code.json) | `RooCodeInc/Roo-Code` | `NONE` | `NA` | 否 | 当前 `main` 运行时已彻底移除 PostHog/Sentry，零活跃遥测、零跨工具窥探。 |
| 🟢 **红榜** | [CASE-014](cases/CASE-014-cc-switch.json) | `farion1231/cc-switch` | `NONE` | `NA` | 否 | 纯本地零遥测切换器，调用 Claude Code 查用量时主动注入 `DISABLE_TELEMETRY=1`。 |
| 🟢 **红榜** | [CASE-015](cases/CASE-015-claude-squad.json) | `smtg-ai/claude-squad` | `NONE` | `NA` | 否 | 纯离线 Go 终端编排器，零遥测 SDK、零 HTTP 网络请求。 |

---

## 开源共建：用 `oss-audit` 或你自己的 Skill 评定红黑榜

OSS Bureau 不设任何私有黑盒数据库，**所有证据、审理过程与归档全部公开存放在本 GitHub 仓库**。无论你用的是 `oss-audit` 还是**自己写的审计 Skill / 脚本**，只要按开放协议 [`case-bundle.v1.json`](skills/oss-audit/references/case-schema.json) 输出客观源码证据，就能接入同一张红黑榜：

```text
任意 Skill (oss-audit 或自建 Skill) ──▶ 公开 GitHub Issue（永久固证 + Skill 署名）
                                                │
                                                ▼
                                 GitHub Actions 自动审案 Bot (scripts/bureau_bot.py)
                                   • 校验 case-bundle.v1.json Schema
                                   • 远端调 GitHub API 核实目标仓库、Commit 与源码路径真实存在
                                   • 按公开规则自动算 🔴 黑榜 / 🟡 灰榜 / 🟢 红榜并打标签评论
                                                │
                                                ▼（社区复核后，维护者给 Issue 打 `approved` 标签）
                                 Bot 自动提归档 PR → cases/CASE-ISS-<号>-<仓库>.json
                                                │
                                                ▼（Merge PR）
                                 自动部署官网正式红黑榜，并直链原始证据 Issue！
```

### 公开红 / 灰 / 黑判定标尺（代码同源，透明可核验）
- 🔴 **黑榜（Blacklist）**：命中任意一条红线 —— 跨工具静默窃密/读取他工具凭证（`cross_tool_access = true`）、源码与公开隐私承诺直接矛盾（`DIRECT_CONTRADICTION`）、强制遥测无法关闭（`FORCED`），或经核实的 `HIGH` / `CRITICAL` 风险。
- 🟡 **灰榜（Watchlist）**：未触发黑榜红线，但存在默认开启遥测（`OPT_OUT_HARD` / `OPT_OUT_EASY`）、文档轻描淡写（`PARTIAL_MISMATCH`）或 `MEDIUM` 风险。
- 🟢 **红榜（Cleared）**：零活跃遥测（`NONE`）或严格默认关闭（`OPT_IN`），无跨工具越权，无承诺矛盾，风险为 `CLEAN` / `LOW`。

### 4 种零门槛互动方式
1. **网页即时定级 & 一键发 Issue**：在 [在线红黑榜](https://edison-land.github.io/oss-bureau/) 拖入 `case-bundle.json`，当场看规则命中项、暂存到本机榜单对比、导出 PNG 证据图，或一键提交到公开 [Case Submission Issue](https://github.com/edison-land/oss-bureau/issues/new?template=case-submission.yml)。
2. **接入你自己的 Skill**：在网站「判定规则 & 第三方 Skill 接入」Tab 一键复制 **Universal Output Contract** 契约给你的 Skill，产出带 `auditor_tool` 署名的 JSON 即可参与评定并署名上榜。
3. **直接提 PR**：将符合规范的 `case-bundle.v1.json` 放入 [`cases/`](cases/) 提 PR，CI 自动完成 Schema 与远端源码验真。
4. **社区听证 & 维护者销案**：在网站的 **「社区听证池」** 或 GitHub Issues 中对新线索点赞复核（👍/👎）、补充反证；若项目已修复，维护者可通过 [整改销案表单](https://github.com/edison-land/oss-bureau/issues/new?template=remediation-appeal.yml) 提交修复 Commit 更新状态。

---

## `oss-audit` 核心能力

| 能力模块 | 具体做什么 |
| :--- | :--- |
| **遥测与暗黑开关检测** | 扫描 PostHog、Sentry、Mixpanel、Segment、Amplitude、Scarf 及自定义上报端点，核实属于默认关闭（opt-in）还是默认开启（opt-out）、是否响应 `DO_NOT_TRACK`。 |
| **跨工具与敏感凭证窥探** | 重点排查越权读取其他工具配置与凭证路径的行为（`~/.claude`、`~/.codex`、`~/.cursor`、`~/.gemini`、`~/.ssh`、`~/.aws`、浏览器数据、系统钥匙串、硬件指纹）。 |
| **承诺 vs. 代码打假** | 自动提取 `README.md`、`PRIVACY.md` 与文档中的零遥测/纯本地承诺，与已核实的运行时源码逐条对照。 |
| **供应链与安全红旗** | 检查 npm 生命周期钩子（`preinstall`/`postinstall`）、`curl \| sh`、动态 `eval`/Base64 执行、关闭 TLS 证书校验、硬编码密钥模式与 `0.0.0.0` 未鉴权监听。 |
| **Git 历史溯源** | 支持 `--trace-term` 定位最早引入可疑遥测或跨工具读取的 Git Commit，严格区分“当前仍在生效”与“历史存在但已修复”。 |
| **本机隐私体检（严格只读）** | 排查本机已安装的 AI 工具、遥测关闭环境变量、编辑器配置与 MCP Server 元数据，一键生成量身定制的 Shell 关闭脚本片段。 |
| **标准化案宗导出** | 同时输出人类可读的《调查卷宗 Markdown》和通过 Schema 校验的 `case-bundle.json`，无缝对接 OSS Bureau 红黑榜与 GitHub 自动审案 Bot。 |

---

## 快速安装

### 方式一：使用 `skills` CLI（推荐）

一套兼容 Antigravity、Claude Code、Codex、Cursor 等支持 Agent Skills 规范的工具：

```bash
npx skills add edison-land/oss-bureau
```

### 方式二：手动 Clone 并软链

```bash
git clone https://github.com/edison-land/oss-bureau.git
cd oss-bureau

# Antigravity（全局）
ln -s "$(pwd)/skills/oss-audit" ~/.gemini/config/skills/oss-audit

# Claude Code（全局）
ln -s "$(pwd)/skills/oss-audit" ~/.claude/skills/oss-audit

# Codex / 通用 .agents 目录
ln -s "$(pwd)/skills/oss-audit" ~/.agents/skills/oss-audit
```

---

## 使用方法

### 1. 直接让 AI 助手执行（推荐）

- **审计某个 GitHub 开源仓库**：
  > 用 `oss-audit` 审计一下 `https://github.com/owner/repo`，重点查有没有默认开启的遥测、跨工具读凭证、供应链钩子，以及和 README 承诺不一致的地方，并导出校验通过的 `case-bundle.json`。
- **追踪某段代码是什么时候塞进去的**：
  > 审计这个本地仓库，并追踪是哪个 Git commit 最早引入了 `.claude` 读取和遥测上报。
- **体检你自己的电脑**：
  > 用 `oss-audit` 检查一下我电脑上装了哪些 AI 工具、哪些遥测开关还没关、MCP 配置干不干净，并给我一段关闭遥测的配置。

### 2. 独立运行零依赖脚本（仅需 Python 3.9+）

```bash
# 静态初筛远程 GitHub 仓库或本地目录
python3 skills/oss-audit/scripts/scan_repo.py https://github.com/owner/repo --format markdown

# 追踪最早引入特定关键词的 Git 提交（本地仓库或远程加 --full-history）
python3 skills/oss-audit/scripts/scan_repo.py /path/to/repo --trace-term ".claude" --trace-term "posthog" --format markdown

# 严格只读的本机遥测与 AI 工具体检
python3 skills/oss-audit/scripts/check_local.py --format markdown

# 校验导出的标准化案宗 JSON 是否符合 v1.0.0 Schema
python3 skills/oss-audit/scripts/validate_bundle.py path/to/case-bundle.json

# 批量校验 cases/ 目录下所有公开案宗
python3 scripts/bureau_bot.py inspect-pr --all --no-network
```

---

## 隐私与客观审计铁律

- **零联网、绝对只读**：`check_local.py` 不修改任何本机文件，不发起任何网络请求。
- **绝不碰用户密钥**：严禁读取、打印或传输 `.ssh/*`、`.aws/credentials`、`.env`、API Key、Auth Token、Cookie 或聊天记录。
- **无实锤不下结论**：`SKILL.md` 与 `bureau_bot.py` 强制要求逐行核验并引用精确文件路径、行号与 Commit，CI 自动远端校验路径真实性。
- **只谈代码事实**：客观呈现公开文档与可复现代码行为，维护者整改后可随时提交修复 Commit 标记「已整改」。

---

## 目录结构

```text
oss-bureau/
├── README.md / README.zh-CN.md / README.ja.md   # 中/英/日三语文档与红黑榜速览
├── LICENSE                                      # MIT License
├── cases/                                       # 一案一文件公开 JSON 注册表（官方 + 社区 PR 归档）
├── scripts/
│   └── bureau_bot.py                            # 零依赖 Issue/PR 验真 Bot、红黑榜规则引擎与 Issue 同步器
├── .github/
│   ├── ISSUE_TEMPLATE/                          # 案宗提交表单 & 维护者整改销案表单
│   └── workflows/
│       ├── audit-intake.yml                     # Issue/PR 自动验真打标 & 审批自动开归档 PR
│       └── deploy-pages.yml                     # 同步社区听证池 Issue 并自动部署官网红黑榜
├── web/                                         # OSS Bureau 互动红黑榜前端（React + Vite + Tailwind）
└── skills/
    └── oss-audit/
        ├── SKILL.md                             # AI 审计 SOP、防误报铁律与卷宗模板
        ├── scripts/                             # scan_repo.py / check_local.py / validate_bundle.py
        └── references/                          # rules.md & case-schema.json (v1.0.0)
```

---

## Roadmap

- [x] **`oss-audit` Skill v1.0** — 仓库静态初筛、承诺 vs. 源码对照、Git 历史溯源、本机只读体检与 `case-bundle.json` v1.0.0 规范。
- [x] **OSS Bureau 在线互动红黑榜** — 部署于 GitHub Pages：收录 15 份源码实锤案宗，支持一键导出 X 证据图、本地 JSON 沙盒定级与标准/隐私洁癖双标尺切换。
- [x] **GitHub Issue ↔ Bot ↔ PR 全公开共建闭环** — 标准化 Issue 表单、Actions 自动远端核验 Commit/源码文件与红黑定级、社区听证池联动、维护者打标自动开 PR 入库，全面兼容第三方自建 Skill。
- [ ] **定时复审追踪** — 定期监听黑榜/灰榜仓库新提交，自动提醒社区复验整改情况。

---

## 开源协议

本项目基于 [MIT License](LICENSE) 开源。
