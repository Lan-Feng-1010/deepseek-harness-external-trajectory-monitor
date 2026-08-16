# DeepSeek Harness External Trajectory Monitor

DeepSeek Harness's universal external-agent launch and real-time trajectory monitoring plugin. It can passively observe any registered append-only JSONL source, or—when explicitly enabled—ask for human approval and start a preconfigured trusted supervisor. It projects public events into Harness's native Trajectory UI and generates a comparable append-only normalized ledger. Codex and Claude use built-in adapters; other agents use the unified `external-agent-event-v1` protocol.

Current plugin version: `0.6.1`<br>
Native real-time projection version: `4.3.0`

> This is an out-of-tree Cordis plugin, not an official DeepSeek component.
> DeepSeek Harness is still pre-release, so compatibility must be revalidated
> after Harness upgrades.

## What it does

- Watches append-only external JSONL logs without altering the evaluated agent.
- Optionally exposes an allowlisted, human-approved launcher that creates a
  fresh run directory, starts a trusted external supervisor, and registers the
  new sources before the child process begins writing events.
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

Harness remains the control/observability layer. The evaluated work is still
performed by the external Codex, Claude, ImplantAgent or generic process. The
plugin does not modify prompts, providers, models, external tool allowlists,
baselines or agent outputs.

## Two operating modes

1. **Monitor only (default):** edit `live-sources.json` or add runtime
   registrations from another trusted process. No launch tools are registered.
2. **Managed preexperiment (optional):** set `enableLaunchTools: true` and
   configure a local `launch-plans.json`. DeepSeek can list plans, request one
   allowlisted case, inspect status and query statistics. The actual executable,
   arguments, source paths, provider/model configuration and case template are
   fixed in the local plan and cannot be supplied by the model.

Every managed start is intercepted by Harness's tool approval hook. The plugin
does not provide a stop/kill tool and never invokes a shell string; it spawns the
predeclared executable with a fixed argument vector.

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
src/launch.ts               Allowlisted managed-launch and registration layer
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
launch-plans.json           Disabled-by-default local launch manifest
launch-plans.example.json   Generic managed-preexperiment example
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

Version `0.6.1` uses TypeScript authoring for both Host and Client. Harness still
loads the compiled JavaScript artifacts. The Cordis row ID, `apply()` entry,
`trajectory_stats` tool and SessionEvent projection remain compatible. Version
`0.6.1` adds optional managed external preexperiment tools and globally
serializes managed runs across plans, while preserving
repeated logical call IDs, the generic adapter and ledger schema v3.

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

## Configure managed preexperiments

Managed launch is disabled in the publishable package. Copy
`launch-plans.example.json` to a protected operational location, keep its
`enabled` flag false until the template and supervisor have been reviewed, and
configure the plugin with absolute paths:

```yaml
- insert:
    - id: external-trajectory-importer
      name: 'dsh-external-trajectory-importer'
      config:
        enableLaunchTools: true
        launchPlansPath: 'C:\agent-data\launch-plans.json'
        runtimeRegistrationRoot: 'C:\agent-data\runtime-registrations'
        runRegistryRoot: 'C:\agent-data\managed-runs'
```

The case template must contain all required inputs and empty runtime output/log
directories. A start copies that template into a unique directory below
`runRootBase`; the template itself is never used as the run directory. Runtime
registrations are hot-loaded into the live monitor, so a newly launched case
appears without restarting Harness. See
[docs/MANAGED_PREEXPERIMENTS.md](docs/MANAGED_PREEXPERIMENTS.md).

Agent choice is represented by enabled local plans. A deployment may expose
separate Codex-only, Claude-only and ImplantAgent-only plans plus reviewed
fixed-order plans. Starting a single-agent plan does not require either of the
other agents to be available. To choose an arbitrary order without creating
every permutation, start one single-agent plan, wait until its managed record
is terminal, then start the next. The launcher rejects overlap across all plans
so evaluated processes do not share a managed run window.

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

Select `[Live Control + Monitor] External agents`. In that single session you
can ask DeepSeek to list/start an allowlisted preexperiment, inspect managed-run
status, and calculate deterministic trajectory statistics. Open the observable
reasoning page for the complete cross-agent Request/tool order.

## Model-free validation

The regression test uses synthetic public events only:

```powershell
npm run validate
```

It verifies generic-agent Request/tool projection, increasing request steps,
assistant-to-tool linkage, Codex source time nullability, Claude message
deduplication and durations, hidden-thinking exclusion, fail-closed structured
workflow mapping, ledger sequence/tool transitions, deterministic statistics
and session guards. It also starts a short local Node fixture through the
managed-launch path to verify fresh-directory copying, approval gating, runtime
registration and terminal status. It does not call Codex, Claude, DeepSeek or a
patient-case pipeline.

See [docs/VALIDATION.md](docs/VALIDATION.md) for the acceptance boundary.

## DeepSeek launcher/monitor-agent role

With managed launch enabled, the plugin registers four tools:

- `external_preexperiment_catalog`: show enabled plans and allowlisted cases;
- `external_preexperiment_start`: request a human-approved start;
- `external_preexperiment_status`: read launcher and source-registration state;
- `trajectory_stats`: compute deterministic execution/error statistics.

The combined monitor session may call only these tools. DeepSeek may interpret
their results, but it cannot provide a command, alter an external agent, or write
into an evaluated trajectory.

- number of calls by agent or case;
- failures grouped by observable error category;
- later successful calls of the same tool (observed recovery);
- tool-name filters and bounded error examples.

The DeepSeek model interprets returned statistics. It does not control the
external agents, and the protected mirrored sessions reject agent execution.
See [docs/MONITOR_AGENT.md](docs/MONITOR_AGENT.md).

### Copy-paste managed preexperiment prompt

Paste this into `[Live Control + Monitor] External agents`. Replace the two
placeholders with values shown by the catalog tool.

```text
You are the launcher and read-only observability supervisor for external-agent
preexperiments. The evaluated work must be performed by the trusted external
Codex/Claude/other-agent supervisor, not by you.

1. Call external_preexperiment_catalog.
2. Select only the plan requested by the user (for example Codex-only,
   Claude-only, ImplantAgent-only, or an allowlisted fixed sequence). Verify
   that plan <PLAN_ID> and case <CASE_ID> are listed. If either is not
   allowlisted, stop and report that without trying another tool.
3. Call external_preexperiment_start exactly once with that plan_id, case_id,
   and confirmation="START_EXTERNAL_PREEXPERIMENT". Wait for the Harness human
   approval dialog. Do not claim the run started unless the tool returns a
   managed run record.
4. Call external_preexperiment_status for the returned run_id. Summarize only
   public launcher state. Use trajectory_stats for deterministic tool counts and
   errors once sources emit events.

If the user requested another agent afterward, wait until the first run is
terminal, then repeat steps 1-4 with that agent's single-agent plan. Never start
two plans concurrently.

Never use terminal, filesystem, code-execution, network, or unrelated tools.
Never alter model/provider settings, prompts, tools, baselines, case inputs, or
source JSONL. Do not expose or reconstruct hidden chain-of-thought. The full
Request-to-Tool order is shown in this session's observable trajectory view.
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
- A managed launcher state of `completed` means the trusted supervisor process
  exited successfully; it does not establish clinical or scientific success.

## Security and data handling

Review [SECURITY.md](SECURITY.md) before pointing the plugin at real logs. The
repository is configured to ignore JSONL, generated ledgers, log files and
environment files. Keep raw clinical trajectories and credentials outside the
repository.
