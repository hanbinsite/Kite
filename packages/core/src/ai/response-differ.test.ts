import { describe, it, expect } from "vitest";
import { computeJsonDiff } from "./response-differ";

describe("computeJsonDiff", () => {
  it("returns empty diff for identical primitives", () => {
    const result = computeJsonDiff(42, 42);
    expect(result).toEqual({ added: [], removed: [], changed: [] });
  });

  it("returns empty diff for identical strings", () => {
    const result = computeJsonDiff("hello", "hello");
    expect(result).toEqual({ added: [], removed: [], changed: [] });
  });

  it("detects type change at root", () => {
    const result = computeJsonDiff(42, "42");
    expect(result.changed).toEqual([{ path: "$", oldValue: 42, newValue: "42" }]);
  });

  it("detects primitive value change", () => {
    const result = computeJsonDiff(1, 2);
    expect(result.changed).toEqual([{ path: "$", oldValue: 1, newValue: 2 }]);
  });

  it("detects null vs value change", () => {
    const result = computeJsonDiff(null, "hello");
    expect(result.changed).toEqual([{ path: "$", oldValue: null, newValue: "hello" }]);
  });

  it("detects null vs null as identical", () => {
    const result = computeJsonDiff(null, null);
    expect(result).toEqual({ added: [], removed: [], changed: [] });
  });

  it("detects added key in object", () => {
    const prev = { name: "Alice" };
    const curr = { name: "Alice", age: 30 };
    const result = computeJsonDiff(prev, curr);
    expect(result.added).toEqual(["age"]);
  });

  it("detects removed key in object", () => {
    const prev = { name: "Alice", age: 30 };
    const curr = { name: "Alice" };
    const result = computeJsonDiff(prev, curr);
    expect(result.removed).toEqual(["age"]);
  });

  it("detects changed value in object", () => {
    const prev = { name: "Alice", count: 1 };
    const curr = { name: "Alice", count: 2 };
    const result = computeJsonDiff(prev, curr);
    expect(result.changed).toEqual([{ path: "count", oldValue: 1, newValue: 2 }]);
  });

  it("detects added element in array", () => {
    const prev = [1, 2];
    const curr = [1, 2, 3];
    const result = computeJsonDiff(prev, curr);
    expect(result.added).toEqual(["[2]"]);
  });

  it("detects removed element from array", () => {
    const prev = [1, 2, 3];
    const curr = [1, 2];
    const result = computeJsonDiff(prev, curr);
    expect(result.removed).toEqual(["[2]"]);
  });

  it("detects changed element in array", () => {
    const prev = [1, 2, 3];
    const curr = [1, 99, 3];
    const result = computeJsonDiff(prev, curr);
    expect(result.changed).toEqual([{ path: "[1]", oldValue: 2, newValue: 99 }]);
  });

  it("detects mixed changes in complex object", () => {
    const prev = { user: { name: "Alice", tags: ["admin"] }, version: 1 };
    const curr = { user: { name: "Bob", tags: ["admin", "editor"] }, version: 1 };
    const result = computeJsonDiff(prev, curr);
    expect(result.changed).toEqual([{ path: "user.name", oldValue: "Alice", newValue: "Bob" }]);
    expect(result.added).toEqual(["user.tags[1]"]);
  });

  it("handles empty objects as identical", () => {
    const result = computeJsonDiff({}, {});
    expect(result).toEqual({ added: [], removed: [], changed: [] });
  });

  it("handles empty arrays as identical", () => {
    const result = computeJsonDiff([], []);
    expect(result).toEqual({ added: [], removed: [], changed: [] });
  });

  it("handles nested object with all three diff types", () => {
    const prev = { a: 1, b: [10, 20], c: { d: "hello" } };
    const curr = { a: 2, b: [10, 20, 30], e: "new" };
    const result = computeJsonDiff(prev, curr);
    expect(result.changed).toEqual([{ path: "a", oldValue: 1, newValue: 2 }]);
    expect(result.added).toEqual(["b[2]", "e"]);
    expect(result.removed).toEqual(["c"]);
  });

  it("handles boolean values", () => {
    const result = computeJsonDiff(true, false);
    expect(result.changed).toEqual([{ path: "$", oldValue: true, newValue: false }]);
  });

  it("handles undefined values", () => {
    const result = computeJsonDiff(undefined, "hello");
    expect(result.changed).toEqual([{ path: "$", oldValue: undefined, newValue: "hello" }]);
  });
});