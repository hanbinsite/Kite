import type { AiMessage } from "./index";

export interface AiContextData {
  request?: { method: string; url: string };
  environments?: { name: string; variables: { key: string; value: string }[] }[];
  collections?: string[];
}

export function buildContextMessage(data: AiContextData): AiMessage {
  const parts: string[] = ["[Context] You are an AI assistant for API development."];

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
