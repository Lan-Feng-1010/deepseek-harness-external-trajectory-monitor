import type { Stats } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
export type AgentKind = 'codex' | 'claude';
export type LiveSourceKind = AgentKind | 'generic' | 'implantagent-trace';
export type ProjectionMode = 'default' | 'implantagent-modules';
export type JsonObject = Record<string, any>;
export interface HistoricalSource {
    readonly agent: AgentKind;
    readonly caseId: string;
    readonly title: string;
    readonly provider: string;
    readonly model: string;
    readonly cwd: string;
    readonly sourcePath: string;
    readonly runRecordPath: string;
    readonly expectedSha256: string;
}
export interface SourceManifest {
    readonly schemaVersion: 1;
    readonly sessions: readonly HistoricalSource[];
}
export interface LiveSource {
    readonly id: string;
    readonly label: string;
    readonly kind: LiveSourceKind;
    readonly root: string;
    readonly cwd: string;
    readonly suffix: string;
    readonly nativeSession: boolean;
    readonly provider: string;
    readonly model: string;
    readonly ledgerRoot: string;
    readonly projectionMode: ProjectionMode;
}
export interface LiveManifest {
    readonly schemaVersion: 1;
    readonly sources: readonly LiveSource[];
}
export interface JsonlRecord<T extends JsonObject = JsonObject> {
    readonly line: number;
    readonly value: T;
}
export interface JsonlDocument<T extends JsonObject = JsonObject> {
    readonly text: string;
    readonly records: readonly JsonlRecord<T>[];
    readonly malformedLines: readonly number[];
}
export interface HarnessSessionEvent {
    readonly type: string;
    readonly seq: number;
    readonly time: number;
    readonly data: JsonObject;
    readonly [key: string]: unknown;
}
export interface EventLog {
    readonly events: HarnessSessionEvent[];
    append(type: string, time: number, data: JsonObject, envelope?: JsonObject): number;
}
export interface HarnessSession {
    readonly id: string;
    append(type: string, data: JsonObject, envelope?: JsonObject): {
        readonly seq: number;
    };
}
export interface HistoricalContext {
    readonly source: HistoricalSource;
    readonly sha256: string;
    readonly sessionId: string;
}
export interface RunRecord extends JsonObject {
    readonly started_at_utc: string;
    readonly finished_at_utc: string;
}
export interface LatestLiveFile {
    readonly path: string;
    readonly name: string;
    readonly details: Stats;
}
export type TraceKind = 'public_reasoning' | 'public_plan' | 'private_reasoning_marker' | 'tool';
export interface ObservableTraceEvent extends JsonObject {
    seq: number;
    kind: TraceKind;
    phase: number;
    timestampMs: number | null;
    resultTimestampMs?: number | null;
    timeEvidence: 'source-event' | 'not-recorded' | 'harness-event';
    toolName?: string;
    callId?: string;
    status?: 'pending' | 'success' | 'error';
    durationMs?: number | null;
    previousTool?: string | null;
    nextTool?: string | null;
}
export interface ObservableTrace extends JsonObject {
    schemaVersion: number;
    sessionId: string;
    agent: string;
    caseId: string;
    title: string;
    events: ObservableTraceEvent[];
}
export interface LedgerFields {
    event_type: string;
    public_assistant_message?: string | null;
    tool_call_id?: string | null;
    tool_name?: string | null;
    tool_arguments?: string | null;
    tool_result?: string | null;
    status?: string | null;
    duration_ms?: number | null;
    module_id?: string | null;
    node_id?: string | null;
    raw_tool_name?: string | null;
    invocation_index?: number | null;
    retry_index?: number | null;
    previous_tool?: string | null;
    next_tool?: string | null;
}
export interface NormalizedLedgerRecord extends JsonObject {
    schema_version: string;
    sequence: number;
    session_id: string;
    agent: LiveSourceKind;
    case_id: string;
    source_path: string;
    source_line: number | null;
    source_timestamp: string | null;
    observed_at: string;
    step: number;
    event_type: string;
}
export interface PendingAssistant {
    readonly text: string;
    readonly record: JsonlRecord;
    readonly event: JsonObject;
    readonly messageId: string | null;
}
export interface PendingToolRequest {
    readonly callId: string;
    readonly toolName: string;
    readonly argumentsText: string;
}
export interface ToolAuditMetadata extends JsonObject {
    toolName?: string;
    startedAtMs?: number | null;
    raw_tool_name?: string | null;
    module_id?: string | null;
    node_id?: string | null;
    invocation_index?: number | null;
    retry_index?: number | null;
}
export interface NativeLiveState {
    readonly session: HarnessSession;
    readonly sessionId: string;
    readonly source: LiveSource;
    readonly path: string;
    readonly caseId: string;
    turn: number;
    step: number;
    stepOpen: boolean;
    stepHasAssistantRequest: boolean;
    readonly processedLines: Set<number>;
    readonly callSeqs: Map<string, number>;
    readonly callSteps: Map<string, number>;
    readonly callLedgerMeta: Map<string, ToolAuditMetadata>;
    readonly openCalls: Set<string>;
    readonly completedCalls: Set<string>;
    readonly assistantLinkedCalls: Set<string>;
    readonly pendingCodexAssistants: PendingAssistant[];
    readonly pendingClaudeAssistantEvents: JsonObject[];
    currentClaudeMessageId: string | null;
    currentGenericRequestId: string | null;
    readonly seenClaudeBlocks: Set<string>;
    assistantOrdinal: number;
    resultOrdinal: number;
    codexNextEventStartsStep: boolean;
    codexRequestTextBlocks: JsonObject[];
    codexRequestToolBlocks: JsonObject[];
    currentImplantAgentGroup: string | null;
    readonly implantAgentInvocationCounts: Map<string, number>;
    readonly ledgerRecords: NormalizedLedgerRecord[];
    ledgerFlushedCount: number;
    readonly ledgerPath: string;
    lastToolName: string | null;
    lastToolCallId: string | null;
    finalStatus: string | null;
    finalized: boolean;
}
export interface MonitorStatsArgs {
    readonly agent?: string;
    readonly case_id?: string;
    readonly tool_name?: string;
    readonly include_errors?: boolean;
}
export interface PluginConfig {
    readonly manifestPath: string;
    readonly liveManifestPath: string;
    readonly reportPath?: string;
}
export interface ImportReport extends JsonObject {
    schemaVersion: 1;
    generatedAt: string;
    modelRunsStarted: 0;
    sourceFilesModified: 0;
    monitorTool: 'trajectory_stats';
    sessions: JsonObject[];
    nativeSessionSources?: string[];
    liveMonitorStatus?: string;
    liveSources?: JsonObject[];
}
export interface HarnessContext {
    on(event: string, listener: (...args: any[]) => unknown): void;
    effect(factory: () => (() => void) | void, label: string): void;
    readonly logger: {
        info(message: string): void;
        warn(message: string): void;
    };
    readonly sessionPersistence: {
        list(): Promise<readonly {
            id: string;
        }[]>;
    };
    readonly sessions: {
        create(id: string, options: JsonObject): HarnessSession;
        flush(session: HarnessSession): Promise<void>;
    };
    readonly tools: {
        register(definition: JsonObject): void;
    };
    readonly webServer: {
        register(route: {
            readonly kind: 'prefix';
            readonly path: string;
            readonly handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
        }): () => void;
    };
}
