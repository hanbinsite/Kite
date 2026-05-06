import type { ResolvedHierarchy } from "../environment";
import type { AuthConfig, Header, Variable } from "@api-client/types";

export function mergeVariables(hierarchy: ResolvedHierarchy): Record<string, string> {
    const result: Record<string, string> = {};

    if (hierarchy.collectionConfig?.variables) {
        for (const v of hierarchy.collectionConfig.variables) {
            if (v.enabled && v.key) result[v.key] = v.value;
        }
    }

    for (const folder of hierarchy.folderPath) {
        if (folder.config?.variables) {
            for (const v of folder.config.variables) {
                if (v.enabled && v.key) result[v.key] = v.value;
            }
        }
    }

    return result;
}

export function mergeHeaders(hierarchy: ResolvedHierarchy, requestHeaders: Header[]): Header[] {
    const merged: Header[] = [];
    const seen = new Map<string, number>();

    const addHeaders = (headers: Header[] | undefined) => {
        if (!headers) return;
        for (const h of headers) {
            if (!h.key) continue;
            const lowerKey = h.key.toLowerCase();
            const idx = seen.get(lowerKey);
            if (idx !== undefined) {
                merged[idx] = { ...h };
            } else {
                seen.set(lowerKey, merged.length);
                merged.push({ ...h });
            }
        }
    };

    addHeaders(hierarchy.collectionConfig?.headers as Header[] | undefined);
    for (const folder of hierarchy.folderPath) {
        addHeaders(folder.config?.headers as Header[] | undefined);
    }
    addHeaders(requestHeaders);

    return merged;
}

export function resolveAuth(hierarchy: ResolvedHierarchy, requestAuth: AuthConfig): AuthConfig {
    if (requestAuth.type !== "none") return requestAuth;

    for (let i = hierarchy.folderPath.length - 1; i >= 0; i--) {
        const folderAuth = hierarchy.folderPath[i]?.config?.auth as AuthConfig | undefined;
        if (folderAuth && folderAuth.type !== "none") return folderAuth;
    }

    const colAuth = hierarchy.collectionConfig?.auth as AuthConfig | undefined;
    if (colAuth && colAuth.type !== "none") return colAuth;

    return requestAuth;
}

export interface ScriptChainEntry {
    source: "Collection" | `Folder: ${string}` | "Request";
    code: string;
}

export function collectPreRequestChain(hierarchy: ResolvedHierarchy, requestScripts: { preRequest?: string }): ScriptChainEntry[] {
    const chain: ScriptChainEntry[] = [];

    const colPre = hierarchy.collectionConfig?.scripts?.preRequest;
    if (colPre?.trim()) {
        chain.push({ source: "Collection", code: colPre });
    }

    for (const folder of hierarchy.folderPath) {
        const folderPre = folder.config?.scripts?.preRequest;
        if (folderPre?.trim()) {
            chain.push({ source: `Folder: ${folder.name}`, code: folderPre });
        }
    }

    if (requestScripts.preRequest?.trim()) {
        chain.push({ source: "Request", code: requestScripts.preRequest });
    }

    return chain;
}

export function collectPostResponseChain(hierarchy: ResolvedHierarchy, requestScripts: { postResponse?: string }): ScriptChainEntry[] {
    const chain: ScriptChainEntry[] = [];

    if (requestScripts.postResponse?.trim()) {
        chain.push({ source: "Request", code: requestScripts.postResponse });
    }

    for (let i = hierarchy.folderPath.length - 1; i >= 0; i--) {
        const folder = hierarchy.folderPath[i];
        const folderPost = folder?.config?.scripts?.postResponse;
        if (folderPost?.trim()) {
            chain.push({ source: `Folder: ${folder.name}`, code: folderPost });
        }
    }

    const colPost = hierarchy.collectionConfig?.scripts?.postResponse;
    if (colPost?.trim()) {
        chain.push({ source: "Collection", code: colPost });
    }

    return chain;
}

export function variablesToRecord(variables: Variable[] | undefined): Record<string, string> {
    const record: Record<string, string> = {};
    if (!variables) return record;
    for (const v of variables) {
        if (v.enabled && v.key) {
            record[v.key] = v.value;
        }
    }
    return record;
}
