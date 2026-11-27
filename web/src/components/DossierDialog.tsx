import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  FileCode2,
  GitCommitHorizontal,
  MessageSquare,
  Scale,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Terminal,
  X,
} from "lucide-react";
import type { CaseDossier, Lang, SeverityProfile } from "../types";
import { exportCaseCardPng } from "../utils/exportCard";
import {
  buildCaseSubmissionIssueUrl,
  buildRemediationAppealUrl,
  evaluateTier,
} from "../utils/bundleParser";

interface DossierDialogProps {
  dossier: CaseDossier | null;
  lang: Lang;
  profile?: SeverityProfile;
  onClose: () => void;
}

export function DossierDialog({
  dossier,
  lang,
  profile = "standard",
  onClose,
}: DossierDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (dossier && !dialog.open) {
      dialog.showModal();
    } else if (!dossier && dialog.open) {
      dialog.close();
    }
  }, [dossier]);

  // Safari fallback for <dialog closedby="any"> light-dismiss
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

  const evaluation = useMemo(() => {
    if (!dossier) return null;
    const res = evaluateTier(
      {
        riskLevel: dossier.riskLevel,
        promiseVsReality: dossier.promiseVsReality,
        defaultTelemetry: dossier.defaultTelemetry,
        crossToolAccess: dossier.crossToolAccess,
        doNotTrack: dossier.doNotTrack,
      },
      profile,
    );
    return {
      tier: profile === "standard" ? dossier.tier : res.tier,
      reasons: res.reasons,
    };
  }, [dossier, profile]);

  const handleClose = () => {
    if (dialogRef.current) {
      dialogRef.current.returnValue = "";
    }
    onClose();
  };

  const handleCopyMitigation = async () => {
    if (!dossier) return;
    await navigator.clipboard.writeText(dossier.mitigationCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleSubmitLocalBundle = async () => {
    if (!dossier) return;
    const { url, jsonWasTooLong } = buildCaseSubmissionIssueUrl({
      repoName: dossier.name,
      commitHash: dossier.commitHash,
      auditorTool: dossier.auditorTool,
      evidenceJson: dossier.rawBundleJson,
      notes: dossier.oneLiner.en,
    });
    if (jsonWasTooLong && dossier.rawBundleJson) {
      await navigator.clipboard.writeText(dossier.rawBundleJson).catch(() => {});
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const activeTier = evaluation?.tier ?? dossier?.tier ?? "cleared";
  const tierStyle =
    activeTier === "blacklist"
      ? {
          border: "border-red-500/40",
          badge: "border-red-500/70 bg-red-500/15 text-red-300",
          label: lang === "zh" ? "实锤黑榜 // BLACKLIST" : "BLACKLIST // VERIFIED",
          Icon: ShieldAlert,
        }
      : activeTier === "watchlist"
        ? {
            border: "border-amber-500/40",
            badge: "border-amber-500/70 bg-amber-500/15 text-amber-300",
            label: lang === "zh" ? "灰榜观察 // WATCHLIST" : "WATCHLIST // CAUTION",
            Icon: ShieldQuestion,
          }
        : {
            border: "border-emerald-500/40",
            badge: "border-emerald-500/70 bg-emerald-500/15 text-emerald-300",
            label: lang === "zh" ? "红榜通过 // CLEARED" : "CLEARED // CLEAN",
            Icon: ShieldCheck,
          };

  const TierIcon = tierStyle.Icon;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={handleClose}
      {...({ closedby: "any" } as Record<string, string>)}
    >
      {dossier && (
        <div
          className={`flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-xl border ${tierStyle.border} bg-[#0c1017] shadow-2xl shadow-black/80`}
        >
          {/* Top Dossier Bar */}
          <div className="flex items-start justify-between gap-4 border-b border-zinc-800/90 bg-[#090c12] px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2 font-mono-code text-xs text-zinc-400">
                <span className="rounded bg-zinc-800/90 px-2 py-0.5 font-semibold text-zinc-200">
                  {dossier.caseId}
                </span>
                <span className={`stamp-badge inline-flex items-center gap-1 rounded px-2 py-0.5 font-bold ${tierStyle.badge}`}>
                  <TierIcon className="h-3.5 w-3.5" />
                  {tierStyle.label}
                </span>
                {dossier.status === "PARTIALLY_PATCHED" && (
                  <span className="rounded border border-sky-500/50 bg-sky-500/10 px-2 py-0.5 text-sky-300">
                    {lang === "zh" ? "已部分整改" : "PARTIALLY PATCHED"}
                  </span>
                )}
                {dossier.sourceType === "community" && (
                  <span className="rounded border border-indigo-500/50 bg-indigo-500/15 px-2 py-0.5 text-indigo-300">
                    {lang === "zh" ? "社区 PR 归档" : "COMMUNITY ARCHIVED"}
                  </span>
                )}
                {dossier.isCustomPreview && (
                  <span className="rounded border border-purple-500/50 bg-purple-500/15 px-2 py-0.5 text-purple-300">
                    {lang === "zh" ? "本地沙盒预览" : "LOCAL SANDBOX"}
                  </span>
                )}
              </div>
              <h1 id={titleId} className="truncate text-xl font-bold text-white sm:text-2xl">
                {dossier.name}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono-code text-xs text-zinc-400">
                <a
                  href={dossier.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-zinc-300 underline decoration-zinc-600 underline-offset-2 hover:text-white"
                >
                  GitHub <ExternalLink className="h-3 w-3" />
                </a>
                <span className="inline-flex items-center gap-1">
                  <GitCommitHorizontal className="h-3.5 w-3.5" />
                  {dossier.commitHash} ({dossier.branch})
                </span>
                {dossier.stars && <span>★ {dossier.stars.toLocaleString()}</span>}
                <span>
                  {lang === "zh" ? "审计日期" : "Audited"}: {dossier.auditedDate}
                </span>
                {dossier.auditorTool && (
                  <span className="inline-flex items-center gap-1 text-zinc-300">
                    <Cpu className="h-3 w-3 text-zinc-500" />
                    {dossier.auditorTool}
                  </span>
                )}
                {dossier.submittedBy && <span>by @{dossier.submittedBy}</span>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label={lang === "zh" ? "关闭案宗" : "Close dossier"}
              className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-2 text-zinc-400 transition hover:border-zinc-600 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable Dossier Body */}
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
            {/* 4 Key Signals */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="rounded-lg border border-zinc-800/90 bg-[#101520] p-3">
                <div className="font-mono-code text-[11px] uppercase text-zinc-500">
                  {lang === "zh" ? "默认遥测" : "Default Telemetry"}
                </div>
                <div className="mt-1 font-mono-code text-sm font-bold text-zinc-100">
                  {dossier.defaultTelemetry}
                </div>
              </div>
              <div className="rounded-lg border border-zinc-800/90 bg-[#101520] p-3">
                <div className="font-mono-code text-[11px] uppercase text-zinc-500">
                  DO_NOT_TRACK
                </div>
                <div className="mt-1 font-mono-code text-sm font-bold text-zinc-100">
                  {dossier.doNotTrack}
                </div>
              </div>
              <div className="rounded-lg border border-zinc-800/90 bg-[#101520] p-3">
                <div className="font-mono-code text-[11px] uppercase text-zinc-500">
                  {lang === "zh" ? "跨工具窃密/关联" : "Cross-Tool Access"}
                </div>
                <div
                  className={`mt-1 font-mono-code text-sm font-bold ${
                    dossier.crossToolAccess ? "text-red-400" : "text-emerald-400"
                  }`}
                >
                  {dossier.crossToolAccess
                    ? lang === "zh"
                      ? "是 (YES)"
                      : "YES"
                    : lang === "zh"
                      ? "否 (NO)"
                      : "NO"}
                </div>
              </div>
              <div className="rounded-lg border border-zinc-800/90 bg-[#101520] p-3">
                <div className="font-mono-code text-[11px] uppercase text-zinc-500">
                  {lang === "zh" ? "承诺 vs 源码" : "Promise vs Code"}
                </div>
                <div
                  className={`mt-1 font-mono-code text-xs font-bold ${
                    dossier.promiseVsReality === "DIRECT_CONTRADICTION"
                      ? "text-red-400"
                      : dossier.promiseVsReality === "PARTIAL_MISMATCH"
                        ? "text-amber-300"
                        : "text-emerald-400"
                  }`}
                >
                  {dossier.promiseVsReality}
                </div>
              </div>
            </div>

            {/* Public Rule Reasoning */}
            {evaluation && (
              <div className="rounded-lg border border-zinc-800/80 bg-[#0a0f18] p-3.5 text-xs">
                <div className="mb-1.5 flex items-center justify-between gap-2 font-mono-code text-[11px] font-semibold uppercase text-zinc-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Scale className="h-3.5 w-3.5 text-zinc-400" />
                    {lang === "zh"
                      ? `公开判定依据 (${profile === "strict" ? "隐私洁癖标尺" : "标准标尺"})`
                      : `Public Rule Reasoning (${profile === "strict" ? "Strict Profile" : "Standard Profile"})`}
                  </span>
                </div>
                <ul className="space-y-1 text-zinc-300">
                  {evaluation.reasons.map((r) => (
                    <li key={r.rule} className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 font-mono-code text-[10px] text-zinc-300">
                        {r.rule}
                      </span>
                      <span>{r[lang]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* One-Liner Verdict */}
            <div className="rounded-lg border border-zinc-800 bg-[#111622] p-4">
              <div className="mb-1.5 font-mono-code text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {lang === "zh" ? "调查结论 // ONE-LINER VERDICT" : "ONE-LINER VERDICT"}
              </div>
              <p className="text-sm leading-relaxed text-zinc-200">{dossier.oneLiner[lang]}</p>
              <div className="mt-3 grid gap-2 border-t border-zinc-800/80 pt-3 text-xs text-zinc-400 sm:grid-cols-2">
                <div>
                  <span className="font-semibold text-zinc-300">
                    {lang === "zh" ? "跨工具读取说明：" : "Cross-tool note: "}
                  </span>
                  {dossier.crossToolNote[lang]}
                </div>
                <div>
                  <span className="font-semibold text-zinc-300">
                    {lang === "zh" ? "硬件指纹情况：" : "Hardware fingerprint: "}
                  </span>
                  {dossier.hardwareFingerprint[lang]}
                </div>
              </div>
            </div>

            {/* Promise vs Reality Quote */}
            {dossier.promiseQuote && (
              <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-4">
                <div className="mb-1.5 font-mono-code text-xs font-semibold uppercase text-red-300">
                  {lang === "zh" ? "公开承诺原文" : "PUBLIC PROMISE QUOTE"}{" "}
                  {dossier.promiseSource ? `(${dossier.promiseSource})` : ""}
                </div>
                <blockquote className="border-l-2 border-red-400/60 pl-3 font-mono-code text-xs italic text-red-100/90">
                  "{dossier.promiseQuote}"
                </blockquote>
              </div>
            )}

            {/* Verified Code Findings */}
            <div>
              <h2 className="mb-3 flex items-center gap-2 font-mono-code text-xs font-semibold uppercase tracking-wider text-zinc-400">
                <FileCode2 className="h-4 w-4 text-zinc-300" />
                {lang === "zh"
                  ? `核实后的源码证据 (${dossier.findings.length})`
                  : `VERIFIED CODE EVIDENCE (${dossier.findings.length})`}
              </h2>
              {dossier.findings.length === 0 ? (
                <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/15 p-4 text-sm text-emerald-200">
                  {lang === "zh"
                    ? "本次静态与源码核验未发现活跃遥测、跨工具窃密或高危安全隐患。"
                    : "No active telemetry, cross-tool credential snooping, or high-risk security red flags found."}
                </div>
              ) : (
                <div className="space-y-3">
                  {dossier.findings.map((f) => (
                    <div
                      key={f.id}
                      className="rounded-lg border border-zinc-800/90 bg-[#0f141d] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono-code text-[11px] font-bold ${
                              f.severity === "HIGH" || f.severity === "CRITICAL"
                                ? "bg-red-500/20 text-red-300"
                                : f.severity === "MEDIUM"
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "bg-zinc-700/60 text-zinc-300"
                            }`}
                          >
                            {f.severity}
                          </span>
                          <span className="font-mono-code text-xs text-zinc-500">{f.id}</span>
                          <h3 className="text-sm font-semibold text-zinc-100">{f.title[lang]}</h3>
                        </div>
                        {f.permalink && (
                          <a
                            href={f.permalink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-mono-code text-xs text-sky-400 hover:text-sky-300"
                          >
                            {f.filePath}:{f.lineRange}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-zinc-300">
                        {f.summary[lang]}
                      </p>
                      <pre className="mt-2.5 overflow-x-auto rounded border border-zinc-800 bg-[#07090d] p-3 font-mono-code text-xs text-red-200/90">
                        <code>{f.codeSnippet}</code>
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Practical User Mitigation */}
            <div className="rounded-lg border border-emerald-500/25 bg-[#0c1414] p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-mono-code text-xs font-semibold uppercase tracking-wider text-emerald-300">
                  <Terminal className="h-4 w-4" />
                  {lang === "zh" ? "如果你装了它怎么办（自救命令）" : "HOW TO DISABLE / MITIGATE"}
                </div>
                <button
                  type="button"
                  onClick={handleCopyMitigation}
                  className="inline-flex items-center gap-1.5 rounded border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 font-mono-code text-xs text-emerald-200 transition hover:bg-emerald-500/20"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? (lang === "zh" ? "已复制" : "Copied") : lang === "zh" ? "复制" : "Copy"}
                </button>
              </div>
              <p className="mb-2 text-xs text-zinc-400">{dossier.mitigationNote[lang]}</p>
              <pre className="overflow-x-auto rounded border border-zinc-800 bg-[#07090d] p-3 font-mono-code text-xs text-emerald-200">
                <code>{dossier.mitigationCommand}</code>
              </pre>
            </div>
          </div>

          {/* Footer Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/90 bg-[#090c12] px-5 py-3.5 sm:px-6">
            <button
              type="button"
              onClick={() => exportCaseCardPng({ ...dossier, tier: activeTier }, lang)}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/90 px-3.5 py-2 text-xs font-semibold text-white transition hover:border-zinc-500 hover:bg-zinc-700"
            >
              <Download className="h-4 w-4" />
              {lang === "zh" ? "导出 X 证据图 (PNG)" : "Export Evidence Card (PNG)"}
            </button>
            <div className="flex flex-wrap items-center gap-2">
              {dossier.evidenceIssueUrl && (
                <a
                  href={dossier.evidenceIssueUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-3 py-2 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-500/25"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  {lang === "zh"
                    ? `原证据 Issue #${dossier.evidenceIssueNumber ?? ""}`
                    : `Evidence Issue #${dossier.evidenceIssueNumber ?? ""}`}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {dossier.isCustomPreview ? (
                <button
                  type="button"
                  onClick={() => void handleSubmitLocalBundle()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-500"
                >
                  {lang === "zh" ? "提交到 GitHub Issue 固证" : "Submit Evidence Issue"}
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              ) : (
                <a
                  href={buildRemediationAppealUrl({
                    caseId: dossier.caseId,
                    repoName: dossier.name,
                    explanation:
                      lang === "zh"
                        ? `针对 ${dossier.caseId} (${dossier.name}) 提交修复 Commit 或补充新证据：`
                        : `Fix commit or follow-up evidence for ${dossier.caseId} (${dossier.name}):`,
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                >
                  {lang === "zh" ? "补充证据 / 整改销案" : "Add Evidence / Claim Fix"}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
