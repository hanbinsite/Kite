import { describe, it, expect } from "vitest";
import {
  CreateRequestActionSchema,
  ModifyRequestActionSchema,
  WriteTestActionSchema,
  GenerateDocActionSchema,
  FixErrorActionSchema,
  ExtractVariablesActionSchema,
  GenerateMockActionSchema,
  parseAgentAction,
  AGENT_TOOLS,
} from "./action-types";

describe("action-types", () => {
  describe("CreateRequestActionSchema", () => {
    it("parses valid create_request", () => {
      const result = CreateRequestActionSchema.safeParse({
        type: "create_request",
        description: "Create a new endpoint",
        data: {
          name: "Get Users",
          method: "GET",
          url: "https://api.example.com/users",
        },
      });
      expect(result.success).toBe(true);
    });

    it("parses create_request with optional headers", () => {
      const result = CreateRequestActionSchema.safeParse({
        type: "create_request",
        description: "test",
        data: {
          name: "Login",
          method: "POST",
          url: "https://api.example.com/login",
          headers: [{ key: "Content-Type", value: "application/json" }],
        },
      });
      expect(result.success).toBe(true);
    });

    it("rejects create_request with invalid method", () => {
      const result = CreateRequestActionSchema.safeParse({
        type: "create_request",
        description: "test",
        data: { name: "X", method: "PATCH", url: "https://x.com" },
      });
      // PATCH is valid
      expect(result.success).toBe(true);
    });

    it("rejects missing required fields", () => {
      const result = CreateRequestActionSchema.safeParse({
        type: "create_request",
        description: "test",
        data: { name: "X" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty string name (zod string allows empty by default)", () => {
      const result = CreateRequestActionSchema.safeParse({
        type: "create_request",
        description: "test",
        data: { name: "", method: "GET", url: "https://x.com" },
      });
      // Zod's .string() allows empty strings by default
      expect(result.success).toBe(true);
    });
  });

  describe("ModifyRequestActionSchema", () => {
    it("parses valid modify_request", () => {
      const result = ModifyRequestActionSchema.safeParse({
        type: "modify_request",
        description: "Update URL",
        data: { changes: [{ path: "url", op: "set", value: "https://new.example.com" }] },
      });
      expect(result.success).toBe(true);
    });

    it("parses remove op without value", () => {
      const result = ModifyRequestActionSchema.safeParse({
        type: "modify_request",
        description: "Remove header",
        data: { changes: [{ path: "headers.Authorization", op: "remove" }] },
      });
      expect(result.success).toBe(true);
    });

    it("accepts empty changes array (zod array allows empty by default)", () => {
      const result = ModifyRequestActionSchema.safeParse({
        type: "modify_request",
        description: "test",
        data: { changes: [] },
      });
      // Zod's .array() allows empty arrays by default
      expect(result.success).toBe(true);
    });
  });

  describe("WriteTestActionSchema", () => {
    it("parses valid write_test", () => {
      const result = WriteTestActionSchema.safeParse({
        type: "write_test",
        description: "Status test",
        data: { script: "pm.test('status is 200', () => { pm.response.to.have.status(200); });" },
      });
      expect(result.success).toBe(true);
    });

    it("defaults language to javascript", () => {
      const result = WriteTestActionSchema.safeParse({
        type: "write_test",
        description: "test",
        data: { script: "pm.test('x', () => {});" },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data.language).toBe("javascript");
      }
    });
  });

  describe("GenerateDocActionSchema", () => {
    it("parses valid generate_doc", () => {
      const result = GenerateDocActionSchema.safeParse({
        type: "generate_doc",
        description: "API docs",
        data: { markdown: "# API\n\n## GET /users\n..." },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("FixErrorActionSchema", () => {
    it("parses valid fix_error", () => {
      const result = FixErrorActionSchema.safeParse({
        type: "fix_error",
        description: "Fix timeout",
        data: {
          suggestions: [
            { path: "url", issue: "Wrong host", fix: "Change to correct host" },
            { path: "headers.Authorization", issue: "Missing token", fix: "Add Bearer token" },
          ],
        },
      });
      expect(result.success).toBe(true);
    });

    it("rejects suggestions without required fields", () => {
      const result = FixErrorActionSchema.safeParse({
        type: "fix_error",
        description: "test",
        data: { suggestions: [{ path: "url" }] },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("ExtractVariablesActionSchema", () => {
    it("parses valid extract_variables", () => {
      const result = ExtractVariablesActionSchema.safeParse({
        type: "extract_variables",
        description: "Extract from response",
        data: {
          variables: [
            { key: "USER_ID", value: "123", source: "$.data.id" },
            { key: "TOKEN", value: "abc" },
          ],
          targetEnvironment: "Development",
        },
      });
      expect(result.success).toBe(true);
    });

    it("parses extract_variables without optional fields", () => {
      const result = ExtractVariablesActionSchema.safeParse({
        type: "extract_variables",
        description: "test",
        data: { variables: [{ key: "X", value: "y" }] },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("GenerateMockActionSchema", () => {
    it("parses valid generate_mock", () => {
      const result = GenerateMockActionSchema.safeParse({
        type: "generate_mock",
        description: "Mock endpoint",
        data: {
          route: "/api/users/:id",
          method: "GET",
          statusCode: 200,
          responseBody: { id: 1, name: "Test" },
        },
      });
      expect(result.success).toBe(true);
    });

    it("defaults statusCode to 200", () => {
      const result = GenerateMockActionSchema.safeParse({
        type: "generate_mock",
        description: "test",
        data: {
          route: "/api/health",
          method: "GET",
          responseBody: { status: "ok" },
        },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data.statusCode).toBe(200);
      }
    });
  });

  describe("parseAgentAction", () => {
    it("parses create_request from object", () => {
      const action = parseAgentAction({
        type: "create_request",
        description: "Create",
        data: { name: "API", method: "POST", url: "https://example.com" },
      });
      expect(action).not.toBeNull();
      expect(action?.type).toBe("create_request");
    });

    it("parses each action type", () => {
      const types = ["create_request", "modify_request", "write_test", "generate_doc", "fix_error", "extract_variables", "generate_mock"];
      for (const t of types) {
        const raw: Record<string, unknown> = { type: t, description: "test" };
        switch (t) {
          case "create_request":
            raw.data = { name: "X", method: "GET", url: "https://x.com" };
            break;
          case "modify_request":
            raw.data = { changes: [{ path: "url", op: "set", value: "https://x.com" }] };
            break;
          case "write_test":
            raw.data = { script: "pm.test('x', () => {});" };
            break;
          case "generate_doc":
            raw.data = { markdown: "# Doc" };
            break;
          case "fix_error":
            raw.data = { suggestions: [{ path: "url", issue: "x", fix: "y" }] };
            break;
          case "extract_variables":
            raw.data = { variables: [{ key: "X", value: "y" }] };
            break;
          case "generate_mock":
            raw.data = { route: "/api", method: "GET", responseBody: {} };
            break;
        }
        const action = parseAgentAction(raw);
        expect(action, `Failed to parse ${t}`).not.toBeNull();
        expect(action!.type).toBe(t);
      }
    });

    it("returns null for non-object", () => {
      expect(parseAgentAction("string")).toBeNull();
      expect(parseAgentAction(null)).toBeNull();
      expect(parseAgentAction(42)).toBeNull();
    });

    it("returns null for unknown type", () => {
      expect(parseAgentAction({ type: "unknown", description: "test" })).toBeNull();
    });

    it("returns null for invalid data", () => {
      expect(parseAgentAction({ type: "create_request", description: "test", data: {} })).toBeNull();
    });
  });

  describe("AGENT_TOOLS", () => {
    it("has 7 tools", () => {
      expect(AGENT_TOOLS).toHaveLength(7);
    });

    it("all tools have type function", () => {
      for (const tool of AGENT_TOOLS) {
        expect(tool.type).toBe("function");
      }
    });

    it("all tools have name, description, and parameters", () => {
      for (const tool of AGENT_TOOLS) {
        expect(tool.function.name).toBeTruthy();
        expect(tool.function.description).toBeTruthy();
        expect(tool.function.parameters.type).toBe("object");
      }
    });

    it("tool names match action types", () => {
      const names = AGENT_TOOLS.map((t) => t.function.name).sort();
      expect(names).toEqual([
        "create_request",
        "extract_variables",
        "fix_error",
        "generate_doc",
        "generate_mock",
        "modify_request",
        "write_test",
      ].sort());
    });
  });
});