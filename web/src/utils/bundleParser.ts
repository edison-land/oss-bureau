import type { CaseDossier, RawCaseBundleV1, Tier } from "../types";

export interface ParseBundleResult {
  ok: boolean;
  dossier?: CaseDossier;
  raw?: RawCaseBundleV1;
  errors: string[];
}

const VALID_RISK = new Set(["CLEAN", "LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const VALID_PROMISE = new Set([
  "CONSISTENT",
  "PARTIAL_MISMATCH",
  "DIRECT_CONTRADICTION",
  "NO_CLAIM_FOUND",
]);
const VALID_TELEMETRY = new Set([
  "NONE",
  "OPT_IN",
  "OPT_OUT_EASY",
  "OPT_OUT_HARD",
  "FORCED",
  "UNKNOWN",
]);

function inferTier(raw: RawCaseBundleV1): Tier {
  const { risk_level, promise_vs_reality, default_telemetry, cross_tool_access } = raw.verdict;
  if (
    risk_level === "CRITICAL" ||
    risk_level === "HIGH" ||
    promise_vs_reality === "DIRECT_CONTRADICTION" ||
    default_telemetry === "FORCED" ||
    cross_tool_access
  ) {
    return "blacklist";
  }
  if (
    risk_level === "MEDIUM" ||
    default_telemetry === "OPT_OUT_EASY" ||
    default_telemetry === "OPT_OUT_HARD"
  ) {
    return "watchlist";
  }
  return "cleared";
}

export function parseCaseBundleJson(text: string): ParseBundleResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      errors: [`JSON parse error: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  const errors: string[] = [];
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, errors: ["Root JSON value must be an object."] };
  }

  const raw = parsed as Partial<RawCaseBundleV1>;
  if (raw.schema_version !== "1.0.0") {
    errors.push(`schema_version must be "1.0.0" (got ${JSON.stringify(raw.schema_version)})`);
  }
  if (!raw.target?.name) {
    errors.push("Missing required field: target.name");
  }
  if (!raw.verdict) {
    errors.push("Missing required object: verdict");
  } else {
    if (!VALID_RISK.has(raw.verdict.risk_level)) {
      errors.push(`Invalid verdict.risk_level: ${String(raw.verdict.risk_level)}`);
    }
    if (!VALID_PROMISE.has(raw.verdict.promise_vs_reality)) {
      errors.push(`Invalid verdict.promise_vs_reality: ${String(raw.verdict.promise_vs_reality)}`);
    }
    if (!VALID_TELEMETRY.has(raw.verdict.default_telemetry)) {
      errors.push(`Invalid verdict.default_telemetry: ${String(raw.verdict.default_telemetry)}`);
    }
    if (!raw.verdict.one_liner) {
      errors.push("Missing required field: verdict.one_liner");
    }
  }
  if (!Array.isArray(raw.findings)) {
    errors.push("Missing required array: findings");
  }
  if (!Array.isArray(raw.user_mitigations)) {
    errors.push("Missing required array: user_mitigations");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const valid = raw as RawCaseBundleV1;
  const firstPromise = valid.promises?.[0];
  const mitigationCmd =
    valid.user_mitigations.map((m) => `# ${m.action}\n${m.command_or_config}`).join("\n\n") ||
    "# See case findings for mitigation steps.";

  const dossier: CaseDossier = {
    caseId: valid.case_id ? valid.case_id.toUpperCase() : "PREVIEW-001",
    tier: inferTier(valid),
    status: "PREVIEW",
    name: valid.target.name,
    repoUrl: valid.target.repo_url || `https://github.com/${valid.target.name}`,
    commitHash: (valid.target.commit_hash || "unknown").slice(0, 10),
    branch: valid.target.branch || "main",
    auditedDate: (valid.generated_at || new Date().toISOString()).slice(0, 10),
    riskLevel: valid.verdict.risk_level,
    defaultTelemetry: valid.verdict.default_telemetry,
    doNotTrack: "NA",
    crossToolAccess: Boolean(valid.verdict.cross_tool_access),
    crossToolNote: {
      zh: valid.verdict.cross_tool_access ? "检测到跨工具凭证/配置读取" : "未检测到跨工具遥测越权",
      en: valid.verdict.cross_tool_access
        ? "Cross-tool credential/config access detected"
        : "No cross-tool telemetry snooping detected",
    },
    hardwareFingerprint: {
      zh: "详见下方源码证据",
      en: "See verified findings below",
    },
    promiseVsReality: valid.verdict.promise_vs_reality,
    oneLiner: {
      zh: valid.verdict.one_liner,
      en: valid.verdict.one_liner,
    },
    promiseQuote: firstPromise?.quote,
    promiseSource: firstPromise
      ? `${firstPromise.file_path || firstPromise.source}${firstPromise.line ? `:L${firstPromise.line}` : ""}`
      : undefined,
    findings: valid.findings.map((f) => ({
      id: f.id,
      category: f.category,
      severity: f.severity,
      title: { zh: f.title, en: f.title },
      summary: { zh: f.summary, en: f.summary },
      filePath: f.file_path,
      lineRange: `L${f.line_start}${f.line_end > f.line_start ? `-L${f.line_end}` : ""}`,
      codeSnippet: f.code_snippet,
      permalink: f.permalink,
      remediation: f.remediation ? { zh: f.remediation, en: f.remediation } : undefined,
    })),
    mitigationCommand: mitigationCmd,
    mitigationNote: {
      zh: "由导入的 case-bundle.json 自动解析生成。",
      en: "Parsed directly from the imported case-bundle.json.",
    },
    isCustomPreview: true,
  };

  return { ok: true, dossier, raw: valid, errors: [] };
}

export function buildGitHubIssueUrl(params: {
  repoName: string;
  repoUrl?: string;
  commitHash?: string;
  summary: string;
  evidenceJson?: string;
}): string {
  const title = `[Case Tip] ${params.repoName}`;
  const bodyParts = [
    "### Target Repository",
    `- **Name**: ${params.repoName}`,
    params.repoUrl ? `- **URL**: ${params.repoUrl}` : "",
    params.commitHash ? `- **Commit**: \`${params.commitHash}\`` : "",
    "",
    "### Summary of Evidence",
    params.summary,
  ].filter(Boolean);

  if (params.evidenceJson) {
    const trimmed =
      params.evidenceJson.length > 3500
        ? params.evidenceJson.slice(0, 3500) + "\n... (attach full case-bundle.json in comment)"
        : params.evidenceJson;
    bodyParts.push("", "### `case-bundle.json` (v1.0.0)", "```json", trimmed, "```");
  }

  const qs = new URLSearchParams({
    title,
    labels: "case-tip",
    body: bodyParts.join("\n"),
  });
  return `https://github.com/edison-land/oss-bureau/issues/new?${qs.toString()}`;
}
