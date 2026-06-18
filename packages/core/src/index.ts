export type {
  HttpRequestConfig,
  HttpResponse,
  Header,
  QueryParam,
  BodyConfig,
  RequestSettings,
  ResponseHeader,
} from "@api-client/types";

export type { Collection, CollectionItem } from "@api-client/types";
export type { Environment, Variable } from "@api-client/types";

export { VariableResolver, resolveVariables, variablesToRecord } from "./environment";
export type { VariableScope, ResolvedHierarchy, ResolvedHierarchyFolder } from "./environment";

export { useUIStore, useTabStore } from "./navigation";
export type { Tab, TabStore, UIStore, Theme } from "./navigation";

export {
  markStart,
  markEnd,
  measureAsync,
  measureSync,
  getMark,
  getAllMarks,
} from "./performance";
export type { PerformanceMark } from "./performance";

export { handleError, parseAppError, isRetryableError, isNetworkError, categorizeError, getErrorMapping } from "./error";
export type { HandledError, ErrorMapping, ErrorCategory } from "./error";

export { detectFormat, importCollection, parseCurl, parsePostman, parseHar } from "./importer";
export type { ImportResult, ImportRequest, ImportFormat } from "./importer";

export { exportCollection, toPostmanCollection, toCurlCommands, toHar } from "./exporter";
export type { ExportFormat, ExportOptions, ExportRequest, ExportCollection } from "./exporter";

export {
  startOAuth2Flow,
  exchangeOAuth2Token,
} from "./http";
export type {
  OAuth2FlowConfig,
  OAuth2StartResult,
  OAuth2TokenResult,
  OAuth2CallbackPayload,
} from "./http";

export type {
  AiProviderConfig,
  AiChatRequest,
  AiChatResponse,
  AiMessage,
  AiStreamChunk,
  AiApiKeyStatus,
} from "./ai";

export {
  getCollectionVariables,
  getFolderVariables,
  mergeVariables,
  mergeHeaders,
  resolveAuth,
  collectPreRequestChain,
  collectPostResponseChain,
  collectionVariablesToRecord,
} from "./collection";
export type { ScriptChainEntry } from "./collection";
