/** Read-only external-agent trajectory projection for DeepSeek Harness. */

import { createHash } from 'node:crypto'
import { appendFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  EventLog,
  HarnessContext,
  HarnessSession,
  HistoricalContext,
  HistoricalSource,
  ImportReport,
  JsonObject,
  JsonlDocument,
  JsonlRecord,
  LatestLiveFile,
  LedgerFields,
  LiveManifest,
  LiveSource,
  MonitorStatsArgs,
  NativeLiveState,
  NormalizedLedgerRecord,
  ObservableTrace,
  ObservableTraceEvent,
  PluginConfig,
  RunRecord,
  SourceManifest,
  ToolAuditMetadata,
} from './types.ts'

export type {
  HistoricalSource,
  JsonlRecord,
  LedgerFields,
  LiveSource,
  MonitorStatsArgs,
  NativeLiveState,
  NormalizedLedgerRecord,
  ObservableTrace,
  ObservableTraceEvent,
  PluginConfig,
  SourceManifest,
} from './types.ts'

export const name = 'external-trajectory-importer'
export const inject = ['sessions', 'sessionPersistence', 'webServer', 'tools']

const DEFAULT_MANIFEST_PATH = fileURLToPath(new URL('./sources.json', import.meta.url))
const DEFAULT_LIVE_MANIFEST_PATH = fileURLToPath(new URL('./live-sources.json', import.meta.url))
const DEFAULT_LEDGER_ROOT = fileURLToPath(new URL('./generated-ledgers', import.meta.url))
const SESSION_PREFIX = 'session-external-trajectory-'
export const LIVE_MONITOR_SESSION_ID = `${SESSION_PREFIX}live-monitor-v3-2`
export const NATIVE_LIVE_PROJECTION_VERSION = '4.0.0'
export const NORMALIZED_LEDGER_SCHEMA = 'external-trajectory-ledger-v3'
const TRACE_ROUTE = '/api/external-reasoning-trace'
const TOOL_ITEM_TYPES = new Set(['command_execution', 'file_change', 'web_search', 'mcp_tool_call'])

const IMPLANTAGENT_MODULES = Object.freeze({
  M1: 'M1 · 解剖 / Anatomy',
  M2: 'M2 · 位点识别与适应证 / Site identification and eligibility',
  M3: 'M3 · 初始种植方案 / Initial implant proposal',
  M4: 'M4 · 安全检查与有界修正 / Safety checking and bounded refinement',
  M5: 'M5 · 多位点协调 / Multi-site coordination',
  M6: 'M6 · 可追溯输出 / Traceable output',
})

