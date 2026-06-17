import { describe, it, expect, beforeEach } from "vitest";
import {
  markStart,
  markEnd,
  measureAsync,
  measureSync,
  getMark,
  getAllMarks,
} from "./index";

const knownMarks = new Set<string>();

function clearKnownMarks() {
  for (const name of knownMarks) {
    markEnd(name);
    markEnd(name); // second call is no-op but helps
  }
  knownMarks.clear();
}

beforeEach(() => {
  clearKnownMarks();
});

function trackAndStart(name: string, metadata?: Record<string, unknown>) {
  knownMarks.add(name);
  markStart(name, metadata);
}

describe("performance marks", () => {
  it("markStart creates a mark with startTime", () => {
    const before = performance.now();
    trackAndStart("test1");
    const after = performance.now();
    const mark = getMark("test1");
    expect(mark).toBeDefined();
    expect(mark!.name).toBe("test1");
    expect(mark!.startTime).toBeGreaterThanOrEqual(before);
    expect(mark!.startTime).toBeLessThanOrEqual(after);
    expect(mark!.endTime).toBeUndefined();
  });

  it("markStart stores metadata", () => {
    trackAndStart("meta", { key: "val" });
    const mark = getMark("meta");
    expect(mark!.metadata).toEqual({ key: "val" });
  });

  it("markEnd sets endTime and duration", () => {
    trackAndStart("test2");
    markEnd("test2");
    const mark = getMark("test2");
    expect(mark!.endTime).toBeDefined();
    expect(mark!.duration).toBeGreaterThanOrEqual(0);
  });

  it("markEnd returns undefined for non-existent mark", () => {
    const result = markEnd("nonexistent");
    expect(result).toBeUndefined();
  });

  it("markEnd merges metadata", () => {
    trackAndStart("meta2", { a: 1 });
    markEnd("meta2", { b: 2 });
    const mark = getMark("meta2");
    expect(mark!.metadata).toEqual({ a: 1, b: 2 });
  });

  it("getMark returns undefined for missing mark", () => {
    expect(getMark("missing")).toBeUndefined();
  });

  it("getAllMarks returns all marks", () => {
    trackAndStart("a");
    trackAndStart("b");
    markEnd("a");
    const all = getAllMarks();
    // filter to only our tracked marks
    const ours = all.filter((m) => knownMarks.has(m.name));
    expect(ours.length).toBe(2);
    const names = ours.map((m) => m.name).sort();
    expect(names).toEqual(["a", "b"]);
  });
});

describe("measureAsync", () => {
  it("returns the function result", async () => {
    const result = await measureAsync("async1", async () => 42);
    expect(result).toBe(42);
    knownMarks.add("async1");
  });

  it("marks start and end", async () => {
    await measureAsync("async2", async () => {});
    knownMarks.add("async2");
    const mark = getMark("async2");
    expect(mark).toBeDefined();
    expect(mark!.duration).toBeGreaterThanOrEqual(0);
  });

  it("marks end with error=true on exception", async () => {
    await expect(
      measureAsync("async3", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    knownMarks.add("async3");
    const mark = getMark("async3");
    expect(mark!.duration).toBeGreaterThanOrEqual(0);
    expect(mark!.metadata?.error).toBe(true);
  });
});

describe("measureSync", () => {
  it("returns the function result", () => {
    const result = measureSync("sync1", () => "hello");
    expect(result).toBe("hello");
    knownMarks.add("sync1");
  });

  it("marks start and end", () => {
    measureSync("sync2", () => {});
    knownMarks.add("sync2");
    const mark = getMark("sync2");
    expect(mark).toBeDefined();
    expect(mark!.duration).toBeGreaterThanOrEqual(0);
  });

  it("marks end with error=true on exception", () => {
    expect(() =>
      measureSync("sync3", () => {
        throw new Error("sync boom");
      }),
    ).toThrow("sync boom");
    knownMarks.add("sync3");
    const mark = getMark("sync3");
    expect(mark!.duration).toBeGreaterThanOrEqual(0);
    expect(mark!.metadata?.error).toBe(true);
  });
});