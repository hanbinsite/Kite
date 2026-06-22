import type { AiMessage } from "./index";
import type { McpToolInfo } from "./mcp-external";

export interface AiContextData {
  request?: { method: string; url: string };
  environments?: { name: string; variables: { key: string; value: string }[] }[];
  collections?: string[];
}

export function buildContextMessage(data: AiContextData): AiMessage {
  const parts: string[] = [
    "[Context] You are an AI assistant for API development.",
    "You can perform actions by returning a JSON block with a 'type' field. Available actions: create_request, modify_request, write_test, generate_doc, fix_error, extract_variables, generate_mock.",
    "When the user asks you to create a request, write a test, or extract variables, wrap your action in a ```json code block.",
  ];

  if (data.request) {
    parts.push(`Active request: ${data.request.method} ${data.request.url}`);
  }

  if (data.environments?.length) {
    const envList = data.environments.map((e) => {
      const vars = e.variables.map((v) => `${v.key}=${v.value}`).join(", ");
      return `  ${e.name}: ${vars || "none"}`;
    });
    parts.push(`Environments:\n${envList.join("\n")}`);
  }

  if (data.collections?.length) {
    parts.push(`Collections: ${data.collections.join(", ")}`);
  }

  return { role: "system", content: parts.join("\n") };
}

export function buildMcpContext(externalTools: McpToolInfo[]): string {
  if (externalTools.length === 0) return "";

  const lines: string[] = ["[Available MCP Tools] You may use the following external MCP tools. To run one, return a ```json code block with: {\"type\":\"run_mcp_tool\",\"description\":\"Run tool\",\"data\":{\"serverId\":\"...\",\"toolName\":\"...\",\"arguments\":{...}}}"];
  const grouped = new Map<string, McpToolInfo[]>();
  for (const tool of externalTools) {
    const list = grouped.get(tool.serverName);
    if (list) {
      list.push(tool);
    } else {
      grouped.set(tool.serverName, [tool]);
    }
  }
  for (const [serverName, tools] of grouped) {
    lines.push(`Server: ${serverName}`);
    for (const tool of tools) {
      lines.push(`  - ${tool.name}: ${tool.description || "(no description)"}`);
    }
  }
  return lines.join("\n");
}
