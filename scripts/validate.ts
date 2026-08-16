import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  appendNativeLiveRecords,
  buildMonitorStats,
  initializeNativeLiveSession,
  loadLiveManifest,
  loadManifest,
  NATIVE_LIVE_PROJECTION_VERSION,
  NORMALIZED_LEDGER_SCHEMA,
  readonlyImportedSessionGuard,
  unflushedNativeLedgerRecords,
} from 'dsh-external-trajectory-importer'

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = dirname(here)
const packageMetadata = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')) as { version: string }

class MockSession {
  readonly id: string
  readonly events: any[]
  clock: number

  constructor(id: string) {
    this.id = id
    this.events = []
    this.clock = 1_000
  }

  append(type: string, data: any, envelope: Record<string, unknown> = {}) {
    const event = {
      type,
      seq: this.events.length,
      time: this.clock,
      data,
      ...envelope,
    }
    this.clock += 1
    this.events.push(event)
    return event
  }
}

function jsonlRecords(values: any[]) {
  return values.map((value: any, index: number) => ({ line: index + 1, value }))
}

function validateRelationalEvents(events: any[]): void {
  let openTurn = null
  let openStep = null
  const openCalls = new Set()
  for (const [index, event] of events.entries()) {
    assert.equal(event.seq, index, `event ${index} has non-contiguous seq`)
    assert.ok(Number.isSafeInteger(event.time) && event.time >= 0)
    if (event.type === 'turn/start') {
      assert.equal(openTurn, null)
      openTurn = event.data.turn
    } else if (event.type === 'turn/end') {
      assert.equal(openStep, null)
      assert.equal(openTurn, event.data.turn)
      openTurn = null
    } else if (event.type === 'step/start') {
      assert.equal(openStep, null)
      assert.equal(openTurn, event.data.turn)
      openStep = event.data.step
    } else if (event.type === 'step/end') {
      assert.equal(openTurn, event.data.turn)
      assert.equal(openStep, event.data.step)
      openStep = null
      openCalls.clear()
    } else if (event.type === 'tool/call') {
      assert.equal(openTurn, event.data.turn)
      assert.equal(openStep, event.data.step)
      assert.ok(!openCalls.has(event.data.callId))
      openCalls.add(event.data.callId)
    } else if (event.type === 'tool/result') {
      const callId = event.data.message.source.callId
      assert.ok(openCalls.has(callId), `result lacks open call ${callId}`)
      openCalls.delete(callId)
    } else if (event.type === 'assistant/message') {
      assert.equal(openTurn, event.data.turn)
      assert.equal(openStep, event.data.step)
      assert.ok(event.data.message.content.every((block: any) => block.type !== 'reasoning'))
    }
  }
  assert.equal(openTurn, null)
  assert.equal(openStep, null)
  assert.equal(openCalls.size, 0)
}

function assertEveryToolFollowsLinkedAssistant(events: any[]): void {
  const linkedAt = new Map()
  for (const [index, event] of events.entries()) {
    if (event.type === 'assistant/message') {
      for (const block of event.data.message.content) {
        if (block.type === 'tool-call') {
          linkedAt.set(block.id, {
            index,
            turn: event.data.turn,
            step: event.data.step,
          })
        }
      }
      continue
    }
    if (event.type !== 'tool/call') continue
    const link = linkedAt.get(event.data.callId)
    assert.ok(link, `tool ${event.data.callId} lacks assistant link`)
    assert.ok(link.index < index)
    assert.equal(link.turn, event.data.turn)
    assert.equal(link.step, event.data.step)
  }
}

