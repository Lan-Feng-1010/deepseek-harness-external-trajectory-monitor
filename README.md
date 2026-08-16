# DeepSeek Harness External Trajectory Monitor

DeepSeek Harness's universal external agent real-time trajectory monitoring plugin. It passively observes publicly exposed JSONL events continuously appended by any external agent process, projects them into Harness's native Trajectory UI, and simultaneously generates a comparable append-only normalized ledger. Codex and Claude use built-in adapters; other agents use the unified `external-agent-event-v1` protocol.

Current plugin version: `0.5.2`<br>
Native real-time projection version: `4.2.0`

> This is an out-of-tree Cordis plugin, not an official DeepSeek component.
> DeepSeek Harness is still pre-release, so compatibility must be revalidated
> after Harness upgrades.

## What it does

- Watches append-only external JSONL logs without launching or controlling the
  evaluated model.
- Accepts any external process through `kind: "generic"` and the canonical
  `external-agent-event-v1` Request/tool event protocol.
- Creates one native Harness session per external run.
- Displays increasing purple `Request #N` rows followed by the linked yellow
  Tool rows, including payload, result, status and Harness append timing.
- Preserves public assistant checkpoints while excluding hidden thinking,
  reasoning content and signatures.
- Writes an append-only normalized ledger with source order/time, observed
  time, request step, tool arguments/results/status/duration and tool
  transitions.
- Provides a deterministic read-only `trajectory_stats` tool so a separate
  DeepSeek monitor agent can answer questions about calls, failures and
  observed recovery without guessing counts from a long transcript.
- Keeps Codex/Claude native parsing and supports optional structured workflow
  overlays supplied explicitly by a source. Such overlays never define the
  generic core and never infer nodes from text or call order.

Harness is an observability layer only. The plugin does not modify prompts,
providers, models, tool allowlists, baselines or agent outputs.

## Evidence model

The plugin keeps three distinct layers:

1. Raw external-agent JSONL is the source of truth and is never
   written back by the plugin.
2. `generated-ledgers/*.normalized.jsonl` is an append-only comparison ledger.
3. Harness Trajectory is the interactive UI projection, not the sole audit
   record.

Codex events without source timestamps retain source-line order and a null
source timestamp. The plugin never substitutes Harness append time for missing
scientific timing.

## Request-to-tool projection

Harness displays a Tool under a Request only when the same step already has a
matching assistant `tool-call` block.

- Claude events are grouped by `message.id`/request ID, not by every streaming
  block. Duplicate blocks are ignored.
- Codex `--json` commonly emits tool start/result before a public
  `agent_message`. The first tool therefore receives an explicitly labelled
  observational request anchor; later public checkpoints are associated with
  the next tool request. This anchor is not hidden chain-of-thought and is not
  represented as verbatim model text.
- Structured module projection is an optional fail-closed overlay. Only exact,
  explicitly registered tool identities may be mapped to fixed workflow nodes;
  free-form agents are never assigned invented nodes.

## Repository layout

```text
src/index.ts                Typed Host plugin and trajectory adapters
src/types.ts                Manifest, event, ledger and adapter contracts
src/client/                 Typed Harness Client UI source
lib/index.js                Prebuilt Host runtime
lib/client.js               Prebuilt Client runtime
lib/types/                  Generated TypeScript declarations
tsconfig*.json              Strict TypeScript source/build configuration
tsdown.config.ts            Official Harness Host/Client bundle configuration
scripts/sanitize-build.ts   Removes local absolute paths from compiled bundles
cordis.patch.yml            Cordis bundle patch
runtime-sources.json        Optional historical import manifest; empty by default
live-sources.json           Active live manifest; empty by default
live-sources.example.json   Generic/Codex/Claude/custom-agent examples
scripts/validate.ts         Synthetic, model-free regression test
docs/                       Monitor-agent and comparison documentation
```

No raw trajectories, case files, generated ledgers, credentials, model weights
or patient data are included in this repository.

