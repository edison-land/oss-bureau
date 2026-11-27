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

export function exportCaseCardPng(dossier: CaseDossier, lang: Lang): void {
  const W = 1200;
  const H = 675;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Background
  ctx.fillStyle = "#080a0e";
  ctx.fillRect(0, 0, W, H);

  // Subtle grid
  ctx.strokeStyle = "rgba(148, 163, 184, 0.06)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Accent color by tier
  const accent =
    dossier.tier === "blacklist"
      ? "#ef4444"
      : dossier.tier === "watchlist"
        ? "#f59e0b"
        : "#10b981";

  // Top accent bar
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 6);

  // Outer card border
  ctx.strokeStyle = "rgba(148, 163, 184, 0.22)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(36, 36, W - 72, H - 72);

  // Top metadata row
  ctx.fillStyle = "#94a3b8";
  ctx.font = '600 18px "IBM Plex Mono", monospace';
  ctx.fillText(`OSS BUREAU // ${dossier.caseId}  •  COMMIT ${dossier.commitHash}`, 68, 86);

  // Stamp badge
  const stampLabel =
    dossier.tier === "blacklist"
      ? lang === "zh"
        ? "实锤黑榜 // BLACKLIST"
        : "BLACKLIST // VERIFIED"
      : dossier.tier === "watchlist"
        ? lang === "zh"
          ? "灰榜观察 // WATCHLIST"
          : "WATCHLIST // CAUTION"
        : lang === "zh"
          ? "红榜通过 // CLEARED"
          : "CLEARED // CLEAN";

  ctx.font = '700 18px "IBM Plex Mono", monospace';
  const badgeW = ctx.measureText(stampLabel).width + 36;
  const badgeX = W - 68 - badgeW;
  ctx.fillStyle = `${accent}22`;
  ctx.fillRect(badgeX, 58, badgeW, 38);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(badgeX, 58, badgeW, 38);
  ctx.fillStyle = accent;
  ctx.fillText(stampLabel, badgeX + 18, 83);

  // Repo title
  ctx.fillStyle = "#f8fafc";
  ctx.font = '800 44px "Inter", -apple-system, sans-serif';
  ctx.fillText(dossier.name, 68, 158);

  if (dossier.stars) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = '500 20px "IBM Plex Mono", monospace';
    ctx.fillText(`★ ${dossier.stars.toLocaleString()} stars   •   Audited ${dossier.auditedDate}`, 68, 194);
  }

  // 4 Metric tiles
  const metrics = [
    {
      label: lang === "zh" ? "默认遥测" : "DEFAULT TELEMETRY",
      value: dossier.defaultTelemetry,
    },
    {
      label: "DO_NOT_TRACK",
      value: dossier.doNotTrack,
    },
    {
      label: lang === "zh" ? "跨工具窃密/关联" : "CROSS-TOOL SNOOPING",
      value: dossier.crossToolAccess ? "YES" : "NO",
    },
    {
      label: lang === "zh" ? "承诺 vs 源码" : "PROMISE VS CODE",
      value: dossier.promiseVsReality,
    },
  ];

  const tileW = (W - 136 - 48) / 4;
  metrics.forEach((m, idx) => {
    const x = 68 + idx * (tileW + 16);
    const y = 224;
    ctx.fillStyle = "#111620";
    ctx.fillRect(x, y, tileW, 82);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.16)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, tileW, 82);

    ctx.fillStyle = "#94a3b8";
    ctx.font = '600 13px "IBM Plex Mono", monospace';
    ctx.fillText(m.label, x + 16, y + 28);

    ctx.fillStyle =
      m.value === "FORCED" || m.value === "DIRECT_CONTRADICTION" || m.value === "YES"
        ? "#f87171"
        : m.value === "NONE" || m.value === "CLEAN" || m.value === "CONSISTENT" || m.value === "NO"
          ? "#34d399"
          : "#fbbf24";
    ctx.font = '700 18px "IBM Plex Mono", monospace';
    ctx.fillText(m.value, x + 16, y + 60);
  });

  // Verdict summary box
  ctx.fillStyle = "#0e131c";
  ctx.fillRect(68, 330, W - 136, 152);
  ctx.strokeStyle = `${accent}66`;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(68, 330, W - 136, 152);

  ctx.fillStyle = accent;
  ctx.font = '700 15px "IBM Plex Mono", monospace';
  ctx.fillText(lang === "zh" ? "VERDICT // 调查结论" : "VERDICT // SUMMARY", 90, 362);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = '500 22px "Inter", -apple-system, sans-serif';
  const summaryLines = wrapText(ctx, dossier.oneLiner[lang], W - 184, 3);
  summaryLines.forEach((line, idx) => {
    ctx.fillText(line, 90, 400 + idx * 32);
  });

  // First code evidence line if present
  const firstFinding = dossier.findings[0];
  if (firstFinding) {
    ctx.fillStyle = "#111620";
    ctx.fillRect(68, 502, W - 136, 72);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.16)";
    ctx.lineWidth = 1;
    ctx.strokeRect(68, 502, W - 136, 72);

    ctx.fillStyle = "#94a3b8";
    ctx.font = '600 14px "IBM Plex Mono", monospace';
    ctx.fillText(`EVIDENCE: ${firstFinding.filePath} (${firstFinding.lineRange})`, 90, 528);

    ctx.fillStyle = "#fca5a5";
    ctx.font = '500 15px "IBM Plex Mono", monospace';
    const snip = firstFinding.codeSnippet.split("\n")[0].slice(0, 95);
    ctx.fillText(snip, 90, 556);
  }

  // Footer
  ctx.fillStyle = "#64748b";
  ctx.font = '500 16px "IBM Plex Mono", monospace';
  ctx.fillText("github.com/edison-land/oss-bureau   •   npx skills add edison-land/oss-bureau", 68, H - 56);

  const link = document.createElement("a");
  link.download = `oss-bureau-${dossier.caseId.toLowerCase()}-${dossier.name.replace("/", "-")}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