const historicalManifest = await loadManifest(join(packageRoot, 'runtime-sources.json'))
const liveManifest = await loadLiveManifest(join(packageRoot, 'live-sources.json'))
const exampleManifest = await loadLiveManifest(join(packageRoot, 'live-sources.example.json'))
assert.deepEqual(historicalManifest.sessions, [])
assert.deepEqual(liveManifest.sources, [])
assert.equal(exampleManifest.sources.length, 5)
assert.deepEqual(exampleManifest.sources.map(source => source.id), [
  'my-external-agent',
  'implantagent-external',
  'implantagent-v08-trace',
  'codex-only',
  'claude-only',
])
assert.ok(exampleManifest.sources.every(source => source.cwd.startsWith('C:\\agent-workspaces\\')))
const publishableText = await Promise.all([
  'src/index.ts',
  'lib/index.js',
  'lib/client.js',
  'tsdown.config.ts',
  'README.md',
  'docs/GENERIC_AGENT_PROTOCOL.md',
].map(path => readFile(join(packageRoot, path), 'utf8')))
const forbiddenLocalFragments = [
  ['HUA', 'WEI'].join(''),
  ['C01', '_'].join(''),
  ['F:', '\\'].join(''),
  packageRoot,
]
assert.ok(publishableText.every(text => forbiddenLocalFragments.every(fragment => !text.includes(fragment))))

const codexSession = new MockSession('session-external-trajectory-native-validation-codex')
const codexState = initializeNativeLiveSession(codexSession, {
  id: 'codex-only',
  label: 'Codex',
  kind: 'codex',
  provider: 'codex-cli',
  model: 'fixture-no-model',
  root: 'C:\\fixture-logs\\codex',
  cwd: 'C:\\fixture-workspaces\\codex',
  suffix: '_events.jsonl',
  nativeSession: true,
  projectionMode: 'default',
  ledgerRoot: 'C:\\fixture-ledgers\\codex',
}, 'C:\\fixture-logs\\codex\\CASE_001_events.jsonl', 'CASE_001')
appendNativeLiveRecords(codexState, jsonlRecords([
  { type: 'item.started', item: { id: 'codex-tool-1', type: 'command_execution', command: 'inspect-input', status: 'in_progress' } },
  { type: 'item.completed', item: { id: 'codex-tool-1', type: 'command_execution', command: 'inspect-input', aggregated_output: 'input-ok', exit_code: 0, status: 'completed' } },
  { type: 'item.completed', item: { id: 'codex-message-1', type: 'agent_message', text: 'Public checkpoint one.' } },
  { type: 'item.started', item: { id: 'codex-tool-2', type: 'file_change', changes: [{ path: 'plan.json', kind: 'add' }], status: 'in_progress' } },
  { type: 'item.completed', item: { id: 'codex-tool-2', type: 'file_change', changes: [{ path: 'plan.json', kind: 'add' }], status: 'completed' } },
  { type: 'item.completed', item: { id: 'codex-message-2', type: 'agent_message', text: 'Public checkpoint two.' } },
  { type: 'turn.completed', usage: { input_tokens: 0, output_tokens: 0 } },
]))
validateRelationalEvents(codexSession.events)
assertEveryToolFollowsLinkedAssistant(codexSession.events)
assert.deepEqual(
  codexSession.events.filter(event => event.type === 'step/start').map(event => event.data.step),
  [1, 2, 3],
)
const codexLedger = unflushedNativeLedgerRecords(codexState)
assert.ok(codexLedger.every(row => row.schema_version === NORMALIZED_LEDGER_SCHEMA))
assert.ok(codexLedger.every(row => row.source_timestamp === null))
assert.equal(codexLedger.filter(row => row.event_type === 'tool_call').length, 2)
assert.equal(codexLedger.filter(row => row.event_type === 'tool_result').length, 2)
assert.ok(codexLedger.some(row => row.event_type === 'tool_transition'))

