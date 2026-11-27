import { useMemo, useState } from "react";
import {
  ArrowUpRightIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
} from "lucide-react";
import type { CaseDossier, Lang, SeverityProfile } from "../types";
import { exportCaseCardPng } from "../utils/exportCard";
import {
  buildCaseSubmissionIssueUrl,
  buildRemediationAppealUrl,
  evaluateTier,
} from "../utils/bundleParser";
import { StatusBadge, formatDnt, formatStars, formatTelemetry } from "./StatusBadge";
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

  return (
    <Dialog
      open={Boolean(dossier)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPopup className="max-w-2xl">
        {dossier && (
          <>
            <DialogHeader className="pr-12">
              <div className="flex items-center gap-2.5">
                <DialogTitle className="tracking-tight">{dossier.name}</DialogTitle>
                <StatusBadge tier={activeTier} lang={lang} />
              </div>

              <DialogDescription className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-xs">
                <a
                  href={dossier.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
                >
                  GitHub
                  <ArrowUpRightIcon className="size-3" />
                </a>
                <span>·</span>
                <span>{dossier.commitHash.slice(0, 8)}</span>
                {dossier.stars && (
                  <>
                    <span>·</span>
                    <span className="tabular-nums">{formatStars(dossier.stars)} ★</span>
                  </>
                )}
                <span>·</span>
                <span>{dossier.auditedDate}</span>
                {dossier.auditorTool && (
                  <>
                    <span>·</span>
                    <span>{dossier.auditorTool}</span>
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <DialogPanel className="space-y-6">
              {/* Key Facts Grid */}
              <div className="grid grid-cols-2 gap-4 rounded-xl border bg-muted/40 px-4 py-3 sm:grid-cols-4">
                <div>
                  <div className="text-xs text-muted-foreground">
                    {lang === "zh" ? "遥测" : "Telemetry"}
                  </div>
                  <div className="mt-0.5 font-medium text-sm">
                    {formatTelemetry(dossier.defaultTelemetry, lang)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">DNT</div>
                  <div className="mt-0.5 font-medium text-sm">
                    {formatDnt(dossier.doNotTrack, lang)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    {lang === "zh" ? "跨工具" : "Cross-tool"}
                  </div>
                  <div
                    className={`mt-0.5 font-medium text-sm ${
                      dossier.crossToolAccess ? "text-destructive-foreground" : ""
                    }`}
                  >
                    {dossier.crossToolAccess
                      ? lang === "zh"
                        ? "是"
                        : "Yes"
                      : dossier.caseId === "CASE-002"
                        ? lang === "zh"
                          ? "已移除"
                          : "Removed"
                        : lang === "zh"
                          ? "否"
                          : "No"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    {lang === "zh" ? "承诺对照" : "Docs"}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-xs leading-5">
                    {dossier.promiseVsReality}
                  </div>
                </div>
              </div>

              {/* Core Finding Summary */}
              <p className="text-sm leading-relaxed text-foreground">{dossier.oneLiner[lang]}</p>

              {/* Public Promise Quote */}
              {dossier.promiseQuote && (
                <blockquote className="border-l-2 border-destructive/50 pl-3.5 text-sm italic text-muted-foreground">
                  “{dossier.promiseQuote}”
                  {dossier.promiseSource && (
                    <span className="ml-2 not-italic font-mono text-xs">
                      — {dossier.promiseSource}
                    </span>
                  )}
                </blockquote>
              )}

              {/* Verified Code Findings */}
              {dossier.findings.length > 0 && (
                <div className="space-y-4">
                  <Separator />
                  <div className="space-y-4">
                    {dossier.findings.map((f) => (
                      <div key={f.id} className="space-y-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div className="flex items-center gap-2">
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
                            <span className="font-medium text-sm text-foreground">
                              {f.title[lang]}
                            </span>
                          </div>
                          {f.permalink && (
                            <a
                              href={f.permalink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-0.5 font-mono text-xs text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
                            >
                              {f.filePath}:{f.lineRange}
                              <ArrowUpRightIcon className="size-3" />
                            </a>
                          )}
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {f.summary[lang]}
                        </p>
                        <pre className="overflow-x-auto rounded-lg border bg-sidebar p-3 font-mono text-xs text-foreground">
                          <code>{f.codeSnippet}</code>
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Opt-out / Mitigation */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-xs text-muted-foreground">
                    {lang === "zh" ? "关闭方式" : "Opt-out"}
                  </span>
                  <Button size="xs" variant="ghost" onClick={handleCopyMitigation}>
                    {copied ? <CheckIcon /> : <CopyIcon />}
                    {copied ? (lang === "zh" ? "已复制" : "Copied") : lang === "zh" ? "复制" : "Copy"}
                  </Button>
                </div>
                <pre className="overflow-x-auto rounded-lg border bg-sidebar p-3 font-mono text-xs text-foreground">
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
                PNG
              </Button>
              <div className="flex items-center gap-2">
                {dossier.evidenceIssueUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<a href={dossier.evidenceIssueUrl} target="_blank" rel="noreferrer" />}
                  >
                    Issue #{dossier.evidenceIssueNumber}
                    <ArrowUpRightIcon />
                  </Button>
                )}
                {dossier.isCustomPreview ? (
                  <Button size="sm" onClick={() => void handleSubmitLocalBundle()}>
                    {lang === "zh" ? "提交 Issue" : "Open Issue"}
                    <ArrowUpRightIcon />
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
                        })}
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                  >
                    {lang === "zh" ? "整改申诉" : "Report fix"}
                    <ArrowUpRightIcon />
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