const IMPLANTAGENT_TOOLS = Object.freeze({
  t01_segmentation_selection: { nodeId: 'T01', moduleId: 'M1', title: '分割选择 / Segmentation selection' },
  t02_candidate_generation: { nodeId: 'T02', moduleId: 'M2', title: '候选位点生成 / Candidate generation' },
  t03_admission: { nodeId: 'T03', moduleId: 'M2', title: '位点准入 / Site admission' },
  t04_routing: { nodeId: 'T04', moduleId: 'M2', title: '路径证据 / Routing evidence' },
  t05_initial_entry: { nodeId: 'T05', moduleId: 'M3', title: '初始入口 / Initial entry' },
  t06_initial_axis: { nodeId: 'T06', moduleId: 'M3', title: '初始轴向 / Initial axis' },
  t07_initial_size: { nodeId: 'T07', moduleId: 'M3', title: '初始尺寸 / Initial size' },
  t08_initial_depth: { nodeId: 'T08', moduleId: 'M3', title: '初始深度 / Initial depth' },
  t09_sinus_path: { nodeId: 'T09', moduleId: 'M4', title: '上颌窦路径 / Sinus path' },
  t10_anatomic_safety: { nodeId: 'T10', moduleId: 'M4', title: '解剖安全 / Anatomic safety' },
  t11_refinement: { nodeId: 'T11', moduleId: 'M4', title: '有界修正 / Bounded refinement' },
  t12_multisite_coordination: { nodeId: 'T12', moduleId: 'M5', title: '多位点协调 / Multi-site coordination' },
  t13_output_package: { nodeId: 'T13', moduleId: 'M6', title: '输出封装 / Output package' },
})

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string`)
  }
  return value
}

function parseEpoch(value: unknown, label: string): number {
  const result = Date.parse(requireNonEmptyString(value, label))
  if (!Number.isSafeInteger(result) || result < 0) throw new Error(`${label} is not a valid timestamp`)
  return result
}

function eventTime(value: unknown, fallback: number): number {
  if (typeof value !== 'string') return fallback
  const result = Date.parse(value)
  return Number.isSafeInteger(result) && result >= 0 ? result : fallback
}

function safeTokenCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

function sanitizeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
}

function sha256Text(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

async function readJson(path: string, label: string): Promise<JsonObject> {
  const text = await readFile(path, 'utf8')
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function readJsonl(path: string): Promise<JsonlDocument> {
  const text = await readFile(path, 'utf8')
  const records: JsonlRecord[] = []
  const malformedLines: number[] = []
  const lines = text.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (line === undefined) continue
    if (line.trim() === '') continue
    try {
      records.push({ line: index + 1, value: JSON.parse(line) })
    } catch {
      malformedLines.push(index + 1)
    }
  }
  return { text, records, malformedLines }
}

function validateSource(source: JsonObject, index: number): HistoricalSource {
  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    throw new Error(`sessions[${index}] must be an object`)
  }
  const agent = requireNonEmptyString(source.agent, `sessions[${index}].agent`) as HistoricalSource['agent']
  if (agent !== 'codex' && agent !== 'claude') {
    throw new Error(`sessions[${index}].agent must be "codex" or "claude"`)
  }
  const checked = {
    agent,
    caseId: requireNonEmptyString(source.caseId, `sessions[${index}].caseId`),
    title: requireNonEmptyString(source.title, `sessions[${index}].title`),
    provider: requireNonEmptyString(source.provider, `sessions[${index}].provider`),
    model: requireNonEmptyString(source.model, `sessions[${index}].model`),
    cwd: requireNonEmptyString(source.cwd, `sessions[${index}].cwd`),
    sourcePath: requireNonEmptyString(source.sourcePath, `sessions[${index}].sourcePath`),
    runRecordPath: requireNonEmptyString(source.runRecordPath, `sessions[${index}].runRecordPath`),
    expectedSha256: requireNonEmptyString(source.expectedSha256, `sessions[${index}].expectedSha256`).toLowerCase(),
  }
  if (!isAbsolute(checked.cwd) || !isAbsolute(checked.sourcePath) || !isAbsolute(checked.runRecordPath)) {
    throw new Error(`sessions[${index}] cwd and source paths must be absolute`)
  }
  if (!/^[a-f0-9]{64}$/.test(checked.expectedSha256)) {
    throw new Error(`sessions[${index}].expectedSha256 must be a lowercase SHA-256 digest`)
  }
  return checked
}

export async function loadManifest(path = DEFAULT_MANIFEST_PATH): Promise<SourceManifest> {
  const manifest = await readJson(path, 'trajectory source manifest')
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.sessions)) {
    throw new Error('trajectory source manifest must use schemaVersion 1 and contain a sessions array')
  }
  return { schemaVersion: 1, sessions: manifest.sessions.map(validateSource) }
}

function validateLiveSource(source: JsonObject, index: number): LiveSource {
  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    throw new Error(`live sources[${index}] must be an object`)
  }
  const kind = requireNonEmptyString(source.kind, `live sources[${index}].kind`) as LiveSource['kind']
  if (!['codex', 'claude', 'generic', 'implantagent-trace'].includes(kind)) {
    throw new Error(`live sources[${index}].kind is unsupported`)
  }
  const root = requireNonEmptyString(source.root, `live sources[${index}].root`)
  if (!isAbsolute(root)) throw new Error(`live sources[${index}].root must be absolute`)
  const cwd = source.cwd === undefined
    ? root
    : requireNonEmptyString(source.cwd, `live sources[${index}].cwd`)
  if (!isAbsolute(cwd)) throw new Error(`live sources[${index}].cwd must be absolute when configured`)
  return {
    id: sanitizeId(requireNonEmptyString(source.id, `live sources[${index}].id`)),
    label: requireNonEmptyString(source.label, `live sources[${index}].label`),
    kind,
    root: resolve(root),
    cwd: resolve(cwd),
    suffix: typeof source.suffix === 'string' && source.suffix !== '' ? source.suffix : (kind === 'generic' || kind === 'implantagent-trace' ? '.jsonl' : '_events.jsonl'),
    nativeSession: source.nativeSession === true,
    provider: typeof source.provider === 'string' && source.provider !== ''
      ? source.provider
      : kind === 'claude' ? 'claude-cli' : kind === 'codex' ? 'codex-cli' : 'external-process',
    model: typeof source.model === 'string' && source.model !== ''
      ? source.model
      : kind === 'claude' ? 'external-claude' : kind === 'codex' ? 'external-codex' : 'external-agent',
    ledgerRoot: source.ledgerRoot === undefined
      ? DEFAULT_LEDGER_ROOT
      : resolve(requireNonEmptyString(source.ledgerRoot, `live sources[${index}].ledgerRoot`)),
    projectionMode: source.projectionMode === 'implantagent-modules' ? 'implantagent-modules' : 'default',
  }
}

export async function loadLiveManifest(path = DEFAULT_LIVE_MANIFEST_PATH): Promise<LiveManifest> {
  const manifest = await readJson(path, 'live trajectory source manifest')
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.sources)) {
    throw new Error('live trajectory source manifest must use schemaVersion 1 and contain a sources array')
  }
  return { schemaVersion: 1, sources: manifest.sources.map(validateLiveSource) }
}

function makeEventLog(): EventLog {
  const events: EventLog['events'] = []
  return {
    append(type, time, data, envelope = {}) {
      const event = { type, seq: events.length, time, data, ...envelope }
      events.push(event)
      return event.seq
    },
    events,
  }
}

function messageId(sessionId: string, label: string, ordinal: number): string {
  return `${sessionId}-${label}-${ordinal}`
}

function appendImportNotice(log: EventLog, context: HistoricalContext, time: number): void {
  const text = [
    `Imported read-only ${context.source.agent} CLI trajectory for ${context.source.caseId}.`,
    `Source: ${context.source.sourcePath}`,
    `SHA-256: ${context.sha256}`,
    'The importer did not run a model and the raw JSONL remains the audit source of truth.',
  ].join('\n')
  log.append('user/message', time, {
    id: messageId(context.sessionId, 'notice', 1),
    role: 'user',
    content: [{ type: 'text', text }],
    source: {
      kind: 'plugin',
      plugin: name,
      form: 'notice',
      summary: `Imported read-only ${context.source.agent} trajectory ${context.source.caseId}`,
    },
  }, { surfaceOp: 'append' })
  log.append('session/title', time, {
    title: context.source.title,
    messageSeqs: [],
    source: { kind: 'user' },
  })
}

function appendAssistant(log: EventLog, context: HistoricalContext, position: JsonObject, time: number, content: JsonObject[], ordinal: number, usage?: JsonObject): void {
  const data = {
    turn: position.turn,
    step: position.step,
    message: {
      id: messageId(context.sessionId, 'assistant', ordinal),
      role: 'assistant',
      content,
      source: {
        kind: 'model',
        provider: context.source.provider,
        model: context.source.model,
      },
    },
    ...(usage === undefined ? {} : { usage }),
  }
  log.append('assistant/message', time, data, { surfaceOp: 'append' })
}

function appendTool(log: EventLog, context: HistoricalContext, position: JsonObject, call: JsonObject, result: JsonObject): void {
  const callSeq = log.append('tool/call', call.time, {
    turn: position.turn,
    step: position.step,
    callId: call.id,
    name: call.name,
    arguments: call.arguments,
  })
  const message = {
    id: messageId(context.sessionId, 'tool-result', result.ordinal),
    role: 'user',
    content: [{
      type: 'tool-result',
      toolCallId: call.id,
      content: [{ type: 'text', text: result.text }],
      isError: result.isError,
    }],
    source: { kind: 'tool', callId: call.id },
  }
  log.append('tool/result', result.time, {
    turn: position.turn,
    step: position.step,
    message,
    ...(result.isError ? { error: { name: 'ExternalToolError', code: result.errorCode } } : {}),
    meta: {
      importedBy: name,
      externalAgent: context.source.agent,
      sourceLine: result.sourceLine,
      sourceEventType: result.sourceEventType,
    },
  }, { surfaceOp: 'append', sourceEventSeqs: [callSeq] })
}

function createStepController(log: EventLog, turn: number) {
  let step = 0
  let open = false
  return {
    get position() {
      return { turn, step }
    },
    ensure(time: number) {
      if (!open) {
        step += 1
        log.append('step/start', time, { turn, step })
        open = true
      }
      return { turn, step }
    },
    close(time: number) {
      if (!open) return
      log.append('step/end', time, { turn, step })
      open = false
    },
    get isOpen() {
      return open
    },
    get count() {
      return step
    },
  }
}

function codexToolArguments(item: JsonObject): string {
  switch (item.type) {
    case 'command_execution':
      return JSON.stringify({ command: item.command })
    case 'file_change':
      return JSON.stringify({ changes: item.changes })
    case 'web_search':
      return JSON.stringify({ query: item.query, action: item.action })
    case 'mcp_tool_call':
      return JSON.stringify(item.arguments ?? {})
    default:
      return JSON.stringify(item)
  }
}

function codexToolResult(item: JsonObject): string {
  if (item.type === 'command_execution') return typeof item.aggregated_output === 'string' ? item.aggregated_output : ''
  if (item.type === 'mcp_tool_call') {
    if (item.result !== undefined) return JSON.stringify(item.result)
    if (item.error !== undefined) return JSON.stringify(item.error)
  }
  return JSON.stringify(item)
}

function codexRawToolName(item: JsonObject): string {
  if (item.type === 'mcp_tool_call') return `mcp__${String(item.server ?? '')}__${String(item.tool ?? '')}`
  return item.type
}

function implantagentToolMetadata(item: JsonObject): JsonObject | null {
  if (item?.type !== 'mcp_tool_call' || item.server !== 'implantagent') return null
  const metadata = (IMPLANTAGENT_TOOLS as Record<string, { nodeId: string; moduleId: string; title: string }>)[String(item.tool)]
  if (metadata === undefined) return null
  return {
    ...metadata,
    rawToolName: `mcp__implantagent__${item.tool}`,
    visibleToolName: `${metadata.nodeId} · ${metadata.title}`,
  }
}

function codexCommandText(item: JsonObject): string {
  if (typeof item?.command === 'string') return item.command
  if (Array.isArray(item?.command)) return item.command.map((value: unknown) => String(value)).join(' ')
  return ''
}

function pathLeaf(value: string): string {
  const parts = value.split(/[\\/]/)
  return parts.at(-1) || value
}

function codexToolDisplayName(item: JsonObject): string {
  if (item.type === 'mcp_tool_call') return codexRawToolName(item)
  if (item.type !== 'command_execution') return item.type
  const command = codexCommandText(item)
  const tracebackScript = typeof item.aggregated_output === 'string'
    ? item.aggregated_output.match(/File\s+["']([^"']+\.py)["']/i)?.[1]
    : undefined
  if (tracebackScript !== undefined) return pathLeaf(tracebackScript)
  const quotedPython = command.match(/["']([^"']+\.py)["']/i)
  const plainPython = command.match(/(?:^|\s)([^\s;|&]+\.py)(?=$|\s|[;|&])/i)
  const script = quotedPython?.[1] ?? plainPython?.[1]
  if (script !== undefined) return pathLeaf(script)
  if (/(?:^|[\s;&|"'])jq(?:\.exe)?(?:\s|$)/i.test(command)) return 'jq'
  if (/(?:^|[\s;&|"'])python(?:\d+(?:\.\d+)?)?(?:\.exe)?\s+(?:-c|-)(?:\s|$|<)/i.test(command)) return 'python:inline'
  if (/(?:^|[\s;&|"'])git(?:\.exe)?(?:\s|$)/i.test(command)) return 'git'
  if (/(?:^|[\s;&|"'])docker(?:\.exe)?(?:\s|$)/i.test(command)) return 'docker'
  return 'command_execution'
}

const ERROR_CATEGORY_LABELS: Record<string, string> = {
  missing_dependency: '缺少运行依赖',
  schema_validation: 'Schema 校验失败',
  data_contract: '数据契约/键缺失',
  jq_quoting: 'jq 查询/引号/表达式',
  python_runtime: 'Python 运行异常',
  shell_nonzero: '命令非零退出',
  tool_error: '工具执行失败',
}

function classifyToolError(event: JsonObject): { category: string; categoryLabel: string } {
  const evidence = `${event.arguments ?? ''}\n${event.result ?? ''}`.toLowerCase()
  let category = 'tool_error'
  if (/modulenotfounderror|no module named|cannot find module/.test(evidence)) category = 'missing_dependency'
  else if (/jsonschema|validationerror|failed validating|is too short|is too long/.test(evidence)) category = 'schema_validation'
  else if (/keyerror|missing (?:required )?(?:key|field)|required propert/.test(evidence)) category = 'data_contract'
  else if (/jq:\s*error|jq(?:\.exe)?[^\n]*(?:syntax|compile) error/.test(evidence) || event.toolName === 'jq') category = 'jq_quoting'
  else if (/traceback \(most recent call last\)|\b(?:type|value|attribute|index|runtime)error\b/.test(evidence)) category = 'python_runtime'
  else if (event.exitCode !== null && event.exitCode !== undefined && event.exitCode !== 0) category = 'shell_nonzero'
  return { category, categoryLabel: ERROR_CATEGORY_LABELS[category] ?? ERROR_CATEGORY_LABELS.tool_error ?? '工具执行失败' }
}

function buildCodexEvents(context: HistoricalContext, records: readonly JsonlRecord[], malformedLines: readonly number[], runRecord: RunRecord) {
  const startedAt = parseEpoch(runRecord.started_at_utc, 'Codex run started_at_utc')
  const finishedAt = parseEpoch(runRecord.finished_at_utc, 'Codex run finished_at_utc')
  const log = makeEventLog()
  const turn = 1
  const steps = createStepController(log, turn)
  let assistantOrdinal = 0
  let resultOrdinal = 0
  let sourceCompleted = false
  const counts = {
    assistantMessages: 0,
    toolCalls: 0,
    toolResults: 0,
    todoSnapshots: 0,
    ignoredStartedDuplicates: 0,
  }

  log.append('turn/start', startedAt, { turn })
  appendImportNotice(log, context, startedAt)

  for (const record of records) {
    const event = record.value
    if (event?.type === 'turn.completed') {
      sourceCompleted = true
      continue
    }
    const item = event?.item
    if (item === null || typeof item !== 'object') continue

    if (item.type === 'todo_list' && Array.isArray(item.items)) {
      const todos = item.items.map((entry: JsonObject) => ({
        content: typeof entry?.text === 'string' ? entry.text : JSON.stringify(entry),
        status: entry?.completed === true ? 'completed' : 'pending',
      }))
      log.append('todo/write', startedAt, { todos })
      counts.todoSnapshots += 1
      continue
    }

    if (event.type === 'item.started' && TOOL_ITEM_TYPES.has(item.type)) {
      counts.ignoredStartedDuplicates += 1
      continue
    }

    if (event.type === 'item.completed' && item.type === 'agent_message' && typeof item.text === 'string') {
      steps.close(startedAt)
      const position = steps.ensure(startedAt)
      assistantOrdinal += 1
      appendAssistant(log, context, position, startedAt, [{ type: 'text', text: item.text }], assistantOrdinal)
      counts.assistantMessages += 1
      continue
    }

    if (event.type === 'item.completed' && TOOL_ITEM_TYPES.has(item.type)) {
      const position = steps.ensure(startedAt)
      resultOrdinal += 1
      const rawId = typeof item.id === 'string' && item.id !== '' ? item.id : `line-${record.line}`
      const callId = `external-${context.source.agent}-${sanitizeId(rawId)}`
      const exitCode = Number.isInteger(item.exit_code) ? item.exit_code : undefined
      const isError = item.status === 'failed' || (exitCode !== undefined && exitCode !== 0)
      appendTool(log, context, position, {
        id: callId,
        name: item.type,
        arguments: codexToolArguments(item),
        time: startedAt,
      }, {
        text: codexToolResult(item),
        isError,
        errorCode: exitCode === undefined ? 'EXTERNAL_TOOL_FAILED' : `EXTERNAL_EXIT_${exitCode}`,
        time: startedAt,
        ordinal: resultOrdinal,
        sourceLine: record.line,
        sourceEventType: event.type,
      })
      counts.toolCalls += 1
      counts.toolResults += 1
    }
  }

  steps.close(finishedAt)
  log.append('turn/end', finishedAt, {
    turn,
    reason: sourceCompleted ? { kind: 'completed' } : { kind: 'aborted', reason: { kind: 'legacy' } },
  })
  return {
    events: log.events,
    summary: {
      ...counts,
      steps: steps.count,
      malformedLines,
      omittedHiddenReasoningEvents: 0,
      sourceCompleted,
      timestampCoverage: 'run-boundaries-only',
    },
  }
}

function claudeUsage(usage: unknown): JsonObject | undefined {
  if (usage === null || typeof usage !== 'object') return undefined
  const value = usage as JsonObject
  const inputTokens = safeTokenCount(value.input_tokens)
  const outputTokens = safeTokenCount(value.output_tokens)
  if (inputTokens === undefined || outputTokens === undefined) return undefined
  const cacheReadTokens = safeTokenCount(value.cache_read_input_tokens)
  const cacheWriteTokens = safeTokenCount(value.cache_creation_input_tokens)
  return {
    inputTokens,
    outputTokens,
    ...(cacheReadTokens === undefined ? {} : { cacheReadTokens }),
    ...(cacheWriteTokens === undefined ? {} : { cacheWriteTokens }),
  }
}

function claudeResultText(content: unknown): string {
  return typeof content === 'string' ? content : JSON.stringify(content)
}

function buildClaudeEvents(context: HistoricalContext, records: readonly JsonlRecord[], malformedLines: readonly number[], runRecord: RunRecord) {
  const startedAt = parseEpoch(runRecord.started_at_utc, 'Claude run started_at_utc')
  const finishedAt = parseEpoch(runRecord.finished_at_utc, 'Claude run finished_at_utc')
  const log = makeEventLog()
  const turn = 1
  const steps = createStepController(log, turn)
  let pendingAssistant: {
    id: string
    time: number
    content: JsonObject[]
    tools: JsonObject[]
    usage: JsonObject | undefined
  } | undefined
  let assistantOrdinal = 0
  let resultOrdinal = 0
  let sourceCompleted = false
  const openCalls = new Map<string, number>()
  const assistantMessageIds = new Set<string>()
  const counts = {
    assistantMessages: 0,
    visibleAssistantTextBlocks: 0,
    syntheticUserNotices: 0,
    toolCalls: 0,
    toolResults: 0,
    unmatchedToolResults: 0,
    omittedHiddenReasoningEvents: 0,
    omittedThinkingTokenEvents: 0,
    omittedTaskProgressEvents: 0,
    omittedOtherSystemEvents: 0,
  }

  log.append('turn/start', startedAt, { turn })
  appendImportNotice(log, context, startedAt)

  function closeStep(time: number): void {
    steps.close(time)
    openCalls.clear()
  }

  function flushAssistant(): void {
    if (pendingAssistant === undefined) return
    const pending = pendingAssistant
    pendingAssistant = undefined
    if (pending.content.length === 0) return
    closeStep(pending.time)
    const position = steps.ensure(pending.time)
    assistantOrdinal += 1
    appendAssistant(log, context, position, pending.time, pending.content, assistantOrdinal, pending.usage)
    counts.assistantMessages += 1
    for (const tool of pending.tools) {
      const callSeq = log.append('tool/call', tool.time, {
        turn: position.turn,
        step: position.step,
        callId: tool.id,
        name: tool.name,
        arguments: tool.arguments,
      })
      openCalls.set(tool.id, callSeq)
      counts.toolCalls += 1
    }
  }

  for (const record of records) {
    const event = record.value
    if (event?.type === 'assistant' && event.message && typeof event.message === 'object') {
      const id = typeof event.message.id === 'string' ? event.message.id : `line-${record.line}`
      assistantMessageIds.add(id)
      if (pendingAssistant?.id !== id) {
        flushAssistant()
        pendingAssistant = {
          id,
          time: eventTime(event.timestamp, startedAt),
          content: [],
          tools: [],
          usage: claudeUsage(event.message.usage),
        }
      }
      if (pendingAssistant === undefined) throw new Error('Claude assistant state was not initialized')
      const currentAssistant = pendingAssistant
      currentAssistant.usage = claudeUsage(event.message.usage) ?? currentAssistant.usage
      for (const block of Array.isArray(event.message.content) ? event.message.content : []) {
        if (block?.type === 'thinking') {
          counts.omittedHiddenReasoningEvents += 1
        } else if (block?.type === 'text' && typeof block.text === 'string') {
          currentAssistant.content.push({ type: 'text', text: block.text })
          counts.visibleAssistantTextBlocks += 1
        } else if (block?.type === 'tool_use') {
          const toolId = requireNonEmptyString(block.id, `Claude tool_use at line ${record.line} id`)
          const toolName = requireNonEmptyString(block.name, `Claude tool_use at line ${record.line} name`)
          const tool = {
            id: toolId,
            name: toolName,
            arguments: JSON.stringify(block.input ?? {}),
            time: eventTime(event.timestamp, startedAt),
          }
          currentAssistant.content.push({
            type: 'tool-call',
            id: tool.id,
            name: tool.name,
            arguments: tool.arguments,
          })
          currentAssistant.tools.push(tool)
        }
      }
      continue
    }

    if (event?.type === 'user' && event.message && typeof event.message === 'object') {
      flushAssistant()
      const time = eventTime(event.timestamp, startedAt)
      for (const block of Array.isArray(event.message.content) ? event.message.content : []) {
        if (block?.type === 'tool_result') {
          const callId = requireNonEmptyString(block.tool_use_id, `Claude tool_result at line ${record.line} id`)
          let callSeq = openCalls.get(callId)
          if (callSeq === undefined) {
            const position = steps.ensure(time)
            callSeq = log.append('tool/call', time, {
              turn: position.turn,
              step: position.step,
              callId,
              name: 'external_unmatched_tool_result',
              arguments: '{}',
            })
            openCalls.set(callId, callSeq)
            counts.toolCalls += 1
            counts.unmatchedToolResults += 1
          }
          const position = steps.position
          const isError = block.is_error === true
          resultOrdinal += 1
          const message = {
            id: messageId(context.sessionId, 'tool-result', resultOrdinal),
            role: 'user',
            content: [{
              type: 'tool-result',
              toolCallId: callId,
              content: [{ type: 'text', text: claudeResultText(block.content) }],
              isError,
            }],
            source: { kind: 'tool', callId },
          }
          log.append('tool/result', time, {
            turn: position.turn,
            step: position.step,
            message,
            ...(isError ? { error: { name: 'ExternalToolError', code: 'EXTERNAL_TOOL_ERROR' } } : {}),
            meta: {
              importedBy: name,
              externalAgent: context.source.agent,
              sourceLine: record.line,
              sourceEventType: event.type,
            },
          }, { surfaceOp: 'append', sourceEventSeqs: [callSeq] })
          openCalls.delete(callId)
          counts.toolResults += 1
        } else if (block?.type === 'text' && typeof block.text === 'string') {
          log.append('user/message', time, {
            id: messageId(context.sessionId, 'synthetic-user', counts.syntheticUserNotices + 1),
            role: 'user',
            content: [{ type: 'text', text: block.text }],
            source: {
              kind: 'plugin',
              plugin: 'claude-cli',
              form: 'notice',
              summary: 'Synthetic user-visible notice emitted by Claude CLI',
            },
          }, { surfaceOp: 'append' })
          counts.syntheticUserNotices += 1
        }
      }
      continue
    }

    if (event?.type === 'result') {
      flushAssistant()
      sourceCompleted = event.subtype === 'success'
      continue
    }

    if (event?.type === 'system') {
      if (event.subtype === 'thinking_tokens') counts.omittedThinkingTokenEvents += 1
      else if (event.subtype === 'task_started' || event.subtype === 'task_notification') counts.omittedTaskProgressEvents += 1
      else counts.omittedOtherSystemEvents += 1
    }
  }

  flushAssistant()
  closeStep(finishedAt)
  log.append('turn/end', finishedAt, {
    turn,
    reason: sourceCompleted ? { kind: 'completed' } : { kind: 'aborted', reason: { kind: 'legacy' } },
  })
  return {
    events: log.events,
    summary: {
      ...counts,
      uniqueAssistantMessageIds: assistantMessageIds.size,
      steps: steps.count,
      malformedLines,
      sourceCompleted,
      timestampCoverage: 'source-event-timestamps',
    },
  }
}

function exactEventTime(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const parsed = Date.parse(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

function redactObservableText(value: unknown): string {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value)
  const text = typeof serialized === 'string' ? serialized : String(value ?? '')
  return text
    .replace(/((?:api[_-]?key|access[_-]?token|auth[_-]?token|password|secret|authorization)\s*[=:]\s*)([^\s,;]+)/gi, '$1[REDACTED]')
    .replace(/("(?:api[_-]?key|access[_-]?token|auth[_-]?token|password|secret|authorization)"\s*:\s*")[^"]*(")/gi, '$1[REDACTED]$2')
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+\x2f-]+=*/gi, '$1[REDACTED]')
}

function previewText(value: unknown, limit = 280): string {
  const normalized = redactObservableText(value).replace(/\s+/g, ' ').trim()
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1)}…`
}