const claudeSession = new MockSession('session-external-trajectory-native-validation-claude')
const claudeState = initializeNativeLiveSession(claudeSession, {
  id: 'claude-only',
  label: 'Claude',
  kind: 'claude',
  provider: 'claude-cli',
  model: 'fixture-no-model',
  root: 'C:\\fixture-logs\\claude',
  cwd: 'C:\\fixture-workspaces\\claude',
  suffix: '_events.jsonl',
  nativeSession: true,
  projectionMode: 'default',
  ledgerRoot: 'C:\\fixture-ledgers\\claude',
}, 'C:\\fixture-logs\\claude\\CASE_001_events.jsonl', 'CASE_001')
const duplicatedClaudeMessage = {
  type: 'assistant',
  timestamp: '2026-08-15T10:00:00.000Z',
  message: {
    id: 'claude-message-1',
    content: [
      { type: 'text', text: 'Claude public checkpoint one.' },
      { type: 'tool_use', id: 'claude-tool-1', name: 'Bash', input: { command: 'inspect-input' } },
    ],
  },
}
appendNativeLiveRecords(claudeState, jsonlRecords([
  duplicatedClaudeMessage,
  duplicatedClaudeMessage,
  { type: 'user', timestamp: '2026-08-15T10:00:01.500Z', message: { content: [
    { type: 'tool_result', tool_use_id: 'claude-tool-1', content: 'input-ok', is_error: false },
  ] } },
  { type: 'assistant', timestamp: '2026-08-15T10:00:02.000Z', message: { id: 'claude-message-2', content: [
    { type: 'thinking', thinking: 'private content must not be projected' },
    { type: 'text', text: 'Claude public checkpoint two.' },
  ] } },
  { type: 'assistant', timestamp: '2026-08-15T10:00:03.000Z', message: { id: 'claude-message-3', content: [
    { type: 'text', text: 'Claude public checkpoint three.' },
    { type: 'tool_use', id: 'claude-tool-2', name: 'Write', input: { file_path: 'plan.json' } },
  ] } },
  { type: 'user', timestamp: '2026-08-15T10:00:04.250Z', message: { content: [
    { type: 'tool_result', tool_use_id: 'claude-tool-2', content: 'write-ok', is_error: false },
  ] } },
  { type: 'result', subtype: 'success', is_error: false, terminal_reason: 'completed', timestamp: '2026-08-15T10:00:05.000Z' },
]))
validateRelationalEvents(claudeSession.events)
assertEveryToolFollowsLinkedAssistant(claudeSession.events)
assert.equal(claudeSession.events.filter(event => event.type === 'assistant/message').length, 3)
assert.ok(!JSON.stringify(claudeSession.events).includes('private content must not be projected'))
const claudeLedger = unflushedNativeLedgerRecords(claudeState)
assert.equal(claudeLedger.filter(row => row.event_type === 'tool_call').length, 2)
assert.deepEqual(
  claudeLedger.filter(row => row.event_type === 'tool_result').map(row => row.duration_ms),
  [1500, 1250],
)

