import type { DefaultTelemetry, Lang, Tier } from "../types";
import { Badge } from "./ui/badge";

export function StatusBadge({
  tier,
  lang,
  size = "default",
}: {
  tier: Tier;
  lang: Lang;
  size?: "sm" | "default" | "lg";
}) {
  const cfg =
    tier === "blacklist"
      ? {
          variant: "error" as const,
          dot: "bg-destructive",
          label: lang === "zh" ? "黑榜" : "Flagged",
        }
      : tier === "watchlist"
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
    <Badge variant={cfg.variant} size={size}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </Badge>
  );
}

export function formatTelemetry(value: DefaultTelemetry, lang: Lang): string {
  switch (value) {
    case "FORCED":
      return lang === "zh" ? "强制" : "Forced";
    case "OPT_OUT_HARD":
      return lang === "zh" ? "默认开 (难关)" : "Opt-out (hard)";
    case "OPT_OUT_EASY":
      return lang === "zh" ? "默认开" : "Opt-out";
    case "OPT_IN":
      return lang === "zh" ? "默认关" : "Opt-in";
    case "NONE":
      return lang === "zh" ? "无" : "None";
    default:
      return lang === "zh" ? "未知" : "Unknown";
  }
}

export function formatDnt(value: "YES" | "NO" | "NA" | "NEW", lang: Lang): string {
  switch (value) {
    case "YES":
      return lang === "zh" ? "支持" : "Yes";
    case "NO":
      return lang === "zh" ? "忽略" : "No";
    case "NEW":
      return lang === "zh" ? "新增" : "New";
    default:
      return "—";
  }
}

export function formatStars(stars?: number): string {
  if (!stars) return "—";
  if (stars >= 1000) return `${(stars / 1000).toFixed(1)}k`;
  return String(stars);
}