function connectToolTransitions(events: ObservableTraceEvent[]): ObservableTraceEvent[] {
  const tools = events.filter(event => event.kind === 'tool')
  for (let index = 0; index < tools.length; index += 1) {
    const current = tools[index]
    if (current === undefined) continue
    const previous = tools[index - 1]
    const next = tools[index + 1]
    current.previousTool = previous?.toolName ?? null
    current.nextTool = next?.toolName ?? null
    current.transition = previous === undefined ? `START → ${current.toolName}` : `${previous.toolName} → ${current.toolName}`
    const previousEnd = previous?.resultTimestampMs ?? previous?.timestampMs
    current.gapFromPreviousToolMs = previousEnd !== null && previousEnd !== undefined && current.timestampMs !== null
      ? Math.max(0, current.timestampMs - previousEnd)
      : null
  }
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]
    if (event !== undefined) event.seq = index + 1
  }
  return tools
}

function makeObservableTrace(
  context: JsonObject,
  runRecord: RunRecord,
  malformedLines: readonly number[],
  timeCoverage: string,
  events: ObservableTraceEvent[],
  extraStats: JsonObject = {},
): ObservableTrace {
  const startedAtMs = parseEpoch(runRecord.started_at_utc, `${context.source.agent} run started_at_utc`)
  const finishedAtMs = parseEpoch(runRecord.finished_at_utc, `${context.source.agent} run finished_at_utc`)
  const tools = connectToolTransitions(events)
  return {
    schemaVersion: 1,
    sessionId: context.sessionId,
    agent: context.source.agent,
    caseId: context.source.caseId,
    title: context.source.title,
    source: {
      path: context.source.sourcePath,
      sha256: context.sha256,
      malformedLines,
      timeCoverage,
    },
    run: { startedAtMs, finishedAtMs, durationMs: Math.max(0, finishedAtMs - startedAtMs) },
    boundary: {
      label: 'observable-reasoning',
      publicDecisionTextOnly: true,
      hiddenChainOfThoughtIncluded: false,
      hiddenReasoningMarkersContainContent: false,
      sourceOfTruth: context.source.sourcePath,
    },
    stats: {
      observableEvents: events.length,
      toolCalls: tools.length,
      publicReasoningEvents: events.filter(event => event.kind === 'public_reasoning').length,
      publicPlanEvents: events.filter(event => event.kind === 'public_plan').length,
      privateReasoningMarkers: events.filter(event => event.kind === 'private_reasoning_marker').length,
      successfulTools: tools.filter(event => event.status === 'success').length,
      failedTools: tools.filter(event => event.status === 'error').length,
      exactToolTimestamps: tools.filter(event => event.timestampMs !== null).length,
      exactToolDurations: tools.filter(event => event.durationMs !== null).length,
      ...extraStats,
    },
    events,
  }
}

function buildCodexObservableTrace(context: JsonObject, records: readonly JsonlRecord[], malformedLines: readonly number[], runRecord: RunRecord): ObservableTrace {
  const events: ObservableTraceEvent[] = []
  const startedTools = new Map<string, ObservableTraceEvent>()
  let publicContext = ''
  let phase = 0
  for (const record of records) {
    const event = record.value
    const item = event?.item
    if (item === null || typeof item !== 'object') continue
    if (event.type === 'item.started' && TOOL_ITEM_TYPES.has(item.type) && typeof item.id === 'string') {
      const argumentsText = redactObservableText(codexToolArguments(item))
      const observableTool: ObservableTraceEvent = {
        seq: 0,
        kind: 'tool',
        phase,
        timestampMs: null,
        resultTimestampMs: null,
        timeEvidence: 'not-recorded',
        durationMs: null,
        gapFromPreviousToolMs: null,
        callId: `external-${context.source.agent}-${sanitizeId(item.id)}`,
        toolName: codexToolDisplayName(item),
        rawToolName: item.type,
        status: 'pending',
        exitCode: null,
        callSourceLine: record.line,
        resultSourceLine: null,
        arguments: argumentsText,
        argumentsPreview: previewText(argumentsText),
        result: '',
        resultPreview: '',
        publicContextBefore: publicContext,
        publicContextPreview: publicContext === '' ? '' : previewText(publicContext),
      }
      events.push(observableTool)
      startedTools.set(item.id, observableTool)
      continue
    }
    if (item.type === 'todo_list' && Array.isArray(item.items)) {
      phase += 1
      const text = item.items.map((entry: JsonObject) => `${entry?.completed === true ? '✓' : '○'} ${typeof entry?.text === 'string' ? entry.text : JSON.stringify(entry)}`).join('\n')
      events.push({
        seq: 0,
        kind: 'public_plan',
        phase,
        timestampMs: null,
        timeEvidence: 'not-recorded',
        sourceLine: record.line,
        text: redactObservableText(text),
        preview: previewText(text),
      })
      continue
    }
    if (event.type === 'item.completed' && item.type === 'agent_message' && typeof item.text === 'string') {
      phase += 1
      publicContext = redactObservableText(item.text)
      events.push({
        seq: 0,
        kind: 'public_reasoning',
        phase,
        timestampMs: null,
        timeEvidence: 'not-recorded',
        sourceLine: record.line,
        text: publicContext,
        preview: previewText(publicContext),
      })
      continue
    }
    if (event.type === 'item.completed' && TOOL_ITEM_TYPES.has(item.type)) {
      const rawId = typeof item.id === 'string' && item.id !== '' ? item.id : `line-${record.line}`
      const exitCode = Number.isInteger(item.exit_code) ? item.exit_code : null
      const failed = item.status === 'failed' || (exitCode !== null && exitCode !== 0)
      const argumentsText = redactObservableText(codexToolArguments(item))
      const resultText = redactObservableText(codexToolResult(item))
      let observableTool = startedTools.get(rawId)
      if (observableTool === undefined) {
        observableTool = {
          seq: 0,
          kind: 'tool',
          phase,
          timestampMs: null,
          resultTimestampMs: null,
          timeEvidence: 'not-recorded',
          durationMs: null,
          gapFromPreviousToolMs: null,
          callId: `external-${context.source.agent}-${sanitizeId(rawId)}`,
          callSourceLine: null,
          publicContextBefore: publicContext,
          publicContextPreview: publicContext === '' ? '' : previewText(publicContext),
        }
        events.push(observableTool)
      }
      Object.assign(observableTool, {
        toolName: codexToolDisplayName(item),
        rawToolName: item.type,
        status: failed ? 'error' : 'success',
        exitCode,
        resultSourceLine: record.line,
        arguments: argumentsText,
        argumentsPreview: previewText(argumentsText),
        result: resultText,
        resultPreview: previewText(resultText),
      })
      if (failed) Object.assign(observableTool, classifyToolError(observableTool))
    }
  }
  return makeObservableTrace(context, runRecord, malformedLines, 'run-boundaries-only', events, {
    missingPerEventTimestamps: events.length,
    omittedHiddenReasoningEvents: 0,
  })
}

function buildClaudeObservableTrace(context: JsonObject, records: readonly JsonlRecord[], malformedLines: readonly number[], runRecord: RunRecord): ObservableTrace {
  const events: ObservableTraceEvent[] = []
  const toolsById = new Map<string, ObservableTraceEvent>()
  let publicContext = ''
  let phase = 0
  let thinkingTokenEvents = 0
  for (const record of records) {
    const event = record.value
    const timestampMs = exactEventTime(event?.timestamp)
    if (event?.type === 'assistant' && event.message && typeof event.message === 'object') {
      const messageId = typeof event.message.id === 'string' ? event.message.id : `line-${record.line}`
      for (const block of Array.isArray(event.message.content) ? event.message.content : []) {
        if (block?.type === 'thinking') {
          events.push({
            seq: 0,
            kind: 'private_reasoning_marker',
            phase,
            timestampMs,
            timeEvidence: timestampMs === null ? 'not-recorded' : 'source-event',
            sourceLine: record.line,
            messageId,
            contentOmitted: true,
            label: '私有 reasoning 事件（内容不可见）',
          })
        } else if (block?.type === 'text' && typeof block.text === 'string') {
          phase += 1
          publicContext = redactObservableText(block.text)
          events.push({
            seq: 0,
            kind: 'public_reasoning',
            phase,
            timestampMs,
            timeEvidence: timestampMs === null ? 'not-recorded' : 'source-event',
            sourceLine: record.line,
            messageId,
            text: publicContext,
            preview: previewText(publicContext),
          })
        } else if (block?.type === 'tool_use') {
          const callId = requireNonEmptyString(block.id, `Claude tool_use at line ${record.line} id`)
          const toolName = requireNonEmptyString(block.name, `Claude tool_use at line ${record.line} name`)
          const argumentsText = redactObservableText(block.input ?? {})
          const tool: ObservableTraceEvent = {
            seq: 0,
            kind: 'tool',
            phase,
            timestampMs,
            resultTimestampMs: null,
            timeEvidence: timestampMs === null ? 'not-recorded' : 'source-event',
            durationMs: null,
            gapFromPreviousToolMs: null,
            callId,
            toolName,
            status: 'pending',
            exitCode: null,
            callSourceLine: record.line,
            resultSourceLine: null,
            arguments: argumentsText,
            argumentsPreview: previewText(argumentsText),
            result: '',
            resultPreview: '',
            publicContextBefore: publicContext,
            publicContextPreview: publicContext === '' ? '' : previewText(publicContext),
          }
          events.push(tool)
          toolsById.set(callId, tool)
        }
      }
      continue
    }
    if (event?.type === 'user' && event.message && typeof event.message === 'object') {
      for (const block of Array.isArray(event.message.content) ? event.message.content : []) {
        if (block?.type !== 'tool_result') continue
        const callId = requireNonEmptyString(block.tool_use_id, `Claude tool_result at line ${record.line} id`)
        const tool = toolsById.get(callId)
        if (tool === undefined) continue
        tool.resultTimestampMs = timestampMs
        tool.resultSourceLine = record.line
        tool.status = block.is_error === true ? 'error' : 'success'
        tool.result = redactObservableText(claudeResultText(block.content))
        tool.resultPreview = previewText(tool.result)
        tool.durationMs = tool.timestampMs !== null && timestampMs !== null ? Math.max(0, timestampMs - tool.timestampMs) : null
      }
      continue
    }
    if (event?.type === 'system' && event.subtype === 'thinking_tokens') thinkingTokenEvents += 1
  }
  return makeObservableTrace(context, runRecord, malformedLines, 'source-event-timestamps', events, {
    omittedThinkingTokenEvents: thinkingTokenEvents,
    hiddenReasoningContentIncluded: 0,
  })
}