const genericSession = new MockSession('session-external-trajectory-native-validation-generic')
const genericState = initializeNativeLiveSession(genericSession, {
  id: 'my-external-agent',
  label: 'My external agent',
  kind: 'generic',
  provider: 'external-process',
  model: 'fixture-no-model',
  root: 'C:\\fixture-logs\\generic',
  cwd: 'C:\\fixture-workspaces\\generic',
  suffix: '.jsonl',
  nativeSession: true,
  projectionMode: 'default',
  ledgerRoot: 'C:\\fixture-ledgers\\generic',
}, 'C:\\fixture-logs\\generic\\CASE_GENERIC.jsonl', 'CASE_GENERIC')
appendNativeLiveRecords(genericState, jsonlRecords([
  { schema_version: 'external-agent-event-v1', event_type: 'run_started', timestamp: '2026-08-15T11:00:00.000Z' },
  { schema_version: 'external-agent-event-v1', event_type: 'request_started', request_id: 'req-1', public_message: 'Inspect and validate the input.', timestamp: '2026-08-15T11:00:01.000Z' },
  { schema_version: 'external-agent-event-v1', event_type: 'tool_call', request_id: 'req-1', call_id: 'call-1', tool_name: 'validate_inputs', arguments: { case: 'CASE_GENERIC' }, timestamp: '2026-08-15T11:00:02.000Z', metadata: { module_id: 'INPUT', node_id: 'VALIDATE', invocation_index: 1, retry_index: 0 } },
  { schema_version: 'external-agent-event-v1', event_type: 'tool_result', request_id: 'req-1', call_id: 'call-1', status: 'success', result: { valid: true }, duration_ms: 1250, timestamp: '2026-08-15T11:00:03.250Z' },
  { schema_version: 'external-agent-event-v1', event_type: 'assistant_message', request_id: 'req-1', public_message: 'Input validation completed.', timestamp: '2026-08-15T11:00:03.500Z' },
  { schema_version: 'external-agent-event-v1', event_type: 'request_completed', request_id: 'req-1', timestamp: '2026-08-15T11:00:04.000Z' },
  { schema_version: 'external-agent-event-v1', event_type: 'request_started', request_id: 'req-2', public_message: 'Write the normalized output.', timestamp: '2026-08-15T11:00:05.000Z' },
  { schema_version: 'external-agent-event-v1', event_type: 'tool_call', request_id: 'req-2', call_id: 'call-2', tool_name: 'write_output', arguments: { path: 'result.json' }, timestamp: '2026-08-15T11:00:06.000Z' },
  { schema_version: 'external-agent-event-v1', event_type: 'tool_result', request_id: 'req-2', call_id: 'call-2', status: 'error', result: { error: 'synthetic write failure' }, duration_ms: 500, timestamp: '2026-08-15T11:00:06.500Z' },
  { schema_version: 'external-agent-event-v1', event_type: 'run_failed', status: 'failed', message: 'Synthetic generic run failed.', timestamp: '2026-08-15T11:00:07.000Z' },
]))
validateRelationalEvents(genericSession.events)
assertEveryToolFollowsLinkedAssistant(genericSession.events)
assert.deepEqual(
  genericSession.events.filter(event => event.type === 'step/start').map(event => event.data.step),
  [1, 2],
)
const genericCalls = genericSession.events.filter(event => event.type === 'tool/call')
assert.equal(genericCalls.length, 2)
assert.equal(genericCalls[0]?.data.meta.moduleId, 'INPUT')
assert.equal(genericCalls[0]?.data.meta.nodeId, 'VALIDATE')
const genericLedger = unflushedNativeLedgerRecords(genericState)
assert.ok(genericLedger.every(row => row.agent === 'generic'))
assert.equal(genericLedger.filter(row => row.event_type === 'tool_call').length, 2)
assert.deepEqual(genericLedger.filter(row => row.event_type === 'tool_result').map(row => row.duration_ms), [1250, 500])
assert.equal(genericLedger.filter(row => row.event_type === 'run_terminal').length, 1)
assert.throws(() => {
  const invalidState = initializeNativeLiveSession(new MockSession('session-external-trajectory-native-validation-generic-invalid'), {
    ...genericState.source,
    id: 'generic-invalid',
  }, 'C:\\fixture-logs\\generic\\INVALID.jsonl', 'INVALID')
  appendNativeLiveRecords(invalidState, jsonlRecords([
    { schema_version: 'external-agent-event-v1', event_type: 'request_started', request_id: 'req-1', public_message: 'Invalid result fixture.' },
    { schema_version: 'external-agent-event-v1', event_type: 'tool_result', request_id: 'req-1', call_id: 'missing-call', status: 'success', result: {} },
  ]))
}, /lacks call/)

