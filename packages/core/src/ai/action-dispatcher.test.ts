import { describe, it, expect, vi } from "vitest";
import { chatAndParseActions } from "./action-dispatcher";
import type { AiChatWithToolsResponse } from "./action-types";

vi.mock("./index", () => ({
  aiChatWithTools: vi.fn(),
}));

import { aiChatWithTools } from "./index";

const mockAiChat = aiChatWithTools as ReturnType<typeof vi.fn>;

function makeResponse(toolCalls: AiChatWithToolsResponse["toolCalls"]): AiChatWithToolsResponse {
  return {
    id: "resp-1",
    content: "Done",
    model: "gpt-4",
    toolCalls,
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
  };
}

describe("action-dispatcher", () => {
  it("parses valid create_request tool call", async () => {
    mockAiChat.mockResolvedValue(makeResponse([
      {
        id: "call-1",
        type: "function",
        function: {
          name: "create_request",
          arguments: JSON.stringify({ name: "Test", method: "GET", url: "https://test.com" }),
        },
      },
    ]));

    const { actions } = await chatAndParseActions("prov-1", [{ role: "user", content: "create" }]);

    expect(actions).toHaveLength(1);
    expect(actions[0]!.type).toBe("create_request");
  });

  it("skips unparseable JSON in tool call arguments", async () => {
    mockAiChat.mockResolvedValue(makeResponse([
      {
        id: "call-1",
        type: "function",
        function: { name: "create_request", arguments: "invalid json" },
      },
    ]));

    const { actions } = await chatAndParseActions("prov-1", []);

    expect(actions).toHaveLength(0);
  });

  it("skips tool calls with unknown type", async () => {
    mockAiChat.mockResolvedValue(makeResponse([
      {
        id: "call-1",
        type: "function",
        function: { name: "unknown_action", arguments: "{}" },
      },
    ]));

    const { actions } = await chatAndParseActions("prov-1", []);

    expect(actions).toHaveLength(0);
  });

  it("parses multiple tool calls", async () => {
    mockAiChat.mockResolvedValue(makeResponse([
      {
        id: "call-1",
        type: "function",
        function: {
          name: "create_request",
          arguments: JSON.stringify({ name: "A", method: "GET", url: "https://a.com" }),
        },
      },
      {
        id: "call-2",
        type: "function",
        function: {
          name: "write_test",
          arguments: JSON.stringify({ script: "pm.test('ok', () => {});" }),
        },
      },
    ]));

    const { actions } = await chatAndParseActions("prov-1", []);

    expect(actions).toHaveLength(2);
    expect(actions[0]!.type).toBe("create_request");
    expect(actions[1]!.type).toBe("write_test");
  });

  it("passes messages and tools to aiChatWithTools", async () => {
    mockAiChat.mockResolvedValue(makeResponse([]));

    const messages = [{ role: "user", content: "help" }];
    await chatAndParseActions("prov-2", messages);

    expect(mockAiChat).toHaveBeenCalledWith({
      providerId: "prov-2",
      messages,
      tools: expect.any(Array),
    });
  });

  it("returns empty actions for empty toolCalls", async () => {
    mockAiChat.mockResolvedValue(makeResponse([]));

    const { actions } = await chatAndParseActions("prov-1", []);

    expect(actions).toHaveLength(0);
  });

  it("returns response data alongside actions", async () => {
    mockAiChat.mockResolvedValue(makeResponse([]));

    const { response } = await chatAndParseActions("prov-1", []);

    expect(response.id).toBe("resp-1");
    expect(response.model).toBe("gpt-4");
  });

  it("skips tool calls with valid JSON but invalid schema", async () => {
    mockAiChat.mockResolvedValue(makeResponse([
      {
        id: "call-1",
        type: "function",
        function: {
          name: "create_request",
          arguments: JSON.stringify({ name: 123, method: "INVALID", url: "" }),
        },
      },
    ]));

    const { actions } = await chatAndParseActions("prov-1", []);

    expect(actions).toHaveLength(0);
  });

  it("handles generate_doc tool call", async () => {
    mockAiChat.mockResolvedValue(makeResponse([
      {
        id: "call-1",
        type: "function",
        function: {
          name: "generate_doc",
          arguments: JSON.stringify({ markdown: "# API Docs\nContent here" }),
        },
      },
    ]));

    const { actions } = await chatAndParseActions("prov-1", []);

    expect(actions).toHaveLength(1);
    expect(actions[0]!.type).toBe("generate_doc");
  });

  it("handles fix_error tool call", async () => {
    mockAiChat.mockResolvedValue(makeResponse([
      {
        id: "call-1",
        type: "function",
        function: {
          name: "fix_error",
          arguments: JSON.stringify({
            suggestions: [{ path: "url", issue: "wrong", fix: "correct" }],
          }),
        },
      },
    ]));

    const { actions } = await chatAndParseActions("prov-1", []);

    expect(actions).toHaveLength(1);
    expect(actions[0]!.type).toBe("fix_error");
  });
});