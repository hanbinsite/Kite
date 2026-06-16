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