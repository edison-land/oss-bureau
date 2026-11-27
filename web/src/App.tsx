import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileWarning,
  Github,
  Globe,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Terminal,
  Upload,
} from "lucide-react";
import { CASES } from "./data/cases";
import type { CaseDossier, Lang, Tier } from "./types";
import { DossierDialog } from "./components/DossierDialog";
import { SubmitTipDialog } from "./components/SubmitTipDialog";
import { exportCaseCardPng } from "./utils/exportCard";

type FilterMode = "all" | Tier | "cross_tool" | "no_dnt";
type SortMode = "risk" | "stars" | "caseId";

const INSTALL_CMD = "npx skills add edison-land/oss-bureau";

const TIER_ORDER: Record<Tier, number> = {
  blacklist: 0,
  watchlist: 1,
  cleared: 2,
};

export default function App() {
  const [lang, setLang] = useState<Lang>("zh");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [sort, setSort] = useState<SortMode>("risk");
  const [query, setQuery] = useState("");
  const [selectedDossier, setSelectedDossier] = useState<CaseDossier | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const stats = useMemo(() => {
    const totalStars = CASES.reduce((sum, c) => sum + (c.stars ?? 0), 0);
    return {
      total: CASES.length,
      blacklist: CASES.filter((c) => c.tier === "blacklist").length,
      watchlist: CASES.filter((c) => c.tier === "watchlist").length,
      cleared: CASES.filter((c) => c.tier === "cleared").length,
      totalStars,
    };
  }, []);

  const filteredCases = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = CASES.filter((c) => {
      if (filter === "blacklist" || filter === "watchlist" || filter === "cleared") {
        if (c.tier !== filter) return false;
      } else if (filter === "cross_tool") {
        if (!c.crossToolAccess && c.caseId !== "CASE-002") return false;
      } else if (filter === "no_dnt") {
        if (c.doNotTrack !== "NO") return false;
      }
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.caseId.toLowerCase().includes(q) ||
        c.oneLiner.zh.toLowerCase().includes(q) ||
        c.oneLiner.en.toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sort === "stars") return (b.stars ?? 0) - (a.stars ?? 0);
      if (sort === "caseId") return a.caseId.localeCompare(b.caseId);
      const td = TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
      if (td !== 0) return td;
      return a.caseId.localeCompare(b.caseId);
    });
  }, [filter, query, sort]);

  const copyInstallCmd = async () => {
    await navigator.clipboard.writeText(INSTALL_CMD);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 1800);
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
                  ? `${stats.total} 份源码实锤案宗 · ${(stats.totalStars / 10000).toFixed(0)}万+ Stars 已审`
                  : `${stats.total} Verified Dossiers · ${(stats.totalStars / 1000).toFixed(0)}k+ Stars Audited`}
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
              href="https://github.com/edison-land/oss-bureau"
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
              {lang === "zh" ? "提交线报" : "Submit Tip"}
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
                  ? "开源界佛伯乐 // 只看公开源码与 Commit 证据"
                  : "EVIDENCE-FIRST OPEN SOURCE PRIVACY & TELEMETRY WATCH"}
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
                {lang === "zh"
                  ? "别信官网的“零遥测”，直接看源码实锤。"
                  : "Don't trust \"zero telemetry\" claims. Verify the code."}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
                {lang === "zh"
                  ? "面向所有开源 AI 工具与开发 CLI 的公开取证案宗墙。每一份红黑榜档案都由 oss-audit Skill 扫描并逐行核实源码、Commit 与文档承诺——支持拖入 JSON 预览立案、一键导出 X 证据图。"
                  : "Public dossier board for open-source AI coding tools and CLIs. Every record is scanned with the oss-audit Skill and verified line-by-line against source code, commits, and public privacy claims."}
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
                  {lang === "zh" ? "拖入 case-bundle.json 立案" : "Drop case-bundle.json"}
                </button>
              </div>
            </div>

            {/* Summary KPI Cards */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 lg:w-80">
              <button
                type="button"
                onClick={() => setFilter(filter === "blacklist" ? "all" : "blacklist")}
                className={`rounded-xl border p-3.5 text-left transition ${
                  filter === "blacklist"
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
                onClick={() => setFilter(filter === "watchlist" ? "all" : "watchlist")}
                className={`rounded-xl border p-3.5 text-left transition ${
                  filter === "watchlist"
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
                onClick={() => setFilter(filter === "cleared" ? "all" : "cleared")}
                className={`rounded-xl border p-3.5 text-left transition ${
                  filter === "cleared"
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

        {/* Filter & Search Bar */}
        <section className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ["all", lang === "zh" ? `全部 (${stats.total})` : `All (${stats.total})`],
                ["blacklist", lang === "zh" ? `🔴 黑榜 (${stats.blacklist})` : `Blacklist (${stats.blacklist})`],
                ["watchlist", lang === "zh" ? `🟡 灰榜 (${stats.watchlist})` : `Watchlist (${stats.watchlist})`],
                ["cleared", lang === "zh" ? `🟢 红榜 (${stats.cleared})` : `Cleared (${stats.cleared})`],
                ["cross_tool", lang === "zh" ? "跨工具窥探" : "Cross-Tool"],
                ["no_dnt", lang === "zh" ? "不认 DO_NOT_TRACK" : "Ignores DNT"],
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
                placeholder={lang === "zh" ? "搜项目 / 案宗号..." : "Search repo / case..."}
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

        {/* Fair-Play Footer */}
        <footer className="mt-12 border-t border-zinc-800/80 pt-6 text-xs leading-relaxed text-zinc-500">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <p className="max-w-2xl">
              {lang === "zh"
                ? "公平与事实声明：OSS Bureau 仅收录基于公开源码、精确 Commit Hash 与可复现文档的客观静态审计。若项目维护者已在后续版本修复，请通过 GitHub Issue/PR 提交修复 Commit 申请标记「已整改」。"
                : "Fair-Play Notice: OSS Bureau publishes factual audits backed by public source code, exact commit hashes, and verifiable docs. Maintainers who remediate findings can submit the fix commit via GitHub Issue/PR to update status."}
            </p>
            <div className="flex shrink-0 items-center gap-3 font-mono-code">
              <a
                href="https://github.com/edison-land/oss-bureau"
                target="_blank"
                rel="noreferrer"
                className="text-zinc-400 hover:text-white"
              >
                edison-land/oss-bureau
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
        onClose={() => setSelectedDossier(null)}
      />

      <SubmitTipDialog
        open={submitOpen}
        lang={lang}
        onClose={() => setSubmitOpen(false)}
        onPreviewDossier={(d) => setSelectedDossier(d)}
      />
    </div>
  );
}
