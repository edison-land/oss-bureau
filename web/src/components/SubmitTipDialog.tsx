import { useState } from "react";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  EyeIcon,
  GitPullRequestIcon,
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
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogDescription,
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
        // Clipboard optional
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

  const tierMeta =
    parsedDossier?.tier === "blacklist"
      ? {
          variant: "error" as const,
          dot: "bg-destructive",
          label: lang === "zh" ? "黑榜 · Flagged" : "Flagged",
        }
      : parsedDossier?.tier === "watchlist"
        ? {
            variant: "warning" as const,
            dot: "bg-warning",
            label: lang === "zh" ? "灰榜 · Watch" : "Watch",
          }
        : {
            variant: "success" as const,
            dot: "bg-success",
            label: lang === "zh" ? "红榜 · Clean" : "Clean",
          };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPopup className="max-w-2xl">
        <DialogHeader className="pr-12">
          <DialogTitle>
            {lang === "zh" ? "提交源码证据 & 评定红黑榜" : "Submit evidence & classify bundle"}
          </DialogTitle>
          <DialogDescription>
            {lang === "zh"
              ? "支持 oss-audit 或任意自定义 Skill 产出的 case-bundle.v1.json，证据永久固定在公开 GitHub Issue。"
              : "Drop a case-bundle.v1.json from oss-audit or your own Skill. Evidence is archived publicly in GitHub Issues and PRs."}
          </DialogDescription>
        </DialogHeader>

        <DialogPanel>
          <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
            <TabsList className="w-full sm:w-fit">
              <TabsTab value="json">
                {lang === "zh" ? "导入 JSON 定级" : "Drop JSON"}
              </TabsTab>
              <TabsTab value="contract">
                {lang === "zh" ? "接入自有 Skill" : "Bring your Skill"}
              </TabsTab>
              <TabsTab value="manual">
                {lang === "zh" ? "手动提交 / 申诉" : "Manual / Appeal"}
              </TabsTab>
            </TabsList>

            <TabsPanel value="json" className="mt-4 space-y-4">
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
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-colors ${
                  dragging
                    ? "border-foreground bg-accent"
                    : "border-input bg-muted/40 hover:bg-muted/70"
                }`}
              >
                <UploadIcon className="mb-2 size-5 text-muted-foreground" />
                <span className="font-medium text-sm text-foreground">
                  {lang === "zh"
                    ? "拖拽 case-bundle.json 到此处，或点击选择文件"
                    : "Drop case-bundle.json here, or click to browse"}
                </span>
                <span className="mt-1 font-mono text-xs text-muted-foreground">
                  Schema v1.0.0 · 100% client-side validation
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
                placeholder={
                  lang === "zh"
                    ? "或直接粘贴 case-bundle.json 内容..."
                    : "Or paste raw case-bundle.json contents..."
                }
              />

              {parseErrors.length > 0 && (
                <Alert variant="error">
                  <AlertCircleIcon />
                  <AlertTitle>
                    {lang === "zh" ? "Schema 校验未通过" : "Schema validation failed"}
                  </AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc space-y-0.5 pl-4 font-mono text-xs">
                      {parseErrors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {parsedDossier && (
                <div className="space-y-3 rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CheckCircle2Icon className="size-4 text-success" />
                      <span>{parsedDossier.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        ({parsedDossier.findings.length}{" "}
                        {lang === "zh" ? "条证据" : "findings"})
                      </span>
                    </div>
                    <Badge variant={tierMeta.variant}>
                      <span aria-hidden="true" className={`size-1.5 rounded-full ${tierMeta.dot}`} />
                      {tierMeta.label}
                    </Badge>
                  </div>

                  <div className="rounded-lg border bg-muted/40 p-3 text-xs">
                    <div className="mb-1.5 font-mono text-[11px] text-muted-foreground">
                      {lang === "zh"
                        ? `公开规则引擎计算结果 · ${parsedDossier.auditorTool}`
                        : `Public rule engine verdict · ${parsedDossier.auditorTool}`}
                    </div>
                    <ul className="space-y-1.5">
                      {ruleReasons.map((r) => (
                        <li key={r.rule} className="flex items-start gap-2">
                          <Badge variant="outline" size="sm" className="mt-0.5 shrink-0 font-mono">
                            {r.rule}
                          </Badge>
                          <span className="leading-relaxed text-foreground">{r[lang]}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {copiedJsonNotice && (
                    <Alert variant="info">
                      <AlertDescription className="text-xs">
                        {lang === "zh"
                          ? "JSON 较长，已自动完整复制到剪贴板。在刚打开的 GitHub Issue JSON 框里直接粘贴即可。"
                          : "Bundle exceeded URL limits and was copied to your clipboard. Paste it into the GitHub Issue JSON field."}
                      </AlertDescription>
                    </Alert>
                  )}

                  {addedLocalNotice && (
                    <Alert variant="success">
                      <AlertDescription className="text-xs">
                        {lang === "zh"
                          ? "已暂存到当前页面榜单（仅存本地浏览器，可随时移除）。"
                          : "Pinned to your local directory view (saved in browser localStorage)."}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onAddLocalCase(parsedDossier);
                        setAddedLocalNotice(true);
                      }}
                    >
                      <PlusIcon />
                      {lang === "zh" ? "暂存到本机榜单对比" : "Pin to local table"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onClose();
                        onPreviewDossier(parsedDossier);
                      }}
                    >
                      <EyeIcon />
                      {lang === "zh" ? "预览卷宗 & 导出 PNG" : "Inspect & PNG"}
                    </Button>
                    <Button size="sm" onClick={() => void handleSubmitJsonToGitHub()}>
                      {lang === "zh" ? "固定证据到 GitHub Issue" : "Submit GitHub Issue"}
                      <ExternalLinkIcon />
                    </Button>
                  </div>
                </div>
              )}
            </TabsPanel>

            <TabsPanel value="contract" className="mt-4 space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {lang === "zh"
                  ? "无需绑定我们的 Skill。只要你的自定义审计 Skill 或 AI Prompt 按下方 Schema v1.0.0 输出客观证据并在 auditor_tool 署名，GitHub Bot 就会自动验真 Commit 与源码文件、按公开标尺定级，并在审批后自动开 PR 入库。"
                  : "You don't need to use oss-audit. Any custom Skill or prompt that outputs case-bundle.v1.json with your tool name in `auditor_tool` is automatically verified against GitHub commits & files and classified under the same open rules."}
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    Universal Output Contract (v1.0.0)
                  </span>
                  <Button size="xs" variant="outline" onClick={handleCopyContract}>
                    {copiedContract ? <CheckIcon /> : <CopyIcon />}
                    {copiedContract
                      ? lang === "zh"
                        ? "已复制"
                        : "Copied"
                      : lang === "zh"
                        ? "复制契约"
                        : "Copy contract"}
                  </Button>
                </div>
                <pre className="max-h-56 overflow-auto rounded-xl border bg-sidebar p-3.5 font-mono text-xs text-foreground">
                  <code>{UNIVERSAL_SKILL_CONTRACT}</code>
                </pre>
              </div>

              <div className="flex flex-wrap gap-2">
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
                  {lang === "zh" ? "打开案宗提交表单" : "Open Case Issue Form"}
                  <ExternalLinkIcon />
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
                  <GitPullRequestIcon />
                  {lang === "zh" ? "直接提 PR 到 cases/" : "Submit PR to cases/"}
                </Button>
              </div>
            </TabsPanel>

            <TabsPanel value="manual" className="mt-4 space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  {lang === "zh" ? "GitHub 仓库 (owner/repo)" : "GitHub repository (owner/repo)"}
                </label>
                <Input
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="owner/repo"
                  className="font-mono"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Commit SHA</label>
                  <Input
                    value={commitHash}
                    onChange={(e) => setCommitHash(e.target.value)}
                    placeholder="70bde71191"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    {lang === "zh" ? "审计 Skill / 工具" : "Auditor Skill / tool"}
                  </label>
                  <Input
                    value={auditorTool}
                    onChange={(e) => setAuditorTool(e.target.value)}
                    placeholder="oss-audit v1.0.0"
                    className="font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  {lang === "zh" ? "客观事实与源码链接" : "Verified facts & source permalinks"}
                </label>
                <Textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={4}
                  placeholder={
                    lang === "zh"
                      ? "简述默认遥测、跨工具读取或文档承诺矛盾，附 GitHub 文件行号链接..."
                      : "Summarize default telemetry, cross-tool reads, or doc mismatches with GitHub file:line links..."
                  }
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  render={<a href={manualIssue.url} target="_blank" rel="noreferrer" />}
                >
                  {lang === "zh" ? "打开预填 Issue 表单" : "Open pre-filled Issue"}
                  <ExternalLinkIcon />
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
                  {lang === "zh" ? "维护者整改销案" : "Maintainer fix appeal"}
                  <ExternalLinkIcon />
                </Button>
              </div>
            </TabsPanel>
          </Tabs>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
