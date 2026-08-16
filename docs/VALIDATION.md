# Validation boundary

## Current package

- Plugin version: `0.3.2`
- Native live projection: `3.2.0`
- Normalized ledger schema: `external-trajectory-ledger-v2`
- Initially accepted Harness revision: `0.1.0-rc.5`, commit
  `47f943859bef60e4160492346772ded9b24f765a`

## Model-free acceptance

The repository regression uses synthetic Codex, Claude and ImplantAgent public
events. It verifies:

- monotonically increasing Request steps;
- every Tool follows a linked assistant request in the same step;
- tool call/result pairing and balanced step/turn closure;
- Codex source timestamps remain null when absent;
- Claude message-ID deduplication and source-derived durations;
- hidden thinking/reasoning content exclusion;
- exact ImplantAgent Preflight plus M1-M6/T01-T13 projection;
- raw MCP tool name, module ID, node ID and duration preservation;
- contiguous append-only ledger sequence and tool transitions;
- deterministic `trajectory_stats` filtering;
- mirrored-session execution guard.

The original local UI acceptance also confirmed that Request rows and linked
Tool drawers survived a full Harness page reload. That result is compatibility
evidence for the tested Harness revision, not a guarantee for future Harness
versions.

## Explicitly not validated by this test

- No Codex, Claude or DeepSeek model is started.
- No clinical/patient case is run.
- No claim about planning quality or clinical correctness is made.
- No cross-agent latency comparison is made when sources lack comparable event
  timestamps.
- No future Harness version is assumed compatible without revalidation.
