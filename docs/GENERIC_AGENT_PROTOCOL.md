# Generic external-agent JSONL protocol

Plugin `0.5.0` accepts any external agent process through `kind: "generic"`.
Codex and Claude may continue using their native adapters. ImplantAgent's
M1-M6/T01-T13 display is an optional projection overlay and is not the core
protocol.

## Transport boundary

The external supervisor owns the process and appends complete UTF-8 JSON
objects, one per line, to a file under the configured `root`. The plugin reads
the file every two seconds. It never launches, pauses or changes the agent.

Every event must use `schema_version: "external-agent-event-v1"` and a supported
`event_type`. `timestamp` is optional. When absent, source order is retained and
the ledger records a null source timestamp. Harness observation time is not
substituted for missing source time.

## Event sequence

One run uses this order:

```text
run_started
request_started
  assistant_message (optional)
  tool_call -> tool_result (zero or more pairs)
request_completed (optional)
request_started
  ...
run_completed | run_failed
```

The plugin fails closed when a tool result has no preceding call, an event
references a different active request, a new request starts with open calls,
or an unknown event type/schema appears.

### Run start

```json
{"schema_version":"external-agent-event-v1","event_type":"run_started","timestamp":"2026-08-15T10:00:00.000Z"}
```

### Request

`request_id` must be stable and unique within the run. `public_message` is
observable model output or a clearly labelled controller-generated public
summary; it must never contain hidden chain-of-thought.

```json
{"schema_version":"external-agent-event-v1","event_type":"request_started","request_id":"req-1","public_message":"Inspect the available inputs, then validate them.","timestamp":"2026-08-15T10:00:01.000Z"}
```

An optional later public message for the same request is:

```json
{"schema_version":"external-agent-event-v1","event_type":"assistant_message","request_id":"req-1","public_message":"The inputs passed structural validation.","timestamp":"2026-08-15T10:00:02.000Z"}
```

### Tool call and result

`call_id` is stable within the run. `arguments` and `result` may be JSON values
or strings. The plugin redacts common credential fields before projection.

```json
{"schema_version":"external-agent-event-v1","event_type":"tool_call","request_id":"req-1","call_id":"call-1","tool_name":"validate_inputs","arguments":{"case":"CASE_001"},"timestamp":"2026-08-15T10:00:03.000Z"}
{"schema_version":"external-agent-event-v1","event_type":"tool_result","request_id":"req-1","call_id":"call-1","status":"success","result":{"valid":true},"duration_ms":1250,"timestamp":"2026-08-15T10:00:04.250Z"}
```

Optional comparison metadata may be supplied either at the top level or under
`metadata`: `module_id`, `node_id`, `raw_tool_name`, `invocation_index`, and
`retry_index`. These are source labels; the generic adapter does not infer
nodes from text or call order.

### Request and run completion

```json
{"schema_version":"external-agent-event-v1","event_type":"request_completed","request_id":"req-1","timestamp":"2026-08-15T10:00:05.000Z"}
{"schema_version":"external-agent-event-v1","event_type":"run_completed","status":"completed","message":"External run completed","timestamp":"2026-08-15T10:00:06.000Z"}
```

Use `run_failed` plus `status: "failed"` for a terminal failure.

## Harness projection

Each new `request_id` becomes the next Harness `Request #N`. Its tool calls and
results are projected as linked yellow Tool rows under that request. Raw JSONL
remains the source of truth; the append-only normalized ledger is the
comparison layer; Harness is the interactive projection.
