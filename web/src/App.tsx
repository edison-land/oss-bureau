import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  Eye,
  FileWarning,
  GitPullRequest,
  Github,
  Globe,
  MessageSquare,
  RefreshCw,
  Scale,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Terminal,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Upload,
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

export default function App() {
  const [lang, setLang] = useState<Lang>("zh");
  const [view, setView] = useState<MainView>("board");
  const [profile, setProfile] = useState<SeverityProfile>("standard");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [sort, setSort] = useState<SortMode>("risk");
  const [query, setQuery] = useState("");
  const [selectedDossier, setSelectedDossier] = useState<CaseDossier | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedContract, setCopiedContract] = useState(false);

  // User-pinned local sandbox cases (persisted in localStorage)
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

  // Community Pending Issues (synced at build time + live GitHub API refresh)
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
        if (!res.ok) {
          throw new Error(`GitHub API HTTP ${res.status}`);
        }
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
          : `Live GitHub API refresh unavailable (${err instanceof Error ? err.message : "network error"}); showing synced snapshot.`,
      );
    } finally {
      setRefreshingIssues(false);
    }
  };

  return (
    <div className="min-h-dvh text-zinc-100">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-[#080a0e]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/10 text-red-400">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono-code text-sm font-bold tracking-wider text-white">
                  OSS BUREAU
                </span>
                <span className="hidden rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono-code text-[10px] text-zinc-400 sm:inline">
                  {lang === "zh" ? "开源调查局" : "PUBLIC CASE BOARD"}
                </span>
              </div>
              <div className="font-mono-code text-[10px] text-zinc-500">
                {lang === "zh"
                  ? `${CASES.length} 份仓库归档案宗 · ${(stats.totalStars / 10000).toFixed(0)}万+ Stars 已审 · GitHub 公开联动`
                  : `${CASES.length} Archived Dossiers · ${(stats.totalStars / 1000).toFixed(0)}k+ Stars · GitHub-Backed`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLang(lang === "zh" ? "en" : "zh")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/90 px-2.5 py-1.5 font-mono-code text-xs text-zinc-300 transition hover:border-zinc-600 hover:text-white"
            >
              <Globe className="h-3.5 w-3.5" />
              {lang === "zh" ? "EN" : "中文"}
            </button>
            <a
              href={`https://github.com/${REPO_SLUG}`}
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/90 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-white sm:inline-flex"
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </a>
            <button
              type="button"
              onClick={() => setSubmitOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-red-900/50 transition hover:bg-red-500"
            >
              <Upload className="h-3.5 w-3.5" />
              {lang === "zh" ? "提交证据 / 测红黑榜" : "Submit / Classify"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Hero */}
        <section className="rounded-2xl border border-zinc-800/90 bg-[#0c1017]/90 p-6 shadow-xl shadow-black/40 sm:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-500/35 bg-red-500/10 px-3 py-1 font-mono-code text-[11px] font-semibold text-red-300">
                <FileWarning className="h-3.5 w-3.5" />
                {lang === "zh"
                  ? "开源界佛伯乐 // 所有证据固定在公开 GitHub Issue & PR"
                  : "OPEN GITHUB-BACKED AUDIT BOARD // ISSUES + PR ARCHIVE"}
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
                {lang === "zh"
                  ? "别信官网的“零遥测”，直接看源码实锤。"
                  : "Don't trust \"zero telemetry\" claims. Verify the code."}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
                {lang === "zh"
                  ? "面向开源 AI 工具与 CLI 的公开红黑榜。支持用 oss-audit 或你自己的 Skill 产出 case-bundle.json，证据全部固定在公开 GitHub Issue，由 Actions 自动验真 Commit 与源码路径、按公开规则评定红/灰/黑，合并 PR 即自动上榜。"
                  : "Public Red/Watch/Blacklist for open-source AI tools & CLIs. Run oss-audit or bring your own Skill to emit case-bundle.json — evidence lives permanently in public GitHub Issues, auto-verified by Actions and archived via PR."}
              </p>

              {/* Install Skill Command Bar */}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2.5 rounded-lg border border-zinc-700/90 bg-[#07090d] px-3.5 py-2 font-mono-code text-xs text-emerald-300">
                  <Terminal className="h-3.5 w-3.5 text-zinc-500" />
                  <code>{INSTALL_CMD}</code>
                  <button
                    type="button"
                    onClick={copyInstallCmd}
                    className="ml-1 rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                  >
                    {copiedCmd ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <Check className="h-3 w-3" /> {lang === "zh" ? "已复制" : "Copied"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Copy className="h-3 w-3" /> {lang === "zh" ? "复制装 Skill" : "Copy"}
                      </span>
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmitOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900/90 px-3.5 py-2 text-xs font-semibold text-zinc-200 transition hover:border-red-500/60 hover:text-white"
                >
                  <Upload className="h-3.5 w-3.5 text-red-400" />
                  {lang === "zh" ? "拖入 JSON 定级 / 发 Issue" : "Drop JSON / Submit Issue"}
                </button>
              </div>
            </div>

            {/* Summary KPI Cards */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 lg:w-80">
              <button
                type="button"
                onClick={() => {
                  setView("board");
                  setFilter(filter === "blacklist" ? "all" : "blacklist");
                }}
                className={`rounded-xl border p-3.5 text-left transition ${
                  view === "board" && filter === "blacklist"
                    ? "border-red-500 bg-red-500/15"
                    : "border-red-500/30 bg-red-950/20 hover:border-red-500/60"
                }`}
              >
                <div className="font-mono-code text-[11px] font-semibold text-red-300">
                  {lang === "zh" ? "🔴 黑榜" : "BLACKLIST"}
                </div>
                <div className="mt-1 font-mono-code text-2xl font-bold text-white">
                  {stats.blacklist}
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setView("board");
                  setFilter(filter === "watchlist" ? "all" : "watchlist");
                }}
                className={`rounded-xl border p-3.5 text-left transition ${
                  view === "board" && filter === "watchlist"
                    ? "border-amber-500 bg-amber-500/15"
                    : "border-amber-500/30 bg-amber-950/20 hover:border-amber-500/60"
                }`}
              >
                <div className="font-mono-code text-[11px] font-semibold text-amber-300">
                  {lang === "zh" ? "🟡 灰榜" : "WATCHLIST"}
                </div>
                <div className="mt-1 font-mono-code text-2xl font-bold text-white">
                  {stats.watchlist}
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setView("board");
                  setFilter(filter === "cleared" ? "all" : "cleared");
                }}
                className={`rounded-xl border p-3.5 text-left transition ${
                  view === "board" && filter === "cleared"
                    ? "border-emerald-500 bg-emerald-500/15"
                    : "border-emerald-500/30 bg-emerald-950/20 hover:border-emerald-500/60"
                }`}
              >
                <div className="font-mono-code text-[11px] font-semibold text-emerald-300">
                  {lang === "zh" ? "🟢 红榜" : "CLEARED"}
                </div>
                <div className="mt-1 font-mono-code text-2xl font-bold text-white">
                  {stats.cleared}
                </div>
              </button>
            </div>
          </div>
        </section>

        {/* Primary View Switcher */}
        <section className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setView("board")}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                view === "board"
                  ? "bg-zinc-100 text-zinc-950"
                  : "border border-zinc-800 bg-[#0d1118] text-zinc-300 hover:border-zinc-600 hover:text-white"
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              {lang === "zh"
                ? `正式红黑榜 (${stats.total})`
                : `Verified Board (${stats.total})`}
            </button>
            <button
              type="button"
              onClick={() => setView("hearings")}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                view === "hearings"
                  ? "bg-zinc-100 text-zinc-950"
                  : "border border-zinc-800 bg-[#0d1118] text-zinc-300 hover:border-zinc-600 hover:text-white"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {lang === "zh"
                ? `社区听证池 · Issues (${communityIssues.length})`
                : `Community Hearings · Issues (${communityIssues.length})`}
            </button>
            <button
              type="button"
              onClick={() => setView("rules")}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                view === "rules"
                  ? "bg-zinc-100 text-zinc-950"
                  : "border border-zinc-800 bg-[#0d1118] text-zinc-300 hover:border-zinc-600 hover:text-white"
              }`}
            >
              <Scale className="h-3.5 w-3.5" />
              {lang === "zh" ? "判定规则 & 第三方 Skill 接入" : "Tier Rules & Open Protocol"}
            </button>
          </div>

          {view === "board" && (
            <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-[#0b0f16] p-1 font-mono-code text-[11px]">
              <span className="px-2 text-zinc-500">
                {lang === "zh" ? "判定标尺:" : "Profile:"}
              </span>
              <button
                type="button"
                onClick={() => setProfile("standard")}
                className={`rounded px-2.5 py-1 transition ${
                  profile === "standard"
                    ? "bg-zinc-200 font-semibold text-zinc-950"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {lang === "zh" ? "标准" : "Standard"}
              </button>
              <button
                type="button"
                onClick={() => setProfile("strict")}
                title={
                  lang === "zh"
                    ? "任何默认开启的遥测或不认 DO_NOT_TRACK 均划入黑榜"
                    : "Treats any default-on opt-out telemetry or DNT refusal as blacklist"
                }
                className={`rounded px-2.5 py-1 transition ${
                  profile === "strict"
                    ? "bg-red-500/85 font-semibold text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {lang === "zh" ? "隐私洁癖" : "Strict Purist"}
              </button>
            </div>
          )}
        </section>

        {/* VIEW 1: VERIFIED BOARD */}
        {view === "board" && (
          <>
            {/* Filter & Search Bar */}
            <section className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    ["all", lang === "zh" ? `全部 (${stats.total})` : `All (${stats.total})`],
                    [
                      "blacklist",
                      lang === "zh"
                        ? `🔴 黑榜 (${stats.blacklist})`
                        : `Blacklist (${stats.blacklist})`,
                    ],
                    [
                      "watchlist",
                      lang === "zh"
                        ? `🟡 灰榜 (${stats.watchlist})`
                        : `Watchlist (${stats.watchlist})`,
                    ],
                    [
                      "cleared",
                      lang === "zh" ? `🟢 红榜 (${stats.cleared})` : `Cleared (${stats.cleared})`,
                    ],
                    ["cross_tool", lang === "zh" ? "跨工具窥探" : "Cross-Tool"],
                    ["no_dnt", lang === "zh" ? "不认 DO_NOT_TRACK" : "Ignores DNT"],
                    ...(stats.community > 0
                      ? ([
                          [
                            "community",
                            lang === "zh"
                              ? `社区/本地 (${stats.community})`
                              : `Community/Local (${stats.community})`,
                          ],
                        ] as const)
                      : []),
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFilter(id)}
                    className={`rounded-lg border px-3 py-1.5 font-mono-code text-xs font-medium transition ${
                      filter === id
                        ? "border-zinc-400 bg-zinc-100 text-zinc-950"
                        : "border-zinc-800 bg-[#0d1118] text-zinc-400 hover:border-zinc-600 hover:text-zinc-100"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-56">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={
                      lang === "zh" ? "搜项目 / 案宗号 / Skill..." : "Search repo / case / skill..."
                    }
                    className="w-full rounded-lg border border-zinc-800 bg-[#0d1118] py-1.5 pl-8 pr-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
                  />
                </div>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortMode)}
                  aria-label={lang === "zh" ? "排序方式" : "Sort order"}
                  className="rounded-lg border border-zinc-800 bg-[#0d1118] px-2.5 py-1.5 font-mono-code text-xs text-zinc-300 focus:border-zinc-500 focus:outline-none"
                >
                  <option value="risk">{lang === "zh" ? "按风险排序" : "Sort: Risk"}</option>
                  <option value="stars">{lang === "zh" ? "按 Stars 排序" : "Sort: Stars"}</option>
                  <option value="caseId">{lang === "zh" ? "按案宗号" : "Sort: Case ID"}</option>
                </select>
              </div>
            </section>

            {/* Case Board Grid */}
            <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredCases.map((c) => {
                const isBlack = c.tier === "blacklist";
                const isWatch = c.tier === "watchlist";
                const cardBorder = isBlack
                  ? "border-red-500/35 hover:border-red-400/70"
                  : isWatch
                    ? "border-amber-500/25 hover:border-amber-400/60"
                    : "border-emerald-500/20 hover:border-emerald-400/50";
                const badgeClass = isBlack
                  ? "border-red-500/60 bg-red-500/15 text-red-300"
                  : isWatch
                    ? "border-amber-500/60 bg-amber-500/15 text-amber-300"
                    : "border-emerald-500/60 bg-emerald-500/15 text-emerald-300";
                const TierIcon = isBlack ? ShieldAlert : isWatch ? ShieldQuestion : ShieldCheck;
                const tierLabel = isBlack
                  ? lang === "zh"
                    ? "黑榜"
                    : "BLACKLIST"
                  : isWatch
                    ? lang === "zh"
                      ? "灰榜"
                      : "WATCHLIST"
                    : lang === "zh"
                      ? "红榜"
                      : "CLEARED";

                return (
                  <article
                    key={c.caseId}
                    className={`group flex flex-col justify-between rounded-xl border ${cardBorder} bg-[#0d1118]/95 p-5 transition`}
                  >
                    <div>
                      {/* Card Top Meta */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono-code text-[11px] font-semibold text-zinc-500">
                          {c.caseId} · {c.commitHash}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {c.sourceType === "local" && (
                            <span className="rounded border border-purple-500/50 bg-purple-500/15 px-1.5 py-0.5 font-mono-code text-[10px] text-purple-300">
                              LOCAL
                            </span>
                          )}
                          {c.sourceType === "community" && (
                            <span className="rounded border border-indigo-500/50 bg-indigo-500/15 px-1.5 py-0.5 font-mono-code text-[10px] text-indigo-300">
                              PR
                            </span>
                          )}
                          {c.status === "PARTIALLY_PATCHED" && (
                            <span className="rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 font-mono-code text-[10px] text-sky-300">
                              {lang === "zh" ? "部分整改" : "PATCHED"}
                            </span>
                          )}
                          <span
                            className={`stamp-badge inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold ${badgeClass}`}
                          >
                            <TierIcon className="h-3 w-3" />
                            {tierLabel}
                          </span>
                        </div>
                      </div>

                      {/* Repo Title */}
                      <div className="mt-3 flex items-baseline justify-between gap-2">
                        <h2 className="truncate text-base font-bold text-white group-hover:text-zinc-100">
                          {c.name}
                        </h2>
                        {c.stars && (
                          <span className="shrink-0 font-mono-code text-xs text-zinc-400">
                            ★ {(c.stars / 1000).toFixed(1)}k
                          </span>
                        )}
                      </div>

                      {/* Compact Signals */}
                      <div className="mt-3 flex flex-wrap gap-1.5 font-mono-code text-[11px]">
                        <span className="rounded border border-zinc-800 bg-[#090c12] px-2 py-0.5 text-zinc-300">
                          TEL: {c.defaultTelemetry}
                        </span>
                        <span
                          className={`rounded border px-2 py-0.5 ${
                            c.doNotTrack === "NO"
                              ? "border-red-500/30 bg-red-950/30 text-red-300"
                              : "border-zinc-800 bg-[#090c12] text-zinc-400"
                          }`}
                        >
                          DNT: {c.doNotTrack}
                        </span>
                        {c.crossToolAccess && (
                          <span className="rounded border border-red-500/40 bg-red-500/15 px-2 py-0.5 font-semibold text-red-300">
                            {lang === "zh" ? "跨工具取证" : "CROSS-TOOL"}
                          </span>
                        )}
                      </div>

                      {/* Summary */}
                      <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-zinc-300">
                        {c.oneLiner[lang]}
                      </p>

                      {/* Provenance line */}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-mono-code text-[10px] text-zinc-500">
                        <span className="inline-flex items-center gap-1 truncate">
                          <Cpu className="h-3 w-3 shrink-0" />
                          {c.auditorTool || "oss-audit v1.0.0"}
                        </span>
                        {c.evidenceIssueUrl && (
                          <a
                            href={c.evidenceIssueUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
                          >
                            Issue #{c.evidenceIssueNumber}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-zinc-800/80 pt-3.5">
                      <button
                        type="button"
                        onClick={() => setSelectedDossier(c)}
                        className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-white"
                      >
                        {lang === "zh" ? "查看完整卷宗" : "Open Dossier"}
                      </button>
                      <div className="flex items-center gap-1.5">
                        {c.sourceType === "local" && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLocalCase(c.caseId)}
                            title={lang === "zh" ? "移除本机沙盒条目" : "Remove local sandbox entry"}
                            className="rounded-lg border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-400 transition hover:border-red-500/50 hover:text-red-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => exportCaseCardPng(c, lang)}
                          title={lang === "zh" ? "导出 PNG 证据图" : "Export PNG Evidence Card"}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 font-mono-code text-[11px] text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                        >
                          <Download className="h-3.5 w-3.5" />
                          PNG
                        </button>
                        <a
                          href={c.repoUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open ${c.name} on GitHub`}
                          className="rounded-lg border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-400 transition hover:border-zinc-600 hover:text-white"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            {filteredCases.length === 0 && (
              <div className="mt-8 rounded-xl border border-zinc-800 bg-[#0d1118] p-10 text-center text-sm text-zinc-400">
                {lang === "zh" ? "没有匹配的案宗记录。" : "No matching dossiers found."}
              </div>
            )}
          </>
        )}

        {/* VIEW 2: COMMUNITY HEARINGS (GITHUB ISSUES SYNC) */}
        {view === "hearings" && (
          <section className="mt-6 space-y-4">
            <div className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-800 bg-[#0d1118] p-5 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-base font-bold text-white">
                  {lang === "zh"
                    ? "社区公开听证池（直接联动 GitHub Issues）"
                    : "Public Community Hearings (Synced with GitHub Issues)"}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  {lang === "zh"
                    ? "所有社区通过 oss-audit 或自建 Skill 提交的待复核案宗都公开固定在 GitHub Issue 里。你可以点进对应 Issue 参与复核、投票（👍/👎）或提交反证；维护者贴上 approved 标签后，Bot 自动开 PR 归档进正式红黑榜。"
                    : "Pending submissions from oss-audit and custom Skills live permanently in public GitHub Issues. Review code evidence, vote (👍/👎), or post counter-evidence on GitHub. Labeling an Issue `approved` triggers an automated archive PR."}
                </p>
                <div className="mt-2 font-mono-code text-[11px] text-zinc-500">
                  {lang === "zh" ? "最近同步" : "Last synced"}: {issuesSyncedAt.slice(0, 19).replace("T", " ")} UTC
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void refreshLiveGitHubIssues()}
                  disabled={refreshingIssues}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-white disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshingIssues ? "animate-spin" : ""}`} />
                  {lang === "zh" ? "实时拉取 GitHub Issues" : "Refresh Live Issues"}
                </button>
                <a
                  href={`https://github.com/${REPO_SLUG}/issues/new?template=case-submission.yml`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-red-500"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {lang === "zh" ? "发起新案宗 Issue" : "Submit New Case Issue"}
                </a>
              </div>
            </div>

            {refreshError && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-950/25 px-4 py-2.5 text-xs text-amber-200">
                {refreshError}
              </div>
            )}

            {communityIssues.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 bg-[#0b0f17] p-10 text-center">
                <MessageSquare className="mx-auto mb-3 h-7 w-7 text-zinc-500" />
                <div className="text-sm font-semibold text-zinc-200">
                  {lang === "zh"
                    ? "当前暂无待审的社区听证 Issue"
                    : "No open case-submission Issues yet"}
                </div>
                <p className="mx-auto mt-1.5 max-w-lg text-xs text-zinc-400">
                  {lang === "zh"
                    ? "你可以成为第一个提交者：用 oss-audit 或你自己的 Skill 审计任意开源项目，把 case-bundle.json 提交到 GitHub Issue，Bot 会自动验真并立即出现在这里。"
                    : "Be the first contributor: audit any open-source repo with oss-audit or your own Skill, submit its case-bundle.json via Issue, and our Bot will verify and publish it here."}
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSubmitOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-red-500"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {lang === "zh" ? "拖入 JSON 提交首份社区案宗" : "Submit First Community Case"}
                  </button>
                  <a
                    href={`https://github.com/${REPO_SLUG}/issues?q=is%3Aissue+label%3Acase-submission`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white"
                  >
                    {lang === "zh" ? "查看 GitHub Issues" : "View on GitHub"}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {communityIssues.map((iss) => {
                  const tierCls =
                    iss.tier === "blacklist"
                      ? "border-red-500/60 bg-red-500/15 text-red-300"
                      : iss.tier === "watchlist"
                        ? "border-amber-500/60 bg-amber-500/15 text-amber-300"
                        : iss.tier === "cleared"
                          ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                          : "border-zinc-700 bg-zinc-800/80 text-zinc-300";

                  const tierText =
                    iss.tier === "blacklist"
                      ? lang === "zh"
                        ? "🔴 拟定黑榜"
                        : "BLACKLIST"
                      : iss.tier === "watchlist"
                        ? lang === "zh"
                          ? "🟡 拟定灰榜"
                          : "WATCHLIST"
                        : iss.tier === "cleared"
                          ? lang === "zh"
                            ? "🟢 拟定红榜"
                            : "CLEARED"
                          : lang === "zh"
                            ? "待定级"
                            : "PENDING";

                  return (
                    <article
                      key={iss.number}
                      className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-[#0d1118] p-5 transition hover:border-zinc-600"
                    >
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono-code text-xs text-zinc-500">
                            Issue #{iss.number} · @{iss.author}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {iss.evidenceStatus === "verified" && (
                              <span className="rounded border border-sky-500/50 bg-sky-500/15 px-1.5 py-0.5 font-mono-code text-[10px] text-sky-300">
                                BOT VERIFIED
                              </span>
                            )}
                            {iss.evidenceStatus === "needs_fix" && (
                              <span className="rounded border border-red-500/40 bg-red-950/40 px-1.5 py-0.5 font-mono-code text-[10px] text-red-300">
                                NEEDS FIX
                              </span>
                            )}
                            <span
                              className={`rounded border px-2 py-0.5 font-mono-code text-[11px] font-bold ${tierCls}`}
                            >
                              {tierText}
                            </span>
                          </div>
                        </div>

                        <h3 className="mt-2.5 text-base font-bold text-white">{iss.targetRepo}</h3>
                        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-zinc-300">
                          {iss.summary}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-3 font-mono-code text-[11px] text-zinc-400">
                          {iss.auditorTool && (
                            <span className="inline-flex items-center gap-1">
                              <Cpu className="h-3 w-3 text-zinc-500" />
                              {iss.auditorTool}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <ThumbsUp className="h-3 w-3 text-emerald-400" />
                            {iss.thumbsUp}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <ThumbsDown className="h-3 w-3 text-red-400" />
                            {iss.thumbsDown}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MessageSquare className="h-3 w-3 text-zinc-500" />
                            {iss.comments}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/80 pt-3.5">
                        {iss.bundle ? (
                          <button
                            type="button"
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
                            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-white"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {lang === "zh" ? "预览案宗证据" : "Preview Dossier"}
                          </button>
                        ) : (
                          <span className="font-mono-code text-[11px] text-zinc-500">
                            {lang === "zh" ? "纯文本线索（无 JSON 附件）" : "Manual text tip"}
                          </span>
                        )}
                        <a
                          href={iss.htmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                        >
                          {lang === "zh" ? "去 Issue 复核 / 投票" : "Review / Vote on GitHub"}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* VIEW 3: PUBLIC RULES & OPEN SKILL PROTOCOL */}
        {view === "rules" && (
          <section className="mt-6 space-y-5">
            {/* Public Tier Rules Matrix */}
            <div className="rounded-xl border border-zinc-800 bg-[#0d1118] p-6">
              <h2 className="text-base font-bold text-white">
                {lang === "zh"
                  ? "公开红 / 灰 / 黑三榜判定规则（代码同源，拒绝黑箱）"
                  : "Public Red / Watch / Blacklist Tier Rules (Open & Deterministic)"}
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                {lang === "zh"
                  ? "无论是官方 oss-audit 还是社区自建 Skill，都只负责产出客观源码证据 JSON；最终红/灰/黑分级由仓库内完全公开的 scripts/bureau_bot.py 与前端 bundleParser.ts 同一套规则自动计算。"
                  : "Both oss-audit and third-party Skills produce objective code-fact JSON; final tiers are computed deterministically by the same open rule engine in `scripts/bureau_bot.py` and `web/src/utils/bundleParser.ts`."}
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-red-500/35 bg-red-950/15 p-4">
                  <div className="font-mono-code text-xs font-bold text-red-300">
                    {lang === "zh" ? "🔴 黑榜 // BLACKLIST" : "🔴 BLACKLIST"}
                  </div>
                  <ul className="mt-2.5 list-disc space-y-1.5 pl-4 text-xs text-zinc-300">
                    <li>
                      {lang === "zh"
                        ? "跨工具静默读取其他工具凭证/配置 (cross_tool_access = true)"
                        : "Silent cross-tool credential/config snooping (cross_tool_access = true)"}
                    </li>
                    <li>
                      {lang === "zh"
                        ? "源码与公开“零遥测”文档直接矛盾 (DIRECT_CONTRADICTION)"
                        : "Direct contradiction with explicit privacy docs (DIRECT_CONTRADICTION)"}
                    </li>
                    <li>
                      {lang === "zh"
                        ? "强制遥测且无内置关闭机制 (FORCED)"
                        : "Forced telemetry with no built-in disable switch (FORCED)"}
                    </li>
                    <li>
                      {lang === "zh"
                        ? "经源码核实的高危/严重隐私或供应链红旗 (HIGH / CRITICAL)"
                        : "Verified HIGH or CRITICAL privacy/supply-chain finding"}
                    </li>
                  </ul>
                </div>

                <div className="rounded-xl border border-amber-500/35 bg-amber-950/15 p-4">
                  <div className="font-mono-code text-xs font-bold text-amber-300">
                    {lang === "zh" ? "🟡 灰榜 // WATCHLIST" : "🟡 WATCHLIST"}
                  </div>
                  <ul className="mt-2.5 list-disc space-y-1.5 pl-4 text-xs text-zinc-300">
                    <li>
                      {lang === "zh"
                        ? "默认开启遥测且关闭门槛高或隐藏开关 (OPT_OUT_HARD)"
                        : "Default-on telemetry with high opt-out friction (OPT_OUT_HARD)"}
                    </li>
                    <li>
                      {lang === "zh"
                        ? "默认开启遥测，但坦白披露且可关闭 (OPT_OUT_EASY)"
                        : "Disclosed default-on opt-out telemetry (OPT_OUT_EASY)"}
                    </li>
                    <li>
                      {lang === "zh"
                        ? "文档对遥测范围轻描淡写 (PARTIAL_MISMATCH)"
                        : "Documentation omits material telemetry details (PARTIAL_MISMATCH)"}
                    </li>
                    <li>
                      {lang === "zh"
                        ? "中等风险默认配置 (MEDIUM)"
                        : "Moderate telemetry or security concerns (MEDIUM)"}
                    </li>
                  </ul>
                </div>

                <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/15 p-4">
                  <div className="font-mono-code text-xs font-bold text-emerald-300">
                    {lang === "zh" ? "🟢 红榜 // CLEARED" : "🟢 CLEARED"}
                  </div>
                  <ul className="mt-2.5 list-disc space-y-1.5 pl-4 text-xs text-zinc-300">
                    <li>
                      {lang === "zh"
                        ? "零活跃遥测 (NONE) 或严格默认关闭 (OPT_IN)"
                        : "Zero active telemetry (NONE) or strictly opt-in (OPT_IN)"}
                    </li>
                    <li>
                      {lang === "zh"
                        ? "无未披露的跨工具敏感目录读取"
                        : "No undisclosed cross-tool credential access"}
                    </li>
                    <li>
                      {lang === "zh"
                        ? "公开承诺与运行时代码完全一致"
                        : "Public docs match actual runtime code"}
                    </li>
                    <li>
                      {lang === "zh"
                        ? "风险等级为 CLEAN 或 LOW"
                        : "Risk level CLEAN or LOW"}
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* GitHub Issue -> Actions -> PR Pipeline */}
            <div className="rounded-xl border border-zinc-800 bg-[#0d1118] p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-bold text-white">
                  {lang === "zh"
                    ? "GitHub 全公开联动闭环（Issue 固证 → Bot 验真 → PR 归档）"
                    : "GitHub-Native Pipeline (Issue Evidence → Bot Verification → PR Archive)"}
                </h2>
                <div className="flex gap-2">
                  <a
                    href={`https://github.com/${REPO_SLUG}/issues/new?template=case-submission.yml`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
                  >
                    {lang === "zh" ? "提交案宗 Issue" : "Open Case Issue"}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <a
                    href={`https://github.com/${REPO_SLUG}/tree/main/cases`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-zinc-500"
                  >
                    <GitPullRequest className="h-3.5 w-3.5" />
                    cases/
                  </a>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                {[
                  {
                    step: "01",
                    title: lang === "zh" ? "Skill 产出证据" : "Emit Case Bundle",
                    desc:
                      lang === "zh"
                        ? "使用 oss-audit 或你自己的 Skill 审计仓库，产出 case-bundle.v1.json。"
                        : "Run oss-audit or any custom Skill to emit case-bundle.v1.json.",
                  },
                  {
                    step: "02",
                    title: lang === "zh" ? "固定到公开 Issue" : "Pin in GitHub Issue",
                    desc:
                      lang === "zh"
                        ? "通过表单或网页提交到 GitHub Issue，带永久时间戳与 Skill 署名。"
                        : "Submit via Issue Form for permanent public timestamp & Skill attribution.",
                  },
                  {
                    step: "03",
                    title: lang === "zh" ? "Actions 自动验真" : "Automated Bot Check",
                    desc:
                      lang === "zh"
                        ? "Bot 校验 Schema、远端核实目标 Commit 与源码路径存在性，并自动打红/灰/黑标签。"
                        : "Bot validates schema, checks target repo commit & file paths, and labels tier.",
                  },
                  {
                    step: "04",
                    title: lang === "zh" ? "审批自动开 PR 上榜" : "Auto PR → Live Board",
                    desc:
                      lang === "zh"
                        ? "社区/维护者复核后加 approved 标签，Bot 自动开 PR 归档进 cases/，Merge 即上线。"
                        : "Adding `approved` triggers an archive PR into `cases/`; merging deploys live.",
                  },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="rounded-lg border border-zinc-800/90 bg-[#080b10] p-3.5"
                  >
                    <div className="font-mono-code text-xs font-bold text-red-400">
                      STEP {item.step}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">{item.title}</div>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-400">{item.desc}</p>
                  </div>
                ))}
              </div>

              {/* Universal Contract Copy Block */}
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-mono-code text-xs font-semibold text-zinc-300">
                    {lang === "zh"
                      ? "给第三方 / 自建 Skill 的通用输出契约（Universal Output Contract）"
                      : "Universal Output Contract for Custom Skills"}
                  </span>
                  <button
                    type="button"
                    onClick={copyUniversalContract}
                    className="inline-flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 font-mono-code text-xs text-zinc-200 hover:border-zinc-500 hover:text-white"
                  >
                    {copiedContract ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        {lang === "zh" ? "已复制" : "Copied"}
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        {lang === "zh" ? "复制契约" : "Copy Contract"}
                      </>
                    )}
                  </button>
                </div>
                <pre className="max-h-64 overflow-auto rounded-lg border border-zinc-800 bg-[#07090d] p-3.5 font-mono-code text-[11px] text-zinc-300">
                  <code>{UNIVERSAL_SKILL_CONTRACT}</code>
                </pre>
              </div>
            </div>
          </section>
        )}

        {/* Fair-Play Footer */}
        <footer className="mt-12 border-t border-zinc-800/80 pt-6 text-xs leading-relaxed text-zinc-500">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <p className="max-w-2xl">
              {lang === "zh"
                ? "公平与事实声明：OSS Bureau 仅收录基于公开源码、精确 Commit Hash 与可复现文档的客观静态审计。所有证据公开存放在 GitHub Issue 与 cases/ 目录；若项目维护者已在后续版本修复，请通过整改申诉 Issue 提交修复 Commit 更新状态。"
                : "Fair-Play Notice: OSS Bureau publishes factual audits backed by public source code, exact commit hashes, and verifiable docs. All evidence lives publicly in GitHub Issues and `cases/`. Maintainers can submit fix commits via Remediation Appeal to update status."}
            </p>
            <div className="flex shrink-0 items-center gap-3 font-mono-code">
              <a
                href={`https://github.com/${REPO_SLUG}`}
                target="_blank"
                rel="noreferrer"
                className="text-zinc-400 hover:text-white"
              >
                {REPO_SLUG}
              </a>
              <span>·</span>
              <span>MIT License</span>
            </div>
          </div>
        </footer>
      </main>

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