function caseIdFromFilename(filename: string): string {
  return filename.match(/C\d{2}_\d{4}/)?.[0] ?? filename.replace(/_events\.jsonl$/i, '').replace(/\.jsonl$/i, '')
}

async function latestLiveFile(source: LiveSource): Promise<LatestLiveFile | null> {
  let entries
  try {
    entries = await readdir(source.root, { withFileTypes: true })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null
    throw error
  }
  const candidates: LatestLiveFile[] = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(source.suffix)) continue
    const path = join(source.root, entry.name)
    const details = await stat(path)
    candidates.push({ path, name: entry.name, details })
  }
  candidates.sort((left, right) => right.details.mtimeMs - left.details.mtimeMs || left.name.localeCompare(right.name))
  return candidates[0] ?? null
}

function liveRunRecord(records: readonly JsonlRecord[], details: LatestLiveFile['details']): RunRecord {
  const exact = records.flatMap(record => {
    const value = exactEventTime(record.value?.timestamp ?? record.value?.started_at_utc)
    return value === null ? [] : [value]
  })
  const started = exact.length > 0 ? Math.min(...exact) : Math.max(0, details.birthtimeMs || details.ctimeMs || details.mtimeMs)
  const finishedExact = records.flatMap(record => {
    const value = exactEventTime(record.value?.finished_at_utc ?? record.value?.timestamp)
    return value === null ? [] : [value]
  })
  const finished = finishedExact.length > 0 ? Math.max(...finishedExact) : details.mtimeMs
  return {
    started_at_utc: new Date(Math.min(started, finished)).toISOString(),
    finished_at_utc: new Date(Math.max(started, finished)).toISOString(),
  }
}

export function nativeLiveSessionId(source: LiveSource, path: string, caseId: string): string {
  const sessionProjection = source.kind === 'generic' ? 'v4' : 'v3-2'
  return `${SESSION_PREFIX}native-${sessionProjection}-${sanitizeId(source.id)}-${sanitizeId(caseId)}-${sha256Text(path).slice(0, 12)}`
}

function nativeLiveTitle(state: NativeLiveState, status = 'RUNNING'): string {
  return `[External ${state.source.label}] ${state.caseId} · ${status}`
}

export function initializeNativeLiveSession(session: HarnessSession, source: LiveSource, path: string, caseId: string): NativeLiveState {
  const state: NativeLiveState = {
    session,
    sessionId: session.id,
    source,
    path,
    caseId,
    turn: 1,
    step: 1,
    stepOpen: true,
    stepHasAssistantRequest: false,
    processedLines: new Set(),
    callSeqs: new Map(),
    callSteps: new Map(),
    callLedgerMeta: new Map(),
    openCalls: new Set(),
    completedCalls: new Set(),
    assistantLinkedCalls: new Set(),
    pendingCodexAssistants: [],
    pendingClaudeAssistantEvents: [],
    currentClaudeMessageId: null,
    currentGenericRequestId: null,
    seenClaudeBlocks: new Set(),
    assistantOrdinal: 0,
    resultOrdinal: 0,
    codexNextEventStartsStep: false,
    codexRequestTextBlocks: [],
    codexRequestToolBlocks: [],
    currentImplantAgentGroup: null,
    implantAgentInvocationCounts: new Map(),
    ledgerRecords: [],
    ledgerFlushedCount: 0,
    ledgerPath: join(source.ledgerRoot ?? DEFAULT_LEDGER_ROOT, `${session.id}.normalized.jsonl`),
    lastToolName: null,
    lastToolCallId: null,
    finalStatus: null,
    finalized: false,
  }
  session.append('turn/start', { turn: state.turn })
  session.append('user/message', {
    id: `${state.sessionId}-live-notice`,
    role: 'user',
    content: [{ type: 'text', text: [
      `Live read-only mirror of external ${source.label} for ${caseId}.`,
      `Source JSONL: ${path}`,
      'Tool cards are appended while the external agent runs. The external JSONL remains the audit source of truth.',
      `Projection: ${NATIVE_LIVE_PROJECTION_VERSION}. Normalized ledger: ${state.ledgerPath}`,
      'This Harness session did not launch or control the external model.',
    ].join('\n') }],
    source: { kind: 'plugin', plugin: name, form: 'notice', summary: `Live external trajectory ${caseId}` },
  }, { surfaceOp: 'append' })
  session.append('session/title', {
    title: nativeLiveTitle(state),
    messageSeqs: [],
    source: { kind: 'user' },
  })
  session.append('step/start', { turn: state.turn, step: state.step })
  return state
}

function sourceTimestamp(event: JsonObject) {
  const value = event?.timestamp ?? event?.started_at_utc ?? null
  const milliseconds = exactEventTime(value)
  return {
    milliseconds,
    iso: milliseconds === null ? null : new Date(milliseconds).toISOString(),
  }
}

function appendLedgerRecord(
  state: NativeLiveState,
  record: JsonlRecord | null | undefined,
  event: JsonObject,
  fields: LedgerFields,
): NormalizedLedgerRecord {
  const timestamp = sourceTimestamp(event)
  const row = {
    schema_version: NORMALIZED_LEDGER_SCHEMA,
    sequence: state.ledgerRecords.length + 1,
    session_id: state.sessionId,
    agent: state.source.kind,
    case_id: state.caseId,
    source_path: state.path,
    source_line: record?.line ?? null,
    source_timestamp: timestamp.iso,
    observed_at: new Date().toISOString(),
    step: state.step,
    event_type: fields.event_type,
    public_assistant_message: fields.public_assistant_message ?? null,
    tool_call_id: fields.tool_call_id ?? null,
    tool_name: fields.tool_name ?? null,
    tool_arguments: fields.tool_arguments ?? null,
    tool_result: fields.tool_result ?? null,
    status: fields.status ?? null,
    duration_ms: fields.duration_ms ?? null,
    module_id: fields.module_id ?? null,
    node_id: fields.node_id ?? null,
    raw_tool_name: fields.raw_tool_name ?? null,
    invocation_index: fields.invocation_index ?? null,
    retry_index: fields.retry_index ?? null,
    previous_tool: fields.previous_tool ?? null,
    next_tool: fields.next_tool ?? null,
    source_event_type: event?.type ?? event?.event_type ?? null,
  }
  state.ledgerRecords.push(row)
  return row
}

function rotateNativeLiveStep(state: NativeLiveState): void {
  if (!state.stepOpen) return
  if (state.openCalls.size > 0) throw new Error('cannot rotate native live step with open tool calls')
  state.session.append('step/end', { turn: state.turn, step: state.step })
  state.step += 1
  state.session.append('step/start', { turn: state.turn, step: state.step })
  state.stepHasAssistantRequest = false
  state.codexRequestTextBlocks = []
  state.codexRequestToolBlocks = []
}

function appendNativeLiveAssistantContent(
  state: NativeLiveState,
  content: JsonObject[],
  record: JsonlRecord | null,
  event: JsonObject | null,
  ledgerFields: LedgerFields | null = null,
): void {
  if (!Array.isArray(content) || content.length === 0) return
  state.assistantOrdinal += 1
  state.session.append('assistant/message', {
    turn: state.turn,
    step: state.step,
    message: {
      id: `${state.sessionId}-live-assistant-${state.assistantOrdinal}`,
      role: 'assistant',
      content,
      source: { kind: 'model', provider: state.source.provider, model: state.source.model },
    },
  }, { surfaceOp: 'append' })
  if (ledgerFields !== null) appendLedgerRecord(state, record, event ?? {}, ledgerFields)
  state.stepHasAssistantRequest = true
}

function appendCodexPublicMessage(state: NativeLiveState, text: string, record: JsonlRecord, event: JsonObject, messageId: string | null): void {
  if (typeof text !== 'string' || text === '') return
  state.pendingCodexAssistants.push({ text, record, event, messageId })
  state.codexNextEventStartsStep = true
}

function linkNativeToolToAssistant(
  state: NativeLiveState,
  callId: string,
  toolName: string,
  argumentsText: string,
  record: JsonlRecord,
  event: JsonObject,
  label: string | null = null,
): void {
  if (state.assistantLinkedCalls.has(callId)) return
  const content: JsonObject[] = []
  if (!state.stepHasAssistantRequest && typeof label === 'string' && label !== '') {
    content.push({ type: 'text', text: label })
  }
  content.push({ type: 'tool-call', id: callId, name: toolName, arguments: argumentsText })
  appendNativeLiveAssistantContent(state, content, record, event, {
    event_type: 'request_anchor',
    tool_call_id: callId,
    tool_name: toolName,
    tool_arguments: argumentsText,
    status: 'observed',
  })
  state.assistantLinkedCalls.add(callId)
}

function prepareCodexToolRequest(state: NativeLiveState, callId: string, toolName: string, argumentsText: string, record: JsonlRecord, event: JsonObject): void {
  if (state.callSeqs.has(callId)) return
  if (state.codexNextEventStartsStep) {
    if (state.openCalls.size > 0) throw new Error('cannot start a new Codex request with an open tool call')
    rotateNativeLiveStep(state)
  }
  state.codexNextEventStartsStep = false
  if (state.codexRequestTextBlocks.length === 0) {
    if (state.pendingCodexAssistants.length > 0) {
      for (const pending of state.pendingCodexAssistants.splice(0)) {
        state.codexRequestTextBlocks.push({ type: 'text', text: pending.text })
        appendLedgerRecord(state, pending.record, pending.event, {
          event_type: 'assistant_message',
          public_assistant_message: pending.text,
          status: 'completed',
          tool_call_id: pending.messageId ?? null,
        })
      }
    } else {
      state.codexRequestTextBlocks.push({ type: 'text', text: `Observable Codex request: ${toolName}` })
    }
  }
  state.codexRequestToolBlocks.push({ type: 'tool-call', id: callId, name: toolName, arguments: argumentsText })
  appendNativeLiveAssistantContent(
    state,
    [...state.codexRequestTextBlocks, ...state.codexRequestToolBlocks],
    record,
    event,
    {
      event_type: 'request_anchor',
      tool_call_id: callId,
      tool_name: toolName,
      tool_arguments: argumentsText,
      status: 'observed',
    },
  )
  for (const block of state.codexRequestToolBlocks) state.assistantLinkedCalls.add(block.id)
}

function prepareImplantAgentModuleToolRequest(
  state: NativeLiveState,
  callId: string,
  item: JsonObject,
  argumentsText: string,
  record: JsonlRecord,
  event: JsonObject,
): { metadata: JsonObject; audit: ToolAuditMetadata } {
  const metadata = implantagentToolMetadata(item)
  if (metadata === null) {
    throw new Error(`unregistered ImplantAgent MCP tool cannot be assigned to M1-M6: ${codexRawToolName(item)}`)
  }
  if (state.callSeqs.has(callId)) {
    const existing = state.callLedgerMeta.get(callId) ?? {}
    return { metadata, audit: existing }
  }
  const dryRun = item.arguments?.dry_run === true
  const group = dryRun ? 'PREFLIGHT' : metadata.moduleId
  if (state.currentImplantAgentGroup !== null && state.currentImplantAgentGroup !== group) {
    if (state.openCalls.size > 0) throw new Error('cannot change ImplantAgent module with an open tool call')
    rotateNativeLiveStep(state)
  }
  state.currentImplantAgentGroup = group
  const requestTitle = dryRun
    ? 'Preflight · 固定工具完整性检查（不属于 M1–M6 临床执行）'
    : IMPLANTAGENT_MODULES[metadata.moduleId as keyof typeof IMPLANTAGENT_MODULES]
  const invocationIndex = (state.implantAgentInvocationCounts.get(metadata.rawToolName) ?? 0) + 1
  state.implantAgentInvocationCounts.set(metadata.rawToolName, invocationIndex)
  const audit: ToolAuditMetadata = {
    module_id: dryRun ? null : metadata.moduleId,
    node_id: metadata.nodeId,
    raw_tool_name: metadata.rawToolName,
    invocation_index: invocationIndex,
    retry_index: null,
  }
  appendNativeLiveAssistantContent(state, [
    { type: 'text', text: `${requestTitle}\n真实工具：${metadata.rawToolName}` },
    { type: 'tool-call', id: callId, name: metadata.visibleToolName, arguments: argumentsText },
  ], record, event, {
    event_type: 'request_anchor',
    tool_call_id: callId,
    tool_name: metadata.visibleToolName,
    tool_arguments: argumentsText,
    status: 'observed',
    ...audit,
  })
  state.assistantLinkedCalls.add(callId)
  return { metadata, audit }
}

