import { parseAgentAction } from "./action-types";
import type { AgentAction } from "./action-types";
import { aiChatWithTools } from "./index";
import { AGENT_TOOLS } from "./action-types";
import type { AiChatWithToolsResponse } from "./action-types";

export interface DispatchResult {
  success: boolean;
  message: string;
}

export async function chatAndParseActions(
  providerId: string,
  messages: { role: string; content: string }[],
): Promise<{ actions: AgentAction[]; response: AiChatWithToolsResponse }> {
  const response = await aiChatWithTools({
    providerId,
    messages,
    tools: AGENT_TOOLS,
  });

  const actions: AgentAction[] = [];
  for (const tc of response.toolCalls) {
    try {
      const args = JSON.parse(tc.function.arguments);
      const action = parseAgentAction({ type: tc.function.name, data: args, description: tc.function.name });
      if (action) actions.push(action);
    } catch {
      // skip unparseable tool calls
    }
  }

  return { actions, response };
}

export function extractActionsFromText(text: string): AgentAction[] {
  if (!text) return [];

  const actions: AgentAction[] = [];
  const jsonBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = jsonBlockRegex.exec(text)) !== null) {
    const raw = match[1]!.trim();
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const action = parseAgentAction(item);
          if (action) actions.push(action);
        }
      } else if (typeof parsed === "object" && parsed !== null) {
        const action = parseAgentAction(parsed);
        if (action) actions.push(action);
      }
    } catch {
      // skip unparseable JSON blocks
    }
  }

  return actions;
}