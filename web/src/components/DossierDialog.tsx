import { useMemo, useState } from "react";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  GitCommitHorizontalIcon,
  MessageSquareIcon,
} from "lucide-react";
import type { CaseDossier, Lang, SeverityProfile } from "../types";
import { exportCaseCardPng } from "../utils/exportCard";
import {
  buildCaseSubmissionIssueUrl,
  buildRemediationAppealUrl,
  evaluateTier,
} from "../utils/bundleParser";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "./ui/dialog";
import { Frame, FramePanel } from "./ui/frame";
import { Separator } from "./ui/separator";

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
  const [copied, setCopied] = useState(false);

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
  const tierBadge =
    activeTier === "blacklist"
      ? {
          variant: "error" as const,
          dot: "bg-destructive",
          label: lang === "zh" ? "黑榜" : "Flagged",
        }
      : activeTier === "watchlist"
        ? {
            variant: "warning" as const,
            dot: "bg-warning",
            label: lang === "zh" ? "灰榜" : "Watch",
          }
        : {
            variant: "success" as const,
            dot: "bg-success",
            label: lang === "zh" ? "红榜" : "Clean",
          };

  return (
    <Dialog
      open={Boolean(dossier)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPopup className="max-w-3xl">
        {dossier && (
          <>
            <DialogHeader className="pr-12">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="font-mono">
                  {dossier.caseId}
                </Badge>
                <Badge variant={tierBadge.variant}>
                  <span aria-hidden="true" className={`size-1.5 rounded-full ${tierBadge.dot}`} />
                  {tierBadge.label}
                </Badge>
                {dossier.status === "PARTIALLY_PATCHED" && (
                  <Badge variant="info">
                    {lang === "zh" ? "部分整改" : "Partially patched"}
                  </Badge>
                )}
                {dossier.sourceType === "community" && (
                  <Badge variant="secondary">
                    {lang === "zh" ? "社区归档" : "Community PR"}
                  </Badge>
                )}
                {dossier.isCustomPreview && (
                  <Badge variant="secondary">
                    {lang === "zh" ? "本地沙盒" : "Local sandbox"}
                  </Badge>
                )}
              </div>

              <DialogTitle className="mt-1 tracking-tight">{dossier.name}</DialogTitle>

              <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
                <a
                  href={dossier.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
                >
                  github.com/{dossier.name}
                  <ExternalLinkIcon className="size-3" />
                </a>
                <span className="inline-flex items-center gap-1">
                  <GitCommitHorizontalIcon className="size-3.5" />
                  {dossier.commitHash} ({dossier.branch})
                </span>
                {dossier.stars && (
                  <span className="tabular-nums">{dossier.stars.toLocaleString()} stars</span>
                )}
                <span>{dossier.auditedDate}</span>
                {dossier.auditorTool && <span>via {dossier.auditorTool}</span>}
                {dossier.submittedBy && <span>by @{dossier.submittedBy}</span>}
              </DialogDescription>
            </DialogHeader>

            <DialogPanel className="space-y-5">
              {/* 4 Key Signals in a clean coss Frame */}
              <Frame>
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                  <FramePanel className="p-3.5">
                    <div className="text-muted-foreground text-xs">
                      {lang === "zh" ? "默认遥测" : "Default telemetry"}
                    </div>
                    <div className="mt-1 font-mono font-medium text-sm">
                      {dossier.defaultTelemetry}
                    </div>
                  </FramePanel>
                  <FramePanel className="p-3.5">
                    <div className="text-muted-foreground text-xs">DO_NOT_TRACK</div>
                    <div className="mt-1 font-mono font-medium text-sm">{dossier.doNotTrack}</div>
                  </FramePanel>
                  <FramePanel className="p-3.5">
                    <div className="text-muted-foreground text-xs">
                      {lang === "zh" ? "跨工具访问" : "Cross-tool access"}
                    </div>
                    <div
                      className={`mt-1 font-mono font-medium text-sm ${
                        dossier.crossToolAccess
                          ? "text-destructive-foreground"
                          : "text-success-foreground"
                      }`}
                    >
                      {dossier.crossToolAccess ? "YES" : "NO"}
                    </div>
                  </FramePanel>
                  <FramePanel className="p-3.5">
                    <div className="text-muted-foreground text-xs">
                      {lang === "zh" ? "承诺 vs 源码" : "Docs vs code"}
                    </div>
                    <div className="mt-1 truncate font-mono font-medium text-xs leading-5">
                      {dossier.promiseVsReality}
                    </div>
                  </FramePanel>
                </div>
              </Frame>

              {/* Summary + notes */}
              <div className="space-y-3">
                <p className="text-sm leading-relaxed text-foreground">{dossier.oneLiner[lang]}</p>
                <div className="grid gap-3 rounded-xl border bg-muted/40 p-3.5 text-xs sm:grid-cols-2">
                  <div>
                    <div className="font-medium text-foreground">
                      {lang === "zh" ? "跨工具读取说明" : "Cross-tool behavior"}
                    </div>
                    <div className="mt-1 leading-relaxed text-muted-foreground">
                      {dossier.crossToolNote[lang]}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-foreground">
                      {lang === "zh" ? "设备指纹" : "Hardware fingerprint"}
                    </div>
                    <div className="mt-1 leading-relaxed text-muted-foreground">
                      {dossier.hardwareFingerprint[lang]}
                    </div>
                  </div>
                </div>
              </div>

              {/* Public Rule Engine Reasoning */}
              {evaluation && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    {lang === "zh"
                      ? `公开规则判定依据（${profile === "strict" ? "隐私洁癖标尺" : "标准标尺"}）`
                      : `Classification basis (${profile === "strict" ? "Strict profile" : "Standard profile"})`}
                  </div>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    {evaluation.reasons.map((r) => (
                      <li key={r.rule} className="flex items-start gap-2">
                        <Badge variant="outline" size="sm" className="mt-0.5 shrink-0 font-mono">
                          {r.rule}
                        </Badge>
                        <span className="leading-relaxed text-foreground">{r[lang]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Promise Quote */}
              {dossier.promiseQuote && (
                <div className="rounded-xl border border-destructive/25 bg-destructive/4 p-4">
                  <div className="font-mono text-xs text-destructive-foreground">
                    {lang === "zh" ? "公开文档承诺" : "Public documentation claim"}
                    {dossier.promiseSource ? ` · ${dossier.promiseSource}` : ""}
                  </div>
                  <blockquote className="mt-2 border-l-2 border-destructive/40 pl-3 text-sm italic text-foreground">
                    “{dossier.promiseQuote}”
                  </blockquote>
                </div>
              )}

              <Separator />

              {/* Verified Code Findings */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">
                    {lang === "zh"
                      ? `源码核实证据 (${dossier.findings.length})`
                      : `Verified code findings (${dossier.findings.length})`}
                  </h3>
                </div>

                {dossier.findings.length === 0 ? (
                  <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
                    {lang === "zh"
                      ? "本次静态与源码核验未发现活跃遥测、跨工具凭证读取或高危安全红旗。"
                      : "No active telemetry, undisclosed cross-tool access, or high-risk security findings verified in runtime code."}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dossier.findings.map((f) => (
                      <div key={f.id} className="rounded-xl border bg-card p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              size="sm"
                              variant={
                                f.severity === "CRITICAL" || f.severity === "HIGH"
                                  ? "error"
                                  : f.severity === "MEDIUM"
                                    ? "warning"
                                    : "secondary"
                              }
                            >
                              {f.severity}
                            </Badge>
                            <span className="font-mono text-xs text-muted-foreground">{f.id}</span>
                            <span className="font-medium text-sm text-foreground">
                              {f.title[lang]}
                            </span>
                          </div>
                          {f.permalink && (
                            <a
                              href={f.permalink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
                            >
                              {f.filePath}:{f.lineRange}
                              <ExternalLinkIcon className="size-3" />
                            </a>
                          )}
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                          {f.summary[lang]}
                        </p>
                        <pre className="mt-3 overflow-x-auto rounded-lg border bg-sidebar p-3 font-mono text-xs text-foreground">
                          <code>{f.codeSnippet}</code>
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Mitigation */}
              <div className="rounded-xl border bg-muted/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm">
                      {lang === "zh" ? "如何关闭遥测 / 自救配置" : "Mitigation & opt-out"}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {dossier.mitigationNote[lang]}
                    </p>
                  </div>
                  <Button size="xs" variant="outline" onClick={handleCopyMitigation}>
                    {copied ? <CheckIcon /> : <CopyIcon />}
                    {copied ? (lang === "zh" ? "已复制" : "Copied") : lang === "zh" ? "复制" : "Copy"}
                  </Button>
                </div>
                <pre className="mt-3 overflow-x-auto rounded-lg border bg-background p-3 font-mono text-xs text-foreground">
                  <code>{dossier.mitigationCommand}</code>
                </pre>
              </div>
            </DialogPanel>

            <DialogFooter className="justify-between sm:justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportCaseCardPng({ ...dossier, tier: activeTier }, lang)}
              >
                <DownloadIcon />
                {lang === "zh" ? "导出 PNG 证据图" : "Export PNG"}
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                {dossier.evidenceIssueUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    render={
                      <a href={dossier.evidenceIssueUrl} target="_blank" rel="noreferrer" />
                    }
                  >
                    <MessageSquareIcon />
                    {lang === "zh"
                      ? `证据 Issue #${dossier.evidenceIssueNumber ?? ""}`
                      : `Issue #${dossier.evidenceIssueNumber ?? ""}`}
                    <ExternalLinkIcon />
                  </Button>
                )}
                {dossier.isCustomPreview ? (
                  <Button size="sm" onClick={() => void handleSubmitLocalBundle()}>
                    {lang === "zh" ? "固定证据到 GitHub Issue" : "Submit to GitHub Issue"}
                    <ExternalLinkIcon />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    render={
                      <a
                        href={buildRemediationAppealUrl({
                          caseId: dossier.caseId,
                          repoName: dossier.name,
                          explanation:
                            lang === "zh"
                              ? `针对 ${dossier.caseId} (${dossier.name}) 提交修复 Commit 或补充证据：`
                              : `Fix commit or follow-up evidence for ${dossier.caseId} (${dossier.name}):`,
                        })}
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                  >
                    {lang === "zh" ? "整改销案 / 补充证据" : "Claim fix / dispute"}
                    <ExternalLinkIcon />
                  </Button>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogPopup>
    </Dialog>
  );
}
