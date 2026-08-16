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
