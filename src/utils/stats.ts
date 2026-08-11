export interface UsageStats {
  questionsAnswered: number;
  totalResponseMs: number;
  sessionsStarted: number;
  // "Time to first word" - what's actually perceived as latency, distinct
  // from totalResponseMs (full completion, which for a long answer can take
  // much longer even once streaming makes the first word appear fast).
  totalFirstChunkMs: number;
  firstChunkCount: number;
}

const DEFAULT_STATS: UsageStats = {
  questionsAnswered: 0,
  totalResponseMs: 0,
  sessionsStarted: 0,
  totalFirstChunkMs: 0,
  firstChunkCount: 0,
};

const STORAGE_KEY = "interview_stats";

function readStats(): UsageStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_STATS, ...JSON.parse(raw) };
  } catch {
    // corrupt/missing data - fall through to defaults
  }
  return { ...DEFAULT_STATS };
}

function writeStats(stats: UsageStats): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

export function recordQuestion(durationMs: number): void {
  const stats = readStats();
  stats.questionsAnswered += 1;
  stats.totalResponseMs += durationMs;
  writeStats(stats);
}

export function recordFirstChunk(durationMs: number): void {
  const stats = readStats();
  stats.firstChunkCount += 1;
  stats.totalFirstChunkMs += durationMs;
  writeStats(stats);
}

export function recordSessionStart(): void {
  const stats = readStats();
  stats.sessionsStarted += 1;
  writeStats(stats);
}

export function getStats(): UsageStats {
  return readStats();
}
