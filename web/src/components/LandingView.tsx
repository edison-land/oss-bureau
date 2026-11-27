import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CheckIcon,
  CopyIcon,
  PlusIcon,
} from "lucide-react";
import type { CaseDossier, Lang } from "../types";
import { StatusBadge, formatDnt, formatStars, formatTelemetry } from "./StatusBadge";
import { Button } from "./ui/button";
import { Frame, FramePanel } from "./ui/frame";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

interface LandingViewProps {
  lang: Lang;
  cases: CaseDossier[];
  counts: {
    all: number;
    blacklist: number;
    watchlist: number;
    cleared: number;
  };
  totalStars: number;
  installCmd: string;
  copiedCmd: boolean;
  onCopyInstallCmd: () => void;
  onOpenRegistry: () => void;
  onOpenProtocol: () => void;
  onOpenSubmit: () => void;
  onInspectCase: (dossier: CaseDossier) => void;
}

export function LandingView({
  lang,
  cases,
  counts,
  totalStars,
  installCmd,
  copiedCmd,
  onCopyInstallCmd,
  onOpenRegistry,
  onOpenProtocol,
  onOpenSubmit,
  onInspectCase,
}: LandingViewProps) {
  // Representative live slice: 2 Flagged, 1 Watch, 1 Clean
  const featured = [
    ...cases.filter((c) => c.tier === "blacklist").slice(0, 2),
    ...cases.filter((c) => c.tier === "watchlist").slice(0, 1),
    ...cases.filter((c) => c.tier === "cleared").slice(-2, -1),
  ];

  const starsLabel = `${(totalStars / 1000000).toFixed(1)}M+`;

  return (
    <div className="space-y-16 py-6 sm:space-y-20 sm:py-12">
      {/* Centered Hero */}
      <section className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <button
          type="button"
          onClick={onOpenRegistry}
          className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 font-mono text-xs text-muted-foreground shadow-xs/5 transition-colors hover:text-foreground"
        >
          <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
          <span className="tabular-nums">
            {lang === "zh"
              ? `${counts.all} 个开源项目已核验 · ${starsLabel} Stars`
              : `${counts.all} open-source tools audited · ${starsLabel} stars`}
          </span>
          <ArrowRightIcon className="size-3" />
        </button>

        <h1 className="mt-6 text-balance font-heading font-semibold text-4xl tracking-tight text-foreground sm:text-5xl">
          {lang === "zh" ? "安装之前，先看源码。" : "Verify before you install."}
        </h1>

        <p className="mt-4 max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
          {lang === "zh"
            ? "面向开源 AI 工具与 CLI 的公开隐私遥测名录。每一条定级都锚定精确 Commit、源码行号与公开 GitHub Issue。"
            : "An open, code-verified telemetry & privacy registry for AI coding tools and CLIs. Every verdict cites exact commits, source lines, and public GitHub Issues."}
        </p>

        {/* Primary Centered CTA */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
          <Button size="lg" onClick={onOpenRegistry}>
            {lang === "zh" ? "进入遥测名录" : "Open Registry"}
            <ArrowRightIcon />
          </Button>
          <Button size="lg" variant="outline" onClick={onOpenSubmit}>
            <PlusIcon />
            {lang === "zh" ? "提交证据" : "Submit Evidence"}
          </Button>
        </div>

        {/* One-line Skill Install Bar */}
        <button
          type="button"
          onClick={onCopyInstallCmd}
          className="mt-5 inline-flex h-8 items-center gap-2 rounded-lg border border-input bg-background px-3 font-mono text-xs text-muted-foreground shadow-xs/5 transition-colors hover:text-foreground"
        >
          <span className="text-foreground">{installCmd}</span>
          {copiedCmd ? (
            <CheckIcon className="size-3.5 text-success" />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
        </button>
      </section>

      {/* Live Registry Snapshot Window */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
          <div className="flex items-center gap-4 font-mono tabular-nums text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
              {counts.blacklist} {lang === "zh" ? "黑榜" : "Flagged"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
              {counts.watchlist} {lang === "zh" ? "灰榜" : "Watch"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
              {counts.cleared} {lang === "zh" ? "红榜" : "Clean"}
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenRegistry}
            className="inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {lang === "zh" ? `查看全部 ${counts.all} 份案宗` : `View all ${counts.all} dossiers`}
            <ArrowRightIcon className="size-3.5" />
          </button>
        </div>

        <Frame>
          <Table variant="card">
            <TableHeader>
              <TableRow>
                <TableHead>{lang === "zh" ? "仓库" : "Repository"}</TableHead>
                <TableHead>{lang === "zh" ? "状态" : "Status"}</TableHead>
                <TableHead>{lang === "zh" ? "遥测" : "Telemetry"}</TableHead>
                <TableHead>DNT</TableHead>
                <TableHead className="text-right">Stars</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {featured.map((c) => (
                <TableRow
                  key={c.caseId}
                  onClick={() => onInspectCase(c)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                  <TableCell>
                    <StatusBadge tier={c.tier} lang={lang} />
                  </TableCell>
                  <TableCell className="text-sm text-foreground">
                    {formatTelemetry(c.defaultTelemetry, lang)}
                  </TableCell>
                  <TableCell
                    className={`text-sm ${
                      c.doNotTrack === "NO"
                        ? "text-destructive-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {formatDnt(c.doNotTrack, lang)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                    {formatStars(c.stars)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Frame>
      </section>

      {/* Three Core Pillars */}
      <section>
        <Frame>
          <div className="grid gap-1 md:grid-cols-3">
            <FramePanel className="space-y-2">
              <div className="font-mono text-xs text-muted-foreground">01</div>
              <h2 className="font-semibold text-sm text-foreground">
                {lang === "zh" ? "只看源码，不听宣传" : "Source, not landing pages"}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {lang === "zh"
                  ? "每一条结论都对应公开仓库的精确 Commit 与源码行号，对照官网隐私声明逐项核实。"
                  : "Every verdict cites exact commit SHAs, file paths, and runtime telemetry behavior against public docs."}
              </p>
            </FramePanel>

            <FramePanel className="space-y-2">
              <div className="font-mono text-xs text-muted-foreground">02</div>
              <h2 className="font-semibold text-sm text-foreground">
                {lang === "zh" ? "支持任意 Skill 审计" : "Audit with any Skill"}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {lang === "zh"
                  ? "使用零依赖 oss-audit 扫描仓库或只读体检本机，或用你自己的 Skill 输出标准 JSON 接入。"
                  : "Run zero-dependency oss-audit on repos or your own machine, or bring any custom Skill emitting case-bundle.v1.json."}
              </p>
            </FramePanel>

            <FramePanel className="space-y-2">
              <div className="font-mono text-xs text-muted-foreground">03</div>
              <h2 className="font-semibold text-sm text-foreground">
                {lang === "zh" ? "全量公开于 GitHub" : "Public GitHub record"}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {lang === "zh"
                  ? "证据与截图固定在公开 Issue 与仓库目录，CI 自动验真源码、拦截短链与密钥，合 PR 自动上榜。"
                  : "Evidence and screenshots live in GitHub Issues and PRs. CI verifies source paths, blocks shortlinks/secrets, and archives on approval."}
              </p>
            </FramePanel>
          </div>
        </Frame>
      </section>

      {/* Bottom Action Bar */}
      <section className="flex flex-col items-center justify-between gap-4 border-t pt-10 text-center sm:flex-row sm:text-left">
        <div>
          <h2 className="font-heading font-semibold text-lg tracking-tight text-foreground">
            {lang === "zh" ? "开始检视你正在用的开源工具" : "Audit the tools on your machine"}
          </h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {lang === "zh"
              ? "开源 · 零遥测 · 机器可读 llms.txt & registry.json"
              : "Open source · Zero telemetry · Machine-readable llms.txt & registry.json"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onOpenRegistry}>
            {lang === "zh" ? "进入遥测名录" : "Open Registry"}
            <ArrowRightIcon />
          </Button>
          <Button variant="outline" onClick={onOpenProtocol}>
            {lang === "zh" ? "规则与协议" : "Protocol"}
          </Button>
          <Button
            variant="ghost"
            render={
              <a
                href="https://github.com/edison-land/oss-bureau"
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            GitHub
            <ArrowUpRightIcon />
          </Button>
        </div>
      </section>
    </div>
  );
}
