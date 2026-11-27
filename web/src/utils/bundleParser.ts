import type {
  CaseDossier,
  DefaultTelemetry,
  PromiseVerdict,
  RawCaseBundleV1,
  RiskLevel,
  SeverityProfile,
  Tier,
  TierRuleHit,
} from "../types";

export interface ParseBundleResult {
  ok: boolean;
  dossier?: CaseDossier;
  raw?: RawCaseBundleV1;
  reasons: TierRuleHit[];
  errors: string[];
}

export interface TierEvaluationInput {
  riskLevel: RiskLevel;
  promiseVsReality: PromiseVerdict;
  defaultTelemetry: DefaultTelemetry;
  crossToolAccess: boolean;
  doNotTrack?: "YES" | "NO" | "NA" | "NEW";
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

export function evaluateTier(
  input: TierEvaluationInput,
  profile: SeverityProfile = "standard",
): { tier: Tier; reasons: TierRuleHit[] } {
  const blackReasons: TierRuleHit[] = [];
  if (input.crossToolAccess) {
    blackReasons.push({
      rule: "CROSS_TOOL_ACCESS",
      tier: "blacklist",
      zh: "存在跨工具窃密或静默读取外部工具凭证/配置（cross_tool_access = true）",
      en: "Cross-tool credential or config snooping detected (cross_tool_access = true)",
    });
  }
  if (input.promiseVsReality === "DIRECT_CONTRADICTION") {
    blackReasons.push({
      rule: "PROMISE_DIRECT_CONTRADICTION",
      tier: "blacklist",
      zh: "源码行为与公开“零遥测/纯本地”承诺直接矛盾（DIRECT_CONTRADICTION）",
      en: "Runtime code directly contradicts explicit privacy claims (DIRECT_CONTRADICTION)",
    });
  }
  if (input.defaultTelemetry === "FORCED") {
    blackReasons.push({
      rule: "FORCED_TELEMETRY",
      tier: "blacklist",
      zh: "强制开启遥测且无内置关闭开关（default_telemetry = FORCED）",
      en: "Forced telemetry with no built-in disable switch (default_telemetry = FORCED)",
    });
  }
  if (input.riskLevel === "CRITICAL" || input.riskLevel === "HIGH") {
    blackReasons.push({
      rule: "HIGH_OR_CRITICAL_RISK",
      tier: "blacklist",
      zh: `存在经核实的高危/严重隐私或安全风险（risk_level = ${input.riskLevel}）`,
      en: `Verified high-impact privacy or security risk (risk_level = ${input.riskLevel})`,
    });
  }

  // Strict privacy purist profile treats any default-on telemetry or DNT refusal as blacklist
  if (profile === "strict") {
    if (input.defaultTelemetry === "OPT_OUT_HARD" || input.defaultTelemetry === "OPT_OUT_EASY") {
      blackReasons.push({
        rule: "STRICT_NO_DEFAULT_TELEMETRY",
        tier: "blacklist",
        zh: `洁癖标尺：默认开启遥测（${input.defaultTelemetry}）直接判入黑榜`,
        en: `Strict profile: any default-on opt-out telemetry (${input.defaultTelemetry}) triggers blacklist`,
      });
    }
    if (input.doNotTrack === "NO" && input.defaultTelemetry !== "NONE") {
      blackReasons.push({
        rule: "STRICT_DNT_REQUIRED",
        tier: "blacklist",
        zh: "洁癖标尺：存在遥测代码却拒绝响应 DO_NOT_TRACK=1",
        en: "Strict profile: telemetry present while ignoring DO_NOT_TRACK=1",
      });
    }
  }

  if (blackReasons.length > 0) {
    return { tier: "blacklist", reasons: blackReasons };
  }

  const watchReasons: TierRuleHit[] = [];
  if (input.defaultTelemetry === "OPT_OUT_HARD") {
    watchReasons.push({
      rule: "OPT_OUT_HARD",
      tier: "watchlist",
      zh: "默认开启遥测且关闭门槛高或开关隐蔽（OPT_OUT_HARD）",
      en: "Default-on telemetry with high opt-out friction or hidden toggle (OPT_OUT_HARD)",
    });
  } else if (input.defaultTelemetry === "OPT_OUT_EASY") {
    watchReasons.push({
      rule: "OPT_OUT_EASY",
      tier: "watchlist",
      zh: "默认开启遥测，需用户主动关闭（OPT_OUT_EASY）",
      en: "Default-on telemetry enabled out of the box (OPT_OUT_EASY)",
    });
  }
  if (input.promiseVsReality === "PARTIAL_MISMATCH") {
    watchReasons.push({
      rule: "PROMISE_PARTIAL_MISMATCH",
      tier: "watchlist",
      zh: "文档对数据采集披露不完整或轻描淡写（PARTIAL_MISMATCH）",
      en: "Documentation downplays or omits material telemetry behavior (PARTIAL_MISMATCH)",
    });
  }
  if (input.riskLevel === "MEDIUM") {
    watchReasons.push({
      rule: "MEDIUM_RISK",
      tier: "watchlist",
      zh: "存在中等风险的遥测或安全默认配置（risk_level = MEDIUM）",
      en: "Moderate telemetry or security hardening concerns (risk_level = MEDIUM)",
    });
  }
  if (watchReasons.length > 0) {
    return { tier: "watchlist", reasons: watchReasons };
  }

  return {
    tier: "cleared",
    reasons: [
      {
        rule: "CLEARED_BASELINE",
        tier: "cleared",
        zh: `无默认遥测（${input.defaultTelemetry}）、无跨工具越权、无承诺矛盾，符合红榜标准`,
        en: `No default-on telemetry (${input.defaultTelemetry}), no cross-tool snooping, and no doc contradiction`,
      },
    ],
  };
}

export function convertRawBundleToDossier(
  valid: RawCaseBundleV1,
  options?: {
    sourceType?: "official" | "community" | "local";
    isCustomPreview?: boolean;
    rawJson?: string;
  },
): { dossier: CaseDossier; reasons: TierRuleHit[] } {
  const meta = valid.bureau_meta;
  const evaluation = evaluateTier(
    {
      riskLevel: valid.verdict.risk_level,
      promiseVsReality: valid.verdict.promise_vs_reality,
      defaultTelemetry: valid.verdict.default_telemetry,
      crossToolAccess: Boolean(valid.verdict.cross_tool_access),
      doNotTrack: meta?.do_not_track,
    },
    "standard",
  );

  const firstPromise = valid.promises?.[0];
  const mitigationCmd =
    valid.user_mitigations.map((m) => `# ${m.action}\n${m.command_or_config}`).join("\n\n") ||
    "# See case findings for mitigation steps.";

  const sourceType = options?.sourceType ?? meta?.source_type ?? "local";
  const computedTier = meta?.tier ?? evaluation.tier;

  const dossier: CaseDossier = {
    caseId: (meta?.case_id || valid.case_id || "LOCAL-001").toUpperCase(),
    tier: computedTier,
    status:
      meta?.status ??
      (options?.isCustomPreview ? "PREVIEW" : computedTier === "cleared" ? "CLEARED" : "VERIFIED"),
    name: valid.target.name,
    repoUrl: valid.target.repo_url || `https://github.com/${valid.target.name}`,
    stars: typeof meta?.stars === "number" ? meta.stars : undefined,
    commitHash: (valid.target.commit_hash || "unknown").slice(0, 10),
    branch: valid.target.branch || "main",
    auditedDate: (valid.generated_at || new Date().toISOString()).slice(0, 10),
    riskLevel: valid.verdict.risk_level,
    defaultTelemetry: valid.verdict.default_telemetry,
    doNotTrack: meta?.do_not_track ?? "NA",
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
      zh: `由 ${valid.auditor_tool || "case-bundle.json"} 审计产物自动解析生成。`,
      en: `Parsed automatically from ${valid.auditor_tool || "case-bundle.json"}.`,
    },
    isCustomPreview: options?.isCustomPreview ?? sourceType === "local",
    auditorTool: valid.auditor_tool || "custom-skill",
    submittedBy: meta?.submitted_by,
    evidenceIssueNumber: meta?.evidence_issue_number,
    evidenceIssueUrl: meta?.evidence_issue_url,
    sourceType,
    rawBundleJson: options?.rawJson,
  };

