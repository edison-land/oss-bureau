import type { CaseDossier, Lang } from "../types";

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let current = "";
  for (const ch of text) {
    const next = current + ch;
    if (ctx.measureText(next).width > maxWidth && current.length > 0) {
      lines.push(current);
      current = ch;
      if (lines.length >= maxLines) {
        lines[maxLines - 1] = lines[maxLines - 1].slice(0, -2) + "…";
        return lines;
      }
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function exportCaseCardPng(dossier: CaseDossier, lang: Lang): void {
  const W = 1200;
  const H = 675;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const isDark = document.documentElement.classList.contains("dark");
  const palette = isDark
    ? {
        canvasBg: "#0d0d0d",
        surface: "#141414",
        mutedSurface: "#1b1b1b",
        border: "rgba(255,255,255,0.10)",
        fg: "#f5f5f5",
        muted: "#a3a3a3",
      }
    : {
        canvasBg: "#fafafa",
        surface: "#ffffff",
        mutedSurface: "#f5f5f5",
        border: "rgba(0,0,0,0.09)",
        fg: "#171717",
        muted: "#666666",
      };

  const accent =
    dossier.tier === "blacklist"
      ? { fg: isDark ? "#f87171" : "#b91c1c", bg: isDark ? "rgba(239,68,68,0.16)" : "rgba(239,68,68,0.09)", dot: "#ef4444" }
      : dossier.tier === "watchlist"
        ? { fg: isDark ? "#fbbf24" : "#b45309", bg: isDark ? "rgba(245,158,11,0.16)" : "rgba(245,158,11,0.10)", dot: "#f59e0b" }
        : { fg: isDark ? "#34d399" : "#047857", bg: isDark ? "rgba(16,185,129,0.16)" : "rgba(16,185,129,0.10)", dot: "#10b981" };

  // Canvas background
  ctx.fillStyle = palette.canvasBg;
  ctx.fillRect(0, 0, W, H);

  // Outer Frame container
  roundRectPath(ctx, 36, 36, W - 72, H - 72, 20);
  ctx.fillStyle = palette.surface;
  ctx.fill();
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Top metadata
  ctx.fillStyle = palette.muted;
  ctx.font = '500 16px "Geist Mono", ui-monospace, monospace';
  ctx.fillText(
    `oss-bureau  ·  ${dossier.caseId}  ·  ${dossier.commitHash}  ·  ${dossier.auditedDate}`,
    72,
    92,
  );

  // Clean semantic pill badge
  const statusLabel =
    dossier.tier === "blacklist"
      ? lang === "zh"
        ? "黑榜 · Flagged"
        : "Flagged"
      : dossier.tier === "watchlist"
        ? lang === "zh"
          ? "灰榜 · Watch"
          : "Watch"
        : lang === "zh"
          ? "红榜 · Clean"
          : "Clean";

  ctx.font = '600 16px "Inter", -apple-system, sans-serif';
  const badgeW = ctx.measureText(statusLabel).width + 44;
  const badgeX = W - 72 - badgeW;
  roundRectPath(ctx, badgeX, 66, badgeW, 34, 8);
  ctx.fillStyle = accent.bg;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(badgeX + 18, 83, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = accent.dot;
  ctx.fill();

  ctx.fillStyle = accent.fg;
  ctx.fillText(statusLabel, badgeX + 30, 89);

  // Repo title
  ctx.fillStyle = palette.fg;
  ctx.font = '700 42px "Inter", -apple-system, sans-serif';
  ctx.fillText(dossier.name, 72, 162);

  if (dossier.stars) {
    ctx.fillStyle = palette.muted;
    ctx.font = '400 18px "Geist Mono", ui-monospace, monospace';
    ctx.fillText(
      `${dossier.stars.toLocaleString()} stars  ·  audited via ${dossier.auditorTool || "oss-audit v1.0.0"}`,
      72,
      198,
    );
  }

  // 4 Metric tiles
  const metrics = [
    { label: lang === "zh" ? "默认遥测" : "Default telemetry", value: dossier.defaultTelemetry },
    { label: "DO_NOT_TRACK", value: dossier.doNotTrack },
    {
      label: lang === "zh" ? "跨工具访问" : "Cross-tool access",
      value: dossier.crossToolAccess ? "YES" : "NO",
    },
    { label: lang === "zh" ? "承诺 vs 源码" : "Docs vs code", value: dossier.promiseVsReality },
  ];

  const tileW = (W - 144 - 36) / 4;
  metrics.forEach((m, idx) => {
    const x = 72 + idx * (tileW + 12);
    const y = 228;
    roundRectPath(ctx, x, y, tileW, 84, 12);
    ctx.fillStyle = palette.mutedSurface;
    ctx.fill();
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = palette.muted;
    ctx.font = '500 13px "Inter", -apple-system, sans-serif';
    ctx.fillText(m.label, x + 16, y + 30);

    ctx.fillStyle = palette.fg;
    ctx.font = '600 17px "Geist Mono", ui-monospace, monospace';
    ctx.fillText(m.value, x + 16, y + 62);
  });

  // Verdict summary
  roundRectPath(ctx, 72, 332, W - 144, 146, 12);
  ctx.fillStyle = palette.mutedSurface;
  ctx.fill();
  ctx.strokeStyle = palette.border;
  ctx.stroke();

  ctx.fillStyle = palette.muted;
  ctx.font = '500 13px "Inter", -apple-system, sans-serif';
  ctx.fillText(lang === "zh" ? "代码核实结论" : "Code-verified summary", 94, 362);

  ctx.fillStyle = palette.fg;
  ctx.font = '500 21px "Inter", -apple-system, sans-serif';
  const summaryLines = wrapText(ctx, dossier.oneLiner[lang], W - 188, 3);
  summaryLines.forEach((line, idx) => {
    ctx.fillText(line, 94, 398 + idx * 31);
  });

  // First code evidence snippet
  const firstFinding = dossier.findings[0];
  if (firstFinding) {
    roundRectPath(ctx, 72, 496, W - 144, 72, 12);
    ctx.fillStyle = palette.canvasBg;
    ctx.fill();
    ctx.strokeStyle = palette.border;
    ctx.stroke();

    ctx.fillStyle = palette.muted;
    ctx.font = '500 13px "Geist Mono", ui-monospace, monospace';
    ctx.fillText(`${firstFinding.filePath} (${firstFinding.lineRange})`, 94, 524);

    ctx.fillStyle = palette.fg;
    ctx.font = '400 14px "Geist Mono", ui-monospace, monospace';
    const snip = firstFinding.codeSnippet.split("\n")[0].slice(0, 95);
    ctx.fillText(snip, 94, 550);
  }

  // Footer
  ctx.fillStyle = palette.muted;
  ctx.font = '400 15px "Geist Mono", ui-monospace, monospace';
  ctx.fillText("edison-land.github.io/oss-bureau  ·  npx skills add edison-land/oss-bureau", 72, H - 56);

  const link = document.createElement("a");
  link.download = `oss-bureau-${dossier.caseId.toLowerCase()}-${dossier.name.replace("/", "-")}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
