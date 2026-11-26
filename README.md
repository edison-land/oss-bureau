# OSS Bureau — `oss-audit` Skill

**开源隐私、遥测与安全审计 Skill（开源仓库取证 + 本机 AI 工具自查）**

> 吃瓜会过去，但信任不该靠嘴，得靠代码自证。  
> Don't trust "zero telemetry" landing pages—verify the code and check your own machine.

`oss-audit` 是一个零外部依赖的标准 **Agent Skill**，兼容 **Antigravity / Claude Code / Codex / Cursor**。装上之后，你的 AI 编程助手可以按标准化流程帮你做两件事：

1. **挖开源仓库（Repo Audit）**：输入 GitHub 链接或本地路径，秒级初筛 + AI 逐行核实，专门查：
   - **隐藏 / 默认开启遥测**：PostHog、Sentry、Mixpanel、Segment 及自定义上报端点，核实默认开/关、上报字段、是否故意难关闭（Dark Patterns）。
   - **跨工具越权读取**：检查是否读取 `~/.claude`、`~/.codex`、`~/.cursor`、`~/.gemini`、`~/.ssh`、`~/.aws`、系统钥匙串、浏览器凭证或硬件指纹。
   - **承诺 vs. 代码打假（Promise vs. Reality）**：提取 `README.md` / `PRIVACY.md` 中的零遥测/纯本地承诺，逐条对照源码精确行号与 Commit Hash。
   - **供应链与安全红旗**：`postinstall` 钩子、`curl | sh`、动态执行/混淆载荷、关闭 TLS 校验、硬编码密钥、未鉴权 `0.0.0.0` 监听等。
   - **标准化卷宗导出**：同时生成可读版《调查卷宗 Markdown》与通过 Schema 校验的 `case-bundle.json`（直接对接即将上线的 **OSS Bureau 开源调查局** 互动举报与证据墙网站）。

2. **查自己电脑（Local Machine Check，严格只读）**：
   - 排查本机已安装的 AI 编程工具、CLI、IDE 及 MCP Server 清单。
   - 检查 `DO_NOT_TRACK` 及各大工具的遥测关闭环境变量与配置文件状态。
   - 一键生成量身定制的 `~/.zshrc` / `~/.bashrc` 关闭遥测配置片段。
   - **隐私铁律**：纯本地、零联网、绝不读取或打印任何 API Key、Token、Cookie、SSH 私钥或聊天记录。

---

## 快速安装 / Quick Install

### 方式一：使用 `skills` CLI（推荐，支持 Claude Code / Codex / Cursor / Antigravity）

```bash
npx skills add edison-land/oss-bureau
```

### 方式二：手动 Clone 并软链

```bash
git clone https://github.com/edison-land/oss-bureau.git
cd oss-bureau

# Antigravity (全局)
ln -s "$(pwd)/skills/oss-audit" ~/.gemini/config/skills/oss-audit

# Claude Code (全局)
ln -s "$(pwd)/skills/oss-audit" ~/.claude/skills/oss-audit

# Codex / 通用 .agents 目录
ln -s "$(pwd)/skills/oss-audit" ~/.agents/skills/oss-audit
```

---

## 使用示例 / Usage Examples

装好 Skill 后，直接用自然语言让你的 AI 助手执行：

- **审计某个 GitHub 仓库**：
  > 用 `oss-audit` 审计一下 `https://github.com/owner/repo`，重点查有没有默认遥测、跨工具读配置、或者和 README 承诺不一致的地方，并导出 `case-bundle.json`。
- **追踪某段代码何时引入**：
  > 查一下这个本地仓库里的遥测代码和 `.claude` 路径读取是什么时候哪个 commit 引入的。
- **体检自己的电脑**：
  > 用 `oss-audit` 查一下我这台电脑上装了哪些 AI 工具、遥测开关有没有关、MCP 列表干不干净。

也可以不通过 AI，直接独立运行零依赖 Python 脚本（仅需 Python 3.9+）：

```bash
# 1. 静态初筛本地或远程开源仓库
python3 skills/oss-audit/scripts/scan_repo.py https://github.com/owner/repo --format markdown

# 2. 只读体检本机 AI 工具与遥测开关
python3 skills/oss-audit/scripts/check_local.py --format markdown

# 3. 校验导出的标准化案宗 JSON
python3 skills/oss-audit/scripts/validate_bundle.py path/to/case-bundle.json
```

---

## 目录结构 / Repository Layout

```text
oss-bureau/
├── README.md
├── LICENSE
└── skills/
    └── oss-audit/
        ├── SKILL.md                  # AI 审计 SOP、防误报铁律、报告模板
        ├── scripts/
        │   ├── scan_repo.py          # 零依赖开源仓库静态初筛 & Git 引入提交追踪
        │   ├── check_local.py        # 零依赖、严格只读本机遥测与 AI 工具体检
        │   └── validate_bundle.py    # case-bundle.json Schema 校验器
        └── references/
            ├── rules.md              # 风险分级标准与误报排除清单
            └── case-schema.json      # 标准化案宗 JSON Schema (v1.0.0)
```

---

## 原则与免责 / Fair-Play Principles

- **证据优先**：只基于公开源码、精确文件路径、行号与 Commit Hash 下结论，不做无依据指控。
- **区分事实与误报**：明确区分“默认开启遥测”、“用户主动 opt-in（合规）”、“测试/示例代码”以及“已修复的历史提交”。
- **实用导向**：不仅指出风险，同时提供可执行的关闭/缓解方案。

## Roadmap

- [x] `oss-audit` Skill v1.0（仓库静态初筛 + 承诺对照 + 本机只读体检 + `case-bundle.json` Schema）
- [ ] **OSS Bureau 互动网站（开源调查局）**：支持拖入 `case-bundle.json` 一键立案、社区复现核验、“承诺 vs 源码”对照卡导出、开发者整改销案通道。
