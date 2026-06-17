import { describe, it, expect } from "vitest";
import { buildContextMessage, type AiContextData } from "./context-builder";

describe("buildContextMessage", () => {
  it('returns a system message', () => {
    const msg = buildContextMessage({});
    expect(msg.role).toBe("system");
    expect(typeof msg.content).toBe("string");
  });

  it("mentions available actions", () => {
    const msg = buildContextMessage({});
    expect(msg.content).toContain("create_request");
    expect(msg.content).toContain("modify_request");
    expect(msg.content).toContain("write_test");
    expect(msg.content).toContain("generate_doc");
    expect(msg.content).toContain("fix_error");
    expect(msg.content).toContain("extract_variables");
    expect(msg.content).toContain("generate_mock");
  });

  it("includes active request when provided", () => {
    const data: AiContextData = {
      request: { method: "POST", url: "https://api.example.com/users" },
    };
    const msg = buildContextMessage(data);
    expect(msg.content).toContain("POST https://api.example.com/users");
  });

  it("does NOT include request section when undefined", () => {
    const msg = buildContextMessage({});
    expect(msg.content).not.toContain("Active request:");
  });

  it("includes environment with variables", () => {
    const data: AiContextData = {
      environments: [
        { name: "staging", variables: [{ key: "BASE_URL", value: "https://stg.example.com" }] },
      ],
    };
    const msg = buildContextMessage(data);
    expect(msg.content).toContain("Environments:");
    expect(msg.content).toContain("staging:");
    expect(msg.content).toContain("BASE_URL=https://stg.example.com");
  });

  it("includes environment with no variables", () => {
    const data: AiContextData = {
      environments: [{ name: "empty_env", variables: [] }],
    };
    const msg = buildContextMessage(data);
    expect(msg.content).toContain("empty_env: none");
  });

  it("includes multiple environments", () => {
    const data: AiContextData = {
      environments: [
        { name: "dev", variables: [{ key: "HOST", value: "localhost" }] },
        { name: "prod", variables: [{ key: "HOST", value: "api.prod.com" }] },
      ],
    };
    const msg = buildContextMessage(data);
    expect(msg.content).toContain("dev:");
    expect(msg.content).toContain("prod:");
  });

  it("includes collections when provided", () => {
    const data: AiContextData = {
      collections: ["Users API", "Orders API"],
    };
    const msg = buildContextMessage(data);
    expect(msg.content).toContain("Collections: Users API, Orders API");
  });

  it("does NOT include collections when empty", () => {
    const msg = buildContextMessage({ collections: [] });
    expect(msg.content).not.toContain("Collections:");
  });

  it("includes full context with all sections", () => {
    const data: AiContextData = {
      request: { method: "GET", url: "https://api.example.com/health" },
      environments: [
        { name: "dev", variables: [{ key: "TOKEN", value: "dev-token" }] },
      ],
      collections: ["Health API"],
    };
    const msg = buildContextMessage(data);
    expect(msg.content).toContain("GET https://api.example.com/health");
    expect(msg.content).toContain("dev:");
    expect(msg.content).toContain("TOKEN=dev-token");
    expect(msg.content).toContain("Collections: Health API");
  });
});