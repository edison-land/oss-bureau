# OSS Audit Severity, Classification & False-Positive Rules

This reference defines how to classify findings, filter noise, and write fair, verifiable verdicts.

---

## 1. Severity Matrix

| Severity | Criteria | Typical Examples |
| :--- | :--- | :--- |
| **CRITICAL** | Active credential theft, covert exfiltration of user code/secrets, or malicious supply-chain payload. | Reading `~/.ssh`, `~/.aws`, `~/.claude`, `~/.codex`, browser cookies, or keychain and transmitting raw tokens/secrets externally; obfuscated `postinstall` remote code execution. |
| **HIGH** | Direct contradiction of explicit privacy/telemetry claims, cross-tool credential/account inspection for fingerprinting, or severe exploitable security flaw. | Docs claim "zero telemetry / opt-in only" while code ships opt-out telemetry enabled by default; reading another tool's auth file to derive a cross-device user hash; unauthenticated `0.0.0.0` command execution endpoint; `postinstall` downloading unverified binaries. |
| **MEDIUM** | Undisclosed default-on telemetry, dark-pattern opt-out, or unsafe security defaults. | Default-on telemetry with no clear CLI/UI toggle or ignoring `DO_NOT_TRACK`; disabled TLS verification (`rejectUnauthorized: false` / `verify=False`); `shell=True` command execution with untrusted input. |
| **LOW** | Disclosed default-on telemetry with easy opt-out, or minor hygiene/hardening gaps. | Documented opt-out telemetry honoring `DO_NOT_TRACK` and a clear config flag; local-only hardware ID used purely for offline license/cache keys without network transmission. |
| **INFO** | Verified benign or strictly opt-in behavior noted for transparency. | Opt-in telemetry disabled by default; error reporting triggered only when user explicitly clicks "Send Crash Report". |

---

## 2. Promise vs. Reality Verdicts

- **`DIRECT_CONTRADICTION`**: Documentation/README/Privacy policy makes an explicit claim (e.g., *"No telemetry unless you opt in"*, *"100% local, zero network calls"*) that is directly violated by default runtime code.
- **`PARTIAL_MISMATCH`**: Documentation downplays or omits material collection (e.g., mentions "anonymous crash logs" while also sending machine fingerprints or reading external tool configs).
- **`CONSISTENT`**: Code behavior matches public documentation, or telemetry is absent/strictly opt-in as stated.
- **`NO_CLAIM_FOUND`**: Repository does not make explicit privacy/telemetry claims in scanned docs (still report telemetry/security facts objectively).

---

## 3. Default Telemetry States

- **`NONE`**: No telemetry or analytics code exists in runtime paths.
- **`OPT_IN`**: Telemetry code exists, but is strictly off until the user explicitly enables it.
- **`OPT_OUT_EASY`**: Enabled by default, clearly documented, honors standard `DO_NOT_TRACK=1` or an obvious setting/flag.
- **`OPT_OUT_HARD`**: Enabled by default, poorly documented, hidden behind obscure env vars, or maintainer refuses reasonable opt-out controls.
- **`FORCED`**: Enabled by default with no supported disable mechanism in code.
- **`UNKNOWN`**: Could not confirm default toggle from available source (explain why).

---

## 4. Mandatory False-Positive Filtering Checklist

Static scans intentionally cast a wide net. Before promoting ANY scanner hit into a verified finding, check:

1. **Test / Fixture / Mock / Example code**: Hits inside `test/`, `__tests__/`, `*.spec.*`, `fixtures/`, `examples/`, or docs snippets are almost never runtime issues unless shipped in production builds.
2. **Dead code or commented-out blocks**: Verify the function is actually imported and called in a real execution path.
3. **Self-owned config paths**: Reading `~/.mytool/config.json` inside `mytool` itself is normal. Only flag **cross-tool** reads (e.g., tool A reading `~/.claude`, `~/.codex`, `~/.cursor`, `~/.ssh`, `~/.aws`, or browser profiles) unless the tool's explicit primary purpose is managing/migrating that exact tool AND the user explicitly invokes it.
4. **Standard API clients vs. telemetry**: An AI coding assistant calling `api.anthropic.com` or `api.openai.com` with the user's configured key is core functionality, not hidden telemetry. Focus on **unannounced third-party analytics endpoints** or **vendor-owned collection endpoints**.
5. **Security tools / scanners**: Linters, secret scanners, and audit tools (including `oss-audit` itself!) contain regex patterns mentioning `.ssh`, `.claude`, or `eval(`. Never confuse detection rules with malicious behavior.
6. **Build-time vs. runtime**: Distinguish developer CI/release scripts from code executed on end-user machines.

---

## 5. Fair-Play & Evidence Discipline

- **Exact citations only**: Every finding MUST cite exact `file_path`, `line_start`, `line_end`, and verbatim `code_snippet` read directly from the repository. Never fabricate or extrapolate line numbers.
- **Fact over drama**: Describe what the code does, what the docs state, and how a user can verify or disable it. Do not speculate on author intent or make personal attacks.
- **Credit remediation**: If git history shows a behavior was later removed or fixed in `HEAD`, explicitly state whether it is **currently active** or **previously present and remediated**, citing both commits if traced.
