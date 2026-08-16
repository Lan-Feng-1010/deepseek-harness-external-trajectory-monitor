import { randomUUID, createHash } from 'node:crypto'
import { spawn, type ChildProcess } from 'node:child_process'
import { cp, mkdir, open, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'

import type {
  JsonObject,
  LaunchCaseSpec,
  LaunchPlan,
  LaunchPlanManifest,
  LaunchSourceTemplate,
  LiveSource,
  ManagedRunRecord,
  PreexperimentStartArgs,
  PreexperimentStatusArgs,
  ProjectionMode,
  RuntimeSourceRegistration,
} from './types.ts'

const PLAN_ID = /^[a-z0-9][a-z0-9._-]{0,95}$/
const CASE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const SOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,191}$/
const TEMPLATE_TOKEN = /\{(plan_id|case_id|run_id|run_root|template_root)\}/g

interface TemplateValues {
  readonly plan_id: string
  readonly case_id: string
  readonly run_id: string
  readonly run_root: string
  readonly template_root: string
}

export interface LaunchManagerOptions {
  readonly plansPath: string
  readonly registrationRoot: string
  readonly runRegistryRoot: string
}

export interface LaunchCatalogPlan extends JsonObject {
  readonly id: string
  readonly label: string
  readonly cases: readonly string[]
  readonly maxConcurrentRuns: number
  readonly sources: readonly JsonObject[]
}

export interface ManagedRunStatus extends JsonObject {
  readonly record: ManagedRunRecord
  readonly processAlive: boolean | null
  readonly terminalStateVerified: boolean
  readonly observedSources: readonly JsonObject[]
}