  return { dossier, reasons: evaluation.reasons };
}

export function parseCaseBundleJson(text: string): ParseBundleResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      reasons: [],
      errors: [`JSON parse error: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  const errors: string[] = [];
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reasons: [], errors: ["Root JSON value must be an object."] };
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
    return { ok: false, reasons: [], errors };
  }

  const valid = raw as RawCaseBundleV1;
  const { dossier, reasons } = convertRawBundleToDossier(valid, {
    sourceType: "local",
    isCustomPreview: true,
    rawJson: text,
  });

  return { ok: true, dossier, raw: valid, reasons, errors: [] };
}

export function buildCaseSubmissionIssueUrl(params: {
  repoName: string;
  commitHash?: string;
  auditorTool?: string;
  evidenceJson?: string;
  notes?: string;
}): { url: string; jsonWasTooLong: boolean } {
  const title = `[Case] ${params.repoName}`;
  const rawJson = params.evidenceJson?.trim() || "";
  const MAX_QUERY_JSON = 3800;
  const jsonWasTooLong = rawJson.length > MAX_QUERY_JSON;

  const qs = new URLSearchParams({
    template: "case-submission.yml",
    title,
    labels: "case-submission",
    target_repo: params.repoName,
    commit_hash: params.commitHash || "",
    auditor_tool: params.auditorTool || "oss-audit v1.0.0",
    case_bundle_json: jsonWasTooLong
      ? "// Paste your full case-bundle.json here (already copied to your clipboard!)"
      : rawJson,
    notes: params.notes || "",
  });
  return {
    url: `https://github.com/edison-land/oss-bureau/issues/new?${qs.toString()}`,
    jsonWasTooLong,
  };
}

