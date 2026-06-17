import { describe, it, expect } from "vitest";
import { VariableResolver, variablesToRecord } from "@api-client/core";
import type { VariableScope } from "@api-client/core";
import type { Variable } from "@api-client/types";

describe("VariableResolver", () => {
  const baseScopes: VariableScope = {
    global: { HOST: "https://global.example.com" },
    collection: { HOST: "https://collection.example.com" },
    environment: { HOST: "https://env.example.com", PORT: "8080" },
    local: { TOKEN: "local-token" },
  };

  it("resolves variable from local scope first", () => {
    const scopes: VariableScope = { ...baseScopes, local: { TOKEN: "local-token" }, environment: { TOKEN: "env-token" } };
    const resolver = new VariableResolver(scopes);
    expect(resolver.get("TOKEN")).toBe("local-token");
  });

  it("falls back through priority: local > data > request > environment > folder > collection > global", () => {
    const r = new VariableResolver({
      global: { X: "global" },
      collection: { X: "collection" },
      folder: { X: "folder" },
      environment: { X: "environment" },
      request: { X: "request" },
      data: { X: "data" },
      local: { X: "local" },
    });
    expect(r.get("X")).toBe("local");
    r.get("X");
    const r2 = new VariableResolver({
      global: { Y: "global" },
      environment: { Y: "env" },
    });
    expect(r2.get("Y")).toBe("env");
  });

  it("returns undefined for unknown variable", () => {
    const resolver = new VariableResolver(baseScopes);
    expect(resolver.get("UNKNOWN_VAR")).toBeUndefined();
  });

  it("resolves dynamic variable $guid", () => {
    const resolver = new VariableResolver({});
    const result = resolver.get("$guid");
    expect(result).toBeDefined();
    expect(typeof result).toBe("string");
    expect(result!.length).toBeGreaterThan(0);
  });

  it("resolves dynamic variable $timestamp", () => {
    const resolver = new VariableResolver({});
    const result = resolver.get("$timestamp");
    expect(result).toBeDefined();
    expect(Number(result)).toBeGreaterThan(0);
  });

  it("resolves dynamic variable $randomInt (0-1000)", () => {
    const resolver = new VariableResolver({});
    const result = resolver.get("$randomInt");
    const num = Number(result);
    expect(num).toBeGreaterThanOrEqual(0);
    expect(num).toBeLessThanOrEqual(1000);
  });

  it("resolves dynamic variable $randomEmail", () => {
    const resolver = new VariableResolver({});
    const result = resolver.get("$randomEmail");
    expect(result).toContain("@");
  });

  it("resolves dynamic variable $randomUuid", () => {
    const resolver = new VariableResolver({});
    const result = resolver.get("$randomUuid");
    expect(result).toBeDefined();
    expect(result!.length).toBeGreaterThan(0);
  });

  it("resolves dynamic variable $randomAlphaNumeric", () => {
    const resolver = new VariableResolver({});
    const result = resolver.get("$randomAlphaNumeric");
    expect(result).toBeDefined();
    expect(result!.length).toBe(8);
  });

  it("resolves dynamic variable $randomFullName", () => {
    const resolver = new VariableResolver({});
    const result = resolver.get("$randomFullName");
    expect(result).toContain(" ");
  });

  it("resolves {{variable}} syntax in text", () => {
    const resolver = new VariableResolver({ global: { NAME: "World" } });
    expect(resolver.resolve("Hello {{NAME}}!")).toBe("Hello World!");
  });

  it("leaves unresolved variable placeholder intact", () => {
    const resolver = new VariableResolver({});
    expect(resolver.resolve("Hello {{MISSING}}")).toBe("Hello {{MISSING}}");
  });

  it("resolves nested variables", () => {
    const resolver = new VariableResolver({
      global: { KEY_NAME: "VALUE", VALUE: "resolved" },
    });
    expect(resolver.resolve("{{KEY_NAME}}")).toBe("VALUE");
  });

  it("prevents infinite recursion (max 5 iterations)", () => {
    const resolver = new VariableResolver({
      global: { A: "{{B}}", B: "{{A}}" },
    });
    const result = resolver.resolve("{{A}}");
    expect(result).not.toBe("{{A}}");
  });

  it("custom dynamic generators override defaults", () => {
    const customDynamic: Record<string, () => string> = {
      $myvar: () => "custom-value",
    };
    const resolver = new VariableResolver({}, customDynamic);
    expect(resolver.get("$myvar")).toBe("custom-value");
  });

  it("resolveMap resolves all values", () => {
    const resolver = new VariableResolver({ global: { PREFIX: "dev" } });
    const map = { url: "http://{{PREFIX}}.example.com", name: "{{PREFIX}}-api" };
    const resolved = resolver.resolveMap(map);
    expect(resolved.url).toBe("http://dev.example.com");
    expect(resolved.name).toBe("dev-api");
  });
});

describe("variablesToRecord", () => {
  it("converts enabled variables to record", () => {
    const vars: Variable[] = [
      { key: "HOST", value: "localhost", enabled: true },
      { key: "PORT", value: "3000", enabled: true },
      { key: "DISABLED", value: "ignored", enabled: false },
    ];
    const record = variablesToRecord(vars);
    expect(record).toEqual({ HOST: "localhost", PORT: "3000" });
  });

  it("skips variables with empty key", () => {
    const vars: Variable[] = [
      { key: "", value: "no-key", enabled: true },
      { key: "VALID", value: "yes", enabled: true },
    ];
    const record = variablesToRecord(vars);
    expect(record).toEqual({ VALID: "yes" });
  });

  it("returns empty record for empty array", () => {
    expect(variablesToRecord([])).toEqual({});
  });
});