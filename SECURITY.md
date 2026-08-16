# Security and data-handling boundary

This plugin reads external-agent JSONL and displays observable content in a
local DeepSeek Harness instance. Treat every configured log root and normalized
ledger root as potentially sensitive.

## Required safeguards

- Keep source JSONL and generated ledgers outside this Git repository.
- Do not commit patient identifiers, case paths, prompts containing protected
  health information, credentials, OAuth artifacts or model-provider secrets.
- Mount or grant source directories read-only whenever the deployment permits.
- Ensure the cloud supervisor appends complete JSONL lines and never rewrites
  earlier lines during an active run.
- Use new source IDs, session IDs and empty log directories for a new formal
  experiment.
- Preserve raw JSONL separately as the audit source of truth.

## Managed-launch safeguards

Managed launch is disabled by default. When it is enabled:

- Store `launch-plans.json`, case templates, runtime registrations and run
  records outside the public repository with least-privilege filesystem access.
- Review each enabled plan locally. Only plan and case IDs are exposed to the
  model; executable paths, argument vectors and source paths are not returned by
  the catalog tool.
- Keep secrets out of command arguments and plan files. Let the trusted
  supervisor obtain credentials through its existing protected environment.
- Every start is routed through Harness's `tools/pre-execute` approval gate and
  also requires the exact confirmation token.
- The launcher uses direct process spawning with `shell: false`; do not replace
  it with interpolation into a command shell.
- Each run copies an allowlisted template into a unique run root. Required
  output/log directories must be empty before the copy.
- Runtime sources must resolve inside the new run root. Path traversal and
  duplicate source IDs fail closed.
- No remote stop or kill capability is exposed. Operational termination remains
  an explicit human administrator action.

The plugin redacts common credential key/value patterns from projected text,
but pattern redaction is defense in depth, not a substitute for keeping secrets
out of agent logs.

## Reasoning boundary

Private reasoning, thinking, signatures and chain-of-thought content are
excluded from the projection. Do not modify this plugin to infer or reconstruct
hidden reasoning from public events.

## Reporting vulnerabilities

Report security concerns privately to the repository owner. Do not attach raw
clinical logs or secrets to a public issue.
