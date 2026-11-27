import { useMemo, useState } from "react";
import {
  ArrowUpRightIcon,
  CheckCircle2Icon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  ImageIcon,
  PlusIcon,
  UploadIcon,
  XCircleIcon,
  XIcon,
} from "lucide-react";
import type { CaseAttachment, CaseDossier, Lang } from "../types";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_ATTACHMENT_BYTES,
  UNIVERSAL_SKILL_CONTRACT,
  buildCaseSubmissionIssueUrl,
  buildPrReadyBundle,
  buildRemediationAppealUrl,
  parseCaseBundleJson,
  runPreflightChecks,
  type LocalAttachmentDraft,
} from "../utils/bundleParser";
import { StatusBadge } from "./StatusBadge";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Tabs, TabsList, TabsPanel, TabsTab } from "./ui/tabs";
import { Textarea } from "./ui/textarea";

interface SubmitTipDialogProps {
  open: boolean;
  lang: Lang;
  onClose: () => void;
  onPreviewDossier: (dossier: CaseDossier) => void;
  onAddLocalCase: (dossier: CaseDossier) => void;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function SubmitTipDialog({
  open,
  lang,
  onClose,
  onPreviewDossier,
  onAddLocalCase,
}: SubmitTipDialogProps) {
  const [tab, setTab] = useState("json");
  const [jsonText, setJsonText] = useState("");
  const [attachments, setAttachments] = useState<LocalAttachmentDraft[]>([]);
  const [draggingJson, setDraggingJson] = useState(false);
  const [draggingImg, setDraggingImg] = useState(false);
  const [copiedJsonNotice, setCopiedJsonNotice] = useState(false);
  const [copiedContract, setCopiedContract] = useState(false);

  const [repoName, setRepoName] = useState("");
  const [commitHash, setCommitHash] = useState("");
  const [summary, setSummary] = useState("");

  const parseResult = useMemo(
    () => (jsonText.trim() ? parseCaseBundleJson(jsonText) : null),
    [jsonText],
  );

  const preflight = useMemo(
    () =>
      runPreflightChecks({
        text: jsonText,
        parseResult,
        attachments,
      }),
    [attachments, jsonText, parseResult],
  );

  const handleJsonFile = async (file: File | undefined) => {
    if (!file) return;
    setCopiedJsonNotice(false);
    setJsonText(await file.text());
  };

  const handleImageFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const nextDrafts: LocalAttachmentDraft[] = [];
    for (const file of Array.from(fileList).slice(0, 8)) {
      const typeOk = ALLOWED_IMAGE_TYPES.has(file.type);
      const sizeOk = file.size > 0 && file.size <= MAX_ATTACHMENT_BYTES;
      const valid = typeOk && sizeOk;
      let error: string | undefined;
      if (!typeOk) error = `${file.name}: PNG/JPG/WebP only`;
      else if (!sizeOk) error = `${file.name}: exceeds 5 MB`;
      const dataUrl = valid ? await readFileAsDataUrl(file) : "";
      nextDrafts.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl,
        valid,
        error,
      });
    }
    setAttachments((prev) => [...prev, ...nextDrafts].slice(0, 8));
  };

  const buildLocalDossierWithAttachments = (): CaseDossier | null => {
    if (!parseResult?.ok || !parseResult.dossier) return null;
    const mappedAttachments: CaseAttachment[] = attachments
      .filter((a) => a.valid)
      .map((a, idx) => ({
        path: `evidence/local/${String(idx + 1).padStart(2, "0")}-${a.name}`,
        caption: a.name,
        previewDataUrl: a.dataUrl,
      }));
    return {
      ...parseResult.dossier,
      attachments: mappedAttachments,
    };
  };

  const handleSubmitJsonToGitHub = async () => {
    if (!parseResult?.ok || !parseResult.dossier || preflight.hasBlockingError) return;
    const { url, jsonWasTooLong } = buildCaseSubmissionIssueUrl({
      repoName: parseResult.dossier.name,
      commitHash: parseResult.dossier.commitHash,
      auditorTool: parseResult.dossier.auditorTool,
      evidenceJson: jsonText,
      notes: parseResult.dossier.oneLiner.en,
      attachmentHints: attachments.filter((a) => a.valid).map((a) => a.name),
    });
    if (jsonWasTooLong) {
      try {
        await navigator.clipboard.writeText(jsonText);
        setCopiedJsonNotice(true);
      } catch {
        // Optional
      }
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDownloadPrJson = () => {
    if (!parseResult?.ok || !parseResult.raw || preflight.hasBlockingError) return;
    const { filename, content } = buildPrReadyBundle(parseResult.raw, attachments);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyContract = async () => {
    await navigator.clipboard.writeText(UNIVERSAL_SKILL_CONTRACT);
    setCopiedContract(true);
    setTimeout(() => setCopiedContract(false), 1800);
  };

  const manualIssue = buildCaseSubmissionIssueUrl({
    repoName: repoName.trim() || "owner/repo",
    commitHash: commitHash.trim() || "",
    notes: summary.trim() || "",
  });

  const showChecks = Boolean(jsonText.trim()) || attachments.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPopup className="max-w-2xl">
        <DialogHeader className="pr-12">
          <DialogTitle>{lang === "zh" ? "提交证据与附件" : "Submit evidence"}</DialogTitle>
        </DialogHeader>

        <DialogPanel>
          <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
            <TabsList className="w-full sm:w-fit">
              <TabsTab value="json">Bundle + Attachments</TabsTab>
              <TabsTab value="contract">{lang === "zh" ? "Skill 契约" : "Skill contract"}</TabsTab>
              <TabsTab value="manual">{lang === "zh" ? "表单" : "Form"}</TabsTab>
            </TabsList>

            <TabsPanel value="json" className="mt-4 space-y-4">
              {/* Two compact dropzones side by side: JSON bundle + Image attachments */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDraggingJson(true);
                  }}
                  onDragLeave={() => setDraggingJson(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDraggingJson(false);
                    void handleJsonFile(e.dataTransfer.files?.[0]);
                  }}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-5 text-center transition-colors ${
                    draggingJson
                      ? "border-foreground bg-accent"
                      : "border-input bg-muted/40 hover:bg-muted/70"
                  }`}
                >
                  <UploadIcon className="size-4 text-muted-foreground" />
                  <span className="font-medium text-xs text-foreground">case-bundle.json</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(e) => void handleJsonFile(e.target.files?.[0])}
                  />
                </label>

                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDraggingImg(true);
                  }}
                  onDragLeave={() => setDraggingImg(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDraggingImg(false);
                    void handleImageFiles(e.dataTransfer.files);
                  }}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-5 text-center transition-colors ${
                    draggingImg
                      ? "border-foreground bg-accent"
                      : "border-input bg-muted/40 hover:bg-muted/70"
                  }`}
                >
                  <ImageIcon className="size-4 text-muted-foreground" />
                  <span className="font-medium text-xs text-foreground">
                    {lang === "zh" ? "截图附件 (PNG/JPG/WebP)" : "Screenshots (PNG/JPG/WebP)"}
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => void handleImageFiles(e.target.files)}
                  />
                </label>
              </div>

              <Textarea
                value={jsonText}
                onChange={(e) => {
                  setCopiedJsonNotice(false);
                  setJsonText(e.target.value);
                }}
                rows={4}
                className="font-mono text-xs"
                placeholder="{ ... }"
              />

              {/* Attached image chips / thumbnails */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className={`inline-flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${
                        att.valid
                          ? "bg-card text-foreground"
                          : "border-destructive/40 bg-destructive/4 text-destructive-foreground"
                      }`}
                    >
                      {att.valid && att.dataUrl && (
                        <img
                          src={att.dataUrl}
                          alt={att.name}
                          className="size-7 rounded object-cover"
                        />
                      )}
                      <div className="max-w-36 truncate">
                        <div className="truncate font-mono text-[11px]">{att.name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {att.valid ? `${(att.size / 1024).toFixed(0)} KB` : att.error}
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${att.name}`}
                        onClick={() =>
                          setAttachments((prev) => prev.filter((item) => item.id !== att.id))
                        }
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* GitHub Checks-style Live Pre-flight Panel */}
              {showChecks && (
                <div className="space-y-3 rounded-xl border bg-muted/40 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm text-foreground">
                      {parseResult?.dossier?.name ||
                        (lang === "zh" ? "提交前自动预检" : "Pre-flight checks")}
                    </span>
                    {parseResult?.ok && parseResult.dossier && (
                      <StatusBadge tier={parseResult.dossier.tier} lang={lang} />
                    )}
                  </div>

                  <ul className="divide-y rounded-lg border bg-background">
                    {preflight.checks.map((chk) => (
                      <li
                        key={chk.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                      >
                        <span className="inline-flex items-center gap-2 font-medium text-foreground">
                          {chk.status === "pass" ? (
                            <CheckCircle2Icon className="size-3.5 text-success" />
                          ) : chk.status === "fail" ? (
                            <XCircleIcon className="size-3.5 text-destructive" />
                          ) : (
                            <span className="size-2 rounded-full bg-muted-foreground/50" />
                          )}
                          {chk.label[lang]}
                        </span>
                        {chk.detail && (
                          <span
                            className={`truncate font-mono text-[11px] ${
                              chk.status === "fail"
                                ? "text-destructive-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {chk.detail[lang]}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {copiedJsonNotice && (
                    <Alert variant="info">
                      <AlertDescription className="text-xs">
                        {lang === "zh"
                          ? "已复制完整 JSON，打开 Issue 后直接粘贴并拖入上述截图即可。"
                          : "Full JSON copied to clipboard — paste it into the Issue and drag your screenshots into the Attachments box."}
                      </AlertDescription>
                    </Alert>
                  )}

                  {parseResult?.ok && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={preflight.hasBlockingError}
                        onClick={() => {
                          const d = buildLocalDossierWithAttachments();
                          if (d) {
                            onAddLocalCase(d);
                            onClose();
                          }
                        }}
                      >
                        <PlusIcon />
                        {lang === "zh" ? "加入本机榜单" : "Pin locally"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={preflight.hasBlockingError}
                        onClick={() => {
                          const d = buildLocalDossierWithAttachments();
                          if (d) {
                            onClose();
                            onPreviewDossier(d);
                          }
                        }}
                      >
                        {lang === "zh" ? "预览" : "Inspect"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={preflight.hasBlockingError}
                        onClick={handleDownloadPrJson}
                      >
                        <DownloadIcon />
                        PR JSON
                      </Button>
                      <Button
                        size="sm"
                        disabled={preflight.hasBlockingError}
                        onClick={() => void handleSubmitJsonToGitHub()}
                      >
                        {lang === "zh" ? "发 GitHub Issue" : "Open GitHub Issue"}
                        <ArrowUpRightIcon />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </TabsPanel>

            <TabsPanel value="contract" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">
                  case-bundle.v1.json
                </span>
                <Button size="xs" variant="outline" onClick={handleCopyContract}>
                  {copiedContract ? <CheckIcon /> : <CopyIcon />}
                  {copiedContract
                    ? lang === "zh"
                      ? "已复制"
                      : "Copied"
                    : lang === "zh"
                      ? "复制"
                      : "Copy"}
                </Button>
              </div>
              <pre className="max-h-64 overflow-auto rounded-xl border bg-sidebar p-3.5 font-mono text-xs text-foreground">
                <code>{UNIVERSAL_SKILL_CONTRACT}</code>
              </pre>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  render={
                    <a
                      href="https://github.com/edison-land/oss-bureau/issues/new?template=case-submission.yml"
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  {lang === "zh" ? "提交 Issue" : "New Issue"}
                  <ArrowUpRightIcon />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  render={
                    <a
                      href="https://github.com/edison-land/oss-bureau/tree/main/cases"
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  cases/ PR
                  <ArrowUpRightIcon />
                </Button>
              </div>
            </TabsPanel>

            <TabsPanel value="manual" className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="owner/repo"
                  aria-label="Repository"
                  className="font-mono"
                />
                <Input
                  value={commitHash}
                  onChange={(e) => setCommitHash(e.target.value)}
                  placeholder="commit SHA"
                  aria-label="Commit SHA"
                  className="font-mono"
                />
              </div>
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={4}
                aria-label="Summary"
                placeholder={
                  lang === "zh"
                    ? "一手源码链接与核实事实（禁止短链）..."
                    : "Canonical source URLs & verified facts (no shortlinks)..."
                }
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  render={<a href={manualIssue.url} target="_blank" rel="noreferrer" />}
                >
                  {lang === "zh" ? "打开 Issue" : "Open Issue"}
                  <ArrowUpRightIcon />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  render={
                    <a
                      href={buildRemediationAppealUrl({
                        caseId: "CASE-XXX",
                        repoName: repoName.trim() || "owner/repo",
                        explanation: summary.trim(),
                      })}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  {lang === "zh" ? "整改申诉" : "Report fix"}
                  <ArrowUpRightIcon />
                </Button>
              </div>
            </TabsPanel>
          </Tabs>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
