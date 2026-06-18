import { describe, it, expect } from "vitest";
import { detectFormat } from "./detect";

describe("format auto-detection", () => {
  it("detects Postman format (has info and _postman_id)", () => {
    const input = JSON.stringify({
      info: { _postman_id: "abc-123", name: "My Collection" },
      item: [],
    });
    expect(detectFormat(input)).toBe("postman");
  });

  it("detects Postman format (has info.schema with postman)", () => {
    const input = JSON.stringify({
      info: { schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
      item: [],
    });
    expect(detectFormat(input)).toBe("postman");
  });

  it("detects HAR format (has log with entries)", () => {
    const input = JSON.stringify({
      log: { entries: [] },
    });
    expect(detectFormat(input)).toBe("har");
  });

  it("detects HAR format (has log with entries populated)", () => {
    const input = JSON.stringify({
      log: {
        entries: [
          { request: { method: "GET", url: "https://example.com" }, response: { status: 200 } },
        ],
      },
    });
    expect(detectFormat(input)).toBe("har");
  });

  it("detects OpenAPI format (has openapi key)", () => {
    const input = JSON.stringify({
      openapi: "3.0.0",
      info: { title: "API", version: "1.0" },
      paths: {},
    });
    expect(detectFormat(input)).toBe("openapi");
  });

  it("detects OpenAPI format (has swagger key)", () => {
    const input = JSON.stringify({
      swagger: "2.0",
      info: { title: "API", version: "1.0" },
      paths: {},
    });
    expect(detectFormat(input)).toBe("openapi");
  });

  it("detects curl format (starts with curl)", () => {
    expect(detectFormat("curl https://api.example.com")).toBe("curl");
  });

  it("detects curl format with flags", () => {
    expect(detectFormat("curl -X POST -H 'Content-Type: application/json' https://api.example.com")).toBe("curl");
  });

  it("returns unknown for empty input", () => {
    expect(detectFormat("")).toBe("unknown");
  });

  it("returns unknown for whitespace-only input", () => {
    expect(detectFormat("   \n\t  ")).toBe("unknown");
  });

  it("returns unknown for non-JSON input that is not curl", () => {
    expect(detectFormat("some random plain text string")).toBe("unknown");
  });

  it("returns unknown for valid JSON without known format keys", () => {
    expect(detectFormat(JSON.stringify({ foo: "bar", baz: 42 }))).toBe("unknown");
  });

  it("returns unknown for JSON array", () => {
    expect(detectFormat(JSON.stringify([1, 2, 3]))).toBe("unknown");
  });
});