import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRightIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  GitPullRequestIcon,
  MessageSquareIcon,
  MoonIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SunIcon,
  TerminalIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  Trash2Icon,
} from "lucide-react";
import { CASES, INITIAL_COMMUNITY_ISSUES } from "./data/cases";
import type {
  CaseDossier,
  CommunityIssueRecord,
  Lang,
  SeverityProfile,
  Tier,
} from "./types";
import { DossierDialog } from "./components/DossierDialog";
import { SubmitTipDialog } from "./components/SubmitTipDialog";
import { exportCaseCardPng } from "./utils/exportCard";
import {
  UNIVERSAL_SKILL_CONTRACT,
  convertRawBundleToDossier,
  evaluateTier,
  parseCaseBundleJson,
} from "./utils/bundleParser";
import {
  applyColorScheme,
  getResolvedScheme,
  getStoredScheme,
  toggleColorScheme,
  type ResolvedScheme,
} from "./utils/theme";
import { Alert, AlertDescription } from "./components/ui/alert";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from "./components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./components/ui/empty";
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "./components/ui/frame";
import { Input } from "./components/ui/input";
import { Separator } from "./components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./components/ui/table";
import { Tabs, TabsList, TabsTab } from "./components/ui/tabs";

type MainView = "board" | "hearings" | "rules";
type FilterMode = "all" | Tier | "cross_tool" | "no_dnt" | "community";
type SortMode = "risk" | "stars" | "caseId";

const INSTALL_CMD = "npx skills add edison-land/oss-bureau";
const LOCAL_STORAGE_KEY = "oss_bureau_local_sandbox_cases_v1";
const REPO_SLUG = "edison-land/oss-bureau";

const TIER_ORDER: Record<Tier, number> = {
  blacklist: 0,
  watchlist: 1,
  cleared: 2,
};

function extractJsonFromIssueBody(body: string): string | null {
  const fenced = body.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
  if (fenced?.[1]) return fenced[1];
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return body.slice(start, end + 1);
  }
  return null;
}

function formatStars(stars?: number): string {
  if (!stars) return "—";
  if (stars >= 1000) return `${(stars / 1000).toFixed(1)}k`;
  return String(stars);
}

