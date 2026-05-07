export type { Collection, CollectionItem } from "./types";
export type { Environment, Variable } from "@api-client/types";

export {
    getCollectionVariables,
    getFolderVariables,
    mergeVariables,
    mergeHeaders,
    resolveAuth,
    collectPreRequestChain,
    collectPostResponseChain,
    variablesToRecord as collectionVariablesToRecord,
} from "./hierarchy-merge";
export type { ScriptChainEntry } from "./hierarchy-merge";
