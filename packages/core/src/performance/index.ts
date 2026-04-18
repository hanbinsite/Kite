const isDev =
  typeof import.meta !== "undefined" && (import.meta as unknown as Record<string, Record<string, unknown>>).env
    ? ((import.meta as unknown as Record<string, Record<string, unknown>>).env?.DEV as boolean)
    : false;

export interface PerformanceMark {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

const marks = new Map<string, PerformanceMark>();

export function markStart(name: string, metadata?: Record<string, unknown>): void {
  marks.set(name, {
    name,
    startTime: performance.now(),
    metadata,
  });
  if (isDev) {
    console.debug(`[perf] ⏱ ${name}:start`, metadata ?? "");
  }
}

export function markEnd(name: string, metadata?: Record<string, unknown>): number | undefined {
  const mark = marks.get(name);
  if (!mark) return undefined;

  mark.endTime = performance.now();
  mark.duration = mark.endTime - mark.startTime;
  if (metadata) mark.metadata = { ...mark.metadata, ...metadata };

  if (isDev) {
    console.debug(`[perf] ⏱ ${name}:end ${mark.duration.toFixed(1)}ms`, mark.metadata ?? "");
  }

  return mark.duration;
}

export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>,
): Promise<T> {
  markStart(name, metadata);
  try {
    const result = await fn();
    markEnd(name, metadata);
    return result;
  } catch (error) {
    markEnd(name, { ...metadata, error: true });
    throw error;
  }
}

export function measureSync<T>(
  name: string,
  fn: () => T,
  metadata?: Record<string, unknown>,
): T {
  markStart(name, metadata);
  try {
    const result = fn();
    markEnd(name, metadata);
    return result;
  } catch (error) {
    markEnd(name, { ...metadata, error: true });
    throw error;
  }
}

export function getMark(name: string): PerformanceMark | undefined {
  return marks.get(name);
}

export function getAllMarks(): PerformanceMark[] {
  return Array.from(marks.values());
}
