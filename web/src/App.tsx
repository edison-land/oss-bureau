import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowUpIcon,
  ArrowUpRightIcon,
  CheckIcon,
  CopyIcon,
  GithubIcon,
  MessageSquareIcon,
  MoonIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SunIcon,
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
import { StatusBadge, formatDnt, formatStars, formatTelemetry } from "./components/StatusBadge";
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
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./components/ui/empty";
import { Frame, FramePanel } from "./components/ui/frame";
import { Input } from "./components/ui/input";
import { Kbd } from "./components/ui/kbd";
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
type FilterMode = "all" | Tier;
type SortKey = "tier" | "name" | "stars";
type SortDir = "ascending" | "descending";

const INSTALL_CMD = "npx skills add edison-land/oss-bureau";
const LOCAL_STORAGE_KEY = "oss_bureau_local_sandbox_cases_v1";
const REPO_SLUG = "edison-land/oss-bureau";
const COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

const TIER_RANK: Record<Tier, number> = {
  blacklist: 0,
  watchlist: 1,
  cleared: 2,
};

function extractJsonFromIssueBody(body: string): string | null {
  const fenced = body.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
  if (fenced?.[1]) return fenced[1];
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start !== -1 && end > start ? body.slice(start, end + 1) : null;
}

export default function App() {
  const [lang, setLang] = useState<Lang>("en");
  const [scheme, setScheme] = useState<ResolvedScheme>(() => getResolvedScheme());
  const [view, setView] = useState<MainView>("board");
  const [profile, setProfile] = useState<SeverityProfile>("standard");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [sortKey, setSortKey] = useState<SortKey>("tier");
  const [sortDir, setSortDir] = useState<SortDir>("ascending");
  const [sortAnnouncement, setSortAnnouncement] = useState("");
  const [query, setQuery] = useState("");
  const [selectedDossier, setSelectedDossier] = useState<CaseDossier | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedContract, setCopiedContract] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const tableCaptionId = useId();

  // Sync color scheme across tabs & OS changes
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

  // Keyboard shortcut: `/` focuses search input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        setView("board");
        requestAnimationFrame(() => searchRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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

  const [communityIssues, setCommunityIssues] = useState<CommunityIssueRecord[]>(
    INITIAL_COMMUNITY_ISSUES.issues,
  );
  const [refreshingIssues, setRefreshingIssues] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localCases));
    } catch {
      // Ignore storage quota errors
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

  const counts = useMemo(
    () => ({
      all: allCases.length,
      blacklist: allCases.filter((c) => c.tier === "blacklist").length,
      watchlist: allCases.filter((c) => c.tier === "watchlist").length,
      cleared: allCases.filter((c) => c.tier === "cleared").length,
    }),
    [allCases],
  );

  const visibleCases = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = allCases.filter((c) => {
      if (filter !== "all" && c.tier !== filter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.caseId.toLowerCase().includes(q) ||
        c.defaultTelemetry.toLowerCase().includes(q) ||
        (c.auditorTool ?? "").toLowerCase().includes(q) ||
        c.oneLiner.en.toLowerCase().includes(q) ||
        c.oneLiner.zh.toLowerCase().includes(q)
      );
    });

    const factor = sortDir === "ascending" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (a.sourceType === "local" && b.sourceType !== "local") return -1;
      if (b.sourceType === "local" && a.sourceType !== "local") return 1;
      if (sortKey === "stars") return factor * ((a.stars ?? 0) - (b.stars ?? 0));
      if (sortKey === "name") return factor * COLLATOR.compare(a.name, b.name);
      const td = TIER_RANK[a.tier] - TIER_RANK[b.tier];
      if (td !== 0) return factor * td;
      return COLLATOR.compare(a.caseId, b.caseId);
    });
  }, [allCases, filter, query, sortDir, sortKey]);

  const handleSort = (key: SortKey, label: string) => {
    const nextDir: SortDir =
      sortKey === key
        ? sortDir === "ascending"
          ? "descending"
          : "ascending"
        : key === "stars"
          ? "descending"
          : "ascending";
    setSortKey(key);
    setSortDir(nextDir);
    setSortAnnouncement(`Sorted by ${label}, ${nextDir}, ${visibleCases.length} rows`);
  };

  const copyInstallCmd = async () => {
    await navigator.clipboard.writeText(INSTALL_CMD);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 1600);
  };

  const copyContract = async () => {
    await navigator.clipboard.writeText(UNIVERSAL_SKILL_CONTRACT);
    setCopiedContract(true);
    setTimeout(() => setCopiedContract(false), 1600);
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

  const refreshLiveGitHubIssues = async () => {
    setRefreshingIssues(true);
    setRefreshError(null);
    try {
      const byNum = new Map<number, CommunityIssueRecord>();
      for (const label of ["case-submission", "case-tip"]) {
        const res = await fetch(
          `https://api.github.com/repos/${REPO_SLUG}/issues?state=open&labels=${encodeURIComponent(label)}&per_page=30`,
          { headers: { Accept: "application/vnd.github+json" } },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
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

          const reactions = (item.reactions as Record<string, number> | undefined) ?? {};
          const user = (item.user as Record<string, string> | undefined) ?? {};
          const title = String(item.title ?? "");

          byNum.set(num, {
            number: num,
            title,
            htmlUrl: String(item.html_url ?? ""),
            author: user.login || "unknown",
            createdAt: String(item.created_at ?? ""),
            updatedAt: String(item.updated_at ?? ""),
            comments: Number(item.comments ?? 0),
            thumbsUp: Number(reactions["+1"] ?? 0),
            thumbsDown: Number(reactions["-1"] ?? 0),
            labels,
            tier,
            evidenceStatus: labels.includes("evidence:verified")
              ? "verified"
              : labels.includes("evidence:needs-fix")
                ? "needs_fix"
                : validBundle
                  ? "valid_json"
                  : "manual_tip",
            targetRepo:
              validBundle?.target.name ||
              title.replace(/^\[(?:Case|Case Tip)\]\s*/i, "").trim() ||
              `Issue #${num}`,
            auditorTool: validBundle?.auditor_tool ?? null,
            summary: validBundle?.verdict.one_liner || title,
            bundle: validBundle,
          });
        }
      }
      setCommunityIssues([...byNum.values()].sort((a, b) => b.number - a.number));
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : "Failed to refresh");
    } finally {
      setRefreshingIssues(false);
    }
  };

  return (
    <div className="isolate relative flex min-h-svh flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-sidebar/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setView("board")}
              className="font-mono font-semibold text-sm tracking-tight text-foreground"
            >
              oss-bureau
            </button>

            <nav aria-label="Primary" className="flex items-center gap-1">
              <Button
                variant={view === "board" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("board")}
              >
                {lang === "zh" ? "名录" : "Registry"}
              </Button>
              <Button
                variant={view === "hearings" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("hearings")}
              >
                {lang === "zh" ? "听证" : "Issues"}
                {communityIssues.length > 0 && (
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {communityIssues.length}
                  </span>
                )}
              </Button>
              <Button
                variant={view === "rules" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("rules")}
              >
                {lang === "zh" ? "协议" : "Protocol"}
              </Button>
            </nav>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLang(lang === "en" ? "zh" : "en")}
              aria-label="Language"
            >
              {lang === "en" ? "中文" : "EN"}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setScheme(toggleColorScheme())}
              aria-label={scheme === "dark" ? "Light theme" : "Dark theme"}
            >
              {scheme === "dark" ? <SunIcon /> : <MoonIcon />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="GitHub repository"
              render={
                <a href={`https://github.com/${REPO_SLUG}`} target="_blank" rel="noreferrer" />
              }
            >
              <GithubIcon />
            </Button>
            <Button size="sm" className="ml-1" onClick={() => setSubmitOpen(true)}>
              <PlusIcon />
              {lang === "zh" ? "提交" : "Submit"}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {/* Focused Title Bar — zero tagline, zero filler */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <h1 className="font-heading font-semibold text-2xl tracking-tight text-foreground">
            {view === "board"
              ? lang === "zh"
                ? "开源遥测名录"
                : "Open-source telemetry registry"
              : view === "hearings"
                ? lang === "zh"
                  ? "社区听证 Issues"
                  : "Pending submissions"
                : lang === "zh"
                  ? "规则与 Agent 协议"
                  : "Rules & agent protocol"}
          </h1>

          <button
            type="button"
            onClick={copyInstallCmd}
            className="inline-flex h-8 w-fit items-center gap-2 rounded-lg border border-input bg-background px-3 font-mono text-xs text-foreground shadow-xs/5 transition-colors hover:bg-accent/50"
          >
            <span>{INSTALL_CMD}</span>
            {copiedCmd ? (
              <CheckIcon className="size-3.5 text-success" />
            ) : (
              <CopyIcon className="size-3.5 text-muted-foreground" />
            )}
          </button>
        </div>

        {/* VIEW 1: REGISTRY */}
        {view === "board" && (
          <section className="mt-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterMode)}>
                <TabsList>
                  <TabsTab value="all">
                    {lang === "zh" ? "全部" : "All"}
                    <span className="ml-1 font-mono text-xs text-muted-foreground tabular-nums">
                      {counts.all}
                    </span>
                  </TabsTab>
                  <TabsTab value="blacklist">
                    <span aria-hidden="true" className="mr-1.5 size-1.5 rounded-full bg-destructive" />
                    {lang === "zh" ? "黑榜" : "Flagged"}
                    <span className="ml-1 font-mono text-xs text-muted-foreground tabular-nums">
                      {counts.blacklist}
                    </span>
                  </TabsTab>
                  <TabsTab value="watchlist">
                    <span aria-hidden="true" className="mr-1.5 size-1.5 rounded-full bg-warning" />
                    {lang === "zh" ? "灰榜" : "Watch"}
                    <span className="ml-1 font-mono text-xs text-muted-foreground tabular-nums">
                      {counts.watchlist}
                    </span>
                  </TabsTab>
                  <TabsTab value="cleared">
                    <span aria-hidden="true" className="mr-1.5 size-1.5 rounded-full bg-success" />
                    {lang === "zh" ? "红榜" : "Clean"}
                    <span className="ml-1 font-mono text-xs text-muted-foreground tabular-nums">
                      {counts.cleared}
                    </span>
                  </TabsTab>
                </TabsList>
              </Tabs>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-52 sm:flex-none">
                  <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 z-10 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchRef}
                    type="search"
                    size="sm"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={lang === "zh" ? "搜索" : "Filter"}
                    className="[&_input]:pl-7 [&_input]:pr-7"
                  />
                  {!query && (
                    <Kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                      /
                    </Kbd>
                  )}
                </div>

                <Tabs value={profile} onValueChange={(v) => setProfile(v as SeverityProfile)}>
                  <TabsList size="sm">
                    <TabsTab value="standard">{lang === "zh" ? "标准" : "Standard"}</TabsTab>
                    <TabsTab value="strict">{lang === "zh" ? "严格" : "Strict"}</TabsTab>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            <div role="status" className="sr-only">
              {sortAnnouncement}
            </div>

            <Frame>
              {visibleCases.length === 0 ? (
                <FramePanel>
                  <Empty className="py-12">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <SearchIcon />
                      </EmptyMedia>
                      <EmptyTitle>{lang === "zh" ? "无匹配项" : "No results"}</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                </FramePanel>
              ) : (
                <div
                  role="region"
                  tabIndex={0}
                  aria-labelledby={tableCaptionId}
                  className="registry-table-region"
                >
                  <Table variant="card">
                    <caption id={tableCaptionId} className="sr-only">
                      {lang === "zh" ? "开源遥测名录" : "Open-source telemetry registry"}
                    </caption>
                    <TableHeader>
                      <TableRow>
                        <TableHead
                          scope="col"
                          aria-sort={sortKey === "name" ? sortDir : undefined}
                        >
                          <button
                            type="button"
                            onClick={() => handleSort("name", "Repository")}
                            className="sort-trigger flex h-10 w-full items-center gap-1.5 px-2.5 text-left font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span>{lang === "zh" ? "仓库" : "Repository"}</span>
                            <ArrowUpIcon
                              aria-hidden="true"
                              className="sort-indicator size-3.5 opacity-0 transition-transform"
                            />
                          </button>
                        </TableHead>

                        <TableHead
                          scope="col"
                          aria-sort={sortKey === "tier" ? sortDir : undefined}
                        >
                          <button
                            type="button"
                            onClick={() => handleSort("tier", "Status")}
                            className="sort-trigger flex h-10 w-full items-center gap-1.5 px-2.5 text-left font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span>{lang === "zh" ? "状态" : "Status"}</span>
                            <ArrowUpIcon
                              aria-hidden="true"
                              className="sort-indicator size-3.5 opacity-0 transition-transform"
                            />
                          </button>
                        </TableHead>

                        <TableHead scope="col">{lang === "zh" ? "遥测" : "Telemetry"}</TableHead>
                        <TableHead scope="col">DNT</TableHead>

                        <TableHead
                          scope="col"
                          aria-sort={sortKey === "stars" ? sortDir : undefined}
                          className="text-right"
                        >
                          <button
                            type="button"
                            onClick={() => handleSort("stars", "Stars")}
                            className="sort-trigger flex h-10 w-full items-center justify-end gap-1.5 px-2.5 text-right font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <ArrowUpIcon
                              aria-hidden="true"
                              className="sort-indicator size-3.5 opacity-0 transition-transform"
                            />
                            <span>Stars</span>
                          </button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleCases.map((c) => (
                        <TableRow
                          key={c.caseId}
                          onClick={() => setSelectedDossier(c)}
                          className="group cursor-pointer"
                        >
                          <TableCell data-label={lang === "zh" ? "仓库" : "Repository"}>
                            <div className="flex items-center gap-2 py-0.5">
                              <span className="font-medium text-foreground">{c.name}</span>
                              {c.status === "PARTIALLY_PATCHED" && (
                                <Badge size="sm" variant="info">
                                  {lang === "zh" ? "部分整改" : "Patched"}
                                </Badge>
                              )}
                              {c.sourceType === "local" && (
                                <span
                                  className="inline-flex items-center gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Badge size="sm" variant="secondary">
                                    Local
                                  </Badge>
                                  <Button
                                    size="icon-xs"
                                    variant="ghost"
                                    aria-label="Remove local case"
                                    onClick={() =>
                                      setLocalCases((prev) =>
                                        prev.filter((item) => item.caseId !== c.caseId),
                                      )
                                    }
                                  >
                                    <Trash2Icon />
                                  </Button>
                                </span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell data-label={lang === "zh" ? "状态" : "Status"}>
                            <StatusBadge tier={c.tier} lang={lang} />
                          </TableCell>

                          <TableCell data-label={lang === "zh" ? "遥测" : "Telemetry"}>
                            <span className="text-sm text-foreground">
                              {formatTelemetry(c.defaultTelemetry, lang)}
                            </span>
                          </TableCell>

                          <TableCell data-label="DNT">
                            <span
                              className={`text-sm ${
                                c.doNotTrack === "NO"
                                  ? "text-destructive-foreground"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {formatDnt(c.doNotTrack, lang)}
                            </span>
                          </TableCell>

                          <TableCell
                            data-label="Stars"
                            className="text-right font-mono text-xs text-muted-foreground tabular-nums"
                          >
                            {formatStars(c.stars)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Frame>
          </section>
        )}

        {/* VIEW 2: COMMUNITY ISSUES */}
        {view === "hearings" && (
          <section className="mt-6 space-y-4">
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={refreshingIssues}
                onClick={() => void refreshLiveGitHubIssues()}
              >
                <RefreshCwIcon className={refreshingIssues ? "animate-spin" : ""} />
                {lang === "zh" ? "刷新" : "Refresh"}
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
                {lang === "zh" ? "新建 Issue" : "New issue"}
              </Button>
            </div>

            {refreshError && (
              <Alert variant="warning">
                <AlertDescription className="font-mono text-xs">{refreshError}</AlertDescription>
              </Alert>
            )}

            <Frame>
              {communityIssues.length === 0 ? (
                <FramePanel>
                  <Empty className="py-14">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <MessageSquareIcon />
                      </EmptyMedia>
                      <EmptyTitle>
                        {lang === "zh" ? "暂无待审 Issue" : "No open submissions"}
                      </EmptyTitle>
                    </EmptyHeader>
                    <EmptyContent className="flex-row justify-center gap-2">
                      <Button size="sm" onClick={() => setSubmitOpen(true)}>
                        {lang === "zh" ? "提交 JSON" : "Submit JSON"}
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
                        GitHub
                        <ArrowUpRightIcon />
                      </Button>
                    </EmptyContent>
                  </Empty>
                </FramePanel>
              ) : (
                <Table variant="card">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{lang === "zh" ? "仓库" : "Repository"}</TableHead>
                      <TableHead>{lang === "zh" ? "状态" : "Status"}</TableHead>
                      <TableHead>Skill</TableHead>
                      <TableHead className="text-right">Issue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {communityIssues.map((iss) => (
                      <TableRow
                        key={iss.number}
                        className="cursor-pointer"
                        onClick={() => {
                          if (iss.bundle) {
                            const { dossier } = convertRawBundleToDossier(iss.bundle, {
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
                          } else {
                            window.open(iss.htmlUrl, "_blank", "noopener,noreferrer");
                          }
                        }}
                      >
                        <TableCell className="font-medium">{iss.targetRepo}</TableCell>
                        <TableCell>
                          {iss.tier ? (
                            <StatusBadge tier={iss.tier} lang={lang} size="sm" />
                          ) : (
                            <Badge variant="outline" size="sm">
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {iss.auditorTool ?? `@${iss.author}`}
                        </TableCell>
                        <TableCell
                          className="text-right font-mono text-xs text-muted-foreground"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <a
                            href={iss.htmlUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 hover:text-foreground"
                          >
                            #{iss.number}
                            <ArrowUpRightIcon className="size-3" />
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Frame>
          </section>
        )}

        {/* VIEW 3: RULES & AGENT PROTOCOL */}
        {view === "rules" && (
          <section className="mt-6 space-y-6">
            <Frame>
              <div className="grid gap-1 md:grid-cols-3">
                <FramePanel className="space-y-3">
                  <StatusBadge tier="blacklist" lang={lang} />
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    <li>{lang === "zh" ? "跨工具静默读凭证" : "Cross-tool credential reads"}</li>
                    <li>{lang === "zh" ? "源码与隐私声明矛盾" : "Docs contradict runtime code"}</li>
                    <li>{lang === "zh" ? "强制遥测无法关闭" : "Forced telemetry"}</li>
                    <li>{lang === "zh" ? "高危或严重安全红旗" : "High or critical security flaw"}</li>
                  </ul>
                </FramePanel>

                <FramePanel className="space-y-3">
                  <StatusBadge tier="watchlist" lang={lang} />
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    <li>{lang === "zh" ? "默认开启遥测" : "Default-on opt-out telemetry"}</li>
                    <li>{lang === "zh" ? "关闭开关隐蔽或难找" : "Hidden opt-out controls"}</li>
                    <li>{lang === "zh" ? "文档披露不完整" : "Incomplete doc disclosure"}</li>
                    <li>{lang === "zh" ? "中等风险默认配置" : "Medium risk defaults"}</li>
                  </ul>
                </FramePanel>

                <FramePanel className="space-y-3">
                  <StatusBadge tier="cleared" lang={lang} />
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    <li>{lang === "zh" ? "零遥测或严格 Opt-in" : "Zero telemetry or strict opt-in"}</li>
                    <li>{lang === "zh" ? "无跨工具敏感读取" : "No cross-tool snooping"}</li>
                    <li>{lang === "zh" ? "源码与文档一致" : "Docs match runtime code"}</li>
                    <li>{lang === "zh" ? "风险等级 Clean / Low" : "Clean or low risk"}</li>
                  </ul>
                </FramePanel>
              </div>
            </Frame>

            {/* Agent-Readable Static Endpoints (AX) */}
            <Frame>
              <FramePanel className="divide-y p-0">
                {[
                  { label: "llms.txt", href: "./llms.txt", meta: "Agent index" },
                  { label: "registry.json", href: "./registry.json", meta: "JSON API" },
                  {
                    label: "schema/case-bundle.v1.json",
                    href: "./schema/case-bundle.v1.json",
                    meta: "JSON Schema",
                  },
                  {
                    label: "github.com/edison-land/oss-bureau/tree/main/cases",
                    href: `https://github.com/${REPO_SLUG}/tree/main/cases`,
                    meta: "PR registry",
                  },
                ].map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm transition-colors hover:bg-accent/50"
                  >
                    <span className="truncate font-mono text-foreground">{item.label}</span>
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                      {item.meta}
                      <ArrowUpRightIcon className="size-3.5" />
                    </span>
                  </a>
                ))}
              </FramePanel>
            </Frame>

            {/* Universal Skill Contract */}
            <Frame>
              <FramePanel className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">
                    Universal Skill Contract
                  </span>
                  <Button size="xs" variant="outline" onClick={copyContract}>
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
                <pre className="max-h-72 overflow-auto rounded-lg border bg-sidebar p-4 font-mono text-xs text-foreground">
                  <code>{UNIVERSAL_SKILL_CONTRACT}</code>
                </pre>
              </FramePanel>
            </Frame>
          </section>
        )}
      </main>

      <footer className="border-t bg-sidebar">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-5 font-mono text-xs text-muted-foreground sm:px-6">
          <a
            href={`https://github.com/${REPO_SLUG}`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
          >
            {REPO_SLUG}
          </a>
          <div className="flex items-center gap-4">
            <a href="./llms.txt" className="hover:text-foreground">
              llms.txt
            </a>
            <a href="./registry.json" className="hover:text-foreground">
              registry.json
            </a>
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