function flushCodexFinalPublicRequest(state: NativeLiveState): void {
  if (state.pendingCodexAssistants.length === 0) return
  if (state.openCalls.size > 0) throw new Error('cannot flush final Codex public request with open tool calls')
  if (state.stepHasAssistantRequest) rotateNativeLiveStep(state)
  const pending = state.pendingCodexAssistants.splice(0)
  const content = pending.map(item => ({ type: 'text', text: item.text }))
  appendNativeLiveAssistantContent(state, content, pending[0]?.record ?? null, pending[0]?.event ?? null)
  for (const item of pending) {
    appendLedgerRecord(state, item.record, item.event, {
      event_type: 'assistant_message',
      public_assistant_message: item.text,
      status: 'completed',
      tool_call_id: item.messageId ?? null,
    })
  }
  state.codexNextEventStartsStep = false
}

function ensureNativeLiveToolCall(
  state: NativeLiveState,
  callId: string,
  toolName: string,
  argumentsText: string,
  record: JsonlRecord,
  event: JsonObject,
  audit: ToolAuditMetadata = {},
): number {
  const existing = state.callSeqs.get(callId)
  if (existing !== undefined) return existing
  const call = state.session.append('tool/call', {
    turn: state.turn,
    step: state.step,
    callId,
    name: toolName,
    arguments: argumentsText,
    meta: {
      importedBy: name,
      rawToolName: audit.raw_tool_name ?? toolName,
      moduleId: audit.module_id ?? null,
      nodeId: audit.node_id ?? null,
    },
  })
  state.callSeqs.set(callId, call.seq)
  state.callSteps.set(callId, state.step)
  state.openCalls.add(callId)
  const timestamp = sourceTimestamp(event)
  if (state.lastToolName !== null) {
    appendLedgerRecord(state, record, event, {
      event_type: 'tool_transition',
      status: 'observed',
      previous_tool: state.lastToolName,
      next_tool: toolName,
    })
  }
  appendLedgerRecord(state, record, event, {
    event_type: 'tool_call',
    tool_call_id: callId,
    tool_name: toolName,
    tool_arguments: argumentsText,
    status: 'in_progress',
    previous_tool: state.lastToolName,
    ...audit,
  })
  state.callLedgerMeta.set(callId, { toolName, startedAtMs: timestamp.milliseconds, ...audit })
  state.lastToolName = toolName
  state.lastToolCallId = callId
  return call.seq
}

function flushDeferredNativeRequests(state: NativeLiveState): void {
  if (state.openCalls.size > 0) return
  while (state.pendingClaudeAssistantEvents.length > 0 && state.openCalls.size === 0) {
    const pending = state.pendingClaudeAssistantEvents.shift()
    if (pending !== undefined) processClaudeAssistantEvent(state, pending.record as JsonlRecord, pending.event as JsonObject)
  }
}

function appendNativeLiveToolResult(
  state: NativeLiveState,
  callId: string,
  text: string,
  isError: boolean,
  record: JsonlRecord,
  event: JsonObject,
  durationOverrideMs: number | null = null,
): void {
  if (state.completedCalls.has(callId)) return
  const callSeq = state.callSeqs.get(callId)
  if (callSeq === undefined) throw new Error(`live native result lacks call ${callId}`)
  const callStep = state.callSteps.get(callId)
  if (callStep !== state.step) throw new Error(`live native result crossed steps for ${callId}`)
  state.resultOrdinal += 1
  state.session.append('tool/result', {
    turn: state.turn,
    step: callStep,
    message: {
      id: `${state.sessionId}-live-tool-result-${state.resultOrdinal}`,
      role: 'user',
      content: [{
        type: 'tool-result',
        toolCallId: callId,
        content: [{ type: 'text', text }],
        isError,
      }],
      source: { kind: 'tool', callId },
    },
    ...(isError ? { error: { name: 'ExternalToolError', code: 'EXTERNAL_TOOL_ERROR' } } : {}),
    meta: { importedBy: name, externalAgent: state.source.kind, sourceLine: record?.line ?? null, sourceEventType: event?.type ?? null },
  }, { surfaceOp: 'append', sourceEventSeqs: [callSeq] })
  const resultTimestamp = sourceTimestamp(event)
  const callMeta = state.callLedgerMeta.get(callId)
  const measuredDuration = callMeta?.startedAtMs !== null && callMeta?.startedAtMs !== undefined && resultTimestamp.milliseconds !== null
    ? Math.max(0, resultTimestamp.milliseconds - callMeta.startedAtMs)
    : null
  const duration = durationOverrideMs !== null && Number.isFinite(durationOverrideMs) && durationOverrideMs >= 0 ? durationOverrideMs : measuredDuration
  appendLedgerRecord(state, record, event, {
    event_type: 'tool_result',
    tool_call_id: callId,
    tool_name: callMeta?.toolName ?? null,
    tool_result: text,
    status: isError ? 'failed' : 'completed',
    duration_ms: duration,
    previous_tool: callMeta?.toolName ?? null,
    module_id: callMeta?.module_id ?? null,
    node_id: callMeta?.node_id ?? null,
    raw_tool_name: callMeta?.raw_tool_name ?? null,
    invocation_index: callMeta?.invocation_index ?? null,
    retry_index: callMeta?.retry_index ?? null,
  })
  state.completedCalls.add(callId)
  state.openCalls.delete(callId)
  flushDeferredNativeRequests(state)
}

function processClaudeAssistantEvent(state: NativeLiveState, record: JsonlRecord, event: JsonObject): void {
  const rawMessageId = event?.message?.id ?? event?.request_id ?? `line-${record.line}`
  const messageId = String(rawMessageId)
  if (state.currentClaudeMessageId !== null && state.currentClaudeMessageId !== messageId) {
    if (state.openCalls.size > 0) {
      state.pendingClaudeAssistantEvents.push({ record, event })
      return
    }
    rotateNativeLiveStep(state)
  }
  state.currentClaudeMessageId = messageId
  const blocks = Array.isArray(event.message.content) ? event.message.content : []
  const assistantContent: JsonObject[] = []
  const publicTexts: string[] = []
  const toolCalls: { callId: string; toolName: string; argumentsText: string }[] = []
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]
    const blockKey = `${messageId}:${block?.type ?? 'unknown'}:${block?.id ?? index}:${sha256Text(JSON.stringify(block ?? null))}`
    if (state.seenClaudeBlocks.has(blockKey)) continue
    state.seenClaudeBlocks.add(blockKey)
    if (block?.type === 'text') {
      if (typeof block.text === 'string' && block.text !== '') {
        assistantContent.push({ type: 'text', text: block.text })
        publicTexts.push(block.text)
      }
    } else if (block?.type === 'tool_use') {
      const callId = requireNonEmptyString(block.id, `Claude live tool_use at line ${record.line} id`)
      const toolName = requireNonEmptyString(block.name, `Claude live tool_use at line ${record.line} name`)
      const argumentsText = JSON.stringify(block.input ?? {})
      assistantContent.push({ type: 'tool-call', id: callId, name: toolName, arguments: argumentsText })
      toolCalls.push({ callId, toolName, argumentsText })
    }
  }
  if (assistantContent.length === 0) return
  appendNativeLiveAssistantContent(state, assistantContent, record, event, publicTexts.length === 0 ? null : {
    event_type: 'assistant_message',
    public_assistant_message: publicTexts.join('\n'),
    status: 'completed',
    tool_call_id: messageId,
  })
  for (const tool of toolCalls) {
    state.assistantLinkedCalls.add(tool.callId)
    ensureNativeLiveToolCall(state, tool.callId, tool.toolName, tool.argumentsText, record, event)
  }
}

function genericEventType(event: JsonObject, record: JsonlRecord): string {
  if (event?.schema_version !== 'external-agent-event-v1') {
    throw new Error(`generic live event at line ${record.line} must use schema_version external-agent-event-v1`)
  }
  return requireNonEmptyString(event.event_type ?? event.type, `generic live event at line ${record.line} event_type`)
    .trim()
    .toLowerCase()
    .replace(/[.-]+/g, '_')
}

function genericRequestId(event: JsonObject, record: JsonlRecord): string {
  return requireNonEmptyString(event.request_id, `generic live event at line ${record.line} request_id`)
}

function genericCallId(state: NativeLiveState, event: JsonObject, record: JsonlRecord): string {
  const raw = requireNonEmptyString(event.call_id, `generic live event at line ${record.line} call_id`)
  const normalized = sanitizeId(raw) || sha256Text(raw).slice(0, 12)
  return `external-live-generic-${sanitizeId(state.source.id)}-${normalized}`
}

function genericPublicText(event: JsonObject, record: JsonlRecord): string {
  return redactObservableText(requireNonEmptyString(
    event.public_message ?? event.text,
    `generic live event at line ${record.line} public_message`,
  ))
}

function genericAuditMetadata(event: JsonObject): ToolAuditMetadata {
  const metadata = event.metadata !== null && typeof event.metadata === 'object' && !Array.isArray(event.metadata)
    ? event.metadata
    : {}
  const optionalString = (key: string): string | null => {
    const value = event[key] ?? metadata[key]
    return typeof value === 'string' && value.trim() !== '' ? value : null
  }
  const optionalIndex = (key: string): number | null => {
    const value = event[key] ?? metadata[key]
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
  }
  return {
    module_id: optionalString('module_id'),
    node_id: optionalString('node_id'),
    raw_tool_name: optionalString('raw_tool_name'),
    invocation_index: optionalIndex('invocation_index'),
    retry_index: optionalIndex('retry_index'),
  }
}

function flushGenericRequestWithoutTool(state: NativeLiveState, record: JsonlRecord, event: JsonObject): void {
  if (state.stepHasAssistantRequest || state.codexRequestTextBlocks.length === 0) return
  appendNativeLiveAssistantContent(state, [...state.codexRequestTextBlocks], record, event)
}

function beginGenericRequest(state: NativeLiveState, record: JsonlRecord, event: JsonObject): void {
  const requestId = genericRequestId(event, record)
  if (state.currentGenericRequestId === requestId) {
    throw new Error(`generic request_started repeated request_id ${requestId}`)
  }
  if (state.openCalls.size > 0) throw new Error(`generic request ${requestId} started with open tool calls`)
  if (state.currentGenericRequestId !== null) {
    flushGenericRequestWithoutTool(state, record, event)
    rotateNativeLiveStep(state)
  }
  state.currentGenericRequestId = requestId
  state.codexRequestTextBlocks = [{ type: 'text', text: genericPublicText(event, record) }]
  state.codexRequestToolBlocks = []
  appendLedgerRecord(state, record, event, {
    event_type: 'request_started',
    public_assistant_message: genericPublicText(event, record),
    status: 'in_progress',
    tool_call_id: requestId,
  })
}

function assertGenericRequest(state: NativeLiveState, record: JsonlRecord, event: JsonObject): void {
  const requestId = genericRequestId(event, record)
  if (state.currentGenericRequestId !== requestId) {
    throw new Error(`generic event at line ${record.line} references request ${requestId}; active request is ${String(state.currentGenericRequestId)}`)
  }
}

function appendGenericAssistantMessage(state: NativeLiveState, record: JsonlRecord, event: JsonObject): void {
  assertGenericRequest(state, record, event)
  const text = genericPublicText(event, record)
  state.codexRequestTextBlocks.push({ type: 'text', text })
  appendNativeLiveAssistantContent(state, [{ type: 'text', text }], record, event, {
    event_type: 'assistant_message',
    public_assistant_message: text,
    status: 'completed',
    tool_call_id: state.currentGenericRequestId,
  })
}

function appendGenericToolCall(state: NativeLiveState, record: JsonlRecord, event: JsonObject): void {
  assertGenericRequest(state, record, event)
  const callId = genericCallId(state, event, record)
  if (state.callSeqs.has(callId)) return
  const toolName = requireNonEmptyString(event.tool_name, `generic tool_call at line ${record.line} tool_name`)
  const argumentsText = redactObservableText(event.arguments ?? {})
  const audit = genericAuditMetadata(event)
  state.codexRequestToolBlocks.push({ type: 'tool-call', id: callId, name: toolName, arguments: argumentsText })
  appendNativeLiveAssistantContent(
    state,
    [...state.codexRequestTextBlocks, ...state.codexRequestToolBlocks],
    record,
    event,
    {
      event_type: 'request_anchor',
      tool_call_id: callId,
      tool_name: toolName,
      tool_arguments: argumentsText,
      status: 'observed',
      ...audit,
    },
  )
  for (const block of state.codexRequestToolBlocks) state.assistantLinkedCalls.add(String(block.id))
  ensureNativeLiveToolCall(state, callId, toolName, argumentsText, record, event, audit)
}

function appendGenericToolResult(state: NativeLiveState, record: JsonlRecord, event: JsonObject): void {
  assertGenericRequest(state, record, event)
  const callId = genericCallId(state, event, record)
  const status = String(event.status ?? '').trim().toLowerCase()
  const isError = event.is_error === true || ['error', 'failed', 'failure'].includes(status)
  const duration = typeof event.duration_ms === 'number' && Number.isFinite(event.duration_ms) && event.duration_ms >= 0
    ? event.duration_ms
    : null
  appendNativeLiveToolResult(
    state,
    callId,
    redactObservableText(event.result ?? event.output ?? ''),
    isError,
    record,
    event,
    duration,
  )
}

function appendGenericRequestCompleted(state: NativeLiveState, record: JsonlRecord, event: JsonObject): void {
  assertGenericRequest(state, record, event)
  if (state.openCalls.size > 0) throw new Error(`generic request ${String(state.currentGenericRequestId)} completed with open tool calls`)
  flushGenericRequestWithoutTool(state, record, event)
  appendLedgerRecord(state, record, event, {
    event_type: 'request_completed',
    public_assistant_message: typeof event.public_message === 'string' ? redactObservableText(event.public_message) : null,
    status: 'completed',
    tool_call_id: state.currentGenericRequestId,
  })
}

