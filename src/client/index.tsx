import type { Context } from '@deepseek-ai/cordis'
import { useEffect, useMemo, useState } from 'react'
import type { ConversationSnapshot, UseConversationSession } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import css from './observable-reasoning.module.css'

type TraceKind = 'public_reasoning' | 'public_plan' | 'private_reasoning_marker' | 'tool'

interface TraceEvent {
  seq: number
  kind: TraceKind
  phase: number
  timestampMs: number | null
  resultTimestampMs?: number | null
  timeEvidence: 'source-event' | 'not-recorded' | 'harness-event'
  sourceLine?: number
  messageId?: string
  text?: string
  preview?: string
  label?: string
  contentOmitted?: boolean
  toolName?: string
  callId?: string
  status?: 'pending' | 'success' | 'error'
  exitCode?: number | null
  durationMs?: number | null
  gapFromPreviousToolMs?: number | null
  previousTool?: string | null
  nextTool?: string | null
  transition?: string
  callSourceLine?: number | null
  resultSourceLine?: number | null
  callSourceSeq?: number | null
  resultSourceSeq?: number | null
  arguments?: string
  argumentsPreview?: string
  result?: string
  resultPreview?: string
  publicContextBefore?: string
  publicContextPreview?: string
  streamId?: string
  streamLabel?: string
  streamCaseId?: string
  streamLive?: boolean
  rawToolName?: string
  errorCategory?: string
  errorCategoryLabel?: string
  workflowNodeId?: string | null
  workflowModuleId?: string | null
}

interface ErrorDiagnostic {
  toolName?: string
  rawToolName?: string
  errorCategory?: string
  errorCategoryLabel?: string
  timestampMs: number | null
  transition?: string
  callSourceLine?: number | null
  resultSourceLine?: number | null
  publicContextPreview?: string
  argumentsPreview?: string
  resultPreview?: string
}

interface ObservableTrace {
  schemaVersion: number
  sessionId: string
  agent: string
  caseId: string
  title: string
  source: {
    path: string
    sha256?: string
    malformedLines: number[]
    timeCoverage: 'run-boundaries-only' | 'source-event-timestamps' | 'harness-live-events' | 'mixed-live-sources'
  }
  run: { startedAtMs: number; finishedAtMs: number; durationMs: number }
  boundary: {
    hiddenChainOfThoughtIncluded: false
    hiddenReasoningMarkersContainContent: false
  }
  stats: Record<string, number>
  events: TraceEvent[]
  live?: boolean
  streams?: Array<{
    id: string; label: string; kind: string; caseId: string; path: string; sha256?: string
    lastModifiedAtMs: number; live: boolean; toolCalls: number; publicReasoningEvents: number
    failedTools: number; timeCoverage: string
  }>
  errorComparison?: Array<{
    id: string; label: string; kind: string; caseId: string; toolCalls: number
    successfulTools: number; pendingTools: number; uniqueTools: number
    workflowMode: string; workflowNodeCount: number; timeCoverage: string
    failedTools: number; failureRate: number; recoveredFailures: number; unrecoveredFailures: number
    averageRecoveryToolSteps: number | null
    errorTools: Array<{ toolName: string; count: number }>
    errorCategories: Array<{ label: string; count: number }>
    firstError: null | ErrorDiagnostic
    diagnostics: ErrorDiagnostic[]
  }>
}

type Filter = 'all' | 'tools' | 'public' | 'markers'

function formatTime(value: number | null | undefined): string {
  if (value === null || value === undefined) return '未记录（仅保留源日志顺序）'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    fractionalSecondDigits: 3, hour12: false,
  }).format(new Date(value))
}

function formatDuration(value: number | null | undefined): string {
  if (value === null || value === undefined) return '不可计算'
  return value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(value < 10_000 ? 3 : 1)} s`
}

function lineEvidence(event: TraceEvent): string {
  if (event.kind === 'tool') {
    if (event.callSourceSeq !== undefined || event.resultSourceSeq !== undefined) {
      const call = event.callSourceSeq === null || event.callSourceSeq === undefined ? '未定位' : `#${event.callSourceSeq}`
      const result = event.resultSourceSeq === null || event.resultSourceSeq === undefined ? '运行中' : `#${event.resultSourceSeq}`
      return `Harness 调用事件 ${call} · 结果事件 ${result}`
    }
    const call = event.callSourceLine === null || event.callSourceLine === undefined ? '未单独记录' : `L${event.callSourceLine}`
    const result = event.resultSourceLine === null || event.resultSourceLine === undefined ? '未匹配' : `L${event.resultSourceLine}`
    return `调用 ${call} · 结果 ${result}`
  }
  return event.sourceLine === undefined ? '源行未知' : `源行 L${event.sourceLine}`
}

