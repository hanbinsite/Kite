import { aiChat, extractActionsFromText, SLASH_COMMANDS } from "@api-client/core/ai";
import type { AgentAction, WriteTestAction } from "@api-client/core/ai";
import { useChatStore } from "@api-client/core/ai";
import { useCollectionStore } from "@/stores/collection-store";
import { useTabStore } from "@api-client/core";
import { toast } from "@api-client/ui";
import type { CollectionTreeNode } from "@/stores/collection-store";

interface RunTestAllArgs {
  sessionId: string;
  providerId: string;
  buildContextMsgs: () => { role: "user" | "assistant" | "system"; content: string }[];
}

interface RequestRef {
  id: string;
  name: string;
  method: string;
  url: string;
  hasPostResponseScript: boolean;
}

function collectRequests(items: CollectionTreeNode[], acc: RequestRef[]): RequestRef[] {
  for (const item of items) {
    if (item.type === "request") {
      acc.push({
        id: item.id,
        name: item.name,
        method: item.method,
        url: item.url,
        hasPostResponseScript: !!item.scripts?.postResponse?.trim(),
      });
    } else if (item.type === "folder") {
      collectRequests(item.items, acc);
    }
  }
  return acc;
}

function updateRequestScriptsInTree(
  items: CollectionTreeNode[],
  requestId: string,
  postResponse: string,
): boolean {
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (item.type === "request" && item.id === requestId) {
      const updated: CollectionTreeNode = {
        ...item,
        scripts: { ...(item.scripts ?? { preRequest: undefined, postResponse: undefined }), postResponse },
      };
      items[i] = updated;
      return true;
    }
    if (item.type === "folder") {
      if (updateRequestScriptsInTree(item.items, requestId, postResponse)) return true;
    }
  }
  return false;
}

function pickWriteTestAction(actions: AgentAction[]): WriteTestAction | null {
  for (const a of actions) {
    if (a.type === "write_test") return a as WriteTestAction;
  }
  return null;
}

export async function runTestAllBatch({ sessionId, providerId, buildContextMsgs }: RunTestAllArgs): Promise<void> {
  const chatStore = useChatStore.getState();
  const colStore = useCollectionStore.getState();
  const tabStore = useTabStore.getState();

  const activeTabId = tabStore.activeTabId;
  const activeTab = tabStore.tabs.find((t) => t.id === activeTabId);
  let collectionId: string | undefined;
  if (activeTab?.requestId) {
    const hierarchy = colStore.resolveRequestHierarchy(activeTab.requestId);
    collectionId = hierarchy?.collectionId;
  }
  if (!collectionId) {
    collectionId = colStore.collections[0]?.id;
  }

  if (!collectionId) {
    chatStore.addMessage(sessionId, { role: "assistant", content: "No collection found to generate tests for." });
    return;
  }

  const collection = colStore.collections.find((c) => c.id === collectionId);
  if (!collection) {
    chatStore.addMessage(sessionId, { role: "assistant", content: "Collection not found." });
    return;
  }

  const allRequests = collectRequests(collection.items, []);
  const targets = allRequests.filter((r) => !r.hasPostResponseScript);

  if (targets.length === 0) {
    chatStore.addMessage(sessionId, {
      role: "assistant",
      content: `All ${allRequests.length} request(s) in "${collection.name}" already have post-response test scripts. Nothing to generate.`,
    });
    return;
  }

  const slashCmd = SLASH_COMMANDS.find((c) => c.key === "test-all");
  const basePrompt = slashCmd?.prompt ?? "Generate JavaScript test scripts using pm.test() and pm.expect().";
  const contextMsgs = buildContextMsgs();

  chatStore.addMessage(sessionId, {
    role: "user",
    content: `/test-all — generating tests for ${targets.length} request(s) in "${collection.name}"`,
  });
  chatStore.addMessage(sessionId, {
    role: "assistant",
    content: `Generating tests... 0/${targets.length} done`,
  });

  let done = 0;
  let succeeded = 0;
  const failed: string[] = [];
  const summary: string[] = [];

  for (const req of targets) {
    try {
      const userMsg = {
        role: "user" as const,
        content: `Generate a post-response test script for this request.\nName: ${req.name}\nMethod: ${req.method}\nURL: ${req.url}\n\nReturn ONLY a \`\`\`json code block with:\n{"type":"write_test","description":"Test script","data":{"script":"...","language":"javascript"}}`,
      };
      const systemMsg = { role: "system" as const, content: basePrompt };
      const allMessages = [...contextMsgs, systemMsg, userMsg].map((m) => ({ role: m.role, content: m.content }));

      const response = await aiChat({ providerId, messages: allMessages });
      const actions = extractActionsFromText(response.content);
      const writeTest = pickWriteTestAction(actions);

      if (!writeTest || !writeTest.data.script?.trim()) {
        failed.push(`${req.method} ${req.url}`);
        summary.push(`✗ ${req.name} (${req.method} ${req.url}) — no script returned`);
      } else {
        useCollectionStore.setState((state) => {
          const col = state.collections.find((c) => c.id === collectionId);
          if (col) {
            updateRequestScriptsInTree(col.items, req.id, writeTest.data.script);
          }
        });
        useCollectionStore.getState().persistCollection(collectionId);
        succeeded += 1;
        summary.push(`✓ ${req.name} (${req.method} ${req.url})`);
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      failed.push(`${req.method} ${req.url}`);
      summary.push(`✗ ${req.name} (${req.method} ${req.url}) — ${detail}`);
    }

    done += 1;
    chatStore.updateLastAssistantMessage(sessionId, `Generating tests... ${done}/${targets.length} done`);
  }

  const resultText = `Batch test generation complete: ${succeeded}/${targets.length} succeeded.\n\n${summary.join("\n")}`;
  chatStore.updateLastAssistantMessage(sessionId, resultText);

  try {
    toast({
      variant: succeeded === targets.length ? "success" : "warning",
      title: "Batch Test Generation Complete",
      description: `Generated ${succeeded}/${targets.length} test scripts for "${collection.name}".${failed.length > 0 ? ` ${failed.length} failed.` : ""}`,
      duration: 6000,
    });
  } catch (e) {
    console.error("toast error", e);
  }

  void chatStore.saveSession(sessionId);
}
