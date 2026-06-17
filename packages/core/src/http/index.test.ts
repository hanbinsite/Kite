import { describe, it, expect } from "vitest";
import { buildIpcAuth } from "./index";

describe("buildIpcAuth", () => {
  it("returns type and config for bearer", () => {
    const result = buildIpcAuth("bearer", { token: "my-token" });
    expect(result).toEqual({ type: "bearer", config: { token: "my-token" } });
  });

  it("returns type and config for basic", () => {
    const result = buildIpcAuth("basic", { username: "user", password: "pass" });
    expect(result).toEqual({
      type: "basic",
      config: { username: "user", password: "pass" },
    });
  });

  it("returns type and config for apikey", () => {
    const result = buildIpcAuth("apikey", { key: "X-API-Key", value: "secret" });
    expect(result).toEqual({
      type: "apikey",
      config: { key: "X-API-Key", value: "secret" },
    });
  });

  it("returns type and config for jwt", () => {
    const result = buildIpcAuth("jwt", { token: "jwt.token.here" });
    expect(result).toEqual({ type: "jwt", config: { token: "jwt.token.here" } });
  });

  it("returns type and config for oauth2", () => {
    const result = buildIpcAuth("oauth2", { accessToken: "at-123" });
    expect(result).toEqual({
      type: "oauth2",
      config: { accessToken: "at-123" },
    });
  });

  it("returns type and config even without required fields", () => {
    const result = buildIpcAuth("bearer", {});
    expect(result).toEqual({ type: "bearer", config: {} });
  });

  it("handles null config", () => {
    const result = buildIpcAuth("bearer", null);
    expect(result).toEqual({ type: "bearer", config: null });
  });

  it("returns config for unknown auth type", () => {
    const result = buildIpcAuth("unknown_type", { foo: "bar" });
    expect(result).toEqual({ type: "unknown_type", config: { foo: "bar" } });
  });

  it("does not throw for basic with missing password", () => {
    const result = buildIpcAuth("basic", { username: "user" });
    expect(result).toEqual({
      type: "basic",
      config: { username: "user" },
    });
  });
});