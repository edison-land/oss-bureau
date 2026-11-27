import type { CaseDossier, CommunityIssuesSnapshot, RawCaseBundleV1 } from "../types";
import { convertRawBundleToDossier } from "../utils/bundleParser";
import communityIssuesRaw from "./communityIssues.json";

const caseModules = import.meta.glob<Record<string, unknown>>("../../../cases/*.json", {
  eager: true,
  import: "default",
});

function isOfficialDossier(obj: Record<string, unknown>): obj is Record<string, unknown> & CaseDossier {
  return typeof obj.caseId === "string" && typeof obj.tier === "string" && typeof obj.name === "string";
}

function isRawBundleV1(obj: Record<string, unknown>): obj is Record<string, unknown> & RawCaseBundleV1 {
  return obj.schema_version === "1.0.0" && typeof obj.target === "object" && typeof obj.verdict === "object";
}

function loadCasesFromRegistry(): CaseDossier[] {
  const loaded: CaseDossier[] = [];
  for (const mod of Object.values(caseModules)) {
    if (!mod || typeof mod !== "object") continue;
    if (isRawBundleV1(mod)) {
      const { dossier } = convertRawBundleToDossier(mod, {
        sourceType: mod.bureau_meta?.source_type ?? "community",
        isCustomPreview: false,
      });
      loaded.push(dossier);
    } else if (isOfficialDossier(mod)) {
      loaded.push({
        ...mod,
        auditorTool: mod.auditorTool || "oss-audit v1.0.0",
        sourceType: mod.sourceType || "official",
      });
    }
  }
  return loaded.sort((a, b) => a.caseId.localeCompare(b.caseId, undefined, { numeric: true }));
}

export const CASES: CaseDossier[] = loadCasesFromRegistry();

export const INITIAL_COMMUNITY_ISSUES: CommunityIssuesSnapshot =
  communityIssuesRaw as CommunityIssuesSnapshot;
