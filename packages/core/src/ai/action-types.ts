import { z } from "zod";

export const CreateRequestActionSchema = z.object({
  type: z.literal("create_request"),
  description: z.string(),
  data: z.object({
    name: z.string(),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]),
    url: z.string(),
    headers: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
    body: z.object({
      mode: z.enum(["json", "text", "urlencoded", "formdata", "graphql", "binary", "none"]),
      content: z.string().optional(),
    }).optional(),
    auth: z.object({
      type: z.enum(["none", "bearer", "basic", "apikey", "jwt", "oauth1", "oauth2", "awsv4"]),
      config: z.record(z.unknown()).optional(),
    }).optional(),
  }),
});

export const ModifyRequestActionSchema = z.object({
  type: z.literal("modify_request"),
  description: z.string(),
  data: z.object({
    changes: z.array(z.object({
      path: z.string(),
      op: z.enum(["set", "add", "remove"]),
      value: z.unknown().optional(),
    })),
  }),
});

export const WriteTestActionSchema = z.object({
  type: z.literal("write_test"),
  description: z.string(),
  data: z.object({
    script: z.string(),
    language: z.literal("javascript").default("javascript"),
  }),
});

export const GenerateDocActionSchema = z.object({
  type: z.literal("generate_doc"),
  description: z.string(),
  data: z.object({
    markdown: z.string(),
  }),
});

export const FixErrorActionSchema = z.object({
  type: z.literal("fix_error"),
  description: z.string(),
  data: z.object({
    suggestions: z.array(z.object({
      path: z.string(),
      issue: z.string(),
      fix: z.string(),
    })),
  }),
});

export const ExtractVariablesActionSchema = z.object({
  type: z.literal("extract_variables"),
  description: z.string(),
  data: z.object({
    variables: z.array(z.object({
      key: z.string(),
      value: z.string(),
      source: z.string().optional(),
    })),
    targetEnvironment: z.string().optional(),
  }),
});

export const GenerateMockActionSchema = z.object({
  type: z.literal("generate_mock"),
  description: z.string(),
  data: z.object({
    route: z.string(),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    statusCode: z.number().default(200),
    responseBody: z.unknown(),
    headers: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
  }),
});

export type CreateRequestAction = z.infer<typeof CreateRequestActionSchema>;
export type ModifyRequestAction = z.infer<typeof ModifyRequestActionSchema>;
export type WriteTestAction = z.infer<typeof WriteTestActionSchema>;
export type GenerateDocAction = z.infer<typeof GenerateDocActionSchema>;
export type FixErrorAction = z.infer<typeof FixErrorActionSchema>;
export type ExtractVariablesAction = z.infer<typeof ExtractVariablesActionSchema>;
export type GenerateMockAction = z.infer<typeof GenerateMockActionSchema>;

export type AgentAction =
  | CreateRequestAction
  | ModifyRequestAction
  | WriteTestAction
  | GenerateDocAction
  | FixErrorAction
  | ExtractVariablesAction
  | GenerateMockAction;

export const AgentActionSchemas: Record<string, z.ZodType> = {
  create_request: CreateRequestActionSchema,
  modify_request: ModifyRequestActionSchema,
  write_test: WriteTestActionSchema,
  generate_doc: GenerateDocActionSchema,
  fix_error: FixErrorActionSchema,
  extract_variables: ExtractVariablesActionSchema,
  generate_mock: GenerateMockActionSchema,
};

export function parseAgentAction(raw: unknown): AgentAction | null {
  if (typeof raw !== "object" || raw === null) return null;
  const type = (raw as Record<string, unknown>).type;
  if (typeof type !== "string") return null;

  const schema = AgentActionSchemas[type];
  if (!schema) return null;

  const result = schema.safeParse(raw);
  if (result.success) return result.data as AgentAction;
  return null;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "create_request",
      description: "Create a new HTTP API request",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Request name" },
          method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] },
          url: { type: "string", description: "Full URL including protocol" },
          headers: { type: "array", items: { type: "object", properties: { key: { type: "string" }, value: { type: "string" } }, required: ["key", "value"] } },
          body: {
            type: "object",
            properties: {
              mode: { type: "string", enum: ["json", "text", "urlencoded", "formdata", "graphql", "binary", "none"] },
              content: { type: "string" },
            },
          },
          auth: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["none", "bearer", "basic", "apikey", "jwt", "oauth1", "oauth2", "awsv4"] },
              config: { type: "object" },
            },
          },
        },
        required: ["name", "method", "url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "modify_request",
      description: "Modify parameters of the current request",
      parameters: {
        type: "object",
        properties: {
          changes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                path: { type: "string", description: "Dot-path to the field, e.g. 'url', 'headers.0.value', 'body.content'" },
                op: { type: "string", enum: ["set", "add", "remove"] },
                value: { description: "New value for set/add operations" },
              },
              required: ["path", "op"],
            },
          },
        },
        required: ["changes"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_test",
      description: "Write JavaScript test scripts using pm.test() and pm.expect()",
      parameters: {
        type: "object",
        properties: {
          script: { type: "string", description: "JavaScript code using pm.test() API" },
        },
        required: ["script"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_doc",
      description: "Generate API documentation in Markdown format",
      parameters: {
        type: "object",
        properties: {
          markdown: { type: "string", description: "Markdown documentation content" },
        },
        required: ["markdown"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fix_error",
      description: "Suggest fixes for request errors based on response analysis",
      parameters: {
        type: "object",
        properties: {
          suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                path: { type: "string" },
                issue: { type: "string" },
                fix: { type: "string" },
              },
              required: ["path", "issue", "fix"],
            },
          },
        },
        required: ["suggestions"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "extract_variables",
      description: "Extract reusable variables from the current response",
      parameters: {
        type: "object",
        properties: {
          variables: {
            type: "array",
            items: {
              type: "object",
              properties: {
                key: { type: "string", description: "Variable name" },
                value: { type: "string", description: "Extracted value" },
                source: { type: "string", description: "JSONPath or description of where the value came from" },
              },
              required: ["key", "value"],
            },
          },
          targetEnvironment: { type: "string", description: "Target environment name" },
        },
        required: ["variables"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_mock",
      description: "Generate mock server route configuration with realistic data",
      parameters: {
        type: "object",
        properties: {
          route: { type: "string", description: "Route path, e.g. /api/users/:id" },
          method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
          statusCode: { type: "number", description: "HTTP status code" },
          responseBody: { description: "Mock response body (JSON object)" },
          headers: { type: "array", items: { type: "object", properties: { key: { type: "string" }, value: { type: "string" } }, required: ["key", "value"] } },
        },
        required: ["route", "method", "responseBody"],
      },
    },
  },
];

export interface AiChatWithToolsRequest {
  providerId: string;
  messages: { role: string; content: string }[];
  tools: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  sessionId?: string;
}

export interface AiToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface AiChatWithToolsResponse {
  id: string;
  content: string | null;
  model: string;
  toolCalls: AiToolCall[];
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}