const implantTraceSession = new MockSession('session-external-trajectory-native-validation-implantagent-trace')
const implantTraceState = initializeNativeLiveSession(implantTraceSession, {
  id: 'implantagent-v08-trace',
  label: 'ImplantAgent v0.8',
  kind: 'implantagent-trace',
  provider: 'codex-cli-supervisor',
  model: 'fixture-no-model',
  root: 'C:\\fixture-logs\\implantagent-v08',
  cwd: 'C:\\fixture-workspaces\\implantagent-v08',
  suffix: '.events.jsonl',
  nativeSession: true,
  projectionMode: 'default',
  ledgerRoot: 'C:\\fixture-ledgers\\implantagent-v08',
}, 'C:\\fixture-logs\\implantagent-v08\\implantagent-CASE_V08.events.jsonl', 'CASE_V08')
appendNativeLiveRecords(implantTraceState, jsonlRecords([
  { sequence: 1, observed_at: '2026-08-15T12:00:00.000Z', run_id: 'run-v08', case_id: 'CASE_V08', event_type: 'run_started' },
  { sequence: 2, observed_at: '2026-08-15T12:00:01.000Z', run_id: 'run-v08', case_id: 'CASE_V08', event_type: 'request_started', request_id: 'run-v08:request:1', module_id: 'M1', allowed_tool_ids: ['T01'] },
  { sequence: 3, observed_at: '2026-08-15T12:00:01.100Z', run_id: 'run-v08', case_id: 'CASE_V08', event_type: 'action_selected', request_id: 'run-v08:request:1', module_id: 'M1', action: 'call_tool', tool_id: 'T01', public_reason: 'Load trusted segmentations.' },
  { sequence: 4, observed_at: '2026-08-15T12:00:01.200Z', run_id: 'run-v08', case_id: 'CASE_V08', event_type: 'tool_call', request_id: 'run-v08:request:1', module_id: 'M1', tool_id: 'T01', call_id: 'run-v08:T01:r0', raw_tool_name: 'node_runtime_tools.t01_segmentation_runtime.run_t01_segmentation_selection', arguments_summary: { toothfairy3_path: 'redacted-fixture.nii.gz' }, retry_index: 0, invocation_count: 1 },
  { sequence: 5, observed_at: '2026-08-15T12:00:01.500Z', run_id: 'run-v08', case_id: 'CASE_V08', event_type: 'tool_result', request_id: 'run-v08:request:1', module_id: 'M1', tool_id: 'T01', call_id: 'run-v08:T01:r0', status: 'completed', duration_ms: 300, result_summary: { selected: true } },
  { sequence: 6, observed_at: '2026-08-15T12:00:02.000Z', run_id: 'run-v08', case_id: 'CASE_V08', event_type: 'request_started', request_id: 'run-v08:request:2', module_id: 'M2', allowed_tool_ids: ['T02'] },
  { sequence: 7, observed_at: '2026-08-15T12:00:02.100Z', run_id: 'run-v08', case_id: 'CASE_V08', event_type: 'action_selected', request_id: 'run-v08:request:2', module_id: 'M2', action: 'call_tool', tool_id: 'T02', public_reason: 'Generate candidate sites.' },
  { sequence: 8, observed_at: '2026-08-15T12:00:02.200Z', run_id: 'run-v08', case_id: 'CASE_V08', event_type: 'tool_call', request_id: 'run-v08:request:2', module_id: 'M2', tool_id: 'T02', call_id: 'run-v08:T02:r0', raw_tool_name: 'node_runtime_tools.t02_candidate_runtime.run_t02_candidate_generation', arguments_summary: {}, retry_index: 0, invocation_count: 1 },
  { sequence: 9, observed_at: '2026-08-15T12:00:02.600Z', run_id: 'run-v08', case_id: 'CASE_V08', event_type: 'tool_result', request_id: 'run-v08:request:2', module_id: 'M2', tool_id: 'T02', call_id: 'run-v08:T02:r0', status: 'technical_failure', duration_ms: 400, error_type: 'FixtureError', error_message: 'Synthetic fixture failure.' },
  { sequence: 10, observed_at: '2026-08-15T12:00:03.000Z', run_id: 'run-v08', case_id: 'CASE_V08', event_type: 'run_finished', status: 'technical_failure', finish_reason: 'T02_technical_failure' },
]))
validateRelationalEvents(implantTraceSession.events)
assertEveryToolFollowsLinkedAssistant(implantTraceSession.events)
assert.deepEqual(
  implantTraceSession.events.filter(event => event.type === 'step/start').map(event => event.data.step),
  [1, 2],
)
const implantTraceCalls = implantTraceSession.events.filter(event => event.type === 'tool/call')
assert.equal(implantTraceCalls.length, 2)
assert.match(implantTraceCalls[0]?.data.name, /^T01 ·/)
assert.equal(implantTraceCalls[0]?.data.meta.moduleId, 'M1')
assert.equal(implantTraceCalls[1]?.data.meta.nodeId, 'T02')
const implantTraceLedger = unflushedNativeLedgerRecords(implantTraceState)
assert.equal(implantTraceLedger.filter(row => row.event_type === 'tool_call').length, 2)
assert.equal(implantTraceLedger.filter(row => row.event_type === 'tool_result').length, 2)
assert.equal(implantTraceLedger.find(row => row.node_id === 'T01' && row.event_type === 'tool_call')?.raw_tool_name, 'node_runtime_tools.t01_segmentation_runtime.run_t01_segmentation_selection')
assert.equal(implantTraceLedger.filter(row => row.event_type === 'run_terminal').length, 1)

