# Managed external preexperiments

This optional layer lets one DeepSeek Harness session request and observe an
external-agent preexperiment without making DeepSeek the evaluated agent.

## Trust boundary

DeepSeek supplies only three fields: an enabled `plan_id`, an allowlisted
`case_id`, and the exact confirmation token. The local launch plan fixes the
executable, argument vector, working directory, prepared case template,
provider/model metadata and observable source roots. A Harness
`tools/pre-execute` hook returns `ask` for every start, so a person must approve
the call.

The child process is the trusted supervisor. It may start Codex, Claude,
ImplantAgent or another external agent according to its existing configuration.
The plugin does not insert messages into the external run and does not alter its
provider, model, prompt, tools or baseline.

## Lifecycle

1. `external_preexperiment_catalog` returns enabled plan labels, case IDs and
   non-sensitive source metadata.
2. `external_preexperiment_start` validates the selection and concurrent-run
   limit. A global managed-run lock also rejects a second plan while any first
   plan is still running.
3. The plugin verifies required template paths and empty runtime directories.
4. It copies the template to a unique child of `runRootBase`.
5. It expands source paths, verifies that they stay inside the fresh run root,
   and writes an atomic runtime-registration descriptor.
6. It writes an initial managed-run record and directly spawns the predeclared
   executable with `shell: false`. On Windows, the child is deliberately not
   created with Node's detached-process flag because detached Windows
   PowerShell 5.1 can return zero without executing the requested script.
7. The live monitor hot-loads the registration and projects complete JSONL
   lines as they appear.
8. After process exit, every optional `completionPaths` entry must exist under
   the fresh run root before an exit code of zero is accepted as `completed`.
9. `external_preexperiment_status` reports launcher state and source-root
   presence. The append-only JSONL and normalized ledger remain the evidence for
   actual external-agent behavior.

## Plan contract

Use `launch-plans.example.json` as a schema example. Keep the operational plan
outside the repository. Supported template tokens are:

- `{plan_id}`
- `{case_id}`
- `{run_id}`
- `{run_root}`
- `{template_root}`

Every expanded source root, working directory and ledger root must stay inside
`{run_root}`. Plans with unsupported tokens, unsafe relative paths, missing
required files or non-empty template runtime directories are rejected before a
child process starts.

`completionPaths` is an optional array of safe paths relative to `{run_root}`.
Use it for supervisor-written terminal summaries or completion markers. A
zero-exit launcher that produces none of the declared artifacts is recorded as
`failed`, preventing a wrapper no-op from being reported as a successful run.

Use separate enabled plans for Codex-only, Claude-only, ImplantAgent-only and
any reviewed fixed sequence. These are choices, not prerequisites: one agent's
plan does not gate another. Arbitrary ordering is supported by starting a
single-agent plan only after the previous single-agent plan reaches a terminal
state; global serialization prevents accidental overlap.

## What automatic means

After the one approved start, source registration and live observation are
automatic. The plugin intentionally does not auto-start a clinical/model run
merely because a new folder appears; that would bypass case selection and human
approval. To add a new case, prepare a clean allowlisted template and add its
case ID to the protected operational plan.

## Interpretation limits

- `running`, `completed` and `failed` describe the trusted supervisor process;
  `completed` also requires all configured completion artifacts.
- Tool success does not establish clinical correctness.
- JSONL synchronization delay is not model latency.
- Hidden chain-of-thought is neither available nor reconstructed.
- DeepSeek summaries are interpretations of public records; deterministic
  counts should come from `trajectory_stats`.
