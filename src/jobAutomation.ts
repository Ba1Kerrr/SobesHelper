import { callHHTool } from "./pythonBridge";

interface AutomationJobConfig {
  enabled: boolean;
  intervalHours: number;
  presetName?: string;
  nextRunAt?: number;
  lastRunAt?: number;
  lastStatus?: string;
}

interface JobAutomationConfig {
  search?: AutomationJobConfig;
  resumeRefresh?: AutomationJobConfig;
}

interface InitDeps {
  getConfig: () => Record<string, any>;
  setConfig: (config: Record<string, any>) => void;
  broadcast: (channel: string, payload?: any) => void;
}

// Both floors exist because these hit real hh.ru endpoints repeatedly and
// unattended - enforced here (not just as a UI hint) so a mistyped interval
// can't turn into hammering the API while the app just sits in the tray.
const MIN_INTERVAL_HOURS: Record<"search" | "resumeRefresh", number> = {
  search: 1,
  resumeRefresh: 2,
};

let deps: InitDeps | null = null;
const timers = new Map<"search" | "resumeRefresh", ReturnType<typeof setTimeout>>();

function getAutomationConfig(): JobAutomationConfig {
  return (deps!.getConfig().job_automation as JobAutomationConfig) || {};
}

function patchJob(id: "search" | "resumeRefresh", patch: Partial<AutomationJobConfig>): void {
  const config = deps!.getConfig();
  const automation: JobAutomationConfig = { ...(config.job_automation || {}) };
  automation[id] = { ...(automation[id] as AutomationJobConfig), ...patch } as AutomationJobConfig;
  deps!.setConfig({ ...config, job_automation: automation });
}

async function runSearchJob(): Promise<void> {
  const job = getAutomationConfig().search;
  const pythonPath = deps!.getConfig().python_path || "python";
  if (!job?.presetName) {
    patchJob("search", { lastRunAt: Date.now(), lastStatus: "error: no preset configured" });
    return;
  }
  try {
    const params = await callHHTool(pythonPath, "load_preset", { name: job.presetName });
    if (!params) {
      patchJob("search", { lastRunAt: Date.now(), lastStatus: `error: preset "${job.presetName}" not found` });
      return;
    }
    const result = await callHHTool(pythonPath, "apply_vacancies", { params });
    patchJob("search", {
      lastRunAt: Date.now(),
      lastStatus: result?.status === "error" ? `error: ${result.message}` : "ok",
    });
  } catch (err: any) {
    patchJob("search", { lastRunAt: Date.now(), lastStatus: `error: ${err?.message || err}` });
  }
}

async function runResumeRefreshJob(): Promise<void> {
  const pythonPath = deps!.getConfig().python_path || "python";
  try {
    const result = await callHHTool(pythonPath, "run_operation", { name: "update_resumes", params: {} });
    patchJob("resumeRefresh", {
      lastRunAt: Date.now(),
      lastStatus: result?.status === "error" ? `error: ${result.message}` : "ok",
    });
  } catch (err: any) {
    patchJob("resumeRefresh", { lastRunAt: Date.now(), lastStatus: `error: ${err?.message || err}` });
  }
}

const RUNNERS: Record<"search" | "resumeRefresh", () => Promise<void>> = {
  search: runSearchJob,
  resumeRefresh: runResumeRefreshJob,
};

function scheduleJob(id: "search" | "resumeRefresh"): void {
  const existing = timers.get(id);
  if (existing) clearTimeout(existing);

  const job = getAutomationConfig()[id];
  if (!job?.enabled) return;

  const intervalMs = Math.max(MIN_INTERVAL_HOURS[id], job.intervalHours || 0) * 60 * 60 * 1000;
  // If the app restarted mid-interval, nextRunAt (persisted) is still in the
  // future - honor the remaining wait instead of firing immediately, so a
  // restart can't be used to dodge the interval.
  const delay = job.nextRunAt ? Math.max(0, job.nextRunAt - Date.now()) : 0;

  const timer = setTimeout(async () => {
    // The reschedule at the end must always run, even if something above it
    // throws (a disk write hiccup on patchJob, etc.) - otherwise one bad
    // tick permanently stops this job until the app is restarted, silently.
    try {
      await RUNNERS[id]();
      patchJob(id, { nextRunAt: Date.now() + intervalMs });
      deps!.broadcast("hh-event", { type: "automation", job: id, ...getAutomationConfig()[id] });
    } catch {
      // RUNNERS[id]() already catches its own errors into lastStatus: this
      // only guards against a failure in the bookkeeping around it.
    } finally {
      scheduleJob(id);
    }
  }, delay);
  timers.set(id, timer);
}

export function initJobAutomation(initDeps: InitDeps): void {
  deps = initDeps;
  (["search", "resumeRefresh"] as const).forEach(scheduleJob);
}

// Called after set-job-automation saves new config - re-arms both jobs from
// whatever is currently persisted so a toggle or interval change takes
// effect immediately, no app restart needed.
export function rescheduleJobAutomation(): void {
  if (!deps) return;
  (["search", "resumeRefresh"] as const).forEach(scheduleJob);
}

export function clampIntervalHours(id: "search" | "resumeRefresh", hours: number): number {
  return Math.max(MIN_INTERVAL_HOURS[id], hours || MIN_INTERVAL_HOURS[id]);
}