function safeNativeText(value: unknown): string {
  const forbidden = new Set(['analysis', 'chain_of_thought', 'reasoning', 'reasoning_content', 'signature', 'thinking', 'thinking_tokens'])
  const encoded = typeof value === 'string' ? value : JSON.stringify(value, (key, item) => forbidden.has(key.toLowerCase()) ? undefined : item)
  return (encoded ?? '')
    .replace(/((?:api[_-]?key|access[_-]?token|auth[_-]?token|password|secret|authorization)\s*[=:]\s*)([^\s,;]+)/gi, '$1[REDACTED]')
    .replace(/("(?:api[_-]?key|access[_-]?token|auth[_-]?token|password|secret|authorization)"\s*:\s*")[^"]*(")/gi, '$1[REDACTED]$2')
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+\/-]+=*/gi, '$1[REDACTED]')
}

function nativePreview(value: unknown, limit = 280): string {
  const normalized = safeNativeText(value).replace(/\s+/g, ' ').trim()
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1)}…`
}

function buildNativeTrace(snapshot: ConversationSnapshot): ObservableTrace {
  const events: Array<TraceEvent & { sortSeq?: number }> = []
  const tools = new Map<string, TraceEvent & { sortSeq?: number }>()
  let phase = 0
  let publicContext = ''

  for (const node of snapshot.nodes) {
    if (node.kind === 'assistant') {
      node.blocks.forEach((block, blockIndex) => {
        if (block.kind === 'reasoning') {
          events.push({
            seq: 0, sortSeq: node.seq + blockIndex / 1000, kind: 'private_reasoning_marker', phase,
            timestampMs: node.time, timeEvidence: 'harness-event', sourceLine: node.seq,
            messageId: node.messageId, contentOmitted: true,
            label: '私有 reasoning 事件（内容不可见）',
          })
        } else if (block.kind === 'text' && block.text.trim() !== '') {
          phase += 1
          publicContext = safeNativeText(block.text)
          events.push({
            seq: 0, sortSeq: node.seq + blockIndex / 1000, kind: 'public_reasoning', phase,
            timestampMs: node.time, timeEvidence: 'harness-event', sourceLine: node.seq,
            messageId: node.messageId, text: publicContext, preview: nativePreview(publicContext),
          })
        } else if (block.kind === 'tool-call') {
          const argumentsText = safeNativeText(block.argsRaw)
          const tool: TraceEvent & { sortSeq?: number } = {
            seq: 0, sortSeq: node.seq + blockIndex / 1000, kind: 'tool', phase,
            timestampMs: null, resultTimestampMs: null, timeEvidence: 'harness-event',
            durationMs: null, gapFromPreviousToolMs: null, callId: block.callId,
            toolName: block.name, status: 'pending', exitCode: null,
            callSourceSeq: node.seq, resultSourceSeq: null,
            arguments: argumentsText, argumentsPreview: nativePreview(argumentsText),
            result: '', resultPreview: '', publicContextBefore: publicContext,
            publicContextPreview: publicContext === '' ? '' : nativePreview(publicContext),
          }
          events.push(tool)
          tools.set(block.callId, tool)
        }
      })
    } else if (node.kind === 'tool-result') {
      let tool = tools.get(node.callId)
      if (tool === undefined) {
        const argumentsText = safeNativeText(node.call?.argsRaw ?? '{}')
        tool = {
          seq: 0, sortSeq: node.seq - 0.001, kind: 'tool', phase,
          timestampMs: node.callTime, resultTimestampMs: node.time, timeEvidence: 'harness-event',
          durationMs: node.callTime === null ? null : Math.max(0, node.time - node.callTime),
          gapFromPreviousToolMs: null, callId: node.callId,
          toolName: node.call?.name ?? 'unknown_tool', status: node.isError ? 'error' : 'success', exitCode: null,
          callSourceSeq: null, resultSourceSeq: node.seq,
          arguments: argumentsText, argumentsPreview: nativePreview(argumentsText),
          result: safeNativeText(node.content), resultPreview: nativePreview(node.content),
          publicContextBefore: publicContext, publicContextPreview: publicContext === '' ? '' : nativePreview(publicContext),
        }
        events.push(tool)
        tools.set(node.callId, tool)
      } else {
        tool.timestampMs = node.callTime
        tool.resultTimestampMs = node.time
        tool.durationMs = node.callTime === null ? null : Math.max(0, node.time - node.callTime)
        tool.status = node.isError ? 'error' : 'success'
        tool.resultSourceSeq = node.seq
        tool.result = safeNativeText(node.content)
        tool.resultPreview = nativePreview(node.content)
      }
    }
  }

  for (const running of snapshot.runningCalls) {
    if (tools.has(running.callId)) continue
    const argumentsText = safeNativeText(running.argsRaw)
    const tool: TraceEvent & { sortSeq?: number } = {
      seq: 0, sortSeq: Number.MAX_SAFE_INTEGER, kind: 'tool', phase,
      timestampMs: running.time, resultTimestampMs: null, timeEvidence: 'harness-event',
      durationMs: null, gapFromPreviousToolMs: null, callId: running.callId,
      toolName: running.name, status: 'pending', exitCode: null,
      callSourceSeq: null, resultSourceSeq: null,
      arguments: argumentsText, argumentsPreview: nativePreview(argumentsText), result: '', resultPreview: '',
      publicContextBefore: publicContext, publicContextPreview: publicContext === '' ? '' : nativePreview(publicContext),
    }
    events.push(tool)
    tools.set(running.callId, tool)
  }

  events.sort((left, right) => (left.sortSeq ?? 0) - (right.sortSeq ?? 0))
  const toolEvents = events.filter(event => event.kind === 'tool')
  toolEvents.forEach((event, index) => {
    const previous = toolEvents[index - 1]
    const next = toolEvents[index + 1]
    event.previousTool = previous?.toolName ?? null
    event.nextTool = next?.toolName ?? null
    event.transition = previous === undefined ? `START → ${event.toolName}` : `${previous.toolName} → ${event.toolName}`
    const previousEnd = previous?.resultTimestampMs ?? previous?.timestampMs
    event.gapFromPreviousToolMs = previousEnd !== null && previousEnd !== undefined && event.timestampMs !== null
      ? Math.max(0, event.timestampMs - previousEnd)
      : null
  })
  events.forEach((event, index) => { event.seq = index + 1; delete event.sortSeq })

  const turnTimes = [...snapshot.turnTimings.values()]
  const startedAtMs = turnTimes.length === 0 ? Date.now() : Math.min(...turnTimes.map(item => item.startTime))
  const finishedCandidates = turnTimes.flatMap(item => item.endTime === undefined ? [] : [item.endTime])
  const finishedAtMs = snapshot.running || finishedCandidates.length === 0 ? Date.now() : Math.max(...finishedCandidates)
  const implantAgent = toolEvents.some(event => event.toolName?.includes('implantagent') === true)
  return {
    schemaVersion: 1,
    sessionId: snapshot.sessionId,
    agent: implantAgent ? 'implantagent' : 'harness',
    caseId: implantAgent ? 'ImplantAgent live session' : 'Harness live session',
    title: 'Harness native live observable trace',
    source: { path: 'Harness 当前会话的实时事件流', malformedLines: [], timeCoverage: 'harness-live-events' },
    run: { startedAtMs, finishedAtMs, durationMs: Math.max(0, finishedAtMs - startedAtMs) },
    boundary: { hiddenChainOfThoughtIncluded: false, hiddenReasoningMarkersContainContent: false },
    stats: {
      observableEvents: events.length,
      toolCalls: toolEvents.length,
      publicReasoningEvents: events.filter(event => event.kind === 'public_reasoning').length,
      publicPlanEvents: 0,
      privateReasoningMarkers: events.filter(event => event.kind === 'private_reasoning_marker').length,
      successfulTools: toolEvents.filter(event => event.status === 'success').length,
      failedTools: toolEvents.filter(event => event.status === 'error').length,
      exactToolTimestamps: toolEvents.filter(event => event.timestampMs !== null).length,
      exactToolDurations: toolEvents.filter(event => event.durationMs !== null).length,
    },
    events,
    live: snapshot.running,
  }
}

function toolStatusLabel(status: TraceEvent['status']): string {
  if (status === 'success') return '成功'
  if (status === 'error') return '失败'
  return '未匹配结果'
}

function StreamBadge({ event }: { event: TraceEvent }) {
  if (event.streamLabel === undefined) return null
  return <span className={event.streamLive ? css.streamLive : css.streamBadge}>{event.streamLabel} · {event.streamCaseId}</span>
}

function PublicEvent({ event }: { event: TraceEvent }) {
  return (
    <article className={`${css.event} ${css.publicEvent}`} data-event-kind={event.kind}>
      <div className={css.rail}><span className={css.dot} /></div>
      <div className={css.eventBody}>
        <div className={css.eventTopline}>
          <StreamBadge event={event} />
          <span className={css.kind}>{event.kind === 'public_plan' ? '公开计划' : '公开决策文本'}</span>
          <span className={css.time}>{formatTime(event.timestampMs)}</span>
          <span className={css.source}>{lineEvidence(event)}</span>
        </div>
        <p className={css.prose}>{event.text}</p>
      </div>
    </article>
  )
}

function MarkerEvent({ event }: { event: TraceEvent }) {
  return (
    <article className={`${css.event} ${css.markerEvent}`} data-event-kind={event.kind}>
      <div className={css.rail}><span className={css.markerDot} /></div>
      <div className={css.eventBody}>
        <div className={css.eventTopline}>
          <StreamBadge event={event} />
          <span className={css.kind}>私有 reasoning 标记</span>
          <span className={css.time}>{formatTime(event.timestampMs)}</span>
          <span className={css.source}>{lineEvidence(event)}</span>
        </div>
        <p className={css.markerCopy}>日志记录了 reasoning 事件，但本页不显示、也不重建其内容。</p>
      </div>
    </article>
  )
}

function ToolEvent({ event }: { event: TraceEvent }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <article className={`${css.event} ${css.toolEvent}`} data-event-kind="tool" data-tool-status={event.status}>
      <div className={css.rail}><span className={event.status === 'error' ? css.errorDot : css.toolDot} /></div>
      <div className={css.eventBody}>
        <div className={css.eventTopline}>
          <StreamBadge event={event} />
          <span className={css.toolName}>{event.toolName}</span>
          {event.workflowNodeId !== null && event.workflowNodeId !== undefined && <span className={css.workflowNode}>{event.workflowNodeId}</span>}
          <span className={event.status === 'error' ? css.statusError : css.statusOk}>{toolStatusLabel(event.status)}</span>
          {event.status === 'error' && event.errorCategoryLabel !== undefined && <span className={css.errorCategory}>{event.errorCategoryLabel}</span>}
          <span className={css.time}>{formatTime(event.timestampMs)}</span>
        </div>
        <div className={css.transition}>{event.transition}</div>
        <div className={css.metrics}>
          <span>耗时 <strong>{formatDuration(event.durationMs)}</strong></span>
          <span>距上一工具 <strong>{formatDuration(event.gapFromPreviousToolMs)}</strong></span>
          <span>{lineEvidence(event)}</span>
        </div>
        {event.publicContextPreview !== '' && (
          <div className={css.context}><span>调用前公开上下文</span>{event.publicContextPreview}</div>
        )}
        <div className={css.previewGrid}>
          <div><span>参数</span><code>{event.argumentsPreview || '—'}</code></div>
          <div><span>结果</span><code>{event.resultPreview || '—'}</code></div>
        </div>
        <button className={css.expand} type="button" onClick={() => { setExpanded(value => !value) }}>
          {expanded ? '收起完整参数与结果' : '查看完整参数与结果'}
        </button>
        {expanded && (
          <div className={css.fullGrid}>
            <section><h4>完整参数（已做密钥模式脱敏）</h4><pre>{event.arguments || '—'}</pre></section>
            <section><h4>完整结果（已做密钥模式脱敏）</h4><pre>{event.result || '—'}</pre></section>
          </div>
        )}
      </div>
    </article>
  )
}

function ObservableReasoningView({ sessionId, useSession }: { sessionId: string; useSession: UseConversationSession }) {
  const [trace, setTrace] = useState<ObservableTrace | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nativeMode, setNativeMode] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const snapshot = useSession(value => value)
  const nativeTrace = useMemo(() => buildNativeTrace(snapshot), [snapshot])

  useEffect(() => {
    const controller = new AbortController()
    setTrace(null)
    setError(null)
    setNativeMode(false)
    const refresh = () => fetch(`/api/external-reasoning-trace/${encodeURIComponent(sessionId)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (response.status === 404 && !sessionId.startsWith('session-external-trajectory-')) {
          setNativeMode(true)
          return null
        }
        if (response.status === 404) throw new Error('历史导入会话已停用；请打开 [Live Monitor] 查看实时与结束后比较。')
        if (!response.ok) throw new Error(`读取轨迹失败（HTTP ${response.status}）`)
        return response.json() as Promise<ObservableTrace | null>
      })
      .then(value => { if (value !== null) setTrace(value) })
      .catch(reason => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError(reason instanceof Error ? reason.message : String(reason))
      })
    void refresh()
    const timer = sessionId.includes('live-monitor-v1') ? window.setInterval(() => { void refresh() }, 3000) : undefined
    return () => {
      controller.abort()
      if (timer !== undefined) window.clearInterval(timer)
    }
  }, [sessionId])

  const activeTrace = nativeMode ? nativeTrace : trace

  const visible = useMemo(() => {
    if (activeTrace === null) return []
    const needle = query.trim().toLowerCase()
    return activeTrace.events.filter(event => {
      if (filter === 'tools' && event.kind !== 'tool') return false
      if (filter === 'public' && event.kind !== 'public_reasoning' && event.kind !== 'public_plan') return false
      if (filter === 'markers' && event.kind !== 'private_reasoning_marker') return false
      if (needle === '') return true
      return [event.streamLabel, event.streamCaseId, event.toolName, event.transition, event.preview, event.argumentsPreview, event.resultPreview, event.publicContextPreview]
        .some(value => value?.toLowerCase().includes(needle) === true)
    })
  }, [activeTrace, filter, query])

  if (error !== null) return <div className={css.centerState}>{error}</div>
  if (activeTrace === null) return <div className={css.centerState}>正在读取可观察轨迹…</div>

  const shownTrace = activeTrace

  const exact = shownTrace.source.timeCoverage !== 'run-boundaries-only'
  const liveNative = shownTrace.source.timeCoverage === 'harness-live-events'
  const liveExternal = shownTrace.source.timeCoverage === 'mixed-live-sources'
  const implantDiagnostics = shownTrace.errorComparison?.find(arm => arm.id === 'implantagent-external')
  return (
    <div className={css.root}>
      <header className={css.header}>
        <div>
          <div className={css.eyebrow}>OBSERVABLE REASONING TRACE · {shownTrace.agent.toUpperCase()}</div>
          <h2>{shownTrace.caseId} 工具调用与公开决策路径</h2>
          <p>显示公开文本、真实工具调用/结果与工具切换；不显示或推断隐藏思维链。</p>
        </div>
        <div className={exact ? css.exactBadge : css.sequenceBadge}>
          {liveNative
            ? `Harness 实时事件${shownTrace.live ? ' · 正在运行' : ''}`
            : liveExternal
              ? `外部 JSONL 实时同步${shownTrace.live ? ' · 检测到写入' : ''}`
              : exact ? '逐事件时间：源日志精确记录' : '逐事件时间：源日志未记录'}
        </div>
      </header>

      <section className={css.boundary}>
        <strong>{liveNative ? 'Harness 实时轴' : liveExternal ? '多智能体同步观察轴' : exact ? 'Claude 时间轴' : 'Codex 顺序轴'}</strong>
        <span>{liveNative
          ? '页面直接订阅当前 Harness 会话；ImplantAgent T01–T13、web search 和其他真实工具会在调用与返回时自动更新。'
          : liveExternal
            ? '每 3 秒只读刷新各 arm 最新 JSONL。各 arm 内顺序真实；Claude 与 ImplantAgent 工具审计保留精确时间，Codex 缺失的逐事件时间不会被补造，因此不声称跨 arm 的严格时间排序。'
          : exact
          ? '工具调用与结果时间来自 stream-json；耗时和切换间隔由这两个源时间相减。'
          : '这批 --json 只有运行开始/结束时间。本页仅按 JSONL 源行显示真实顺序，单步时间和耗时明确标为不可计算。'}</span>
      </section>

      {shownTrace.streams !== undefined && shownTrace.streams.length > 0 && (
        <section className={css.streams}>
          {shownTrace.streams.map(stream => (
            <div key={stream.id} data-live={stream.live}>
              <div><strong>{stream.label}</strong><span>{stream.live ? '正在写入' : '最近记录'}</span></div>
              <p>{stream.caseId}</p>
              <dl><dt>工具</dt><dd>{stream.toolCalls}</dd><dt>公开决策</dt><dd>{stream.publicReasoningEvents}</dd><dt>失败</dt><dd>{stream.failedTools}</dd></dl>
              <small>{stream.timeCoverage === 'run-boundaries-only' ? '源内顺序；无逐事件时间' : '源事件时间可用'}</small>
            </div>
          ))}
        </section>
      )}

      <section className={css.summary}>
        <div><span>工具调用</span><strong>{shownTrace.stats.toolCalls}</strong></div>
        <div><span>公开决策/计划</span><strong>{(shownTrace.stats.publicReasoningEvents ?? 0) + (shownTrace.stats.publicPlanEvents ?? 0)}</strong></div>
        <div><span>失败工具</span><strong>{shownTrace.stats.failedTools}</strong></div>
        <div><span>精确耗时</span><strong>{shownTrace.stats.exactToolDurations}/{shownTrace.stats.toolCalls}</strong></div>
        <div><span>运行总时长</span><strong>{formatDuration(shownTrace.run.durationMs)}</strong></div>
      </section>

      {shownTrace.errorComparison !== undefined && shownTrace.errorComparison.length > 0 && (
        <section className={css.errorCompare}>
          <div className={css.comparisonContract}>
            <strong>统一比较的是执行事实，不是强行统一工作流</strong>
            <span>ImplantAgent 保留固定业务节点；Codex/Claude 保留自由编排。三者只在工具调用、参数、结果、失败、恢复、顺序和可用时间证据上使用同一口径。</span>
          </div>
          <div className={css.comparisonTable} role="table" aria-label="三智能体统一执行指标">
            <div role="row" data-head="true"><span>智能体</span><span>编排</span><span>工具/种类</span><span>失败</span><span>已恢复</span><span>进行中</span><span>时间证据</span></div>
            {shownTrace.errorComparison.map(arm => (
              <div role="row" key={`compare-${arm.id}`} data-focus={arm.id === 'implantagent-external'}>
                <strong>{arm.label}</strong>
                <span>{arm.workflowMode}{arm.workflowNodeCount > 0 ? ` · ${arm.workflowNodeCount} 节点` : ''}</span>
                <span>{arm.toolCalls} / {arm.uniqueTools}</span><span>{arm.failedTools}</span><span>{arm.recoveredFailures}</span><span>{arm.pendingTools}</span>
                <span>{arm.timeCoverage === 'source-event-timestamps' ? '逐事件时间' : '源顺序'}</span>
              </div>
            ))}
          </div>
          <div className={css.sectionTitle}>
            <div><span>POST-RUN ERROR COMPARISON</span><h3>三臂错误对比</h3></div>
            <p>按最新完成/正在写入的同名 arm 汇总；重点卡片为 ImplantAgent。</p>
          </div>
          <div className={css.errorGrid}>
            {shownTrace.errorComparison.map(arm => (
              <article key={arm.id} data-focus={arm.id === 'implantagent-external'}>
                <header><div><strong>{arm.label}</strong><span>{arm.caseId}</span></div><b>{(arm.failureRate * 100).toFixed(1)}%</b></header>
                <div className={css.errorCounts}><span>{arm.failedTools} 次失败</span><span>{arm.toolCalls} 次调用</span></div>
                {arm.failedTools > 0 && <div className={css.recoveryLine}>已观察恢复 {arm.recoveredFailures} · 未观察恢复 {arm.unrecoveredFailures}{arm.averageRecoveryToolSteps !== null ? ` · 平均 ${arm.averageRecoveryToolSteps.toFixed(1)} 个工具步` : ''}</div>}
                {arm.errorCategories.length > 0 && <div className={css.categoryChips}>{arm.errorCategories.map(item => <code key={item.label}>{item.label} × {item.count}</code>)}</div>}
                {arm.errorTools.length > 0
                  ? <div className={css.errorChips}>{arm.errorTools.map(item => <code key={item.toolName}>{item.toolName} × {item.count}</code>)}</div>
                  : <p className={css.noError}>未观察到失败工具。</p>}
                {arm.firstError !== null && (
                  <details>
                    <summary>首个错误：{arm.firstError.toolName} · {arm.firstError.errorCategoryLabel}</summary>
                    <dl>
                      <dt>时间</dt><dd>{formatTime(arm.firstError.timestampMs)}</dd>
                      <dt>切换</dt><dd>{arm.firstError.transition || '—'}</dd>
                      <dt>源位置</dt><dd>调用 L{arm.firstError.callSourceLine ?? '—'} · 结果 L{arm.firstError.resultSourceLine ?? '—'}</dd>
                      <dt>调用前公开上下文</dt><dd>{arm.firstError.publicContextPreview || '无公开文本'}</dd>
                      <dt>参数</dt><dd><code>{arm.firstError.argumentsPreview || '—'}</code></dd>
                      <dt>错误结果</dt><dd><code>{arm.firstError.resultPreview || '—'}</code></dd>
                    </dl>
                  </details>
                )}
              </article>
            ))}
          </div>
          {implantDiagnostics !== undefined && implantDiagnostics.diagnostics.length > 0 && (
            <div className={css.implantQueue}>
              <div className={css.queueTitle}>
                <div><span>IMPLANTAGENT DEBUG QUEUE</span><h4>ImplantAgent 调试队列</h4></div>
                <p>{implantDiagnostics.diagnostics.length} 个失败，按真实源日志顺序列出；这里不自动改代码或重跑模型。</p>
              </div>
              <div className={css.queueList}>
                {implantDiagnostics.diagnostics.map((item, index) => (
                  <details key={`${item.resultSourceLine ?? index}-${item.toolName ?? 'tool'}`} open={index === 0}>
                    <summary>
                      <b>#{index + 1}</b>
                      <code>{item.toolName || item.rawToolName || 'tool'}</code>
                      <span>{item.errorCategoryLabel || '工具执行失败'}</span>
                      <small>L{item.callSourceLine ?? '—'} → L{item.resultSourceLine ?? '—'}</small>
                    </summary>
                    <dl>
                      <dt>时间</dt><dd>{formatTime(item.timestampMs)}</dd>
                      <dt>工具切换</dt><dd>{item.transition || '—'}</dd>
                      <dt>调用前公开上下文</dt><dd>{item.publicContextPreview || '无公开文本'}</dd>
                      <dt>参数/命令</dt><dd><code>{item.argumentsPreview || '—'}</code></dd>
                      <dt>错误结果</dt><dd><code>{item.resultPreview || '—'}</code></dd>
                    </dl>
                  </details>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section className={css.controls}>
        <div className={css.filters}>
          {([['all', '全部'], ['tools', '仅工具'], ['public', '仅公开决策'], ['markers', '仅私有标记']] as const).map(([value, label]) => (
            <button key={value} type="button" data-active={filter === value} onClick={() => { setFilter(value) }}>{label}</button>
          ))}
        </div>
        <input value={query} onChange={event => { setQuery(event.target.value) }} placeholder="搜索工具、参数、结果或公开上下文" />
        <span className={css.visibleCount}>显示 {visible.length}/{shownTrace.events.length}</span>
      </section>

      <main className={css.timeline}>
        {visible.map(event => event.kind === 'tool'
          ? <ToolEvent key={`event-${event.seq}`} event={event} />
          : event.kind === 'private_reasoning_marker'
            ? <MarkerEvent key={`event-${event.seq}`} event={event} />
            : <PublicEvent key={`event-${event.seq}`} event={event} />)}
      </main>

      <footer className={css.footer}>
        <details>
          <summary>审计来源</summary>
          <code>{shownTrace.source.path}</code>
          {shownTrace.source.sha256 !== undefined && <code>SHA-256 {shownTrace.source.sha256}</code>}
          <span>运行：{formatTime(shownTrace.run.startedAtMs)} → {formatTime(shownTrace.run.finishedAtMs)}</span>
        </details>
      </footer>
    </div>
  )
}

export const inject = ['slots']

export function apply(ctx: Context): void {
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'observable-reasoning',
    order: 20,
    label: '可观察推理',
    inject: (sessionId: string) => ({ sessionId }),
  }, ObservableReasoningView))
}