function finalizeNativeLiveSession(state: NativeLiveState, succeeded: boolean, message: string, record: JsonlRecord, event: JsonObject): void {
  if (state.finalized) return
  for (const callId of state.openCalls) {
    appendNativeLiveToolResult(
      state,
      callId,
      `External run terminated before a tool result was observed: ${message}`,
      true,
      record,
      event,
    )
  }
  flushDeferredNativeRequests(state)
  if (state.source.kind === 'codex' && state.source.projectionMode !== 'implantagent-modules') flushCodexFinalPublicRequest(state)
  if (state.source.kind === 'generic') flushGenericRequestWithoutTool(state, record, event)
  if (state.lastToolName !== null) {
    appendLedgerRecord(state, record, event, {
      event_type: 'tool_transition',
      status: 'terminal',
      previous_tool: state.lastToolName,
      next_tool: null,
    })
  }
  appendLedgerRecord(state, record, event, {
    event_type: 'run_terminal',
    status: succeeded ? 'completed' : 'failed',
    tool_result: message,
    previous_tool: state.lastToolName,
  })
  state.session.append('session/title', {
    title: nativeLiveTitle(state, succeeded ? 'COMPLETED' : 'FAILED'),
    messageSeqs: [],
    source: { kind: 'user' },
  })
  state.session.append('step/end', { turn: state.turn, step: state.step })
  state.stepOpen = false
  state.session.append('turn/end', {
    turn: state.turn,
    reason: succeeded
      ? { kind: 'completed' }
      : { kind: 'error', error: { message, code: 'EXTERNAL_RUN_FAILED' } },
  })
  state.finalStatus = succeeded ? 'COMPLETED' : 'FAILED'
  state.finalized = true
}

export function appendNativeLiveRecords(state: NativeLiveState, records: readonly JsonlRecord[]): number {
  let appended = 0
  for (const record of records) {
    if (state.processedLines.has(record.line)) continue
    state.processedLines.add(record.line)
    const event = record.value
    if (state.finalized) continue

    if (state.source.kind === 'codex') {
      if (event?.type === 'turn.completed') {
        finalizeNativeLiveSession(state, true, 'External Codex run completed', record, event)
        appended += 3
        continue
      }
      if (event?.type === 'turn.failed') {
        finalizeNativeLiveSession(state, false, 'External Codex run failed', record, event)
        appended += 3
        continue
      }
      const item = event?.item
      if (item === null || typeof item !== 'object') continue
      if (item.type === 'todo_list' && Array.isArray(item.items)) {
        state.session.append('todo/write', {
          todos: item.items.map((entry: JsonObject) => ({
            content: typeof entry?.text === 'string' ? entry.text : JSON.stringify(entry),
            status: entry?.completed === true ? 'completed' : 'pending',
          })),
        })
        appended += 1
        continue
      }
      if (event.type === 'item.completed' && item.type === 'agent_message') {
        if (state.source.projectionMode === 'implantagent-modules') {
          appendLedgerRecord(state, record, event, {
            event_type: 'assistant_message',
            public_assistant_message: item.text,
            status: 'completed',
            tool_call_id: item.id ?? `line-${record.line}`,
            module_id: state.currentImplantAgentGroup?.startsWith('M') ? state.currentImplantAgentGroup : null,
          })
        } else {
          appendCodexPublicMessage(state, item.text, record, event, item.id ?? `line-${record.line}`)
        }
        appended += 1
        continue
      }
      if (TOOL_ITEM_TYPES.has(item.type) && (event.type === 'item.started' || event.type === 'item.completed')) {
        const rawId = typeof item.id === 'string' && item.id !== '' ? item.id : `line-${record.line}`
        const callId = `external-live-codex-${sanitizeId(rawId)}`
        const argumentsText = codexToolArguments(item)
        let visibleToolName = codexToolDisplayName(item)
        let audit = {}
        if (state.source.projectionMode === 'implantagent-modules' && item.type === 'mcp_tool_call') {
          const prepared = prepareImplantAgentModuleToolRequest(state, callId, item, argumentsText, record, event)
          visibleToolName = prepared.metadata.visibleToolName
          audit = prepared.audit
        } else {
          prepareCodexToolRequest(state, callId, visibleToolName, argumentsText, record, event)
        }
        ensureNativeLiveToolCall(state, callId, visibleToolName, argumentsText, record, event, audit)
        appended += event.type === 'item.started' ? 1 : 0
        if (event.type === 'item.completed') {
          const exitCode = Number.isInteger(item.exit_code) ? item.exit_code : undefined
          const failed = item.status === 'failed' || (exitCode !== undefined && exitCode !== 0)
          appendNativeLiveToolResult(state, callId, codexToolResult(item), failed, record, event, item.duration_ms ?? null)
          appended += 1
        }
      }
      continue
    }

    if (state.source.kind === 'claude') {
      if (event?.type === 'assistant' && event.message && typeof event.message === 'object') {
        processClaudeAssistantEvent(state, record, event)
        appended += 1
        continue
      }
      if (event?.type === 'user' && event.message && typeof event.message === 'object') {
        for (const block of Array.isArray(event.message.content) ? event.message.content : []) {
          if (block?.type !== 'tool_result') continue
          const callId = requireNonEmptyString(block.tool_use_id, `Claude live tool_result at line ${record.line} id`)
          linkNativeToolToAssistant(state, callId, 'external_unmatched_tool_result', '{}', record, event, 'Observable unmatched external tool result')
          ensureNativeLiveToolCall(state, callId, 'external_unmatched_tool_result', '{}', record, event)
          appendNativeLiveToolResult(state, callId, claudeResultText(block.content), block.is_error === true, record, event)
          appended += 1
        }
        continue
      }
      if (event?.type === 'result') {
        const succeeded = event.subtype === 'success' && event.is_error !== true && event.terminal_reason !== 'api_error'
        finalizeNativeLiveSession(state, succeeded, `External Claude terminal subtype: ${String(event.subtype ?? 'unknown')}`, record, event)
        appended += 3
      }
      continue
    }

    if (state.source.kind === 'generic') {
      const type = genericEventType(event, record)
      if (type === 'run_started') {
        appendLedgerRecord(state, record, event, { event_type: 'run_started', status: 'in_progress' })
        appended += 1
        continue
      }
      if (type === 'request_started') {
        beginGenericRequest(state, record, event)
        appended += 1
        continue
      }
      if (type === 'assistant_message') {
        appendGenericAssistantMessage(state, record, event)
        appended += 1
        continue
      }
      if (type === 'tool_call') {
        appendGenericToolCall(state, record, event)
        appended += 2
        continue
      }
      if (type === 'tool_result') {
        appendGenericToolResult(state, record, event)
        appended += 1
        continue
      }
      if (type === 'request_completed') {
        appendGenericRequestCompleted(state, record, event)
        appended += 1
        continue
      }
      if (type === 'run_completed' || type === 'run_failed') {
        const failed = type === 'run_failed' || ['error', 'failed', 'failure'].includes(String(event.status ?? '').toLowerCase())
        finalizeNativeLiveSession(
          state,
          !failed,
          typeof event.message === 'string' && event.message !== '' ? redactObservableText(event.message) : `External generic run ${failed ? 'failed' : 'completed'}`,
          record,
          event,
        )
        appended += 3
        continue
      }
      throw new Error(`generic live event at line ${record.line} has unsupported event_type ${type}`)
    }
  }
  return appended
}

export function unflushedNativeLedgerRecords(state: NativeLiveState): NormalizedLedgerRecord[] {
  return state.ledgerRecords.slice(state.ledgerFlushedCount)
}

export function markNativeLedgerFlushed(state: NativeLiveState): void {
  state.ledgerFlushedCount = state.ledgerRecords.length
}

function buildGenericObservableTrace(context: JsonObject, records: readonly JsonlRecord[], malformedLines: readonly number[], runRecord: RunRecord): ObservableTrace {
  const events: ObservableTraceEvent[] = []
  const toolsById = new Map<string, ObservableTraceEvent>()
  let publicContext = ''
  let phase = 0
  let missingPerEventTimestamps = 0
  for (const record of records) {
    const event = record.value
    const type = genericEventType(event, record)
    const timestampMs = exactEventTime(event.timestamp)
    if (timestampMs === null) missingPerEventTimestamps += 1
    if (type === 'request_started' || type === 'assistant_message') {
      phase += 1
      publicContext = genericPublicText(event, record)
      events.push({
        seq: 0,
        kind: type === 'request_started' ? 'public_plan' : 'public_reasoning',
        phase,
        timestampMs,
        timeEvidence: timestampMs === null ? 'not-recorded' : 'source-event',
        sourceLine: record.line,
        requestId: genericRequestId(event, record),
        text: publicContext,
        preview: previewText(publicContext),
      })
      continue
    }
    if (type === 'tool_call') {
      const callId = requireNonEmptyString(event.call_id, `generic tool_call at line ${record.line} call_id`)
      const toolName = requireNonEmptyString(event.tool_name, `generic tool_call at line ${record.line} tool_name`)
      const argumentsText = redactObservableText(event.arguments ?? {})
      const audit = genericAuditMetadata(event)
      const tool: ObservableTraceEvent = {
        seq: 0,
        kind: 'tool',
        phase,
        timestampMs,
        resultTimestampMs: null,
        timeEvidence: timestampMs === null ? 'not-recorded' : 'source-event',
        durationMs: null,
        gapFromPreviousToolMs: null,
        callId,
        toolName,
        rawToolName: audit.raw_tool_name ?? toolName,
        workflowNodeId: audit.node_id ?? null,
        workflowModuleId: audit.module_id ?? null,
        invocationIndex: audit.invocation_index ?? null,
        retryIndex: audit.retry_index ?? null,
        status: 'pending',
        exitCode: null,
        callSourceLine: record.line,
        resultSourceLine: null,
        arguments: argumentsText,
        argumentsPreview: previewText(argumentsText),
        result: '',
        resultPreview: '',
        publicContextBefore: publicContext,
        publicContextPreview: publicContext === '' ? '' : previewText(publicContext),
      }
      events.push(tool)
      toolsById.set(callId, tool)
      continue
    }
    if (type === 'tool_result') {
      const callId = requireNonEmptyString(event.call_id, `generic tool_result at line ${record.line} call_id`)
      const tool = toolsById.get(callId)
      if (tool === undefined) throw new Error(`generic tool_result at line ${record.line} has no preceding tool_call ${callId}`)
      const status = String(event.status ?? '').trim().toLowerCase()
      const failed = event.is_error === true || ['error', 'failed', 'failure'].includes(status)
      const resultText = redactObservableText(event.result ?? event.output ?? '')
      tool.resultTimestampMs = timestampMs
      tool.resultSourceLine = record.line
      tool.status = failed ? 'error' : 'success'
      tool.result = resultText
      tool.resultPreview = previewText(resultText)
      tool.durationMs = typeof event.duration_ms === 'number' && Number.isFinite(event.duration_ms) && event.duration_ms >= 0
        ? event.duration_ms
        : tool.timestampMs !== null && timestampMs !== null ? Math.max(0, timestampMs - tool.timestampMs) : null
      if (failed) Object.assign(tool, classifyToolError(tool))
    }
  }
  return makeObservableTrace(context, runRecord, malformedLines, 'source-event-when-provided', events, {
    missingPerEventTimestamps,
    hiddenReasoningContentIncluded: 0,
  })
}

function buildImplantAgentToolTrace(context: JsonObject, records: readonly JsonlRecord[], malformedLines: readonly number[], runRecord: RunRecord): ObservableTrace {
  const events: ObservableTraceEvent[] = []
  for (const record of records) {
    const row = record.value
    if (row?.schema_version !== 'implantagent-tool-trace-v1') continue
    const timestampMs = exactEventTime(row.started_at_utc)
    const resultTimestampMs = exactEventTime(row.finished_at_utc)
    const failed = String(row.status).toUpperCase() === 'ERROR'
    const argumentsText = redactObservableText({
      input_keys: row.input_keys ?? [],
      request_path: row.request_path ?? null,
      requested_output_path: row.requested_output_path ?? null,
      argument_sha256: row.argument_sha256 ?? null,
      dry_run: row.dry_run === true,
      trace_context: row.trace_context ?? {},
    })
    const resultText = redactObservableText({
      status: row.status ?? null,
      node_id: row.node_id ?? null,
      module_id: row.module_id ?? null,
      source_commit: row.source_commit ?? null,
      output_path: row.output_path ?? null,
      output_sha256: row.output_sha256 ?? null,
      error_type: row.error_type ?? null,
      error_message: row.error_message ?? null,
    })
    events.push({
      seq: 0,
      kind: 'tool',
      phase: 0,
      timestampMs,
      resultTimestampMs,
      timeEvidence: timestampMs === null ? 'not-recorded' : 'source-event',
      durationMs: Number.isFinite(row.duration_ms)
        ? Math.max(0, Number(row.duration_ms))
        : timestampMs !== null && resultTimestampMs !== null ? Math.max(0, resultTimestampMs - timestampMs) : null,
      gapFromPreviousToolMs: null,
      callId: typeof row.call_id === 'string' ? row.call_id : `line-${record.line}`,
      toolName: typeof row.public_tool_name === 'string' ? row.public_tool_name : String(row.raw_tool_name ?? 'implantagent_tool'),
      rawToolName: typeof row.raw_tool_name === 'string' ? row.raw_tool_name : null,
      workflowNodeId: typeof row.node_id === 'string' ? row.node_id : null,
      workflowModuleId: typeof row.module_id === 'string' ? row.module_id : null,
      status: failed ? 'error' : 'success',
      exitCode: null,
      callSourceLine: record.line,
      resultSourceLine: record.line,
      arguments: argumentsText,
      argumentsPreview: previewText(argumentsText),
      result: resultText,
      resultPreview: previewText(resultText),
      publicContextBefore: '',
      publicContextPreview: '',
    })
  }
  return makeObservableTrace(context, runRecord, malformedLines, 'source-event-timestamps', events, {
    hiddenReasoningContentIncluded: 0,
  })
}