export function buildRemediationAppealUrl(params: {
  caseId: string;
  repoName: string;
  explanation?: string;
}): string {
  const qs = new URLSearchParams({
    template: "remediation-appeal.yml",
    title: `[Remediation] ${params.caseId} ${params.repoName}`,
    labels: "remediation-appeal",
    case_id: `${params.caseId} ${params.repoName}`,
    explanation: params.explanation || "",
  });
  return `https://github.com/edison-land/oss-bureau/issues/new?${qs.toString()}`;
}

export function buildGitHubIssueUrl(params: {
  repoName: string;
  repoUrl?: string;
  commitHash?: string;
  summary: string;
  evidenceJson?: string;
}): string {
  const { url } = buildCaseSubmissionIssueUrl({
    repoName: params.repoName,
    commitHash: params.commitHash,
    evidenceJson: params.evidenceJson,
    notes: params.summary,
  });
  return url;
}

export const UNIVERSAL_SKILL_CONTRACT = `When auditing an open-source repository for privacy, telemetry, cross-tool credential access, or supply-chain risks, output a strict JSON file conforming to OSS Bureau Case Bundle v1.0.0 so it can be verified and listed on https://edison-land.github.io/oss-bureau/:

{
  "schema_version": "1.0.0",
  "generated_at": "<ISO-8601 UTC timestamp>",
  "auditor_tool": "<YOUR_SKILL_OR_AGENT_NAME vX.Y>",
  "target": {
    "name": "owner/repo",
    "repo_url": "https://github.com/owner/repo",
    "commit_hash": "<exact audited commit SHA>",
    "branch": "main",
    "audited_scope": "repo"
  },
  "verdict": {
    "risk_level": "CLEAN | LOW | MEDIUM | HIGH | CRITICAL",
    "one_liner": "<Concise factual verdict backed by code>",
    "promise_vs_reality": "CONSISTENT | PARTIAL_MISMATCH | DIRECT_CONTRADICTION | NO_CLAIM_FOUND",
    "default_telemetry": "NONE | OPT_IN | OPT_OUT_EASY | OPT_OUT_HARD | FORCED | UNKNOWN",
    "cross_tool_access": false
  },
  "promises": [
    { "source": "README.md", "quote": "<exact quote>", "file_path": "README.md", "line": 12 }
  ],
  "findings": [
    {
      "id": "F-001",
      "category": "telemetry | sensitive_access | promise_mismatch | supply_chain | security",
      "severity": "CRITICAL | HIGH | MEDIUM | LOW | INFO",
      "title": "<short finding title>",
      "summary": "<verified runtime behavior>",
      "verified": true,
      "file_path": "relative/path/in/repo.ts",
      "line_start": 10,
      "line_end": 25,
      "code_snippet": "<verbatim lines from repo>",
      "permalink": "https://github.com/owner/repo/blob/<commit>/relative/path/in/repo.ts#L10-L25"
    }
  ],
  "user_mitigations": [
    { "action": "Disable telemetry", "command_or_config": "export DO_NOT_TRACK=1" }
  ]
}

Rules:
1. Only cite file_path, line_start, line_end, and code_snippet actually read from the repository at commit_hash.
2. Exclude test fixtures, comments, dead code, and self-owned config paths.
3. Submit the resulting JSON to https://github.com/edison-land/oss-bureau/issues/new?template=case-submission.yml`;
