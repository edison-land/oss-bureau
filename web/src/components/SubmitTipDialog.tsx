import { useEffect, useId, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  FileJson,
  GitPullRequest,
  PlusCircle,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import type { CaseDossier, Lang, TierRuleHit } from "../types";
import {
  UNIVERSAL_SKILL_CONTRACT,
  buildCaseSubmissionIssueUrl,
  buildRemediationAppealUrl,
  parseCaseBundleJson,
} from "../utils/bundleParser";

interface SubmitTipDialogProps {
  open: boolean;
  lang: Lang;
  onClose: () => void;
  onPreviewDossier: (dossier: CaseDossier) => void;
  onAddLocalCase: (dossier: CaseDossier) => void;
}

export function SubmitTipDialog({
  open,
  lang,
  onClose,
  onPreviewDossier,
  onAddLocalCase,
}: SubmitTipDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [tab, setTab] = useState<"json" | "contract" | "manual">("json");

  // JSON bundle state
  const [jsonText, setJsonText] = useState("");
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parsedDossier, setParsedDossier] = useState<CaseDossier | null>(null);
  const [ruleReasons, setRuleReasons] = useState<TierRuleHit[]>([]);
  const [dragging, setDragging] = useState(false);
  const [copiedJsonNotice, setCopiedJsonNotice] = useState(false);
  const [addedLocalNotice, setAddedLocalNotice] = useState(false);

  // Contract copy state
  const [copiedContract, setCopiedContract] = useState(false);

  // Manual tip state
  const [repoName, setRepoName] = useState("");
  const [commitHash, setCommitHash] = useState("");
  const [auditorTool, setAuditorTool] = useState("oss-audit v1.0.0");
  const [summary, setSummary] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Safari fallback for <dialog closedby="any">
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || "closedBy" in HTMLDialogElement.prototype) return;

    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    let pressedOutside = false;
    const onDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) dialog.close();
      pressedOutside = false;
    };
    dialog.addEventListener("pointerdown", onDown);
    dialog.addEventListener("pointerup", onUp);
    return () => {
      dialog.removeEventListener("pointerdown", onDown);
      dialog.removeEventListener("pointerup", onUp);
    };
  }, []);

  const handleJsonChange = (text: string) => {
    setJsonText(text);
    setAddedLocalNotice(false);
    setCopiedJsonNotice(false);
    if (!text.trim()) {
      setParseErrors([]);
      setParsedDossier(null);
      setRuleReasons([]);
      return;
    }
    const res = parseCaseBundleJson(text);
    if (res.ok && res.dossier) {
      setParseErrors([]);
      setParsedDossier(res.dossier);
      setRuleReasons(res.reasons);
    } else {
      setParseErrors(res.errors);
      setParsedDossier(null);
      setRuleReasons([]);
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    handleJsonChange(text);
  };

  const handleClose = () => {
    if (dialogRef.current) dialogRef.current.returnValue = "";
    onClose();
  };

  const handleSubmitJsonToGitHub = async () => {
    if (!parsedDossier) return;
    const { url, jsonWasTooLong } = buildCaseSubmissionIssueUrl({
      repoName: parsedDossier.name,
      commitHash: parsedDossier.commitHash,
      auditorTool: parsedDossier.auditorTool,
      evidenceJson: jsonText,
      notes: parsedDossier.oneLiner.en,
    });
    if (jsonWasTooLong) {
      try {
        await navigator.clipboard.writeText(jsonText);
        setCopiedJsonNotice(true);
      } catch {
        // Clipboard permission optional
      }
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCopyContract = async () => {
    await navigator.clipboard.writeText(UNIVERSAL_SKILL_CONTRACT);
    setCopiedContract(true);
    setTimeout(() => setCopiedContract(false), 1800);
  };

  const manualIssue = buildCaseSubmissionIssueUrl({
    repoName: repoName.trim() || "owner/repo",
    commitHash: commitHash.trim() || "",
    auditorTool: auditorTool.trim() || "custom-skill",
    notes: summary.trim() || "",
  });

  const tierBadge =
    parsedDossier?.tier === "blacklist"
      ? {
          cls: "border-red-500/60 bg-red-500/15 text-red-300",
          Icon: ShieldAlert,
          label: lang === "zh" ? "自动判定：🔴 黑榜 (BLACKLIST)" : "Computed Tier: BLACKLIST",
        }
      : parsedDossier?.tier === "watchlist"
        ? {
            cls: "border-amber-500/60 bg-amber-500/15 text-amber-300",
            Icon: ShieldQuestion,
            label: lang === "zh" ? "自动判定：🟡 灰榜 (WATCHLIST)" : "Computed Tier: WATCHLIST",
          }
        : {
            cls: "border-emerald-500/60 bg-emerald-500/15 text-emerald-300",
            Icon: ShieldCheck,
            label: lang === "zh" ? "自动判定：🟢 红榜 (CLEARED)" : "Computed Tier: CLEARED",
          };

  const ComputedTierIcon = tierBadge.Icon;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={handleClose}
      {...({ closedby: "any" } as Record<string, string>)}
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-xl border border-red-500/35 bg-[#0c1017] shadow-2xl shadow-black/80">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 bg-[#090c12] px-5 py-4 sm:px-6">
          <div>
            <div className="font-mono-code text-[11px] font-semibold uppercase tracking-widest text-red-400">
              OSS BUREAU // PUBLIC INTAKE & SKILL SANDBOX
            </div>
            <h1 id={titleId} className="mt-0.5 text-lg font-bold text-white sm:text-xl">
              {lang === "zh"
                ? "提交证据立案 / 用任意 Skill 评定红黑榜"
                : "Submit Evidence to GitHub / Classify Any Skill Bundle"}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label={lang === "zh" ? "关闭窗口" : "Close"}
            className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:border-zinc-600 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex flex-wrap border-b border-zinc-800 bg-[#0a0e15] px-5 pt-3 sm:px-6">
          <button
            type="button"
            onClick={() => setTab("json")}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 pb-2.5 text-xs font-semibold transition ${
              tab === "json"
                ? "border-red-500 text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <FileJson className="h-3.5 w-3.5" />
            {lang === "zh" ? "拖入 JSON 即时定级 & 固证" : "Drop JSON & Classify"}
          </button>
          <button
            type="button"
            onClick={() => setTab("contract")}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 pb-2.5 text-xs font-semibold transition ${
              tab === "contract"
                ? "border-red-500 text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {lang === "zh" ? "用你自己的 Skill 接入" : "Use Your Own Skill"}
          </button>
          <button
            type="button"
            onClick={() => setTab("manual")}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 pb-2.5 text-xs font-semibold transition ${
              tab === "manual"
                ? "border-red-500 text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Send className="h-3.5 w-3.5" />
            {lang === "zh" ? "手动发 Issue / 整改申诉" : "Manual Issue / Appeal"}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          {tab === "json" && (
            <>
              <p className="text-xs leading-relaxed text-zinc-400">
                {lang === "zh"
                  ? "支持 oss-audit 或任何第三方 Skill 产出的 case-bundle.json (v1.0.0)。拖入后先在浏览器按公开规则当场算红/灰/黑，可暂存到本机榜单对比，或一键提交到公开 GitHub Issue 由 Bot 自动验真并生成归档 PR。"
                  : "Drop a case-bundle.json (v1.0.0) from oss-audit or any custom Skill. Validate locally against the public tier rules, pin to your local board for comparison, or submit to a public GitHub Issue for automated Bot verification & PR archiving."}
              </p>

              {/* Dropzone */}
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  void handleFile(e.dataTransfer.files?.[0]);
                }}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition ${
                  dragging
                    ? "border-red-400 bg-red-500/10"
                    : "border-zinc-700/80 bg-[#0a0d14] hover:border-zinc-500"
                }`}
              >
                <Upload className="mb-2 h-5 w-5 text-zinc-400" />
                <span className="text-sm font-medium text-zinc-200">
                  {lang === "zh"
                    ? "拖拽 case-bundle.json 到这里，或点击选择文件"
                    : "Drag & drop case-bundle.json here, or click to select"}
                </span>
                <span className="mt-1 font-mono-code text-[11px] text-zinc-500">
                  Schema v1.0.0 • Open protocol for oss-audit & custom Skills
                </span>
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => void handleFile(e.target.files?.[0])}
                />
              </label>

              <textarea
                value={jsonText}
                onChange={(e) => handleJsonChange(e.target.value)}
                rows={6}
                placeholder={
                  lang === "zh"
                    ? "也可以直接粘贴 case-bundle.json 内容..."
                    : "Or paste case-bundle.json contents directly..."
                }
                className="w-full rounded-lg border border-zinc-800 bg-[#07090d] p-3 font-mono-code text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-red-500/60 focus:outline-none"
              />

              {parseErrors.length > 0 && (
                <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-xs text-red-200">
                  <div className="mb-1 flex items-center gap-1.5 font-semibold text-red-300">
                    <AlertCircle className="h-4 w-4" />
                    {lang === "zh" ? "Schema 校验未通过" : "Schema Validation Failed"}
                  </div>
                  <ul className="list-disc space-y-0.5 pl-5 font-mono-code">
                    {parseErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {parsedDossier && (
                <div className="space-y-3 rounded-xl border border-zinc-700/80 bg-[#0f141e] p-4 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-semibold text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>
                        {parsedDossier.name} ({parsedDossier.findings.length}{" "}
                        {lang === "zh" ? "条源码证据" : "findings"})
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono-code text-[11px] font-bold ${tierBadge.cls}`}
                    >
                      <ComputedTierIcon className="h-3.5 w-3.5" />
                      {tierBadge.label}
                    </span>
                  </div>

                  {/* Rule Engine Explanation */}
                  <div className="rounded-lg border border-zinc-800 bg-[#080b10] p-3">
                    <div className="mb-1.5 font-mono-code text-[11px] font-semibold uppercase text-zinc-400">
                      {lang === "zh"
                        ? `公开规则引擎判定依据 · Skill: ${parsedDossier.auditorTool}`
                        : `Public Rule Engine Reasoning · Skill: ${parsedDossier.auditorTool}`}
                    </div>
                    <ul className="space-y-1 text-zinc-300">
                      {ruleReasons.map((r) => (
                        <li key={r.rule} className="flex items-start gap-2">
                          <span className="mt-0.5 rounded bg-zinc-800 px-1.5 py-0.5 font-mono-code text-[10px] text-zinc-300">
                            {r.rule}
                          </span>
                          <span>{r[lang]}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {copiedJsonNotice && (
                    <div className="rounded-lg border border-sky-500/40 bg-sky-950/30 px-3 py-2 text-sky-200">
                      {lang === "zh"
                        ? "JSON 较长，已自动完整复制到剪贴板：在刚打开的 GitHub Issue 表单 JSON 框内按 Cmd/Ctrl+V 粘贴即可，不会截断证据。"
                        : "Bundle exceeded URL length and was copied to your clipboard — press Cmd/Ctrl+V inside the GitHub Issue JSON field."}
                    </div>
                  )}

                  {addedLocalNotice && (
                    <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-emerald-200">
                      {lang === "zh"
                        ? "已加入当前页面红黑榜（带 LOCAL SANDBOX 标记，仅存你本地浏览器，可随时移除）。"
                        : "Pinned to your local board view with a LOCAL SANDBOX badge (saved in localStorage)."}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        onAddLocalCase(parsedDossier);
                        setAddedLocalNotice(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-600/20 px-3 py-1.5 font-semibold text-emerald-200 transition hover:bg-emerald-600/30"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      {lang === "zh" ? "暂存到本机榜单对比" : "Pin to Local Board"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        dialogRef.current?.close();
                        onPreviewDossier(parsedDossier);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-semibold text-zinc-100 transition hover:bg-zinc-700"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {lang === "zh" ? "预览卷宗 & 导出 PNG" : "Preview & Export PNG"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSubmitJsonToGitHub()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white transition hover:bg-red-500"
                    >
                      {lang === "zh"
                        ? "固定证据到 GitHub Issue（Bot 自动验真）"
                        : "Submit Evidence Issue (Auto-Verified)"}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === "contract" && (
            <div className="space-y-4 text-xs leading-relaxed text-zinc-300">
              <div className="rounded-xl border border-zinc-800 bg-[#0a0f18] p-4">
                <h2 className="text-sm font-bold text-white">
                  {lang === "zh"
                    ? "任何 Skill / AI 都能参与共建红黑榜（开放取证协议）"
                    : "Open Protocol: Bring Your Own Skill or Auditor"}
                </h2>
                <p className="mt-1.5 text-zinc-400">
                  {lang === "zh"
                    ? "OSS Bureau 把「事实取证」与「红黑裁定」解耦：不管你用的是 oss-audit 还是自己写的 Claude / Codex / Cursor 安全 Skill，只需输出符合 case-bundle.v1.json 规范的客观代码证据，并在 auditor_tool 署名你的 Skill。提交到 GitHub Issue 后，Bot 会自动校验目标仓库 Commit 与文件真伪，并按同一套公开标尺评定红/灰/黑，审批后自动开 PR 入库。"
                    : "OSS Bureau decouples evidence gathering from tier classification. Whether you use oss-audit or your own custom audit Skill, output a valid case-bundle.v1.json with your Skill name in `auditor_tool`. Our GitHub Action Bot verifies target commits & file paths remotely, computes the tier under public rules, and opens an archive PR once approved."}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-zinc-800 bg-[#070a0f] p-2.5">
                    <div className="font-mono-code text-[11px] font-bold text-red-300">
                      1. RUN ANY SKILL
                    </div>
                    <div className="mt-1 text-zinc-400">
                      {lang === "zh"
                        ? "把下方契约粘进你的 Skill 或 Prompt，产出 case-bundle.json。"
                        : "Paste the contract below into your Skill or prompt to emit case-bundle.json."}
                    </div>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-[#070a0f] p-2.5">
                    <div className="font-mono-code text-[11px] font-bold text-amber-300">
                      2. PIN TO GITHUB ISSUE
                    </div>
                    <div className="mt-1 text-zinc-400">
                      {lang === "zh"
                        ? "把 JSON 固定到公开 Issue，Bot 自动验真 Commit 与源码路径并算级。"
                        : "Post the JSON in a Case Issue; our Bot verifies remote commits & file paths."}
                    </div>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-[#070a0f] p-2.5">
                    <div className="font-mono-code text-[11px] font-bold text-emerald-300">
                      3. AUTO PR → LIVE BOARD
                    </div>
                    <div className="mt-1 text-zinc-400">
                      {lang === "zh"
                        ? "维护者打 approved 标签自动开 PR，合并后署名你的 Skill 自动上榜。"
                        : "Once labeled `approved`, Bot opens a PR into `cases/` and deploys live."}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono-code text-[11px] font-semibold uppercase text-zinc-400">
                    Universal Output Contract Prompt (v1.0.0)
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyContract}
                    className="inline-flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 font-mono-code text-[11px] text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                  >
                    {copiedContract ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        {lang === "zh" ? "已复制契约" : "Copied"}
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        {lang === "zh" ? "一键复制给你的 Skill" : "Copy Contract"}
                      </>
                    )}
                  </button>
                </div>
                <pre className="max-h-60 overflow-auto rounded-lg border border-zinc-800 bg-[#07090d] p-3 font-mono-code text-[11px] text-zinc-300">
                  <code>{UNIVERSAL_SKILL_CONTRACT}</code>
                </pre>
              </div>

              <div className="flex flex-wrap gap-2">
                <a
                  href="https://github.com/edison-land/oss-bureau/issues/new?template=case-submission.yml"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 font-semibold text-white transition hover:bg-red-500"
                >
                  {lang === "zh" ? "打开 GitHub 案宗提交表单" : "Open Case Submission Issue Form"}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <a
                  href="https://github.com/edison-land/oss-bureau/tree/main/cases"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2 font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                >
                  <GitPullRequest className="h-3.5 w-3.5" />
                  {lang === "zh" ? "直接查看 cases/ 提 PR" : "Contribute Directly via PR"}
                </a>
              </div>
            </div>
          )}

          {tab === "manual" && (
            <div className="space-y-3.5">
              <div>
                <label className="mb-1 block font-mono-code text-xs text-zinc-400">
                  {lang === "zh" ? "GitHub 仓库名 (owner/repo) *" : "GitHub Repo (owner/repo) *"}
                </label>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="owner/repo"
                  className="w-full rounded-lg border border-zinc-800 bg-[#07090d] px-3 py-2 font-mono-code text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-red-500/60 focus:outline-none"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-mono-code text-xs text-zinc-400">
                    {lang === "zh" ? "Commit Hash" : "Commit Hash"}
                  </label>
                  <input
                    type="text"
                    value={commitHash}
                    onChange={(e) => setCommitHash(e.target.value)}
                    placeholder="e.g. 84e4264bb3"
                    className="w-full rounded-lg border border-zinc-800 bg-[#07090d] px-3 py-2 font-mono-code text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-red-500/60 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono-code text-xs text-zinc-400">
                    {lang === "zh" ? "审计所用 Skill / 工具" : "Auditor Skill / Tool"}
                  </label>
                  <input
                    type="text"
                    value={auditorTool}
                    onChange={(e) => setAuditorTool(e.target.value)}
                    placeholder="oss-audit v1.0.0"
                    className="w-full rounded-lg border border-zinc-800 bg-[#07090d] px-3 py-2 font-mono-code text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-red-500/60 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-mono-code text-xs text-zinc-400">
                  {lang === "zh"
                    ? "核心事实与源码行号链接（只收公开可验证证据）*"
                    : "Verified Facts & Source Permalinks *"}
                </label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={4}
                  placeholder={
                    lang === "zh"
                      ? "简述默认遥测、跨工具读取或文档承诺矛盾，附上 GitHub 文件行号链接..."
                      : "Describe default telemetry, cross-tool reads, or README contradictions with file:line permalinks..."
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-[#07090d] p-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-red-500/60 focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={manualIssue.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-500"
                >
                  {lang === "zh" ? "打开预填 GitHub Issue 表单" : "Open Pre-Filled Case Issue"}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <a
                  href={buildRemediationAppealUrl({
                    caseId: "CASE-XXX",
                    repoName: repoName.trim() || "owner/repo",
                    explanation: summary.trim(),
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                >
                  {lang === "zh" ? "维护者整改销案 / 误报申诉" : "Maintainer Remediation Appeal"}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
