import { useEffect, useId, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileJson,
  Send,
  Upload,
  X,
} from "lucide-react";
import type { CaseDossier, Lang } from "../types";
import { buildGitHubIssueUrl, parseCaseBundleJson } from "../utils/bundleParser";

interface SubmitTipDialogProps {
  open: boolean;
  lang: Lang;
  onClose: () => void;
  onPreviewDossier: (dossier: CaseDossier) => void;
}

export function SubmitTipDialog({
  open,
  lang,
  onClose,
  onPreviewDossier,
}: SubmitTipDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [tab, setTab] = useState<"json" | "manual">("json");

  // JSON bundle state
  const [jsonText, setJsonText] = useState("");
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parsedDossier, setParsedDossier] = useState<CaseDossier | null>(null);
  const [dragging, setDragging] = useState(false);

  // Manual tip state
  const [repoName, setRepoName] = useState("");
  const [commitHash, setCommitHash] = useState("");
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
    if (!text.trim()) {
      setParseErrors([]);
      setParsedDossier(null);
      return;
    }
    const res = parseCaseBundleJson(text);
    if (res.ok && res.dossier) {
      setParseErrors([]);
      setParsedDossier(res.dossier);
    } else {
      setParseErrors(res.errors);
      setParsedDossier(null);
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

  const githubJsonSubmitUrl = parsedDossier
    ? buildGitHubIssueUrl({
        repoName: parsedDossier.name,
        repoUrl: parsedDossier.repoUrl,
        commitHash: parsedDossier.commitHash,
        summary: parsedDossier.oneLiner.en,
        evidenceJson: jsonText,
      })
    : "#";

  const githubManualSubmitUrl = buildGitHubIssueUrl({
    repoName: repoName.trim() || "owner/repo",
    repoUrl: repoName.includes("http")
      ? repoName.trim()
      : `https://github.com/${repoName.trim() || "owner/repo"}`,
    commitHash: commitHash.trim() || undefined,
    summary: summary.trim() || "(Describe telemetry / credential access / code line links here)",
  });

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
              OSS BUREAU // INTAKE DESK
            </div>
            <h1 id={titleId} className="mt-0.5 text-lg font-bold text-white sm:text-xl">
              {lang === "zh" ? "提交线报 & 预览案宗" : "Submit Case Tip & Preview Dossier"}
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
        <div className="flex border-b border-zinc-800 bg-[#0a0e15] px-5 pt-3 sm:px-6">
          <button
            type="button"
            onClick={() => setTab("json")}
            className={`inline-flex items-center gap-2 border-b-2 px-3 pb-2.5 text-xs font-semibold transition ${
              tab === "json"
                ? "border-red-500 text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <FileJson className="h-3.5 w-3.5" />
            {lang === "zh" ? "拖入 case-bundle.json（推荐）" : "Drop case-bundle.json (Recommended)"}
          </button>
          <button
            type="button"
            onClick={() => setTab("manual")}
            className={`inline-flex items-center gap-2 border-b-2 px-3 pb-2.5 text-xs font-semibold transition ${
              tab === "manual"
                ? "border-red-500 text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Send className="h-3.5 w-3.5" />
            {lang === "zh" ? "手动填线索" : "Manual Tip"}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          {tab === "json" ? (
            <>
              <p className="text-xs leading-relaxed text-zinc-400">
                {lang === "zh"
                  ? "用 oss-audit Skill 审计完任意仓库后，把导出的 case-bundle.json 拖到下方：立即可在本地校验格式、预览完整案宗并导出 X 证据图，或一键跳转到 GitHub 发起正式立案。"
                  : "Drop or paste a case-bundle.json exported by the oss-audit Skill to validate its schema locally, preview & export a shareable PNG card, or submit directly via GitHub Issue."}
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
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition ${
                  dragging
                    ? "border-red-400 bg-red-500/10"
                    : "border-zinc-700/80 bg-[#0a0d14] hover:border-zinc-500"
                }`}
              >
                <Upload className="mb-2 h-6 w-6 text-zinc-400" />
                <span className="text-sm font-medium text-zinc-200">
                  {lang === "zh"
                    ? "拖拽 case-bundle.json 到这里，或点击选择文件"
                    : "Drag & drop case-bundle.json here, or click to select"}
                </span>
                <span className="mt-1 font-mono-code text-[11px] text-zinc-500">
                  Schema v1.0.0 • 100% client-side validation
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
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/25 p-3.5 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    {lang === "zh"
                      ? `校验通过：${parsedDossier.name}（${parsedDossier.findings.length} 条源码证据）`
                      : `Valid v1.0.0 Bundle: ${parsedDossier.name} (${parsedDossier.findings.length} findings)`}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        dialogRef.current?.close();
                        onPreviewDossier(parsedDossier);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white transition hover:bg-emerald-500"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {lang === "zh" ? "预览案宗 & 导出证据图" : "Preview & Export PNG Card"}
                    </button>
                    <a
                      href={githubJsonSubmitUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-semibold text-white transition hover:bg-zinc-700"
                    >
                      {lang === "zh" ? "一键去 GitHub 提交立案" : "Submit Case on GitHub"}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3.5">
              <div>
                <label className="mb-1 block font-mono-code text-xs text-zinc-400">
                  {lang === "zh" ? "GitHub 仓库名或链接 *" : "GitHub Repo (owner/repo or URL) *"}
                </label>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="owner/repo"
                  className="w-full rounded-lg border border-zinc-800 bg-[#07090d] px-3 py-2 font-mono-code text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-red-500/60 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono-code text-xs text-zinc-400">
                  {lang === "zh" ? "Commit Hash（可选，建议填写）" : "Commit Hash (optional)"}
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
                  {lang === "zh"
                    ? "核心事实与代码行链接（只收公开可验证证据）*"
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
              <a
                href={githubManualSubmitUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-500"
              >
                {lang === "zh" ? "生成预填 GitHub Issue 并提交" : "Open Pre-Filled GitHub Issue"}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
