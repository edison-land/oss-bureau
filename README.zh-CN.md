# OSS Bureau 🔍

<div align="center">

**零外部依赖 · 证据优先 · 本机严格只读 · 跨 Agent 通用 Skill**

别轻信官网的“零遥测”承诺。用代码自证，顺手体检你自己的电脑。

[English](README.md) · [**简体中文**](README.zh-CN.md) · [日本語](README.ja.md)

[![GitHub Stars](https://img.shields.io/github/stars/edison-land/oss-bureau?style=flat&color=f97316)](https://github.com/edison-land/oss-bureau/stargazers)
[![License: MIT](https://img.shields.io/badge/license-MIT-3b82f6?style=flat)](LICENSE)
[![Python 3.9+ Stdlib](https://img.shields.io/badge/Runtime-Python%203.9%2B%20Stdlib-22c55e?style=flat&logo=python&logoColor=white)](skills/oss-audit/scripts)
[![Cross-Agent Skill](https://img.shields.io/badge/Skill-Antigravity%20%7C%20Claude%20%7C%20Codex%20%7C%20Cursor-111827?style=flat)](skills/oss-audit/SKILL.md)
[![Case Bundle v1.0.0](https://img.shields.io/badge/Schema-Case%20Bundle%20v1.0.0-6366f1?style=flat)](skills/oss-audit/references/case-schema.json)

</div>

---

## 为什么做 OSS Bureau？

开发者每天都在往电脑里装各种开源 AI 编程工具、CLI、编辑器插件和 MCP Server。但现实里屡屡出现这样的情况：官网嘴上写着 **“零遥测”** 或 **“纯本地运行”**，代码里却默认开启数据上报、刻意提高关闭门槛，甚至越权去读取电脑里**其他工具的本地凭证目录**（如 `~/.claude`、`~/.codex`、`~/.ssh`、`~/.aws` 或系统钥匙串）。

**`oss-audit`** 能把你的 AI 编程助手变成一名严谨的开源隐私与安全审计员。它不是纯 Prompt 瞎猜，而是采用 **「零依赖 Python 确定性初筛脚本 + AI 逐行代码核验 SOP」** 的架构——确保每一条结论都附带精确的文件路径、行号与 Git Commit 证据。

---

## 核心能力

| 能力模块 | 具体做什么 |
| :--- | :--- |
| **遥测与暗黑开关检测** | 扫描 PostHog、Sentry、Mixpanel、Segment、Amplitude、Scarf 及自定义上报端点，核实属于默认关闭（opt-in）还是默认开启（opt-out）、是否响应 `DO_NOT_TRACK`。 |
| **跨工具与敏感凭证窥探** | 重点排查越权读取其他工具配置与凭证路径的行为（`~/.claude`、`~/.codex`、`~/.cursor`、`~/.gemini`、`~/.ssh`、`~/.aws`、浏览器数据、系统钥匙串、硬件指纹）。 |
| **承诺 vs. 代码打假** | 自动提取 `README.md`、`PRIVACY.md` 与文档中的零遥测/纯本地承诺，与已核实的运行时源码逐条对照。 |
| **供应链与安全红旗** | 检查 npm 生命周期钩子（`preinstall`/`postinstall`）、`curl \| sh`、动态 `eval`/Base64 执行、关闭 TLS 证书校验、硬编码密钥模式与 `0.0.0.0` 未鉴权监听。 |
| **Git 历史溯源** | 支持 `--trace-term` 定位最早引入可疑遥测或跨工具读取的 Git Commit，严格区分“当前仍在生效”与“历史存在但已修复”。 |
| **本机隐私体检（严格只读）** | 排查本机已安装的 AI 工具、遥测关闭环境变量、编辑器配置与 MCP Server 元数据，一键生成量身定制的 Shell 关闭脚本片段。 |
| **标准化案宗导出** | 同时输出人类可读的《调查卷宗 Markdown》和通过 Schema 校验的 `case-bundle.json`，无缝对接即将上线的 **OSS Bureau（开源调查局）** 互动平台。 |

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

装好后，直接用自然语言发指令即可：

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
```

---

## 隐私与客观审计铁律

做隐私审计的工具，必须对自己定最严的底线：

- **零联网、绝对只读**：`check_local.py` 不修改任何本机文件，不发起任何网络请求。
- **绝不碰用户密钥**：严禁读取、打印或传输 `.ssh/*`、`.aws/credentials`、`.env`、API Key、Auth Token、Cookie 或聊天记录；仅检测工具是否存在、白名单内的遥测开关值，以及剥离了环境变量/请求头的 MCP 元数据。
- **无实锤不下结论**：`SKILL.md` 强制要求逐行核验并引用精确文件路径、行号与 Commit；测试夹具、注释、死代码及合规的 opt-in 开关会被过滤，避免误报伤及无辜。
- **只谈代码事实**：客观呈现公开文档与可复现的代码行为，若维护者已在后续版本修复，报告中也会明确标注。

---

## 目录结构

```text
oss-bureau/
├── README.md                          # English documentation (default)
├── README.zh-CN.md                    # 简体中文文档
├── README.ja.md                       # 日本語ドキュメント
├── LICENSE                            # MIT License
└── skills/
    └── oss-audit/
        ├── SKILL.md                   # AI 审计 SOP、防误报铁律与卷宗模板
        ├── scripts/
        │   ├── scan_repo.py           # 零依赖仓库静态初筛 & Git 提交溯源
        │   ├── check_local.py         # 严格只读的本机隐私与遥测体检
        │   └── validate_bundle.py     # 零依赖 case-bundle.json Schema 校验器
        └── references/
            ├── rules.md               # 风险分级矩阵与常见误报排除清单
            └── case-schema.json       # OSS Bureau 标准化案宗 JSON Schema (v1.0.0)
```

---

## Roadmap

- [x] **`oss-audit` Skill v1.0** — 仓库静态初筛、承诺 vs. 源码对照、Git 历史溯源、本机只读体检与 `case-bundle.json` v1.0.0 标准规范。
- [ ] **OSS Bureau 开源调查局互动平台** — 公开案宗墙：支持直接拖入 `case-bundle.json` 发起立案、社区复现核验、一键导出「承诺 vs. 源码」对照图，以及维护者整改销案通道。

---

## 开源协议

本项目基于 [MIT License](LICENSE) 开源。
