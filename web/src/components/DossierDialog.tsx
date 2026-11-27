import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRightIcon,
  CheckCircle2Icon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  LinkIcon,
  PaperclipIcon,
  XIcon,
} from "lucide-react";
import type { CaseAttachment, CaseDossier, Lang, SeverityProfile } from "../types";
import { exportCaseCardPng } from "../utils/exportCard";
import {
  buildCaseSubmissionIssueUrl,
  buildRemediationAppealUrl,
  evaluateTier,
  resolveAttachmentUrl,
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
  const [copiedLink, setCopiedLink] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<CaseAttachment | null>(null);

  useEffect(() => {
    if (!lightboxItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setLightboxItem(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [lightboxItem]);

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

  const handleCopyDeepLink = async () => {
    if (!dossier) return;
    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    await navigator.clipboard.writeText(
      `${window.location.origin}${base}/case/${encodeURIComponent(dossier.caseId)}`,
    );
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1800);
  };

  const handleSubmitLocalBundle = async () => {
    if (!dossier) return;
    const { url, jsonWasTooLong } = buildCaseSubmissionIssueUrl({
      repoName: dossier.name,
      commitHash: dossier.commitHash,
      auditorTool: dossier.auditorTool,
      evidenceJson: dossier.rawBundleJson,
      notes: dossier.oneLiner.en,
      attachmentHints: dossier.attachments?.map((a) => a.caption || a.path),
    });
    if (jsonWasTooLong && dossier.rawBundleJson) {
      await navigator.clipboard.writeText(dossier.rawBundleJson).catch(() => {});
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const activeTier = evaluation?.tier ?? dossier?.tier ?? "cleared";
  const attachments = dossier?.attachments ?? [];

  return (
    <>
      <Dialog
        open={Boolean(dossier)}
        onOpenChange={(open) => {
          if (!open) {
            setLightboxItem(null);
            onClose();
          }
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
                {/* Compact GHSA-style verification checks strip */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2Icon className="size-3 text-success" />
                    Commit {dossier.commitHash.slice(0, 7)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2Icon className="size-3 text-success" />
                    {lang === "zh" ? "无短链" : "Canonical URLs"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2Icon className="size-3 text-success" />
                    {dossier.findings.length} {lang === "zh" ? "条源码证据" : "findings"}
                  </span>
                  {attachments.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-foreground">
                      <PaperclipIcon className="size-3" />
                      {attachments.length} {lang === "zh" ? "份附件" : "attachments"}
                    </span>
                  )}
                </div>

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

                {/* Archived Visual Attachments */}
                {attachments.length > 0 && (
                  <div className="space-y-2.5">
                    <Separator />
                    <div className="font-medium text-xs text-muted-foreground">
                      {lang === "zh"
                        ? `归档附件 (${attachments.length})`
                        : `Attachments (${attachments.length})`}
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {attachments.map((att, idx) => (
                        <button
                          key={`${att.path}-${idx}`}
                          type="button"
                          onClick={() => setLightboxItem(att)}
                          className="group overflow-hidden rounded-lg border bg-card text-left transition-colors hover:border-ring"
                        >
                          <img
                            src={resolveAttachmentUrl(att)}
                            alt={att.caption || att.path}
                            loading="lazy"
                            className="aspect-video w-full object-cover transition-transform group-hover:scale-[1.02]"
                          />
                          <div className="truncate px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
                            {att.caption || att.path.split("/").pop()}
                          </div>
                        </button>
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
                      {copied
                        ? lang === "zh"
                          ? "已复制"
                          : "Copied"
                        : lang === "zh"
                          ? "复制"
                          : "Copy"}
                    </Button>
                  </div>
                  <pre className="overflow-x-auto rounded-lg border bg-sidebar p-3 font-mono text-xs text-foreground">
                    <code>{dossier.mitigationCommand}</code>
                  </pre>
                </div>
              </DialogPanel>

              <DialogFooter className="justify-between sm:justify-between">
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportCaseCardPng({ ...dossier, tier: activeTier }, lang)}
                  >
                    <DownloadIcon />
                    PNG
                  </Button>
                  {!dossier.isCustomPreview && (
                    <Button variant="ghost" size="sm" onClick={handleCopyDeepLink}>
                      {copiedLink ? <CheckIcon /> : <LinkIcon />}
                      {copiedLink
                        ? lang === "zh"
                          ? "已复制"
                          : "Copied"
                        : lang === "zh"
                          ? "链接"
                          : "Link"}
                    </Button>
                  )}
                </div>

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

      {/* High-res Attachment Lightbox */}
      {lightboxItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightboxItem.caption || "Attachment preview"}
          onClick={() => setLightboxItem(null)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90dvh] max-w-5xl overflow-hidden rounded-xl border bg-background shadow-2xl"
          >
            <div className="flex items-center justify-between gap-4 border-b px-4 py-2.5 text-xs">
              <span className="truncate font-mono text-muted-foreground">
                {lightboxItem.caption || lightboxItem.path}
              </span>
              <div className="flex items-center gap-2">
                {lightboxItem.sourceUrl && (
                  <a
                    href={lightboxItem.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
                  >
                    Source
                    <ArrowUpRightIcon className="size-3" />
                  </a>
                )}
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Close preview"
                  onClick={() => setLightboxItem(null)}
                >
                  <XIcon />
                </Button>
              </div>
            </div>
            <img
              src={resolveAttachmentUrl(lightboxItem)}
              alt={lightboxItem.caption || lightboxItem.path}
              className="max-h-[82dvh] w-auto object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