const implantPlan = [
  ['t01_segmentation_selection', 'M1', 'T01'],
  ['t02_candidate_generation', 'M2', 'T02'],
  ['t03_admission', 'M2', 'T03'],
  ['t04_routing', 'M2', 'T04'],
  ['t05_initial_entry', 'M3', 'T05'],
  ['t06_initial_axis', 'M3', 'T06'],
  ['t07_initial_size', 'M3', 'T07'],
  ['t08_initial_depth', 'M3', 'T08'],
  ['t09_sinus_path', 'M4', 'T09'],
  ['t10_anatomic_safety', 'M4', 'T10'],
  ['t11_refinement', 'M4', 'T11'],
  ['t12_multisite_coordination', 'M5', 'T12'],
  ['t13_output_package', 'M6', 'T13'],
] as const
const implantEvents: any[] = []
const addMcpPair = (id: string, tool: string, args: any): void => {
  implantEvents.push({ type: 'item.started', item: {
    id,
    type: 'mcp_tool_call',
    server: 'implantagent',
    tool,
    arguments: args,
    status: 'in_progress',
  } })
  implantEvents.push({ type: 'item.completed', item: {
    id,
    type: 'mcp_tool_call',
    server: 'implantagent',
    tool,
    arguments: args,
    result: { structured_content: { status: args.dry_run ? 'READY' : 'COMPLETED' } },
    duration_ms: 12.5,
    status: 'completed',
  } })
}
addMcpPair('preflight-t01', 't01_segmentation_selection', { dry_run: true })
for (const [tool, moduleId, nodeId] of implantPlan) {
  addMcpPair(`clinical-${nodeId.toLowerCase()}`, tool, {
    inputs: { fixture: true },
    trace_context: { case_id: 'CASE_FIXED', module_id: moduleId },
  })
}
implantEvents.push({ type: 'item.completed', item: { id: 'implant-final', type: 'agent_message', text: 'Public completion checkpoint.' } })
implantEvents.push({ type: 'turn.completed', usage: { input_tokens: 0, output_tokens: 0 } })

const implantSession = new MockSession('session-external-trajectory-native-validation-implantagent')
const implantState = initializeNativeLiveSession(implantSession, {
  id: 'implantagent-external',
  label: 'ImplantAgent',
  kind: 'codex',
  provider: 'codex-cli',
  model: 'fixture-no-model',
  root: 'C:\\fixture-logs\\implantagent',
  cwd: 'C:\\fixture-workspaces\\implantagent',
  suffix: '_events.jsonl',
  nativeSession: true,
  projectionMode: 'implantagent-modules',
  ledgerRoot: 'C:\\fixture-ledgers\\implantagent',
}, 'C:\\fixture-logs\\implantagent\\CASE_FIXED_events.jsonl', 'CASE_FIXED')
appendNativeLiveRecords(implantState, jsonlRecords(implantEvents))
validateRelationalEvents(implantSession.events)
assertEveryToolFollowsLinkedAssistant(implantSession.events)
assert.deepEqual(
  implantSession.events.filter(event => event.type === 'step/start').map(event => event.data.step),
  [1, 2, 3, 4, 5, 6, 7],
)
const implantCalls = implantSession.events.filter(event => event.type === 'tool/call')
assert.equal(implantCalls.length, 14)
assert.deepEqual(
  implantCalls.slice(1).map(event => event.data.meta.moduleId),
  implantPlan.map(([, moduleId]) => moduleId),
)
assert.deepEqual(
  implantCalls.slice(1).map(event => event.data.meta.nodeId),
  implantPlan.map(([, , nodeId]) => nodeId),
)
const implantLedger = unflushedNativeLedgerRecords(implantState)
assert.equal(implantLedger.filter(row => row.event_type === 'tool_call').length, 14)
assert.equal(implantLedger.filter(row => row.event_type === 'tool_result').length, 14)
assert.ok(implantLedger.filter(row => row.event_type === 'tool_result').every(row => row.duration_ms === 12.5))
assert.ok(implantLedger.some(row => row.raw_tool_name === 'mcp__implantagent__t10_anatomic_safety' && row.module_id === 'M4' && row.node_id === 'T10'))

