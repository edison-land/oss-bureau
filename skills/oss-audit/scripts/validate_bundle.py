#!/usr/bin/env python3
"""
Zero-dependency validator for OSS Bureau case-bundle.json files.
Ensures exported bundles conform to references/case-schema.json before publishing
or uploading to the interactive OSS Bureau website.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REQUIRED_TOP = [
    "schema_version",
    "generated_at",
    "auditor_tool",
    "target",
    "verdict",
    "findings",
    "user_mitigations",
]

VALID_SCOPES = {"repo", "local", "both"}
VALID_RISK = {"CLEAN", "LOW", "MEDIUM", "HIGH", "CRITICAL"}
VALID_PROMISE = {"CONSISTENT", "PARTIAL_MISMATCH", "DIRECT_CONTRADICTION", "NO_CLAIM_FOUND"}
VALID_TELEMETRY = {"NONE", "OPT_IN", "OPT_OUT_EASY", "OPT_OUT_HARD", "FORCED", "UNKNOWN"}
VALID_CATEGORIES = {"telemetry", "sensitive_access", "promise_mismatch", "supply_chain", "security"}
VALID_SEVERITIES = {"CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"}


def validate(data: object) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    if not isinstance(data, dict):
        return ["Root JSON value must be an object."], warnings

    for field in REQUIRED_TOP:
        if field not in data:
            errors.append(f"Missing required top-level field: '{field}'")

    if data.get("schema_version") != "1.0.0":
        errors.append(f"schema_version must be '1.0.0', got {data.get('schema_version')!r}")

    target = data.get("target")
    if isinstance(target, dict):
        if not target.get("name"):
            errors.append("target.name must be a non-empty string")
        if target.get("audited_scope") not in VALID_SCOPES:
            errors.append(f"target.audited_scope must be one of {sorted(VALID_SCOPES)}")
        if target.get("audited_scope") in {"repo", "both"} and not target.get("commit_hash"):
            warnings.append("target.commit_hash is missing for a repo audit; permalinks may not be reproducible.")
    else:
        errors.append("target must be an object")

    verdict = data.get("verdict")
    if isinstance(verdict, dict):
        if verdict.get("risk_level") not in VALID_RISK:
            errors.append(f"verdict.risk_level must be one of {sorted(VALID_RISK)}")
        if not verdict.get("one_liner"):
            errors.append("verdict.one_liner must be a non-empty string")
        if verdict.get("promise_vs_reality") not in VALID_PROMISE:
            errors.append(f"verdict.promise_vs_reality must be one of {sorted(VALID_PROMISE)}")
        if verdict.get("default_telemetry") not in VALID_TELEMETRY:
            errors.append(f"verdict.default_telemetry must be one of {sorted(VALID_TELEMETRY)}")
        if not isinstance(verdict.get("cross_tool_access"), bool):
            errors.append("verdict.cross_tool_access must be a boolean")
    else:
        errors.append("verdict must be an object")

    findings = data.get("findings")
    if isinstance(findings, list):
        req_f = [
            "id", "category", "severity", "title", "summary",
            "verified", "file_path", "line_start", "line_end", "code_snippet",
        ]
        for idx, f in enumerate(findings):
            prefix = f"findings[{idx}]"
            if not isinstance(f, dict):
                errors.append(f"{prefix} must be an object")
                continue
            for k in req_f:
                if k not in f:
                    errors.append(f"{prefix} missing required field '{k}'")
            if f.get("category") not in VALID_CATEGORIES:
                errors.append(f"{prefix}.category invalid: {f.get('category')!r}")
            if f.get("severity") not in VALID_SEVERITIES:
                errors.append(f"{prefix}.severity invalid: {f.get('severity')!r}")
            if f.get("verified") is not True:
                warnings.append(f"{prefix} has verified={f.get('verified')!r}; unverified hits should not be published as confirmed findings.")
            ls = f.get("line_start")
            le = f.get("line_end")
            if isinstance(ls, int) and isinstance(le, int):
                if ls < 1 or le < ls:
                    errors.append(f"{prefix} invalid line range: {ls}..{le}")
            else:
                errors.append(f"{prefix}.line_start and line_end must be positive integers")
    else:
        errors.append("findings must be an array")

    mitigations = data.get("user_mitigations")
    if isinstance(mitigations, list):
        for idx, m in enumerate(mitigations):
            if not isinstance(m, dict) or not m.get("action") or not m.get("command_or_config"):
                errors.append(f"user_mitigations[{idx}] must have non-empty 'action' and 'command_or_config'")
    else:
        errors.append("user_mitigations must be an array")

    return errors, warnings


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: validate_bundle.py <path-to-case-bundle.json>", file=sys.stderr)
        return 2
    path = Path(sys.argv[1]).expanduser().resolve()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"FAIL: Could not read/parse JSON: {exc}", file=sys.stderr)
        return 1

    errors, warnings = validate(data)
    for w in warnings:
        print(f"WARN: {w}", file=sys.stderr)
    if errors:
        for e in errors:
            print(f"ERROR: {e}", file=sys.stderr)
        return 1
    print(f"OK: {path.name} is a valid OSS Bureau v1.0.0 case bundle.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
