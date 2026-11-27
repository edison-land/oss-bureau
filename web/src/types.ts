export type Lang = "zh" | "en";

export type Tier = "blacklist" | "watchlist" | "cleared";

export type SeverityProfile = "standard" | "strict";

export type RiskLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "CLEAN";

export type DefaultTelemetry =
  | "NONE"
  | "OPT_IN"
  | "OPT_OUT_EASY"
  | "OPT_OUT_HARD"
  | "FORCED"
  | "UNKNOWN";

export type PromiseVerdict =
  | "CONSISTENT"
  | "PARTIAL_MISMATCH"
  | "DIRECT_CONTRADICTION"
  | "NO_CLAIM_FOUND";

export type CaseStatus = "VERIFIED" | "PARTIALLY_PATCHED" | "CLEARED" | "PREVIEW";

export interface LocalizedText {
  zh: string;
  en: string;
}

export interface TierRuleHit {
  rule: string;
  tier: Tier;
  zh: string;
  en: string;
}

export interface CaseAttachment {
  path: string;
  caption?: string;
  sourceUrl?: string;
  previewDataUrl?: string;
}

export interface PreflightCheck {
  id: string;
  label: LocalizedText;
  status: "pass" | "fail" | "warn";
  detail?: LocalizedText;
}

export interface CaseFinding {
  id: string;
  category: "telemetry" | "sensitive_access" | "promise_mismatch" | "supply_chain" | "security";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  title: LocalizedText;
  summary: LocalizedText;
  filePath: string;
  lineRange: string;
  codeSnippet: string;
  permalink?: string | null;
  remediation?: LocalizedText;
}

export interface CaseDossier {
  caseId: string;
  tier: Tier;
  status: CaseStatus;
  name: string;
  repoUrl: string;
  stars?: number;
  commitHash: string;
  branch: string;
  auditedDate: string;
  riskLevel: RiskLevel;
  defaultTelemetry: DefaultTelemetry;
  doNotTrack: "YES" | "NO" | "NA" | "NEW";
  crossToolAccess: boolean;
  crossToolNote: LocalizedText;
  hardwareFingerprint: LocalizedText;
  promiseVsReality: PromiseVerdict;
  oneLiner: LocalizedText;
  promiseQuote?: string;
  promiseSource?: string;
  findings: CaseFinding[];
  mitigationCommand: string;
  mitigationNote: LocalizedText;
  isCustomPreview?: boolean;
  auditorTool?: string;
  submittedBy?: string;
  evidenceIssueNumber?: number;
  evidenceIssueUrl?: string;
  sourceType?: "official" | "community" | "local";
  attachments?: CaseAttachment[];
  rawBundleJson?: string;
}

export interface BureauMeta {
  case_id?: string;
  tier?: Tier;
  status?: CaseStatus;
  stars?: number | null;
  do_not_track?: "YES" | "NO" | "NA" | "NEW";
  submitted_by?: string;
  evidence_issue_number?: number;
  evidence_issue_url?: string;
  source_type?: "official" | "community";
  attachments?: CaseAttachment[];
  archived_at?: string;
}

export interface RawCaseBundleV1 {
  schema_version: string;
  case_id?: string;
  generated_at: string;
  auditor_tool: string;
  target: {
    name: string;
    repo_url?: string | null;
    website_url?: string | null;
    commit_hash?: string | null;
    branch?: string | null;
    commit_date?: string | null;
    audited_scope: "repo" | "local" | "both";
  };
  verdict: {
    risk_level: RiskLevel;
    one_liner: string;
    promise_vs_reality: PromiseVerdict;
    default_telemetry: DefaultTelemetry;
    cross_tool_access: boolean;
  };
  promises?: Array<{
    source: string;
    quote: string;
    file_path?: string | null;
    line?: number | null;
    url?: string | null;
  }>;
  findings: Array<{
    id: string;
    category: CaseFinding["category"];
    severity: CaseFinding["severity"];
    title: string;
    summary: string;
    verified: boolean;
    file_path: string;
    line_start: number;
    line_end: number;
    code_snippet: string;
    permalink?: string | null;
    remediation?: string | null;
  }>;
  user_mitigations: Array<{
    action: string;
    command_or_config: string;
    scope?: string | null;
  }>;
  disclaimer?: string;
  bureau_meta?: BureauMeta;
}

export interface CommunityIssueRecord {
  number: number;
  title: string;
  htmlUrl: string;
  author: string;
  authorAvatar?: string;
  createdAt: string;
  updatedAt: string;
  comments: number;
  thumbsUp: number;
  thumbsDown: number;
  labels: string[];
  tier: Tier | null;
  evidenceStatus: "verified" | "needs_fix" | "valid_json" | "manual_tip";
  targetRepo: string;
  auditorTool?: string | null;
  summary: string;
  attachmentsCount?: number;
  bundle?: RawCaseBundleV1 | null;
}

export interface CommunityIssuesSnapshot {
  syncedAt: string;
  repo: string;
  issues: CommunityIssueRecord[];
}
