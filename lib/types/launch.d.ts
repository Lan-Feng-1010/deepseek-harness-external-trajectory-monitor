import { type ChildProcess } from 'node:child_process';
import type { JsonObject, LaunchPlanManifest, ManagedRunRecord, PreexperimentStartArgs, PreexperimentStatusArgs, RuntimeSourceRegistration } from './types.ts';
export interface LaunchManagerOptions {
    readonly plansPath: string;
    readonly registrationRoot: string;
    readonly runRegistryRoot: string;
}
export interface LaunchCatalogPlan extends JsonObject {
    readonly id: string;
    readonly label: string;
    readonly cases: readonly string[];
    readonly maxConcurrentRuns: number;
    readonly sources: readonly JsonObject[];
}
export interface ManagedRunStatus extends JsonObject {
    readonly record: ManagedRunRecord;
    readonly processAlive: boolean | null;
    readonly terminalStateVerified: boolean;
    readonly observedSources: readonly JsonObject[];
}
export declare function loadLaunchPlans(path: string): Promise<LaunchPlanManifest>;
export declare function loadRuntimeRegistrations(root: string): Promise<RuntimeSourceRegistration[]>;
export declare class PreexperimentLaunchManager {
    readonly options: LaunchManagerOptions;
    readonly activeRuns: Map<string, ChildProcess>;
    private launchInProgress;
    constructor(options: LaunchManagerOptions);
    catalog(): Promise<{
        readonly schemaVersion: 1;
        readonly plans: readonly LaunchCatalogPlan[];
    }>;
    status(args?: PreexperimentStatusArgs): Promise<{
        readonly schemaVersion: 1;
        readonly runs: readonly ManagedRunStatus[];
    }>;
    start(args: PreexperimentStartArgs): Promise<ManagedRunRecord>;
}
