/** Read-only external-agent trajectory projection for DeepSeek Harness. */
import type { EventLog, HarnessContext, HarnessSession, HistoricalSource, JsonObject, JsonlRecord, LiveManifest, LiveSource, MonitorStatsArgs, NativeLiveState, NormalizedLedgerRecord, ObservableTrace, SourceManifest } from './types.ts';
export type { HistoricalSource, JsonlRecord, LedgerFields, LiveSource, MonitorStatsArgs, NativeLiveState, NormalizedLedgerRecord, ObservableTrace, ObservableTraceEvent, PluginConfig, SourceManifest, } from './types.ts';
export declare const name = "external-trajectory-importer";
export declare const inject: string[];
export declare const LIVE_MONITOR_SESSION_ID = "session-external-trajectory-live-monitor-v3-2";
export declare const NATIVE_LIVE_PROJECTION_VERSION = "4.0.0";
export declare const NORMALIZED_LEDGER_SCHEMA = "external-trajectory-ledger-v3";
export declare function loadManifest(path?: string): Promise<SourceManifest>;
export declare function loadLiveManifest(path?: string): Promise<LiveManifest>;
export declare function nativeLiveSessionId(source: LiveSource, path: string, caseId: string): string;
export declare function initializeNativeLiveSession(session: HarnessSession, source: LiveSource, path: string, caseId: string): NativeLiveState;
export declare function appendNativeLiveRecords(state: NativeLiveState, records: readonly JsonlRecord[]): number;
export declare function unflushedNativeLedgerRecords(state: NativeLiveState): NormalizedLedgerRecord[];
export declare function markNativeLedgerFlushed(state: NativeLiveState): void;
export declare function buildLiveMonitorTrace(liveManifest: LiveManifest): Promise<ObservableTrace>;
export declare function buildMonitorStats(trace: ObservableTrace, rawArgs?: MonitorStatsArgs): JsonObject;
export declare function deriveSessionId(source: HistoricalSource, sha256: string): string;
export declare function isImportedSessionId(sessionId: unknown): sessionId is string;
export declare function readonlyImportedSessionGuard({ agent }: {
    agent?: {
        session?: {
            id?: string;
        };
    };
}, next: () => unknown | Promise<unknown>): Promise<unknown>;
export declare function prepareImport(source: HistoricalSource): Promise<{
    source: HistoricalSource;
    sessionId: string;
    sha256: string;
    createdAt: number;
    events: import("./types.ts").HarnessSessionEvent[];
    observableTrace: ObservableTrace;
    summary: {
        steps: number;
        malformedLines: readonly number[];
        omittedHiddenReasoningEvents: number;
        sourceCompleted: boolean;
        timestampCoverage: string;
        assistantMessages: number;
        toolCalls: number;
        toolResults: number;
        todoSnapshots: number;
        ignoredStartedDuplicates: number;
        sourceLines: number;
        mappedEvents: number;
    } | {
        uniqueAssistantMessageIds: number;
        steps: number;
        malformedLines: readonly number[];
        sourceCompleted: boolean;
        timestampCoverage: string;
        assistantMessages: number;
        visibleAssistantTextBlocks: number;
        syntheticUserNotices: number;
        toolCalls: number;
        toolResults: number;
        unmatchedToolResults: number;
        omittedHiddenReasoningEvents: number;
        omittedThinkingTokenEvents: number;
        omittedTaskProgressEvents: number;
        omittedOtherSystemEvents: number;
        sourceLines: number;
        mappedEvents: number;
    };
}>;
export declare function liveMonitorSeed(time: number): EventLog['events'];
export declare function apply(ctx: HarnessContext, rawConfig: unknown): Promise<void>;