function emptyLiveMonitorTrace(liveSources: readonly LiveSource[]): ObservableTrace {
  const now = Date.now()
  return {
    schemaVersion: 1,
    sessionId: LIVE_MONITOR_SESSION_ID,
    agent: 'external agents',
    caseId: '实时监视 · 暂无可读取日志',
    title: 'External agents live monitor',
    source: { path: liveSources.map(source => source.root).join(' | '), malformedLines: [], timeCoverage: 'mixed-live-sources' },
    run: { startedAtMs: now, finishedAtMs: now, durationMs: 0 },
    boundary: {
      label: 'observable-reasoning', publicDecisionTextOnly: true,
      hiddenChainOfThoughtIncluded: false, hiddenReasoningMarkersContainContent: false,
      sourceOfTruth: 'configured JSONL files',
    },
    stats: {
      observableEvents: 0, toolCalls: 0, publicReasoningEvents: 0, publicPlanEvents: 0,
      privateReasoningMarkers: 0, successfulTools: 0, failedTools: 0,
      exactToolTimestamps: 0, exactToolDurations: 0, liveStreams: 0, monitoredStreams: liveSources.length,
    },
    events: [],
    live: false,
    streams: [],
  }
}

export async function buildLiveMonitorTrace(liveManifest: LiveManifest): Promise<ObservableTrace> {
  const sources = liveManifest.sources
  const output = emptyLiveMonitorTrace(sources)
  const traces: {
    source: LiveSource
    latest: LatestLiveFile
    trace: ObservableTrace
    isLive: boolean
    caseId: string
  }[] = []
  for (const source of sources) {
    const latest = await latestLiveFile(source)
    if (latest === null) continue
    const jsonl = await readJsonl(latest.path)
    const sha256 = sha256Text(jsonl.text)
    const caseId = caseIdFromFilename(latest.name)
    const agent = source.kind === 'implantagent-trace' ? 'implantagent' : source.kind
    const context = {
      source: {
        agent,
        caseId,
        title: `${source.label} ${caseId}`,
        sourcePath: latest.path,
      },
      sha256,
      sessionId: LIVE_MONITOR_SESSION_ID,
    }
    const runRecord = liveRunRecord(jsonl.records, latest.details)
    const trace = source.kind === 'codex'
      ? buildCodexObservableTrace(context, jsonl.records, jsonl.malformedLines, runRecord)
      : source.kind === 'claude'
        ? buildClaudeObservableTrace(context, jsonl.records, jsonl.malformedLines, runRecord)
        : source.kind === 'generic'
          ? buildGenericObservableTrace(context, jsonl.records, jsonl.malformedLines, runRecord)
          : buildImplantAgentToolTrace(context, jsonl.records, jsonl.malformedLines, runRecord)
    const isLive = Date.now() - latest.details.mtimeMs < 15_000
    for (const event of trace.events) {
      event.streamId = source.id
      event.streamLabel = source.label
      event.streamCaseId = caseId
      event.streamLive = isLive
    }
    traces.push({ source, latest, trace, isLive, caseId })
  }
  if (traces.length === 0) return output

  const events = traces.flatMap(item => item.trace.events)
  events.forEach((event, index) => { event.seq = index + 1 })
  const startedAtMs = Math.min(...traces.map(item => item.trace.run.startedAtMs))
  const finishedAtMs = Math.max(...traces.map(item => item.trace.run.finishedAtMs))
  const sum = (key: string): number => traces.reduce((total, item) => total + Number(item.trace.stats[key] ?? 0), 0)
  return {
    ...output,
    caseId: `实时监视 · ${traces.length} 条最新运行`,
    run: { startedAtMs, finishedAtMs, durationMs: Math.max(0, finishedAtMs - startedAtMs) },
    stats: {
      observableEvents: events.length,
      toolCalls: sum('toolCalls'),
      publicReasoningEvents: sum('publicReasoningEvents'),
      publicPlanEvents: sum('publicPlanEvents'),
      privateReasoningMarkers: sum('privateReasoningMarkers'),
      successfulTools: sum('successfulTools'),
      failedTools: sum('failedTools'),
      exactToolTimestamps: sum('exactToolTimestamps'),
      exactToolDurations: sum('exactToolDurations'),
      liveStreams: traces.filter(item => item.isLive).length,
      monitoredStreams: sources.length,
    },
    events,
    live: traces.some(item => item.isLive),
    streams: traces.map(item => ({
      id: item.source.id,
      label: item.source.label,
      kind: item.source.kind,
      caseId: item.caseId,
      path: item.latest.path,
      sha256: item.trace.source.sha256,
      lastModifiedAtMs: item.latest.details.mtimeMs,
      live: item.isLive,
      toolCalls: item.trace.stats.toolCalls,
      publicReasoningEvents: item.trace.stats.publicReasoningEvents,
      failedTools: item.trace.stats.failedTools,
      timeCoverage: item.trace.source.timeCoverage,
    })),
    errorComparison: traces.map(item => {
      const tools = item.trace.events.filter(event => event.kind === 'tool')
      const errors = tools.filter(event => event.status === 'error')
      const counts = new Map<string, number>()
      const categoryCounts = new Map<string, number>()
      for (const event of errors) {
        const toolName = event.toolName ?? event.rawToolName ?? 'unknown'
        counts.set(toolName, (counts.get(toolName) ?? 0) + 1)
      }
      for (const event of errors) {
        const classified = event.errorCategory === undefined ? classifyToolError(event) : {
          category: event.errorCategory,
          categoryLabel: event.errorCategoryLabel,
        }
        event.errorCategory = classified.category
        event.errorCategoryLabel = classified.categoryLabel
        categoryCounts.set(classified.categoryLabel, (categoryCounts.get(classified.categoryLabel) ?? 0) + 1)
      }
      const first = errors[0]
      const recoveryDistances: number[] = []
      for (const error of errors) {
        const errorIndex = tools.indexOf(error)
        const recoveryIndex = tools.findIndex((candidate, index) => index > errorIndex && candidate.toolName === error.toolName && candidate.status === 'success')
        if (recoveryIndex >= 0) recoveryDistances.push(recoveryIndex - errorIndex)
      }
      const workflowNodes = new Set(tools.flatMap(event => typeof event.workflowNodeId === 'string' && event.workflowNodeId !== '' ? [event.workflowNodeId] : []))
      const diagnostic = (event: ObservableTraceEvent) => ({
        toolName: event.toolName,
        rawToolName: event.rawToolName,
        errorCategory: event.errorCategory,
        errorCategoryLabel: event.errorCategoryLabel,
        timestampMs: event.timestampMs,
        transition: event.transition,
        callSourceLine: event.callSourceLine,
        resultSourceLine: event.resultSourceLine,
        publicContextPreview: event.publicContextPreview,
        argumentsPreview: event.argumentsPreview,
        resultPreview: event.resultPreview,
      })
      return {
        id: item.source.id,
        label: item.source.label,
        kind: item.source.kind,
        caseId: item.caseId,
        toolCalls: item.trace.stats.toolCalls,
        successfulTools: tools.filter(event => event.status === 'success').length,
        pendingTools: tools.filter(event => event.status === 'pending').length,
        uniqueTools: new Set(tools.map(event => event.toolName)).size,
        workflowMode: workflowNodes.size > 0 ? '结构化业务节点 overlay；工具编排可变' : '自由工具编排',
        workflowNodeCount: workflowNodes.size,
        timeCoverage: item.trace.source.timeCoverage,
        failedTools: errors.length,
        failureRate: item.trace.stats.toolCalls === 0 ? 0 : errors.length / item.trace.stats.toolCalls,
        recoveredFailures: recoveryDistances.length,
        unrecoveredFailures: errors.length - recoveryDistances.length,
        averageRecoveryToolSteps: recoveryDistances.length === 0 ? null : recoveryDistances.reduce((total, value) => total + value, 0) / recoveryDistances.length,
        errorTools: [...counts].map(([toolName, count]) => ({ toolName, count })).sort((left, right) => right.count - left.count || left.toolName.localeCompare(right.toolName)),
        errorCategories: [...categoryCounts].map(([label, count]) => ({ label, count })).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)),
        firstError: first === undefined ? null : diagnostic(first),
        diagnostics: errors.map(diagnostic),
      }
    }),
  }
}

export function buildMonitorStats(trace: ObservableTrace, rawArgs: MonitorStatsArgs = {}): JsonObject {
  if (rawArgs === null || typeof rawArgs !== 'object' || Array.isArray(rawArgs)) {
    throw new Error('trajectory_stats arguments must be an object')
  }
  const args: MonitorStatsArgs = rawArgs
  for (const key of Object.keys(args)) {
    if (!['agent', 'case_id', 'tool_name', 'include_errors'].includes(key)) {
      throw new Error(`trajectory_stats does not accept argument ${key}`)
    }
  }
  for (const key of ['agent', 'case_id', 'tool_name'] as const) {
    if (args[key] !== undefined && typeof args[key] !== 'string') {
      throw new Error(`${key} must be a string when provided`)
    }
  }
  if (args.include_errors !== undefined && typeof args.include_errors !== 'boolean') {
    throw new Error('include_errors must be a boolean when provided')
  }

  const selector = (args.agent ?? 'all').trim().toLowerCase()
  const aliases: Record<string, string> = {
    implantagent: 'implantagent-external',
    'implant-agent': 'implantagent-external',
    implantagent_external: 'implantagent-external',
    codex: 'codex-only',
    claude: 'claude-only',
  }
  const selectedId = aliases[selector] ?? selector
  const comparisons = Array.isArray(trace.errorComparison) ? trace.errorComparison : []
  const arms = selectedId === '' || selectedId === 'all'
    ? comparisons
    : comparisons.filter(arm => [arm.id, arm.kind, arm.label].some(value => String(value).toLowerCase() === selectedId))
  if (arms.length === 0) throw new Error(`unknown external agent ${String(args.agent)}; use all or a configured source id, kind, or label`)

  const caseFilter = (args.case_id ?? '').trim().toLowerCase()
  const toolFilter = (args.tool_name ?? '').trim().toLowerCase()
  const allEvents = Array.isArray(trace.events) ? trace.events : []
  const summaries = arms.map(arm => {
    const armTools = allEvents.filter(event => event.kind === 'tool' && event.streamId === arm.id)
    const caseTools = caseFilter === ''
      ? armTools
      : armTools.filter(event => String(event.streamCaseId ?? '').toLowerCase() === caseFilter)
    const tools = toolFilter === ''
      ? caseTools
      : caseTools.filter(event => [event.toolName, event.rawToolName].some(value => String(value ?? '').toLowerCase().includes(toolFilter)))
    const success = tools.filter(event => event.status === 'success')
    const errors = tools.filter(event => event.status === 'error')
    const pending = tools.filter(event => event.status === 'pending')
    const toolCounts = new Map<string, { toolName: string; calls: number; success: number; error: number; pending: number }>()
    const categoryCounts = new Map<string, number>()
    for (const event of tools) {
      const toolName = event.toolName ?? event.rawToolName ?? 'unknown'
      const current = toolCounts.get(toolName) ?? { toolName, calls: 0, success: 0, error: 0, pending: 0 }
      current.calls += 1
      if (event.status === 'success') current.success += 1
      else if (event.status === 'error') current.error += 1
      else if (event.status === 'pending') current.pending += 1
      toolCounts.set(toolName, current)
    }
    for (const event of errors) {
      const classified = event.errorCategory === undefined ? classifyToolError(event) : {
        category: event.errorCategory,
        categoryLabel: event.errorCategoryLabel,
      }
      const label = classified.categoryLabel ?? classified.category
      categoryCounts.set(label, (categoryCounts.get(label) ?? 0) + 1)
    }
    const recoveryDistances: number[] = []
    for (const error of errors) {
      const errorIndex = tools.indexOf(error)
      const recoveryIndex = tools.findIndex((candidate, index) => index > errorIndex && candidate.toolName === error.toolName && candidate.status === 'success')
      if (recoveryIndex >= 0) recoveryDistances.push(recoveryIndex - errorIndex)
    }
    return {
      id: arm.id,
      label: arm.label,
      caseId: caseFilter === '' ? arm.caseId : args.case_id,
      workflowMode: arm.workflowMode,
      allToolCallsInSelectedCase: caseTools.length,
      matchingToolCalls: tools.length,
      uniqueMatchingTools: toolCounts.size,
      successfulCalls: success.length,
      failedCalls: errors.length,
      pendingCalls: pending.length,
      failureRate: tools.length === 0 ? 0 : errors.length / tools.length,
      recoveredFailures: recoveryDistances.length,
      unrecoveredFailures: errors.length - recoveryDistances.length,
      averageRecoveryToolSteps: recoveryDistances.length === 0
        ? null
        : recoveryDistances.reduce((total, value) => total + value, 0) / recoveryDistances.length,
      toolCounts: [...toolCounts.values()].sort((left, right) => right.calls - left.calls || left.toolName.localeCompare(right.toolName)),
      errorCategories: [...categoryCounts].map(([label, count]) => ({ label, count }))
        .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)),
      ...(args.include_errors === true ? {
        errorExamples: errors.slice(0, 10).map(event => ({
          toolName: event.toolName,
          category: event.errorCategoryLabel ?? event.errorCategory,
          callSourceLine: event.callSourceLine,
          resultSourceLine: event.resultSourceLine,
          resultPreview: event.resultPreview,
        })),
      } : {}),
    }
  })

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: 'read-only deterministic live trajectory snapshot',
    deterministic: true,
    readOnly: true,
    hiddenChainOfThoughtIncluded: false,
    filters: {
      agent: args.agent ?? 'all',
      caseId: args.case_id ?? null,
      toolName: args.tool_name ?? null,
      includeErrors: args.include_errors === true,
    },
    arms: summaries,
    caveats: [
      'Counts come from observable JSONL events, not model inference.',
      'Recovery means a later successful call of the same normalized tool; it is not proof of root-cause resolution.',
      'Codex source order is preserved when per-event timestamps are absent; timestamps are never fabricated.',
      'Hidden chain-of-thought is not collected or reconstructed.',
    ],
  }
}