export default function App() {
  const [lang, setLang] = useState<Lang>("en");
  const [scheme, setScheme] = useState<ResolvedScheme>(() => getResolvedScheme());
  const [view, setView] = useState<MainView>("board");
  const [profile, setProfile] = useState<SeverityProfile>("standard");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [sort, setSort] = useState<SortMode>("risk");
  const [query, setQuery] = useState("");
  const [selectedDossier, setSelectedDossier] = useState<CaseDossier | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedContract, setCopiedContract] = useState(false);

  // Sync color scheme across tabs & OS preference changes (modern-web-guidance: dark-mode-toggle)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setScheme(applyColorScheme(getStoredScheme()));
    mq.addEventListener("change", sync);
    window.addEventListener("storage", sync);
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // User-pinned local sandbox cases
  const [localCases, setLocalCases] = useState<CaseDossier[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? (parsed as CaseDossier[]) : [];
    } catch {
      return [];
    }
  });

  // Community Pending Issues
  const [communityIssues, setCommunityIssues] = useState<CommunityIssueRecord[]>(
    INITIAL_COMMUNITY_ISSUES.issues,
  );
  const [issuesSyncedAt, setIssuesSyncedAt] = useState<string>(INITIAL_COMMUNITY_ISSUES.syncedAt);
  const [refreshingIssues, setRefreshingIssues] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localCases));
    } catch {
      // Ignore quota errors
    }
  }, [localCases]);

  const allCases = useMemo(() => {
    const merged = [...localCases, ...CASES];
    return merged.map((c) => {
      if (profile === "standard") return c;
      const reEvaluated = evaluateTier(
        {
          riskLevel: c.riskLevel,
          promiseVsReality: c.promiseVsReality,
          defaultTelemetry: c.defaultTelemetry,
          crossToolAccess: c.crossToolAccess,
          doNotTrack: c.doNotTrack,
        },
        "strict",
      );
      return { ...c, tier: reEvaluated.tier };
    });
  }, [localCases, profile]);

  const stats = useMemo(() => {
    const totalStars = CASES.reduce((sum, c) => sum + (c.stars ?? 0), 0);
    return {
      total: allCases.length,
      blacklist: allCases.filter((c) => c.tier === "blacklist").length,
      watchlist: allCases.filter((c) => c.tier === "watchlist").length,
      cleared: allCases.filter((c) => c.tier === "cleared").length,
      community: allCases.filter((c) => c.sourceType === "community" || c.sourceType === "local")
        .length,
      totalStars,
    };
  }, [allCases]);

  const filteredCases = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = allCases.filter((c) => {
      if (filter === "blacklist" || filter === "watchlist" || filter === "cleared") {
        if (c.tier !== filter) return false;
      } else if (filter === "cross_tool") {
        if (!c.crossToolAccess && c.caseId !== "CASE-002") return false;
      } else if (filter === "no_dnt") {
        if (c.doNotTrack !== "NO") return false;
      } else if (filter === "community") {
        if (c.sourceType !== "community" && c.sourceType !== "local") return false;
      }
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.caseId.toLowerCase().includes(q) ||
        (c.auditorTool ?? "").toLowerCase().includes(q) ||
        c.oneLiner.zh.toLowerCase().includes(q) ||
        c.oneLiner.en.toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (a.sourceType === "local" && b.sourceType !== "local") return -1;
      if (b.sourceType === "local" && a.sourceType !== "local") return 1;
      if (sort === "stars") return (b.stars ?? 0) - (a.stars ?? 0);
      if (sort === "caseId") return a.caseId.localeCompare(b.caseId, undefined, { numeric: true });
      const td = TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
      if (td !== 0) return td;
      return a.caseId.localeCompare(b.caseId, undefined, { numeric: true });
    });
  }, [allCases, filter, query, sort]);

  const copyInstallCmd = async () => {
    await navigator.clipboard.writeText(INSTALL_CMD);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 1800);
  };

  const copyUniversalContract = async () => {
    await navigator.clipboard.writeText(UNIVERSAL_SKILL_CONTRACT);
    setCopiedContract(true);
    setTimeout(() => setCopiedContract(false), 1800);
  };

  const handleAddLocalCase = (dossier: CaseDossier) => {
    const stamped: CaseDossier = {
      ...dossier,
      caseId: `LOCAL-${Date.now().toString().slice(-4)}`,
      sourceType: "local",
      isCustomPreview: true,
    };
    setLocalCases((prev) => [stamped, ...prev.filter((p) => p.name !== stamped.name)]);
    setView("board");
    setFilter("all");
  };

  const handleRemoveLocalCase = (caseId: string) => {
    setLocalCases((prev) => prev.filter((c) => c.caseId !== caseId));
  };

  const refreshLiveGitHubIssues = async () => {
    setRefreshingIssues(true);
    setRefreshError(null);
    try {
      const labelsToFetch = ["case-submission", "case-tip"];
      const byNum = new Map<number, CommunityIssueRecord>();

      for (const label of labelsToFetch) {
        const res = await fetch(
          `https://api.github.com/repos/${REPO_SLUG}/issues?state=open&labels=${encodeURIComponent(label)}&per_page=30`,
          { headers: { Accept: "application/vnd.github+json" } },
        );
        if (!res.ok) throw new Error(`GitHub API HTTP ${res.status}`);
        const items = (await res.json()) as Array<Record<string, unknown>>;
        for (const item of items) {
          if ("pull_request" in item) continue;
          const num = Number(item.number);
          if (byNum.has(num)) continue;
          const labels = Array.isArray(item.labels)
            ? item.labels
                .map((l) => (typeof l === "object" && l && "name" in l ? String(l.name) : ""))
                .filter(Boolean)
            : [];
          const body = String(item.body ?? "");
          const maybeJson = extractJsonFromIssueBody(body);
          const parsed = maybeJson ? parseCaseBundleJson(maybeJson) : null;
          const validBundle = parsed?.ok && parsed.raw ? parsed.raw : null;

          let tier: Tier | null = parsed?.ok && parsed.dossier ? parsed.dossier.tier : null;
          if (!tier) {
            if (labels.includes("tier:blacklist")) tier = "blacklist";
            else if (labels.includes("tier:watchlist")) tier = "watchlist";
            else if (labels.includes("tier:cleared")) tier = "cleared";
          }

          const evidenceStatus = labels.includes("evidence:verified")
            ? "verified"
            : labels.includes("evidence:needs-fix")
              ? "needs_fix"
              : validBundle
                ? "valid_json"
                : "manual_tip";

          const reactions = (item.reactions as Record<string, number> | undefined) ?? {};
          const user = (item.user as Record<string, string> | undefined) ?? {};
          const title = String(item.title ?? "");

          byNum.set(num, {
            number: num,
            title,
            htmlUrl: String(item.html_url ?? ""),
            author: user.login || "unknown",
            authorAvatar: user.avatar_url || "",
            createdAt: String(item.created_at ?? ""),
            updatedAt: String(item.updated_at ?? ""),
            comments: Number(item.comments ?? 0),
            thumbsUp: Number(reactions["+1"] ?? 0),
            thumbsDown: Number(reactions["-1"] ?? 0),
            labels,
            tier,
            evidenceStatus,
            targetRepo:
              validBundle?.target.name ||
              title.replace(/^\[(?:Case|Case Tip)\]\s*/i, "").trim() ||
              `Issue #${num}`,
            auditorTool: validBundle?.auditor_tool ?? null,
            summary:
              validBundle?.verdict.one_liner ||
              body.trim().split("\n")[0]?.slice(0, 200) ||
              title,
            bundle: validBundle,
          });
        }
      }

      setCommunityIssues([...byNum.values()].sort((a, b) => b.number - a.number));
      setIssuesSyncedAt(new Date().toISOString());
    } catch (err) {
      setRefreshError(
        lang === "zh"
          ? `实时拉取受限（${err instanceof Error ? err.message : "网络错误"}），当前展示构建时同步的公开快照。`
          : `Live GitHub API refresh unavailable (${err instanceof Error ? err.message : "network error"}). Showing synced snapshot.`,
      );
    } finally {
      setRefreshingIssues(false);
    }
  };

  return (
    <div className="isolate relative flex min-h-svh flex-col">
      {/* Minimal coss-style Header */}
      <header className="sticky top-0 z-30 border-b bg-sidebar/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setView("board")}
              className="flex items-center gap-2 font-semibold tracking-tight text-foreground"
            >
              <span className="font-mono text-sm">oss-bureau</span>
              <Badge variant="outline" size="sm" className="hidden font-mono sm:inline-flex">
                v1.0
              </Badge>
            </button>

            <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
              <Button
                variant={view === "board" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("board")}
              >
                {lang === "zh" ? "红黑榜" : "Directory"}
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {stats.total}
                </span>
              </Button>
              <Button
                variant={view === "hearings" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("hearings")}
              >
                {lang === "zh" ? "社区听证池" : "Community Issues"}
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {communityIssues.length}
                </span>
              </Button>
              <Button
                variant={view === "rules" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("rules")}
              >
                {lang === "zh" ? "判定规则与协议" : "Rules & Protocol"}
              </Button>
            </nav>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLang(lang === "en" ? "zh" : "en")}
              aria-label="Toggle language"
            >
              {lang === "en" ? "中文" : "EN"}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setScheme(toggleColorScheme())}
              aria-label={scheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {scheme === "dark" ? <SunIcon /> : <MoonIcon />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              render={
                <a href={`https://github.com/${REPO_SLUG}`} target="_blank" rel="noreferrer" />
              }
            >
              GitHub
              <ArrowUpRightIcon />
            </Button>
            <Button size="sm" onClick={() => setSubmitOpen(true)}>
              <PlusIcon />
              {lang === "zh" ? "提交证据" : "Submit"}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {/* Clean Editorial Hero */}
        <section className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono tabular-nums">
              {CASES.length} {lang === "zh" ? "份仓库归档案宗" : "audited repositories"}
            </span>
            <span>·</span>
            <span className="font-mono tabular-nums">
              {(stats.totalStars / 1000).toFixed(0)}k+ stars
            </span>
            <span>·</span>
            <span>
              {lang === "zh"
                ? "证据全量公开于 GitHub Issues & PRs"
                : "Evidence archived in public GitHub Issues & PRs"}
            </span>
          </div>

          <h1 className="mt-3 font-heading font-semibold text-3xl tracking-tight text-foreground sm:text-4xl">
            {lang === "zh"
              ? "开源 AI 工具隐私与遥测公开红黑榜"
              : "Open-source privacy & telemetry registry."}
          </h1>

          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {lang === "zh"
              ? "只认公开源码、精确 Commit 与文档对照。使用 oss-audit 或你自己的 Skill 输出 case-bundle.json，提交到 GitHub Issue 自动验真定级，合并 PR 即自动上榜。"
              : "Code-verified audit dossiers for AI coding tools and CLIs. Run oss-audit or bring your own Skill to emit case-bundle.v1.json — verified by GitHub Actions and published via pull request."}
          </p>

          {/* Compact Install + Actions Row */}
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <div className="inline-flex h-8 items-center gap-2 rounded-lg border border-input bg-background px-2.5 font-mono text-xs shadow-xs/5">
              <TerminalIcon className="size-3.5 text-muted-foreground" />
              <code className="select-all text-foreground">{INSTALL_CMD}</code>
              <Separator orientation="vertical" className="mx-0.5 h-3.5" />
              <button
                type="button"
                onClick={copyInstallCmd}
                className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                {copiedCmd ? (
                  <CheckIcon className="size-3.5 text-success" />
                ) : (
                  <CopyIcon className="size-3.5" />
                )}
                <span>{copiedCmd ? (lang === "zh" ? "已复制" : "Copied") : lang === "zh" ? "复制" : "Copy"}</span>
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={() => setSubmitOpen(true)}>
              {lang === "zh" ? "拖入 case-bundle.json 定级" : "Drop case-bundle.json"}
            </Button>
          </div>
        </section>

        {/* Mobile View Tabs */}
        <div className="mt-6 md:hidden">
          <Tabs value={view} onValueChange={(v) => setView(v as MainView)}>
            <TabsList className="w-full">
              <TabsTab value="board">{lang === "zh" ? "红黑榜" : "Directory"}</TabsTab>
              <TabsTab value="hearings">
                {lang === "zh" ? `听证池 (${communityIssues.length})` : `Issues (${communityIssues.length})`}
              </TabsTab>
              <TabsTab value="rules">{lang === "zh" ? "规则协议" : "Rules"}</TabsTab>
            </TabsList>
          </Tabs>
        </div>

        {/* VIEW 1: REGISTRY DIRECTORY */}
        {view === "board" && (
          <section className="mt-8 space-y-4">
            {/* Toolbar: Filter Tabs + Search + Sort + Profile */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterMode)}>
                <TabsList className="flex-wrap">
                  <TabsTab value="all">
                    {lang === "zh" ? "全部" : "All"}
                    <span className="ml-1 font-mono text-xs text-muted-foreground tabular-nums">
                      {stats.total}
                    </span>
                  </TabsTab>
                  <TabsTab value="blacklist">
                    <span aria-hidden="true" className="mr-1.5 size-1.5 rounded-full bg-destructive" />
                    {lang === "zh" ? "黑榜" : "Flagged"}
                    <span className="ml-1 font-mono text-xs text-muted-foreground tabular-nums">
                      {stats.blacklist}
                    </span>
                  </TabsTab>
                  <TabsTab value="watchlist">
                    <span aria-hidden="true" className="mr-1.5 size-1.5 rounded-full bg-warning" />
                    {lang === "zh" ? "灰榜" : "Watch"}
                    <span className="ml-1 font-mono text-xs text-muted-foreground tabular-nums">
                      {stats.watchlist}
                    </span>
                  </TabsTab>
                  <TabsTab value="cleared">
                    <span aria-hidden="true" className="mr-1.5 size-1.5 rounded-full bg-success" />
                    {lang === "zh" ? "红榜" : "Clean"}
                    <span className="ml-1 font-mono text-xs text-muted-foreground tabular-nums">
                      {stats.cleared}
                    </span>
                  </TabsTab>
                  <TabsTab value="cross_tool">
                    {lang === "zh" ? "跨工具" : "Cross-tool"}
                  </TabsTab>
                  <TabsTab value="no_dnt">
                    {lang === "zh" ? "不认 DNT" : "No DNT"}
                  </TabsTab>
                  {stats.community > 0 && (
                    <TabsTab value="community">
                      {lang === "zh" ? "本地/社区" : "Local/PR"}
                    </TabsTab>
                  )}
                </TabsList>
              </Tabs>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-48 flex-1 sm:w-52 sm:flex-none">
                  <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 z-10 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    size="sm"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={lang === "zh" ? "搜索项目 / Skill..." : "Filter repos or skills..."}
                    className="[&_input]:pl-7"
                  />
                </div>

                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortMode)}
                  aria-label={lang === "zh" ? "排序" : "Sort by"}
                  className="h-7.5 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground shadow-xs/5 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-7"
                >
                  <option value="risk">{lang === "zh" ? "按风险排序" : "Sort: Risk"}</option>
                  <option value="stars">{lang === "zh" ? "按 Stars 排序" : "Sort: Stars"}</option>
                  <option value="caseId">{lang === "zh" ? "按案宗号" : "Sort: Case ID"}</option>
                </select>

                <Tabs value={profile} onValueChange={(v) => setProfile(v as SeverityProfile)}>
                  <TabsList size="sm">
                    <TabsTab value="standard">
                      {lang === "zh" ? "标准" : "Standard"}
                    </TabsTab>
                    <TabsTab
                      value="strict"
                      title={
                        lang === "zh"
                          ? "隐私洁癖模式：任何默认开启遥测或不认 DNT 均判黑榜"
                          : "Strict mode: any default-on opt-out telemetry or DNT refusal is flagged"
                      }
                    >
                      {lang === "zh" ? "严格" : "Strict"}
                    </TabsTab>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {/* coss ui Signature Frame + Card Table */}
            <Frame>
              {filteredCases.length === 0 ? (
                <FramePanel>
                  <Empty className="py-12">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <SearchIcon />
                      </EmptyMedia>
                      <EmptyTitle>
                        {lang === "zh" ? "没有匹配的案宗" : "No matching dossiers"}
                      </EmptyTitle>
                      <EmptyDescription>
                        {lang === "zh"
                          ? "尝试清空搜索词或切换筛选条件。"
                          : "Try clearing your search query or switching tier filters."}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </FramePanel>
              ) : (
                <div
                  role="region"
                  tabIndex={0}
                  aria-label={lang === "zh" ? "开源隐私与遥测审计列表" : "Open-source privacy and telemetry registry"}
                  className="registry-table-region"
                >
                  <Table variant="card">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{lang === "zh" ? "仓库" : "Repository"}</TableHead>
                        <TableHead>{lang === "zh" ? "定级" : "Status"}</TableHead>
                        <TableHead>{lang === "zh" ? "默认遥测" : "Telemetry"}</TableHead>
                        <TableHead>DNT</TableHead>
                        <TableHead>{lang === "zh" ? "跨工具" : "Cross-tool"}</TableHead>
                        <TableHead>{lang === "zh" ? "源码核实摘要" : "Summary"}</TableHead>
                        <TableHead className="text-right">
                          {lang === "zh" ? "操作" : "Actions"}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCases.map((c) => {
                        const tierBadge =
                          c.tier === "blacklist"
                            ? {
                                variant: "error" as const,
                                dot: "bg-destructive",
                                label: lang === "zh" ? "黑榜" : "Flagged",
                              }
                            : c.tier === "watchlist"
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
                          <TableRow
                            key={c.caseId}
                            onClick={() => setSelectedDossier(c)}
                            className="cursor-pointer"
                          >
                            <TableCell data-label={lang === "zh" ? "仓库" : "Repository"}>
                              <div className="flex flex-col gap-0.5 py-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-foreground">{c.name}</span>
                                  {c.sourceType === "local" && (
                                    <Badge size="sm" variant="secondary">
                                      Local
                                    </Badge>
                                  )}
                                  {c.sourceType === "community" && (
                                    <Badge size="sm" variant="info">
                                      PR
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground tabular-nums">
                                  <span>{c.caseId}</span>
                                  <span>·</span>
                                  <span>{formatStars(c.stars)} ★</span>
                                  <span>·</span>
                                  <span>{c.commitHash.slice(0, 7)}</span>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell data-label={lang === "zh" ? "定级" : "Status"}>
                              <div className="flex flex-wrap items-center gap-1">
                                <Badge variant={tierBadge.variant}>
                                  <span
                                    aria-hidden="true"
                                    className={`size-1.5 rounded-full ${tierBadge.dot}`}
                                  />
                                  {tierBadge.label}
                                </Badge>
                                {c.status === "PARTIALLY_PATCHED" && (
                                  <Badge size="sm" variant="info">
                                    {lang === "zh" ? "部分整改" : "Patched"}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>

                            <TableCell data-label={lang === "zh" ? "默认遥测" : "Telemetry"}>
                              <span className="font-mono text-xs text-foreground">
                                {c.defaultTelemetry}
                              </span>
                            </TableCell>

                            <TableCell data-label="DNT">
                              <span
                                className={`font-mono text-xs ${
                                  c.doNotTrack === "NO"
                                    ? "text-destructive-foreground"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {c.doNotTrack}
                              </span>
                            </TableCell>

                            <TableCell data-label={lang === "zh" ? "跨工具" : "Cross-tool"}>
                              {c.crossToolAccess ? (
                                <Badge size="sm" variant="error">
                                  {lang === "zh" ? "是" : "Yes"}
                                </Badge>
                              ) : c.caseId === "CASE-002" ? (
                                <Badge size="sm" variant="outline">
                                  {lang === "zh" ? "历史" : "Fixed"}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {lang === "zh" ? "否" : "No"}
                                </span>
                              )}
                            </TableCell>

                            <TableCell
                              data-label={lang === "zh" ? "摘要" : "Summary"}
                              className="max-w-xs whitespace-normal"
                            >
                              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                                {c.oneLiner[lang]}
                              </p>
                            </TableCell>

                            <TableCell
                              data-label={lang === "zh" ? "操作" : "Actions"}
                              className="text-right"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="inline-flex items-center justify-end gap-1">
                                {c.sourceType === "local" && (
                                  <Button
                                    size="icon-xs"
                                    variant="ghost"
                                    onClick={() => handleRemoveLocalCase(c.caseId)}
                                    aria-label="Remove local case"
                                  >
                                    <Trash2Icon />
                                  </Button>
                                )}
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={() => setSelectedDossier(c)}
                                >
                                  {lang === "zh" ? "详情" : "Inspect"}
                                </Button>
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  onClick={() => exportCaseCardPng(c, lang)}
                                  aria-label={lang === "zh" ? "导出 PNG" : "Export PNG"}
                                >
                                  <DownloadIcon />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Frame>
          </section>
        )}

        {/* VIEW 2: COMMUNITY HEARINGS (GITHUB ISSUES) */}
        {view === "hearings" && (
          <section className="mt-8 space-y-4">
            <Frame>
              <FrameHeader className="flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <FrameTitle>
                    {lang === "zh"
                      ? "社区听证池（GitHub Issues 实时联动）"
                      : "Community hearings (GitHub Issues)"}
                  </FrameTitle>
                  <FrameDescription>
                    {lang === "zh"
                      ? `公开展示待复核的 case-submission 线索 · 上次同步 ${issuesSyncedAt.slice(0, 19).replace("T", " ")} UTC`
                      : `Pending evidence pinned in public GitHub Issues · Last synced ${issuesSyncedAt.slice(0, 19).replace("T", " ")} UTC`}
                  </FrameDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={refreshingIssues}
                    onClick={() => void refreshLiveGitHubIssues()}
                  >
                    <RefreshCwIcon className={refreshingIssues ? "animate-spin" : ""} />
                    {lang === "zh" ? "刷新 Issues" : "Refresh"}
                  </Button>
                  <Button
                    size="sm"
                    render={
                      <a
                        href={`https://github.com/${REPO_SLUG}/issues/new?template=case-submission.yml`}
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                  >
                    <PlusIcon />
                    {lang === "zh" ? "提交案宗 Issue" : "New Case Issue"}
                  </Button>
                </div>
              </FrameHeader>

              {refreshError && (
                <div className="px-4 pb-3">
                  <Alert variant="warning">
                    <AlertDescription className="text-xs">{refreshError}</AlertDescription>
                  </Alert>
                </div>
              )}

              <FramePanel>
                {communityIssues.length === 0 ? (
                  <Empty className="py-12">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <MessageSquareIcon />
                      </EmptyMedia>
                      <EmptyTitle>
                        {lang === "zh" ? "暂无待复核 Issue" : "No open case submissions yet"}
                      </EmptyTitle>
                      <EmptyDescription>
                        {lang === "zh"
                          ? "用 oss-audit 或你自己的 Skill 审计任意仓库，把 case-bundle.json 提交到 GitHub Issue，Bot 验真后会立即出现在这里。"
                          : "Audit any open-source repo with oss-audit or your own Skill and open a Case Submission Issue. Verified submissions appear here automatically."}
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent className="flex-row justify-center gap-2">
                      <Button size="sm" onClick={() => setSubmitOpen(true)}>
                        {lang === "zh" ? "导入 JSON 提交" : "Drop JSON to submit"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        render={
                          <a
                            href={`https://github.com/${REPO_SLUG}/issues?q=is%3Aissue+label%3Acase-submission`}
                            target="_blank"
                            rel="noreferrer"
                          />
                        }
                      >
                        {lang === "zh" ? "查看 GitHub" : "View on GitHub"}
                        <ArrowUpRightIcon />
                      </Button>
                    </EmptyContent>
                  </Empty>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {communityIssues.map((iss) => {
                      const tierBadge =
                        iss.tier === "blacklist"
                          ? { variant: "error" as const, label: lang === "zh" ? "黑榜" : "Flagged" }
                          : iss.tier === "watchlist"
                            ? { variant: "warning" as const, label: lang === "zh" ? "灰榜" : "Watch" }
                            : iss.tier === "cleared"
                              ? { variant: "success" as const, label: lang === "zh" ? "红榜" : "Clean" }
                              : { variant: "outline" as const, label: lang === "zh" ? "待定" : "Pending" };

                      return (
                        <Card key={iss.number}>
                          <CardHeader className="pb-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-mono text-xs text-muted-foreground">
                                #{iss.number} · @{iss.author}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {iss.evidenceStatus === "verified" && (
                                  <Badge size="sm" variant="info">
                                    Bot verified
                                  </Badge>
                                )}
                                <Badge size="sm" variant={tierBadge.variant}>
                                  {tierBadge.label}
                                </Badge>
                              </div>
                            </div>
                            <CardTitle className="mt-1 text-base">{iss.targetRepo}</CardTitle>
                            <CardDescription className="line-clamp-2 text-xs">
                              {iss.summary}
                            </CardDescription>
                          </CardHeader>
                          <CardPanel className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                            <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground tabular-nums">
                              {iss.auditorTool && <span>{iss.auditorTool}</span>}
                              <span className="inline-flex items-center gap-1">
                                <ThumbsUpIcon className="size-3" /> {iss.thumbsUp}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <ThumbsDownIcon className="size-3" /> {iss.thumbsDown}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <MessageSquareIcon className="size-3" /> {iss.comments}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {iss.bundle && (
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={() => {
                                    const { dossier } = convertRawBundleToDossier(iss.bundle!, {
                                      sourceType: "community",
                                      isCustomPreview: false,
                                    });
                                    setSelectedDossier({
                                      ...dossier,
                                      caseId: `ISSUE-#${iss.number}`,
                                      submittedBy: iss.author,
                                      evidenceIssueNumber: iss.number,
                                      evidenceIssueUrl: iss.htmlUrl,
                                    });
                                  }}
                                >
                                  <EyeIcon />
                                  {lang === "zh" ? "预览" : "Inspect"}
                                </Button>
                              )}
                              <Button
                                size="xs"
                                variant="secondary"
                                render={<a href={iss.htmlUrl} target="_blank" rel="noreferrer" />}
                              >
                                {lang === "zh" ? "去复核" : "Review"}
                                <ArrowUpRightIcon />
                              </Button>
                            </div>
                          </CardPanel>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </FramePanel>
            </Frame>
          </section>
        )}

        {/* VIEW 3: RULES & OPEN PROTOCOL */}
        {view === "rules" && (
          <section className="mt-8 space-y-6">
            <Frame>
              <FrameHeader>
                <FrameTitle>
                  {lang === "zh" ? "公开分级标尺（标准模式）" : "Public tier classification rules"}
                </FrameTitle>
                <FrameDescription>
                  {lang === "zh"
                    ? "任何 Skill 仅负责产出客观源码事实，最终红/灰/黑定级由仓库内 scripts/bureau_bot.py 与前端同源规则确定性计算。"
                    : "Skills emit objective code facts only. Final status is computed deterministically by the same open engine in scripts/bureau_bot.py and the web client."}
                </FrameDescription>
              </FrameHeader>
              <div className="grid gap-1 md:grid-cols-3">
                <FramePanel className="space-y-2.5">
                  <Badge variant="error">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-destructive" />
                    {lang === "zh" ? "黑榜 · Flagged" : "Flagged"}
                  </Badge>
                  <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground">
                    <li>
                      {lang === "zh"
                        ? "跨工具静默读取外部凭证或账号 (cross_tool_access = true)"
                        : "Silent cross-tool credential or account reads (cross_tool_access = true)"}
                    </li>
                    <li>
                      {lang === "zh"
                        ? "代码行为与公开“零遥测”声明直接矛盾 (DIRECT_CONTRADICTION)"
                        : "Direct contradiction with explicit privacy docs (DIRECT_CONTRADICTION)"}
                    </li>
                    <li>
                      {lang === "zh"
                        ? "强制开启遥测且无内置关闭方式 (FORCED)"
                        : "Forced telemetry with no built-in opt-out (FORCED)"}
                    </li>
                    <li>
                      {lang === "zh"
                        ? "核实存在 HIGH / CRITICAL 级隐私或供应链红旗"
                        : "Verified HIGH or CRITICAL privacy/supply-chain finding"}
                    </li>
                  </ul>
                </FramePanel>

                <FramePanel className="space-y-2.5">
                  <Badge variant="warning">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
                    {lang === "zh" ? "灰榜 · Watch" : "Watch"}
                  </Badge>
                  <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground">
                    <li>
                      {lang === "zh"
                        ? "默认开启遥测且关闭门槛高或隐藏开关 (OPT_OUT_HARD)"
                        : "Default-on telemetry with high opt-out friction (OPT_OUT_HARD)"}
                    </li>
                    <li>
                      {lang === "zh"
                        ? "默认开启遥测但清晰披露且可关闭 (OPT_OUT_EASY)"
                        : "Disclosed default-on opt-out telemetry (OPT_OUT_EASY)"}
                    </li>
                    <li>
                      {lang === "zh"
                        ? "文档对采集范围披露不完整 (PARTIAL_MISMATCH)"
                        : "Documentation omits material telemetry behavior (PARTIAL_MISMATCH)"}
                    </li>
                    <li>
                      {lang === "zh"
                        ? "中等风险默认配置 (MEDIUM)"
                        : "Moderate telemetry or hardening findings (MEDIUM)"}
                    </li>
                  </ul>
                </FramePanel>

                <FramePanel className="space-y-2.5">
                  <Badge variant="success">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
                    {lang === "zh" ? "红榜 · Clean" : "Clean"}
                  </Badge>
                  <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground">
                    <li>
                      {lang === "zh"
                        ? "零活跃遥测 (NONE) 或严格默认关闭 (OPT_IN)"
                        : "Zero active telemetry (NONE) or strictly opt-in (OPT_IN)"}
                    </li>
                    <li>
                      {lang === "zh"
                        ? "无未披露的跨工具敏感目录访问"
                        : "No undisclosed cross-tool credential reads"}
                    </li>
                    <li>
                      {lang === "zh"
                        ? "公开承诺与实际源码行为一致"
                        : "Public claims consistent with runtime source"}
                    </li>
                    <li>
                      {lang === "zh" ? "风险等级为 CLEAN 或 LOW" : "Risk level CLEAN or LOW"}
                    </li>
                  </ul>
                </FramePanel>
              </div>
            </Frame>

            <Frame>
              <FrameHeader className="flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <FrameTitle>
                    {lang === "zh"
                      ? "GitHub 全公开共建闭环 & 第三方 Skill 契约"
                      : "GitHub-native workflow & Universal Skill Contract"}
                  </FrameTitle>
                  <FrameDescription>
                    {lang === "zh"
                      ? "Issue 固证 → Actions 自动验真 Commit/文件路径并定级 → 贴 approved 标签自动开 PR 归档进 cases/。"
                      : "Issue evidence → Actions verifies commits & file paths → labeling `approved` opens an archive PR into cases/."}
                  </FrameDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={copyUniversalContract}>
                    {copiedContract ? <CheckIcon /> : <CopyIcon />}
                    {copiedContract
                      ? lang === "zh"
                        ? "已复制契约"
                        : "Copied"
                      : lang === "zh"
                        ? "复制契约给自有 Skill"
                        : "Copy contract"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    render={
                      <a
                        href={`https://github.com/${REPO_SLUG}/tree/main/cases`}
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                  >
                    <GitPullRequestIcon />
                    cases/
                  </Button>
                </div>
              </FrameHeader>
              <FramePanel>
                <pre className="max-h-72 overflow-auto rounded-lg border bg-sidebar p-4 font-mono text-xs text-foreground">
                  <code>{UNIVERSAL_SKILL_CONTRACT}</code>
                </pre>
              </FramePanel>
            </Frame>
          </section>
        )}
      </main>

      {/* Clean Minimal Footer */}
      <footer className="mt-12 border-t bg-sidebar">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <p className="max-w-2xl leading-relaxed">
            {lang === "zh"
              ? "OSS Bureau 仅收录基于公开源码与精确 Commit 的客观审计。所有证据存放于公开 GitHub Issues 与 cases/，维护者可随时提交修复 Commit 更新状态。"
              : "Factual audits backed exclusively by public source code and commit hashes. All evidence lives in GitHub Issues and cases/; maintainers can submit fix commits anytime."}
          </p>
          <div className="flex shrink-0 items-center gap-3 font-mono">
            <a
              href={`https://github.com/${REPO_SLUG}`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground"
            >
              {REPO_SLUG}
            </a>
            <span>·</span>
            <span>MIT</span>
          </div>
        </div>
      </footer>

      <DossierDialog
        dossier={selectedDossier}
        lang={lang}
        profile={profile}
        onClose={() => setSelectedDossier(null)}
      />

      <SubmitTipDialog
        open={submitOpen}
        lang={lang}
        onClose={() => setSubmitOpen(false)}
        onPreviewDossier={(d) => setSelectedDossier(d)}
        onAddLocalCase={handleAddLocalCase}
      />
    </div>
  );
}
