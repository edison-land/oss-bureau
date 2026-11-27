import { useState } from "react";
import {
  AlertCircleIcon,
  ArrowUpRightIcon,
  CheckIcon,
  CopyIcon,
  PlusIcon,
  UploadIcon,
} from "lucide-react";
import type { CaseDossier, Lang, TierRuleHit } from "../types";
import {
  UNIVERSAL_SKILL_CONTRACT,
  buildCaseSubmissionIssueUrl,
  buildRemediationAppealUrl,
  parseCaseBundleJson,
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

export function SubmitTipDialog({
  open,
  lang,
  onClose,
  onPreviewDossier,
  onAddLocalCase,
}: SubmitTipDialogProps) {
  const [tab, setTab] = useState("json");
  const [jsonText, setJsonText] = useState("");
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parsedDossier, setParsedDossier] = useState<CaseDossier | null>(null);
  const [ruleReasons, setRuleReasons] = useState<TierRuleHit[]>([]);
  const [dragging, setDragging] = useState(false);
  const [copiedJsonNotice, setCopiedJsonNotice] = useState(false);
  const [copiedContract, setCopiedContract] = useState(false);

  const [repoName, setRepoName] = useState("");
  const [commitHash, setCommitHash] = useState("");
  const [summary, setSummary] = useState("");

  const handleJsonChange = (text: string) => {
    setJsonText(text);
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
    handleJsonChange(await file.text());
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
        // Optional
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
    notes: summary.trim() || "",
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPopup className="max-w-xl">
        <DialogHeader className="pr-12">
          <DialogTitle>{lang === "zh" ? "提交证据" : "Submit evidence"}</DialogTitle>
        </DialogHeader>

        <DialogPanel>
          <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
            <TabsList className="w-full sm:w-fit">
              <TabsTab value="json">case-bundle.json</TabsTab>
              <TabsTab value="contract">{lang === "zh" ? "Skill 契约" : "Skill contract"}</TabsTab>
              <TabsTab value="manual">{lang === "zh" ? "表单" : "Form"}</TabsTab>
            </TabsList>

            <TabsPanel value="json" className="mt-4 space-y-3.5">
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
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-sm transition-colors ${
                  dragging
                    ? "border-foreground bg-accent"
                    : "border-input bg-muted/40 hover:bg-muted/70"
                }`}
              >
                <UploadIcon className="size-4 text-muted-foreground" />
                <span>
                  {lang === "zh" ? "拖入或选择 case-bundle.json" : "Drop or select case-bundle.json"}
                </span>
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => void handleFile(e.target.files?.[0])}
                />
              </label>

              <Textarea
                value={jsonText}
                onChange={(e) => handleJsonChange(e.target.value)}
                rows={5}
                className="font-mono text-xs"
                placeholder="{ ... }"
              />

              {parseErrors.length > 0 && (
                <Alert variant="error">
                  <AlertCircleIcon />
                  <AlertDescription className="font-mono text-xs">
                    {parseErrors.join(" · ")}
                  </AlertDescription>
                </Alert>
              )}

              {parsedDossier && (
                <div className="space-y-3 rounded-xl border bg-muted/40 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{parsedDossier.name}</span>
                    <StatusBadge tier={parsedDossier.tier} lang={lang} />
                  </div>

                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {ruleReasons.map((r) => (
                      <li key={r.rule}>{r[lang]}</li>
                    ))}
                  </ul>

                  {copiedJsonNotice && (
                    <Alert variant="info">
                      <AlertDescription className="text-xs">
                        {lang === "zh"
                          ? "已复制完整 JSON，打开 Issue 后直接粘贴。"
                          : "Full JSON copied to clipboard — paste it into the Issue form."}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onAddLocalCase(parsedDossier);
                        onClose();
                      }}
                    >
                      <PlusIcon />
                      {lang === "zh" ? "加入本机榜单" : "Pin locally"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onClose();
                        onPreviewDossier(parsedDossier);
                      }}
                    >
                      {lang === "zh" ? "预览" : "Inspect"}
                    </Button>
                    <Button size="sm" onClick={() => void handleSubmitJsonToGitHub()}>
                      {lang === "zh" ? "发 GitHub Issue" : "Open GitHub Issue"}
                      <ArrowUpRightIcon />
                    </Button>
                  </div>
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
                    ? "源码行号与核实事实..."
                    : "Verified facts & GitHub file:line links..."
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
