import type { Variable } from "./types";
import type { Environment } from "@api-client/types";

export interface VariableScope {
    local?: Record<string, string>;
    data?: Record<string, string>;
    request?: Record<string, string>;
    folder?: Record<string, string>;
    collection?: Record<string, string>;
    environment?: Record<string, string>;
    global?: Record<string, string>;
}

export interface ResolvedHierarchyFolder {
    id: string;
    name: string;
    config?: {
        headers?: { key: string; value: string; disabled: boolean }[];
        auth?: unknown;
        variables?: { key: string; value: string; enabled: boolean }[];
        scripts?: { preRequest?: string; postResponse?: string };
    };
}

export interface ResolvedHierarchy {
    collectionId: string;
    collectionName: string;
    collectionConfig: {
        headers?: { key: string; value: string; disabled: boolean }[];
        auth?: unknown;
        variables?: { key: string; value: string; enabled: boolean }[];
        scripts?: { preRequest?: string; postResponse?: string };
    } | undefined;
    folderPath: ResolvedHierarchyFolder[];
    requestNode: {
        type: "request";
        id: string;
        name: string;
        method: string;
        url: string;
        headers?: { key: string; value: string; disabled: boolean }[];
        auth?: unknown;
        body?: unknown;
        scripts?: { preRequest?: string; postResponse?: string };
    };
}

const VAR_REGEX = /\{\{([^}]+)\}\}/g;

const DYNAMIC_VARIABLES: Record<string, () => string> = {
    $guid: () => crypto.randomUUID(),
    $timestamp: () => Math.floor(Date.now() / 1000).toString(),
    $isoTimestamp: () => new Date().toISOString(),
    $randomInt: () => Math.floor(Math.random() * 1001).toString(),
    $randomUuid: () => crypto.randomUUID(),
    $randomEmail: () => {
        const names = ["alice", "bob", "carol", "dave", "eve"];
        const domains = ["example.com", "test.org", "mail.io"];
        return `${names[Math.floor(Math.random() * names.length)]}${Math.floor(Math.random() * 1000)}@${domains[Math.floor(Math.random() * domains.length)]}`;
    },
    $randomAlphaNumeric: () => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let result = "";
        for (let i = 0; i < 8; i++) {
            result += chars[Math.floor(Math.random() * chars.length)];
        }
        return result;
    },
    $randomFullName: () => {
        const first = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer"];
        const last = ["Smith", "Johnson", "Williams", "Brown", "Jones"];
        return `${first[Math.floor(Math.random() * first.length)]} ${last[Math.floor(Math.random() * last.length)]}`;
    },
};

export class VariableResolver {
    private scopes: VariableScope;
    private dynamicGenerators: Record<string, () => string>;

    constructor(scopes: VariableScope, dynamic?: Record<string, () => string>) {
        this.scopes = scopes;
        this.dynamicGenerators = dynamic ?? DYNAMIC_VARIABLES;
    }

    get(name: string): string | undefined {
        const priority: (keyof VariableScope)[] = ["local", "data", "request", "environment", "folder", "collection", "global"];

        for (const scope of priority) {
            const scopeVars = this.scopes[scope];
            if (scopeVars && name in scopeVars) {
                return scopeVars[name] as string;
            }
        }

        if (name.startsWith("$")) {
            const generator = this.dynamicGenerators[name];
            if (generator) {
                return generator();
            }
        }

        return undefined;
    }

    resolve(text: string): string {
        let result = text;
        let previous = "";
        let iterations = 0;
        const maxIterations = 5;

        while (result !== previous && iterations < maxIterations) {
            previous = result;
            result = result.replace(VAR_REGEX, (match, varName: string) => {
                const resolved = this.get(varName.trim());
                return resolved !== undefined ? resolved : match;
            });
            iterations++;
        }

        return result;
    }

    resolveMap(map: Record<string, string>): Record<string, string> {
        const result: Record<string, string> = {};
        for (const [key, value] of Object.entries(map)) {
            result[key] = this.resolve(value);
        }
        return result;
    }
}

export function resolveVariables(text: string, scopes: VariableScope): string {
    return new VariableResolver(scopes).resolve(text);
}

export function variablesToRecord(variables: Variable[]): Record<string, string> {
    const record: Record<string, string> = {};
    for (const v of variables) {
        if (v.enabled && v.key) {
            record[v.key] = v.value;
        }
    }
    return record;
}

const MAX_INHERITANCE_DEPTH = 10;

export function resolveEnvironmentVariables(
    envId: string,
    allEnvs: Environment[],
    visited: Set<string> = new Set(),
    depth: number = 0,
): Record<string, string> {
    if (depth > MAX_INHERITANCE_DEPTH) return {};
    if (visited.has(envId)) return {};

    const env = allEnvs.find((e) => e.id === envId);
    if (!env) return {};

    visited.add(envId);

    let parentVars: Record<string, string> = {};
    if (env.parent_id && env.parent_id !== envId) {
        parentVars = resolveEnvironmentVariables(env.parent_id, allEnvs, visited, depth + 1);
    }

    const ownVars = variablesToRecord(env.variables);

    return { ...parentVars, ...ownVars };
}