export function deriveSessionId(source: HistoricalSource, sha256: string): string {
  return `${SESSION_PREFIX}${sanitizeId(source.agent)}-${sanitizeId(source.caseId)}-${sha256.slice(0, 12)}`
}

export function isImportedSessionId(sessionId: unknown): sessionId is string {
  return typeof sessionId === 'string' && sessionId.startsWith(SESSION_PREFIX)
}

export async function readonlyImportedSessionGuard(
  { agent }: { agent?: { session?: { id?: string } } },
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  if (isImportedSessionId(agent?.session?.id)) return { kind: 'reject' }
  return next()
}

export async function prepareImport(source: HistoricalSource) {
  const jsonl = await readJsonl(source.sourcePath)
  const sha256 = sha256Text(jsonl.text)
  if (sha256 !== source.expectedSha256) {
    throw new Error(`source hash mismatch for ${source.sourcePath}: expected ${source.expectedSha256}, got ${sha256}`)
  }
  const rawRunRecord = await readJson(source.runRecordPath, `${source.agent} run record`)
  const runRecord: RunRecord = {
    ...rawRunRecord,
    started_at_utc: requireNonEmptyString(rawRunRecord.started_at_utc, `${source.agent} run started_at_utc`),
    finished_at_utc: requireNonEmptyString(rawRunRecord.finished_at_utc, `${source.agent} run finished_at_utc`),
  }
  const sessionId = deriveSessionId(source, sha256)
  const context = { source, sha256, sessionId }
  const converted = source.agent === 'codex'
    ? buildCodexEvents(context, jsonl.records, jsonl.malformedLines, runRecord)
    : buildClaudeEvents(context, jsonl.records, jsonl.malformedLines, runRecord)
  const observableTrace = source.agent === 'codex'
    ? buildCodexObservableTrace(context, jsonl.records, jsonl.malformedLines, runRecord)
    : buildClaudeObservableTrace(context, jsonl.records, jsonl.malformedLines, runRecord)
  return {
    source,
    sessionId,
    sha256,
    createdAt: parseEpoch(runRecord.started_at_utc, `${source.agent} run started_at_utc`),
    events: converted.events,
    observableTrace,
    summary: {
      sourceLines: jsonl.records.length + jsonl.malformedLines.length,
      mappedEvents: converted.events.length,
      ...converted.summary,
    },
  }
}

function validateConfig(config: unknown): PluginConfig {
  if (config === undefined) return { manifestPath: DEFAULT_MANIFEST_PATH, liveManifestPath: DEFAULT_LIVE_MANIFEST_PATH }
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('external trajectory importer config must be an object')
  }
  const candidate = config as JsonObject
  const manifestPath = candidate.manifestPath === undefined
    ? DEFAULT_MANIFEST_PATH
    : requireNonEmptyString(candidate.manifestPath, 'manifestPath')
  const liveManifestPath = candidate.liveManifestPath === undefined
    ? DEFAULT_LIVE_MANIFEST_PATH
    : requireNonEmptyString(candidate.liveManifestPath, 'liveManifestPath')
  const reportPath = candidate.reportPath === undefined
    ? undefined
    : requireNonEmptyString(candidate.reportPath, 'reportPath')
  if (!isAbsolute(manifestPath) || !isAbsolute(liveManifestPath) || (reportPath !== undefined && !isAbsolute(reportPath))) {
    throw new Error('manifestPath, liveManifestPath and reportPath must be absolute when configured')
  }
  return {
    manifestPath: resolve(manifestPath),
    liveManifestPath: resolve(liveManifestPath),
    ...(reportPath === undefined ? {} : { reportPath: resolve(reportPath) }),
  }
}

export function liveMonitorSeed(time: number): EventLog['events'] {
  const log = makeEventLog()
  const turn = 1
  log.append('turn/start', time, { turn })
  log.append('user/message', time, {
    id: `${LIVE_MONITOR_SESSION_ID}-notice`,
    role: 'user',
    content: [{ type: 'text', text: 'Read-only live monitor for any configured external agent public Request and tool trajectory. Codex and Claude use native adapters; other processes use external-agent-event-v1 JSONL. No model is run by this session.' }],
    source: { kind: 'plugin', plugin: name, form: 'notice', summary: 'External agents live monitor' },
  }, { surfaceOp: 'append' })
  log.append('session/title', time, {
    title: '[Live Monitor] External agents',
    messageSeqs: [],
    source: { kind: 'user' },
  })
  log.append('turn/end', time, { turn, reason: { kind: 'completed' } })
  return log.events
}

export async function apply(ctx: HarnessContext, rawConfig: unknown): Promise<void> {
  const config = validateConfig(rawConfig)
  ctx.on('agent/pre-step', readonlyImportedSessionGuard)

  const manifest = await loadManifest(config.manifestPath)
  const liveManifest = await loadLiveManifest(config.liveManifestPath)
  ctx.tools.register({
    name: 'trajectory_stats',
    description: 'Read-only deterministic statistics for all configured external-agent trajectories. Use this tool to count calls, compare failures and recovery, or filter by source/case/tool. It never runs or changes an evaluated agent and never exposes hidden chain-of-thought.',
    parameters: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Optional: all, or any configured source id, kind, or label.' },
        case_id: { type: 'string', description: 'Optional exact case id from the current live stream.' },
        tool_name: { type: 'string', description: 'Optional case-insensitive tool-name substring, such as jq or build_case_outputs.py.' },
        include_errors: { type: 'boolean', description: 'Include up to 10 bounded error examples; false by default.' },
      },
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args: MonitorStatsArgs) {
      return buildMonitorStats(await buildLiveMonitorTrace(liveManifest), args)
    },
  })
  const existing = new Set((await ctx.sessionPersistence.list()).map(header => header.id))
  const traceBodies = new Map<string, string>()
  let liveCache = { expiresAt: 0, body: '' }
  const report: ImportReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    modelRunsStarted: 0,
    sourceFilesModified: 0,
    monitorTool: 'trajectory_stats',
    sessions: [],
  }

  for (const source of manifest.sessions) {
    const prepared = await prepareImport(source)
    traceBodies.set(prepared.sessionId, JSON.stringify(prepared.observableTrace))
    if (existing.has(prepared.sessionId)) {
      report.sessions.push({
        agent: source.agent,
        caseId: source.caseId,
        sessionId: prepared.sessionId,
        sourcePath: source.sourcePath,
        sourceSha256: prepared.sha256,
        status: 'already-imported',
        summary: prepared.summary,
      })
      continue
    }
    const session = ctx.sessions.create(prepared.sessionId, {
      seed: prepared.events,
      meta: { cwd: source.cwd, createdAt: prepared.createdAt },
    })
    await ctx.sessions.flush(session)
    existing.add(prepared.sessionId)
    report.sessions.push({
      agent: source.agent,
      caseId: source.caseId,
      sessionId: prepared.sessionId,
      sourcePath: source.sourcePath,
      sourceSha256: prepared.sha256,
      status: 'imported',
      summary: prepared.summary,
    })
  }

  const nativeStates = new Map<string, NativeLiveState>()
  let nativeTickRunning = false
  const nativeTick = async () => {
    if (nativeTickRunning) return
    nativeTickRunning = true
    try {
      for (const source of liveManifest.sources.filter(item => item.nativeSession && ['codex', 'claude', 'generic'].includes(item.kind))) {
        const latest = await latestLiveFile(source)
        if (latest === null) continue
        const caseId = caseIdFromFilename(latest.name)
        const sessionId = nativeLiveSessionId(source, latest.path, caseId)
        let state = nativeStates.get(sessionId)
        if (state === undefined) {
          if (existing.has(sessionId)) continue
          const session = ctx.sessions.create(sessionId, {
            meta: { cwd: source.cwd, createdAt: Math.max(0, Math.floor(latest.details.birthtimeMs || latest.details.ctimeMs || Date.now())) },
          })
          state = initializeNativeLiveSession(session, source, latest.path, caseId)
          nativeStates.set(sessionId, state)
          existing.add(sessionId)
          report.sessions.push({
            agent: source.kind,
            caseId,
            sessionId,
            sourcePath: latest.path,
            status: 'live-native-session-created',
          })
        }
        const jsonl = await readJsonl(latest.path)
        const appended = appendNativeLiveRecords(state, jsonl.records)
        const runRecord = liveRunRecord(jsonl.records, latest.details)
        const context = {
          source: {
            agent: source.kind,
            caseId,
            title: nativeLiveTitle(state, state.finalStatus ?? 'RUNNING'),
            provider: source.provider,
            model: source.model,
            sourcePath: latest.path,
          },
          sha256: sha256Text(jsonl.text),
          sessionId,
        }
        const trace = source.kind === 'codex'
          ? buildCodexObservableTrace(context, jsonl.records, jsonl.malformedLines, runRecord)
          : source.kind === 'claude'
            ? buildClaudeObservableTrace(context, jsonl.records, jsonl.malformedLines, runRecord)
            : buildGenericObservableTrace(context, jsonl.records, jsonl.malformedLines, runRecord)
        traceBodies.set(sessionId, JSON.stringify(trace))
        const ledgerBatch = unflushedNativeLedgerRecords(state)
        if (ledgerBatch.length > 0) {
          await mkdir(source.ledgerRoot, { recursive: true })
          await appendFile(state.ledgerPath, `${ledgerBatch.map(row => JSON.stringify(row)).join('\n')}\n`, 'utf8')
          markNativeLedgerFlushed(state)
        }
        if (appended > 0 || ledgerBatch.length > 0) await ctx.sessions.flush(state.session)
      }
    } catch (error) {
      ctx.logger.warn(`external trajectory native live mirror tick failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      nativeTickRunning = false
    }
  }
  ctx.effect(() => {
    const timer = setInterval(() => { void nativeTick() }, 2000)
    void nativeTick()
    return () => clearInterval(timer)
  }, 'external trajectory importer: native live session mirror')
  report.nativeSessionSources = liveManifest.sources.filter(source => source.nativeSession).map(source => source.id)

  if (!existing.has(LIVE_MONITOR_SESSION_ID)) {
    const createdAt = Date.now()
    const monitor = ctx.sessions.create(LIVE_MONITOR_SESSION_ID, {
      seed: liveMonitorSeed(createdAt),
      meta: { cwd: process.cwd(), createdAt },
    })
    await ctx.sessions.flush(monitor)
    existing.add(LIVE_MONITOR_SESSION_ID)
    report.liveMonitorStatus = 'created'
  } else {
    report.liveMonitorStatus = 'already-created'
  }
  report.liveSources = liveManifest.sources.map(source => ({
    id: source.id, label: source.label, kind: source.kind, root: source.root,
  }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: TRACE_ROUTE,
    async handler(req, res) {
      if (req.method !== 'GET') {
        res.writeHead(405, { Allow: 'GET' })
        res.end()
        return
      }
      const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
      const prefix = `${TRACE_ROUTE}/`
      if (!pathname.startsWith(prefix)) {
        res.writeHead(404)
        res.end()
        return
      }
      const sessionId = decodeURIComponent(pathname.slice(prefix.length))
      let body = traceBodies.get(sessionId)
      if (sessionId === LIVE_MONITOR_SESSION_ID) {
        const now = Date.now()
        if (liveCache.expiresAt <= now) {
          liveCache = {
            expiresAt: now + 1500,
            body: JSON.stringify(await buildLiveMonitorTrace(liveManifest)),
          }
        }
        body = liveCache.body
      }
      if (body === undefined) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: 'observable trace not found' }))
        return
      }
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      res.end(body)
    },
  }), 'external trajectory importer: observable reasoning trace route')

  if (config.reportPath !== undefined) {
    await writeFile(config.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  }
  ctx.logger.info(`external trajectory importer: ${report.sessions.length} source session(s) checked; no model was run`)
}
