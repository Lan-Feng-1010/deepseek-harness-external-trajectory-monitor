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
} from '../index.js'

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = dirname(here)

class MockSession {
  constructor(id) {
    this.id = id
    this.events = []
    this.clock = 1_000
  }

  append(type, data, envelope = {}) {
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

function jsonlRecords(values) {
  return values.map((value, index) => ({ line: index + 1, value }))
}

function validateRelationalEvents(events) {
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
      assert.ok(event.data.message.content.every(block => block.type !== 'reasoning'))
    }
  }
  assert.equal(openTurn, null)
  assert.equal(openStep, null)
  assert.equal(openCalls.size, 0)
}

function assertEveryToolFollowsLinkedAssistant(events) {
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
assert.equal(exampleManifest.sources.length, 3)
assert.deepEqual(exampleManifest.sources.map(source => source.id), [
  'implantagent-external',
  'codex-only',
  'claude-only',
])
assert.ok(exampleManifest.sources.every(source => source.cwd.startsWith('C:\\agent-workspaces\\')))
const publishableText = await Promise.all([
  'index.js',
  'lib/client.js',
  'tsdown.config.ts',
  'README.md',
].map(path => readFile(join(packageRoot, path), 'utf8')))
assert.ok(publishableText.every(text => !text.includes('HUAWEI')))
assert.ok(publishableText.every(text => !text.includes('C01_')))
assert.ok(publishableText.every(text => !text.includes('F:\\')))

const codexSession = new MockSession('session-external-trajectory-native-validation-codex')
const codexState = initializeNativeLiveSession(codexSession, {
  id: 'codex-only',
  label: 'Codex',
  kind: 'codex',
  provider: 'codex-cli',
  model: 'fixture-no-model',
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
]
const implantEvents = []
const addMcpPair = (id, tool, args) => {
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

const statsTrace = {
  errorComparison: [
    { id: 'implantagent-external', label: 'ImplantAgent', kind: 'codex', workflowMode: 'fixed-modules' },
    { id: 'codex-only', label: 'Codex', kind: 'codex', workflowMode: 'free-form' },
    { id: 'claude-only', label: 'Claude', kind: 'claude', workflowMode: 'free-form' },
  ],
  events: [
    { kind: 'tool', streamId: 'implantagent-external', streamCaseId: 'CASE_FIXED', toolName: 'T10', rawToolName: 'mcp__implantagent__t10_anatomic_safety', status: 'error', errorCategory: 'schema_validation', errorCategoryLabel: 'Schema validation' },
    { kind: 'tool', streamId: 'implantagent-external', streamCaseId: 'CASE_FIXED', toolName: 'T10', rawToolName: 'mcp__implantagent__t10_anatomic_safety', status: 'success' },
    { kind: 'tool', streamId: 'codex-only', streamCaseId: 'CASE_001', toolName: 'Bash', rawToolName: 'Bash', status: 'success' },
    { kind: 'tool', streamId: 'claude-only', streamCaseId: 'CASE_001', toolName: 'Write', rawToolName: 'Write', status: 'success' },
  ],
}
const allStats = buildMonitorStats(statsTrace)
assert.equal(allStats.arms.length, 3)
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
  pluginVersion: '0.3.2',
  nativeLiveProjectionVersion: NATIVE_LIVE_PROJECTION_VERSION,
  normalizedLedgerSchema: NORMALIZED_LEDGER_SCHEMA,
  modelRunsStarted: 0,
  patientCasesRun: 0,
  checks: {
    emptyManifestsLoad: true,
    genericExampleManifestLoads: true,
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