## Compatibility

The original acceptance was performed against DeepSeek Harness `0.1.0-rc.5`,
commit `47f943859bef60e4160492346772ded9b24f765a`. The integration uses Harness's
Cordis Host/Client extension shape rather than ACP. At that revision ACP creates
Harness-owned agents; it is not an ingress protocol for an existing external
agent's tool trajectory.

Version `0.5.2` uses TypeScript authoring for both Host and Client. Harness still
loads the compiled JavaScript artifacts. The Cordis row ID, `apply()` entry,
`trajectory_stats` tool and SessionEvent projection remain compatible. Version
`0.5.2` preserves repeated logical call IDs by separating revision/retry
attempts and hot-reloads the live source manifest while retaining the generic
adapter and ledger schema v3.

Relevant upstream documents:

- [DeepSeek Harness architecture](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)
- [Extension cookbook](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/extension-cookbook.md)
- [ACP package contract](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/acp/acp/README.md)

## Configure live sources

Copy `live-sources.example.json` to `live-sources.json`, then replace every
example path with an absolute path on the Harness host.

Important fields:

| Field | Meaning |
| --- | --- |
| `id` | Stable source identity. The example IDs work with monitor-agent aliases. |
| `kind` | `generic`, `codex`, or `claude`; private/custom adapters may define additional kinds. |
| `root` | Directory receiving append-only JSONL files. |
| `cwd` | External agent workspace shown in the mirrored session metadata. |
| `nativeSession` | Create a native Harness Trajectory session when true. |
| `projectionMode` | Optional explicit projection mode for a separately defined structured-workflow adapter. |
| `ledgerRoot` | Directory for append-only normalized ledgers. |

For any non-Codex/Claude process, set `kind` to `generic` and emit the canonical
events documented in [docs/GENERIC_AGENT_PROTOCOL.md](docs/GENERIC_AGENT_PROTOCOL.md).
Each `request_id` becomes one Harness Request step; its tool calls/results appear
as linked yellow rows beneath it.

The cloud supervisor must continuously synchronize complete JSONL lines into
`root`. If it uploads only after completion, the final trajectory remains
viewable but was not observed in real time. Rewriting or deleting earlier lines
during a run violates the append-only contract.

The plugin re-reads `live-sources.json` during monitoring, so a new external
process can be registered without restarting Harness or disturbing an existing
Harness-native run. Existing mirrored sessions are append-only and are not
deleted when a source is removed from the manifest.

`runtime-sources.json` is intentionally empty. It can be used for hash-locked,
read-only historical imports, but historical replay is not required for live
monitoring.

## Install in DeepSeek Harness

The repository contains the required compiled runtime. To rebuild it from the
typed source, use Node.js `^22.19.0 || >=24.0.0` and point `DSH_SOURCE_ROOT` to a
DeepSeek Harness source checkout:

```powershell
pnpm install
$env:DSH_SOURCE_ROOT = 'C:\path\to\deepseek-harness'
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm run validate
```

The source uses the same strict TypeScript safety settings as the official
Harness repository, including implicit-any, unchecked-index and exact-optional
checks.

From the DeepSeek Harness repository, use its CLI and replace the example paths:

```powershell
$env:DSH_HOME = 'C:\path\to\deepseek-harness-data'
node --import tsx/esm apps/cli/src/bin.ts plugin `
  --profile web add 'C:\path\to\deepseek-harness-external-trajectory-monitor'
```

The bundle patch uses the manifests beside the plugin. It does not replace the
profile's model or provider configuration.

After installation, start Harness normally and open its web UI. Select an
`[External ...]` session and open `Trajectory`. The expected order is:

```text
Request #1
  Tool A
  Tool B
Request #2
  Tool C