const statsTrace: any = {
  errorComparison: [
    { id: 'implantagent-external', label: 'ImplantAgent', kind: 'codex', workflowMode: 'fixed-modules' },
    { id: 'codex-only', label: 'Codex', kind: 'codex', workflowMode: 'free-form' },
    { id: 'claude-only', label: 'Claude', kind: 'claude', workflowMode: 'free-form' },
    { id: 'my-external-agent', label: 'My external agent', kind: 'generic', workflowMode: 'free-form' },
  ],
  events: [
    { kind: 'tool', streamId: 'implantagent-external', streamCaseId: 'CASE_FIXED', toolName: 'T10', rawToolName: 'mcp__implantagent__t10_anatomic_safety', status: 'error', errorCategory: 'schema_validation', errorCategoryLabel: 'Schema validation' },
    { kind: 'tool', streamId: 'implantagent-external', streamCaseId: 'CASE_FIXED', toolName: 'T10', rawToolName: 'mcp__implantagent__t10_anatomic_safety', status: 'success' },
    { kind: 'tool', streamId: 'codex-only', streamCaseId: 'CASE_001', toolName: 'Bash', rawToolName: 'Bash', status: 'success' },
    { kind: 'tool', streamId: 'claude-only', streamCaseId: 'CASE_001', toolName: 'Write', rawToolName: 'Write', status: 'success' },
    { kind: 'tool', streamId: 'my-external-agent', streamCaseId: 'CASE_GENERIC', toolName: 'validate_inputs', rawToolName: 'validate_inputs', status: 'success' },
  ],
}
const allStats = buildMonitorStats(statsTrace)
assert.equal(allStats.arms.length, 4)
assert.equal(allStats.deterministic, true)
assert.equal(allStats.readOnly, true)
const implantStats = buildMonitorStats(statsTrace, { agent: 'implantagent', include_errors: true })
assert.equal(implantStats.arms.length, 1)
assert.equal(implantStats.arms[0].matchingToolCalls, 2)
assert.equal(implantStats.arms[0].recoveredFailures, 1)

let nextCalls = 0
const rejected = await readonlyImportedSessionGuard(
  { agent: { session: { id: implantSession.id } } },
  async () => { nextCalls += 1; return { kind: 'enter' } },
)
assert.deepEqual(rejected, { kind: 'reject' })
assert.equal(nextCalls, 0)
const passed = await readonlyImportedSessionGuard(
  { agent: { session: { id: 'session-normal' } } },
  async () => { nextCalls += 1; return { kind: 'enter' } },
)
assert.deepEqual(passed, { kind: 'enter' })
assert.equal(nextCalls, 1)

const report = {
  schemaVersion: 1,
  validatedAt: new Date().toISOString(),
  pluginVersion: packageMetadata.version,
  nativeLiveProjectionVersion: NATIVE_LIVE_PROJECTION_VERSION,
  normalizedLedgerSchema: NORMALIZED_LEDGER_SCHEMA,
  modelRunsStarted: 0,
  patientCasesRun: 0,
  checks: {
    emptyManifestsLoad: true,
    genericExampleManifestLoads: true,
    genericExternalAgentRequestToolProjection: true,
    genericExternalAgentFailClosed: true,
    implantAgentV08TraceRequestToolProjection: true,
    implantAgentV08FailureProjection: true,
    localUserAndCasePathsAbsent: true,
    requestStepsIncrement: true,
    everyToolFollowsLinkedAssistantRequest: true,
    codexMissingSourceTimesRemainNull: true,
    codexToolTransitionsRecorded: true,
    claudeMessageIdDeduplicated: true,
    claudeDurationsPreserved: true,
    hiddenThinkingExcluded: true,
    implantAgentM1ToM6ProjectionExact: true,
    implantAgentT01ToT13ProjectionExact: true,
    implantAgentRawMcpNamesPreserved: true,
    normalizedLedgerSequencesValid: true,
    deterministicStatsValidated: true,
    mirroredSessionExecutionGuarded: true,
  },
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