function requireObject(value: unknown, label: string): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as JsonObject
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} must be a non-empty string`)
  return value
}

function requireAbsolute(value: unknown, label: string): string {
  const parsed = requireString(value, label)
  if (!isAbsolute(parsed)) throw new Error(`${label} must be an absolute path`)
  return resolve(parsed)
}

function requireStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new Error(`${label} must be an array of strings`)
  }
  return [...value]
}

function requireSafeRelativePath(value: unknown, label: string): string {
  const parsed = requireString(value, label)
  if (isAbsolute(parsed)) throw new Error(`${label} must be relative`)
  const normalized = parsed.replaceAll('\\', '/')
  if (normalized.split('/').some(part => part === '..')) throw new Error(`${label} must not traverse parent directories`)
  return parsed
}

function isInside(root: string, candidate: string): boolean {
  const path = relative(root, candidate)
  return path === '' || (!path.startsWith('..') && !isAbsolute(path))
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

async function readJson(path: string, label: string): Promise<JsonObject> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    throw new Error(`${label} could not be read: ${error instanceof Error ? error.message : String(error)}`)
  }
  try {
    return requireObject(JSON.parse(text), label)
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function writeJsonAtomic(path: string, value: JsonObject): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temporary, path)
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

function validateRuntimeRegistration(value: JsonObject, label: string): RuntimeSourceRegistration {
  if (value.schemaVersion !== 1 || !Array.isArray(value.sources)) {
    throw new Error(`${label} must use schemaVersion 1 and contain sources`)
  }
  requireString(value.runId, `${label}.runId`)
  requireString(value.planId, `${label}.planId`)
  requireString(value.caseId, `${label}.caseId`)
  requireString(value.createdAt, `${label}.createdAt`)
  value.sources.forEach((source, index) => requireObject(source, `${label}.sources[${index}]`))
  return value as RuntimeSourceRegistration
}

function validateCase(raw: unknown, label: string): LaunchCaseSpec {
  const value = requireObject(raw, label)
  const caseId = requireString(value.caseId, `${label}.caseId`)
  if (!CASE_ID.test(caseId)) throw new Error(`${label}.caseId contains unsupported characters`)
  return {
    caseId,
    templateRoot: requireAbsolute(value.templateRoot, `${label}.templateRoot`),
  }
}

function validateSourceTemplate(raw: unknown, label: string): LaunchSourceTemplate {
  const value = requireObject(raw, label)
  const kind = requireString(value.kind, `${label}.kind`) as LaunchSourceTemplate['kind']
  if (!['codex', 'claude', 'generic', 'implantagent-trace'].includes(kind)) {
    throw new Error(`${label}.kind is unsupported`)
  }
  const projectionMode: ProjectionMode | undefined = value.projectionMode === undefined
    ? undefined
    : value.projectionMode === 'implantagent-modules' || value.projectionMode === 'default'
      ? value.projectionMode
      : (() => { throw new Error(`${label}.projectionMode is unsupported`) })()
  return {
    id: requireString(value.id, `${label}.id`),
    label: requireString(value.label, `${label}.label`),
    kind,
    root: requireString(value.root, `${label}.root`),
    ...(value.cwd === undefined ? {} : { cwd: requireString(value.cwd, `${label}.cwd`) }),
    ...(value.suffix === undefined ? {} : { suffix: requireString(value.suffix, `${label}.suffix`) }),
    nativeSession: value.nativeSession !== false,
    ...(value.provider === undefined ? {} : { provider: requireString(value.provider, `${label}.provider`) }),
    ...(value.model === undefined ? {} : { model: requireString(value.model, `${label}.model`) }),
    ledgerRoot: requireString(value.ledgerRoot, `${label}.ledgerRoot`),
    ...(projectionMode === undefined ? {} : { projectionMode }),
  }
}

function validatePlan(raw: unknown, index: number): LaunchPlan {
  const label = `launch plans[${index}]`
  const value = requireObject(raw, label)
  const id = requireString(value.id, `${label}.id`)
  if (!PLAN_ID.test(id)) throw new Error(`${label}.id must use lowercase letters, digits, dot, underscore or hyphen`)
  const command = requireObject(value.command, `${label}.command`)
  const maxConcurrentRuns = value.maxConcurrentRuns === undefined ? 1 : Number(value.maxConcurrentRuns)
  if (!Number.isSafeInteger(maxConcurrentRuns) || maxConcurrentRuns < 1 || maxConcurrentRuns > 8) {
    throw new Error(`${label}.maxConcurrentRuns must be an integer from 1 to 8`)
  }
  if (!Array.isArray(value.cases) || value.cases.length === 0) throw new Error(`${label}.cases must be non-empty`)
  if (!Array.isArray(value.sources) || value.sources.length === 0) throw new Error(`${label}.sources must be non-empty`)
  const cases = value.cases.map((item, caseIndex) => validateCase(item, `${label}.cases[${caseIndex}]`))
  if (new Set(cases.map(item => item.caseId)).size !== cases.length) throw new Error(`${label}.cases contains duplicate caseId values`)
  return {
    id,
    label: requireString(value.label, `${label}.label`),
    enabled: value.enabled === true,
    runRootBase: requireAbsolute(value.runRootBase, `${label}.runRootBase`),
    maxConcurrentRuns,
    requiredPaths: requireStringArray(value.requiredPaths ?? [], `${label}.requiredPaths`)
      .map((item, pathIndex) => requireSafeRelativePath(item, `${label}.requiredPaths[${pathIndex}]`)),
    requiredEmptyDirectories: requireStringArray(value.requiredEmptyDirectories ?? [], `${label}.requiredEmptyDirectories`)
      .map((item, pathIndex) => requireSafeRelativePath(item, `${label}.requiredEmptyDirectories[${pathIndex}]`)),
    completionPaths: requireStringArray(value.completionPaths ?? [], `${label}.completionPaths`)
      .map((item, pathIndex) => requireSafeRelativePath(item, `${label}.completionPaths[${pathIndex}]`)),
    cases,
    command: {
      executable: requireAbsolute(command.executable, `${label}.command.executable`),
      arguments: requireStringArray(command.arguments, `${label}.command.arguments`),
      cwd: requireString(command.cwd, `${label}.command.cwd`),
    },
    sources: value.sources.map((item, sourceIndex) => validateSourceTemplate(item, `${label}.sources[${sourceIndex}]`)),
  }
}

export async function loadLaunchPlans(path: string): Promise<LaunchPlanManifest> {
  const manifest = await readJson(path, 'external preexperiment launch plan manifest')
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.plans)) {
    throw new Error('external preexperiment launch plan manifest must use schemaVersion 1 and contain plans')
  }
  const plans = manifest.plans.map(validatePlan)
  if (new Set(plans.map(plan => plan.id)).size !== plans.length) throw new Error('launch plan IDs must be unique')
  return { schemaVersion: 1, plans }
}

function expandTemplate(value: string, variables: TemplateValues, label: string): string {
  const expanded = value.replace(TEMPLATE_TOKEN, (_match, key: keyof TemplateValues) => variables[key])
  if (/\{[^{}]+\}/.test(expanded)) throw new Error(`${label} contains an unsupported template token`)
  return expanded
}

function expandSource(source: LaunchSourceTemplate, variables: TemplateValues, index: number): LiveSource {
  const label = `expanded sources[${index}]`
  const id = expandTemplate(source.id, variables, `${label}.id`)
  if (!SOURCE_ID.test(id)) throw new Error(`${label}.id contains unsupported characters`)
  const root = resolve(expandTemplate(source.root, variables, `${label}.root`))
  const cwd = resolve(expandTemplate(source.cwd ?? source.root, variables, `${label}.cwd`))
  const ledgerRoot = resolve(expandTemplate(source.ledgerRoot, variables, `${label}.ledgerRoot`))
  if (!isAbsolute(root) || !isAbsolute(cwd) || !isAbsolute(ledgerRoot)) throw new Error(`${label} paths must expand to absolute paths`)
  if (!isInside(variables.run_root, root) || !isInside(variables.run_root, cwd) || !isInside(variables.run_root, ledgerRoot)) {
    throw new Error(`${label} paths must stay inside the fresh run root`)
  }
  return {
    id,
    label: expandTemplate(source.label, variables, `${label}.label`),
    kind: source.kind,
    root,
    cwd,
    suffix: source.suffix ?? (source.kind === 'generic' || source.kind === 'implantagent-trace' ? '.jsonl' : '_events.jsonl'),
    nativeSession: source.nativeSession !== false,
    provider: source.provider ?? (source.kind === 'claude' ? 'claude-cli' : source.kind === 'codex' ? 'codex-cli' : 'external-process'),
    model: source.model ?? (source.kind === 'claude' ? 'external-claude' : source.kind === 'codex' ? 'external-codex' : 'external-agent'),
    ledgerRoot,
    projectionMode: source.projectionMode ?? 'default',
  }
}

async function validateTemplate(caseSpec: LaunchCaseSpec, plan: LaunchPlan): Promise<void> {
  const templateDetails = await stat(caseSpec.templateRoot)
  if (!templateDetails.isDirectory()) throw new Error(`template root is not a directory: ${caseSpec.templateRoot}`)
  for (const relativePath of plan.requiredPaths) {
    const candidate = resolve(caseSpec.templateRoot, relativePath)
    if (!isInside(caseSpec.templateRoot, candidate)) throw new Error(`required path escaped template root: ${relativePath}`)
    await stat(candidate)
  }
  for (const relativePath of plan.requiredEmptyDirectories) {
    const candidate = resolve(caseSpec.templateRoot, relativePath)
    if (!isInside(caseSpec.templateRoot, candidate)) throw new Error(`empty-directory path escaped template root: ${relativePath}`)
    const details = await stat(candidate)
    if (!details.isDirectory()) throw new Error(`required empty path is not a directory: ${relativePath}`)
    if ((await readdir(candidate)).length !== 0) throw new Error(`template runtime directory is not empty: ${relativePath}`)
  }
}

function managedRunId(planId: string, caseId: string): string {
  const stamp = new Date().toISOString().replaceAll(/[-:.TZ]/g, '').slice(0, 14)
  return `${planId}-${caseId.toLowerCase()}-${stamp}-${randomUUID().slice(0, 8)}`
}

function processAlive(pid: number | null): boolean | null {
  if (pid === null || !Number.isSafeInteger(pid) || pid <= 0) return null
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function missingCompletionPaths(runRoot: string, completionPaths: readonly string[]): Promise<string[]> {
  const missing: string[] = []
  for (const relativePath of completionPaths) {
    const candidate = resolve(runRoot, relativePath)
    if (!isInside(runRoot, candidate)) throw new Error(`completion path escaped run root: ${relativePath}`)
    if (!(await pathExists(candidate))) missing.push(relativePath)
  }
  return missing
}

async function loadRunRecords(root: string): Promise<ManagedRunRecord[]> {
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const records: ManagedRunRecord[] = []
  for (const entry of entries.filter(item => item.isFile() && item.name.endsWith('.run.json')).sort((left, right) => left.name.localeCompare(right.name))) {
    const label = `managed run record ${entry.name}`
    const value = await readJson(join(root, entry.name), label)
    if (value.schemaVersion !== 1) throw new Error(`${label} must use schemaVersion 1`)
    requireString(value.runId, `${label}.runId`)
    requireString(value.planId, `${label}.planId`)
    requireString(value.caseId, `${label}.caseId`)
    requireAbsolute(value.runRoot, `${label}.runRoot`)
    records.push(value as ManagedRunRecord)
  }
  return records
}

export async function loadRuntimeRegistrations(root: string): Promise<RuntimeSourceRegistration[]> {
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const registrations: RuntimeSourceRegistration[] = []
  for (const entry of entries.filter(item => item.isFile() && item.name.endsWith('.registration.json')).sort((left, right) => left.name.localeCompare(right.name))) {
    const label = `runtime registration ${entry.name}`
    registrations.push(validateRuntimeRegistration(await readJson(join(root, entry.name), label), label))
  }
  return registrations
}

export class PreexperimentLaunchManager {
  readonly options: LaunchManagerOptions
  readonly activeRuns = new Map<string, ChildProcess>()
  private launchInProgress = false

  constructor(options: LaunchManagerOptions) {
    this.options = options
  }

  async catalog(): Promise<{ readonly schemaVersion: 1; readonly plans: readonly LaunchCatalogPlan[] }> {
    const manifest = await loadLaunchPlans(this.options.plansPath)
    return {
      schemaVersion: 1,
      plans: manifest.plans.filter(plan => plan.enabled).map(plan => ({
        id: plan.id,
        label: plan.label,
        cases: plan.cases.map(item => item.caseId),
        maxConcurrentRuns: plan.maxConcurrentRuns,
        sources: plan.sources.map(source => ({
          kind: source.kind,
          label: source.label,
          provider: source.provider ?? null,
          model: source.model ?? null,
        })),
      })),
    }
  }

  async status(args: PreexperimentStatusArgs = {}): Promise<{ readonly schemaVersion: 1; readonly runs: readonly ManagedRunStatus[] }> {
    const records = await loadRunRecords(this.options.runRegistryRoot)
    const selected = records.filter(record =>
      (args.run_id === undefined || record.runId === args.run_id)
      && (args.plan_id === undefined || record.planId === args.plan_id)
      && (args.case_id === undefined || record.caseId === args.case_id))
    const registrations = await loadRuntimeRegistrations(this.options.registrationRoot)
    const runs = await Promise.all(selected.map(async record => {
      const registration = registrations.find(item => item.runId === record.runId)
      const alive = processAlive(record.processId)
      const observedSources = await Promise.all((registration?.sources ?? []).map(async source => ({
        id: source.id,
        label: source.label,
        kind: source.kind,
        rootExists: await pathExists(source.root),
      })))
      return {
        record,
        processAlive: alive,
        terminalStateVerified: record.state === 'completed' || record.state === 'failed' || record.state === 'launch_failed',
        observedSources,
      }
    }))
    return {
      schemaVersion: 1,
      runs,
    }
  }

  async start(args: PreexperimentStartArgs): Promise<ManagedRunRecord> {
    if (args.confirmation !== 'START_EXTERNAL_PREEXPERIMENT') throw new Error('explicit launch confirmation is required')
    if (this.launchInProgress) throw new Error('another managed launch is being prepared')
    this.launchInProgress = true
    try {
      const manifest = await loadLaunchPlans(this.options.plansPath)
      const plan = manifest.plans.find(item => item.id === args.plan_id && item.enabled)
      if (plan === undefined) throw new Error(`enabled launch plan not found: ${args.plan_id}`)
      const caseSpec = plan.cases.find(item => item.caseId === args.case_id)
      if (caseSpec === undefined) throw new Error(`case is not allowlisted for plan ${plan.id}: ${args.case_id}`)
      const records = await loadRunRecords(this.options.runRegistryRoot)
      const activeManagedRuns = records.filter(record => record.state === 'running' && processAlive(record.processId) === true)
      if (activeManagedRuns.length > 0) {
        throw new Error(`managed run ${activeManagedRuns[0]?.runId ?? 'unknown'} is still running; wait for it to finish before starting another external agent`)
      }
      const activeForPlan = records.filter(record => record.planId === plan.id && record.state === 'running' && processAlive(record.processId) === true)
      if (activeForPlan.length >= plan.maxConcurrentRuns) throw new Error(`launch plan ${plan.id} reached its concurrent-run limit`)

      await validateTemplate(caseSpec, plan)
      const runId = managedRunId(plan.id, caseSpec.caseId)
      const runRoot = resolve(plan.runRootBase, runId)
      if (!isInside(plan.runRootBase, runRoot) || runRoot === plan.runRootBase) throw new Error('fresh run root escaped its configured base')
      try {
        await stat(runRoot)
        throw new Error(`fresh run root already exists: ${runRoot}`)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
      await mkdir(plan.runRootBase, { recursive: true })
      await cp(caseSpec.templateRoot, runRoot, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true })

      const variables: TemplateValues = {
        plan_id: plan.id,
        case_id: caseSpec.caseId,
        run_id: runId,
        run_root: runRoot,
        template_root: caseSpec.templateRoot,
      }
      const sources = plan.sources.map((source, index) => expandSource(source, variables, index))
      if (new Set(sources.map(source => source.id)).size !== sources.length) throw new Error('expanded source IDs must be unique')
      for (const source of sources) {
        await mkdir(source.root, { recursive: true })
        await mkdir(source.ledgerRoot, { recursive: true })
      }
      const registrationPath = join(this.options.registrationRoot, `${runId}.registration.json`)
      const registration: RuntimeSourceRegistration = {
        schemaVersion: 1,
        runId,
        planId: plan.id,
        caseId: caseSpec.caseId,
        createdAt: new Date().toISOString(),
        sources,
      }
      await writeJsonAtomic(registrationPath, registration)

      const controlRoot = join(runRoot, 'supervisor_control')
      await mkdir(controlRoot, { recursive: true })
      const stdoutPath = join(controlRoot, 'launcher.stdout.log')
      const stderrPath = join(controlRoot, 'launcher.stderr.log')
      const recordPath = join(this.options.runRegistryRoot, `${runId}.run.json`)
      const executable = expandTemplate(plan.command.executable, variables, 'command.executable')
      const commandArgs = plan.command.arguments.map((item, index) => expandTemplate(item, variables, `command.arguments[${index}]`))
      const commandCwd = resolve(expandTemplate(plan.command.cwd, variables, 'command.cwd'))
      const executableDetails = await stat(executable)
      if (!executableDetails.isFile()) throw new Error(`configured executable is not a file: ${executable}`)
      const cwdDetails = await stat(commandCwd)
      if (!cwdDetails.isDirectory()) throw new Error(`configured command cwd is not a directory: ${commandCwd}`)
      const now = new Date().toISOString()
      let record: ManagedRunRecord = {
        schemaVersion: 1,
        runId,
        planId: plan.id,
        planLabel: plan.label,
        caseId: caseSpec.caseId,
        state: 'starting',
        createdAt: now,
        updatedAt: now,
        runRoot,
        registrationPath,
        stdoutPath,
        stderrPath,
        sourceIds: sources.map(source => source.id),
        commandSha256: sha256(JSON.stringify({ executable, arguments: commandArgs, cwd: commandCwd })),
        processId: null,
        exitCode: null,
        signal: null,
        error: null,
      }
      await writeJsonAtomic(recordPath, record)

      const stdout = await open(stdoutPath, 'a')
      const stderr = await open(stderrPath, 'a')
      let child: ChildProcess
      try {
        child = spawn(executable, commandArgs, {
          cwd: commandCwd,
          // Node's detached Windows launch can make Windows PowerShell 5.1
          // return 0 without executing the requested script. A non-detached
          // child can still be unref'ed and remains independently observable.
          detached: process.platform !== 'win32',
          shell: false,
          windowsHide: true,
          stdio: ['ignore', stdout.fd, stderr.fd],
        })
      } catch (error) {
        await stdout.close()
        await stderr.close()
        record = { ...record, state: 'launch_failed', updatedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) }
        await writeJsonAtomic(recordPath, record)
        throw error
      }
      await stdout.close()
      await stderr.close()
      child.unref()
      record = { ...record, state: 'running', updatedAt: new Date().toISOString(), processId: child.pid ?? null }
      await writeJsonAtomic(recordPath, record)
      this.activeRuns.set(runId, child)
      child.once('error', error => {
        const failed: ManagedRunRecord = { ...record, state: 'launch_failed', updatedAt: new Date().toISOString(), error: error.message }
        this.activeRuns.delete(runId)
        void writeJsonAtomic(recordPath, failed)
      })
      child.once('exit', (code, signal) => {
        this.activeRuns.delete(runId)
        void (async () => {
          const missing = code === 0 ? await missingCompletionPaths(runRoot, plan.completionPaths) : []
          const completed = code === 0 && missing.length === 0
          const finished: ManagedRunRecord = {
            ...record,
            state: completed ? 'completed' : 'failed',
            updatedAt: new Date().toISOString(),
            exitCode: code,
            signal,
            error: completed
              ? null
              : code === 0
                ? `trusted supervisor exited with 0 but completion artifact(s) are missing: ${missing.join(', ')}`
                : `trusted supervisor exited with ${code ?? signal ?? 'unknown status'}`,
          }
          await writeJsonAtomic(recordPath, finished)
        })().catch(error => {
          const failed: ManagedRunRecord = {
            ...record,
            state: 'failed',
            updatedAt: new Date().toISOString(),
            exitCode: code,
            signal,
            error: `could not verify trusted supervisor completion: ${error instanceof Error ? error.message : String(error)}`,
          }
          void writeJsonAtomic(recordPath, failed)
        })
      })
      return record
    } finally {
      this.launchInProgress = false
    }
  }
}