```

Select `[Live Monitor] External agents` and open the observable
reasoning page for the cross-agent execution/error comparison.

## Model-free validation

The regression test uses synthetic public events only:

```powershell
npm run validate
```

It verifies generic-agent Request/tool projection, increasing request steps,
assistant-to-tool linkage, Codex source time nullability, Claude message
deduplication and durations, hidden-thinking exclusion, fail-closed structured
workflow mapping, ledger sequence/tool transitions, deterministic statistics
and the read-only session guard. It does not call Codex, Claude, DeepSeek or a
patient-case pipeline.

See [docs/VALIDATION.md](docs/VALIDATION.md) for the acceptance boundary.

## DeepSeek monitor-agent role

The plugin registers `trajectory_stats`. A normal, separate Harness agent may
call it to explain deterministic counts such as:

- number of calls by agent or case;
- failures grouped by observable error category;
- later successful calls of the same tool (observed recovery);
- tool-name filters and bounded error examples.

The DeepSeek model interprets returned statistics. It does not control the
external agents, and the protected mirrored sessions reject agent execution.
See [docs/MONITOR_AGENT.md](docs/MONITOR_AGENT.md).

### Copy-paste read-only live-monitor prompt

Create a new, ordinary DeepSeek Harness session for this prompt. Do not paste
it into `[Live Monitor] External agents`, because mirrored sessions are
read-only projections and reject model steps. Replace the three placeholders
before use.

```text
You are a read-only observability supervisor for two external agent runs. You
are not a planning agent and must not execute, control, restart, stop, or send
feedback to either external agent.

Monitor only these sources and case:
- Source A: <SOURCE_ID_A>
- Source B: <SOURCE_ID_B>
- Case: <CASE_ID>

Immediately call trajectory_stats separately for Source A and Source B with
case_id=<CASE_ID> and include_errors=true. Use only the deterministic fields
returned by trajectory_stats. Do not read or reconstruct hidden
chain-of-thought.

If a timer or wait tool is available, take another snapshot every 60 seconds
for up to 120 minutes. Otherwise, take one snapshot, clearly label it as a
point-in-time view, and tell the user to run this prompt again for an update.

On each snapshot, compare with the previous snapshot. Report only when values
change, using a compact table with: total tool calls, successful, failed,
pending, unique tools, failure rate, recovered errors, unrecovered errors,
average recovery tool steps, tool counts, and error categories. Include bounded
error examples only when useful for debugging.

If a source is unknown or has no imported events yet, report "not yet observed"
rather than "failed", and continue waiting. Never infer completion from silence,
unchanged counts, or pending=0. Claim that a run finished only when an explicit
terminal status is available in the imported public record; otherwise write
"terminal status unverified". trajectory_stats does not by itself establish
tool order, tool transitions, the last public event, source-event timing, or a
terminal state. Do not invent any of them. Direct the user to `[Live Monitor]
External agents` for the full Request-to-Tool order.

Stop when both sources have explicit terminal states or after 120 minutes. Then
produce a final comparison of tool-use counts, failures, observed recoveries,
unrecovered errors, and error categories. Clearly separate deterministic plugin
statistics from your interpretation, and label terminal status as unverified
unless a separate explicit public terminal record is available. Do not modify
files, logs, plugin configuration, sessions, models, providers, prompts, or
baselines.
```

## Limitations

- Only events already written and synchronized are observable.
- Network/file-sync delay is not model latency.
- Harness Tool drawer timing is projection timing; scientific timing must use
  source timestamps/durations in the ledger.
- Tool execution success is not clinical correctness.
- “Observed recovery” means a later success for the same normalized tool; it is
  not proof that the root cause was fixed.
- Free-form agent milestones are not equivalent to fixed workflow nodes.
- Hidden chain-of-thought is intentionally unavailable and must not be
  reconstructed.

## Security and data handling

Review [SECURITY.md](SECURITY.md) before pointing the plugin at real logs. The
repository is configured to ignore JSONL, generated ledgers, log files and
environment files. Keep raw clinical trajectories and credentials outside the
repository.
