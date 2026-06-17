export interface DiffResult {
  added: string[];
  removed: string[];
  changed: { path: string; oldValue: unknown; newValue: unknown }[];
}

export function computeJsonDiff(prev: unknown, curr: unknown, path: string = ""): DiffResult {
  const result: DiffResult = { added: [], removed: [], changed: [] };

  if (prev === curr) return result;

  if (typeof prev !== typeof curr) {
    result.changed.push({ path: path || "$", oldValue: prev, newValue: curr });
    return result;
  }

  if (prev === null || curr === null) {
    if (prev !== curr) result.changed.push({ path: path || "$", oldValue: prev, newValue: curr });
    return result;
  }

  if (Array.isArray(prev) && Array.isArray(curr)) {
    const maxLen = Math.max(prev.length, curr.length);
    for (let i = 0; i < maxLen; i++) {
      if (i >= prev.length) {
        result.added.push(`${path}[${i}]`);
      } else if (i >= curr.length) {
        result.removed.push(`${path}[${i}]`);
      } else {
        const sub = computeJsonDiff(prev[i], curr[i], `${path}[${i}]`);
        result.added.push(...sub.added);
        result.removed.push(...sub.removed);
        result.changed.push(...sub.changed);
      }
    }
    return result;
  }

  if (typeof prev === "object" && typeof curr === "object") {
    const prevKeys = Object.keys(prev as Record<string, unknown>);
    const currKeys = Object.keys(curr as Record<string, unknown>);
    const allKeys = new Set([...prevKeys, ...currKeys]);
    for (const key of allKeys) {
      const p = path ? `${path}.${key}` : key;
      if (!(key in (prev as object))) {
        result.added.push(p);
      } else if (!(key in (curr as object))) {
        result.removed.push(p);
      } else {
        const sub = computeJsonDiff(
          (prev as Record<string, unknown>)[key],
          (curr as Record<string, unknown>)[key],
          p,
        );
        result.added.push(...sub.added);
        result.removed.push(...sub.removed);
        result.changed.push(...sub.changed);
      }
    }
    return result;
  }

  if (prev !== curr) result.changed.push({ path: path || "$", oldValue: prev, newValue: curr });
  return result;
}
