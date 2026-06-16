import { describe, it, expect } from "vitest";
import {
  getCollectionVariables,
  getFolderVariables,
  mergeVariables,
  mergeHeaders,
  resolveAuth,
  collectPreRequestChain,
  collectPostResponseChain,
} from "./hierarchy-merge";
import type { ResolvedHierarchy } from "../environment";
import type { AuthConfig, Header } from "@api-client/types";

function createHierarchy(overrides: Partial<ResolvedHierarchy> = {}): ResolvedHierarchy {
  return {
    collectionId: "col-1",
    collectionName: "Test Collection",
    collectionConfig: undefined,
    folderPath: [],
    requestNode: {
      type: "request",
      id: "req-1",
      name: "Test Request",
      method: "GET",
      url: "https://example.com",
    },
    ...overrides,
  };
}

describe("getCollectionVariables", () => {
  it("returns empty for no config", () => {
    const h = createHierarchy();
    expect(getCollectionVariables(h)).toEqual({});
  });

  it("returns enabled variables", () => {
    const h = createHierarchy({
      collectionConfig: {
        variables: [
          { key: "API_URL", value: "https://api.example.com", enabled: true },
          { key: "SECRET", value: "hidden", enabled: false },
        ],
      },
    });
    const vars = getCollectionVariables(h);
    expect(vars).toEqual({ API_URL: "https://api.example.com" });
  });
});

describe("getFolderVariables", () => {
  it("returns empty for no folders", () => {
    const h = createHierarchy();
    expect(getFolderVariables(h)).toEqual({});
  });

  it("returns variables from folder path", () => {
    const h = createHierarchy({
      folderPath: [
        {
          id: "f1",
          name: "Auth",
          config: { variables: [{ key: "TOKEN", value: "folder-token", enabled: true }] },
        },
      ],
    });
    const vars = getFolderVariables(h);
    expect(vars).toEqual({ TOKEN: "folder-token" });
  });

  it("later folders override earlier", () => {
    const h = createHierarchy({
      folderPath: [
        {
          id: "f1",
          name: "Parent",
          config: { variables: [{ key: "HOST", value: "parent", enabled: true }] },
        },
        {
          id: "f2",
          name: "Child",
          config: { variables: [{ key: "HOST", value: "child", enabled: true }] },
        },
      ],
    });
    const vars = getFolderVariables(h);
    expect(vars).toEqual({ HOST: "child" });
  });
});

describe("mergeVariables", () => {
  it("merges collection and folder variables", () => {
    const h = createHierarchy({
      collectionConfig: {
        variables: [{ key: "BASE", value: "collection", enabled: true }],
      },
      folderPath: [
        {
          id: "f1",
          name: "Folder",
          config: { variables: [{ key: "BASE", value: "folder", enabled: true }] },
        },
      ],
    });
    expect(mergeVariables(h)).toEqual({ BASE: "folder" });
  });
});

describe("mergeHeaders", () => {
  const defaultHeaders: Header[] = [
    { key: "Content-Type", value: "application/json", disabled: false },
  ];

  it("returns request headers when no collection/folder config", () => {
    const h = createHierarchy();
    const result = mergeHeaders(h, defaultHeaders);
    expect(result).toHaveLength(1);
    expect(result[0]!.key).toBe("Content-Type");
  });

  it("collection headers override request headers", () => {
    const h = createHierarchy({
      collectionConfig: {
        headers: [{ key: "Content-Type", value: "text/plain", disabled: false }],
      },
    });
    const result = mergeHeaders(h, defaultHeaders);
    expect(result).toHaveLength(1);
    expect(result[0]!.value).toBe("application/json");
  });

  it("folder headers override collection headers", () => {
    const h = createHierarchy({
      collectionConfig: {
        headers: [{ key: "X-Foo", value: "col", disabled: false }],
      },
      folderPath: [
        {
          id: "f1",
          name: "Folder",
          config: { headers: [{ key: "X-Foo", value: "folder", disabled: false }] },
        },
      ],
    });
    const result = mergeHeaders(h, []);
    expect(result).toHaveLength(1);
    expect(result[0]!.value).toBe("folder");
  });

  it("request headers override folder headers", () => {
    const h = createHierarchy({
      folderPath: [
        {
          id: "f1",
          name: "Folder",
          config: { headers: [{ key: "X-Header", value: "folder", disabled: false }] },
        },
      ],
    });
    const result = mergeHeaders(h, [{ key: "X-Header", value: "request", disabled: false }]);
    expect(result).toHaveLength(1);
    expect(result[0]!.value).toBe("request");
  });
});

describe("resolveAuth", () => {
  const noneAuth: AuthConfig = { type: "none", config: {} };
  const bearerAuth: AuthConfig = { type: "bearer", config: { token: "abc" } };

  it("returns request auth when already set", () => {
    const h = createHierarchy();
    expect(resolveAuth(h, bearerAuth)).toEqual(bearerAuth);
  });

  it("falls back to folder auth when request auth is none", () => {
    const h = createHierarchy({
      folderPath: [
        {
          id: "f1",
          name: "Folder",
          config: { auth: bearerAuth },
        },
      ],
    });
    expect(resolveAuth(h, noneAuth)).toEqual(bearerAuth);
  });

  it("falls back to collection auth when none set", () => {
    const h = createHierarchy({
      collectionConfig: { auth: bearerAuth },
    });
    expect(resolveAuth(h, noneAuth)).toEqual(bearerAuth);
  });

  it("returns none auth when nothing configured", () => {
    const h = createHierarchy();
    expect(resolveAuth(h, noneAuth)).toEqual(noneAuth);
  });
});

describe("collectPreRequestChain", () => {
  it("returns empty when nothing configured", () => {
    const h = createHierarchy();
    const chain = collectPreRequestChain(h, {});
    expect(chain).toHaveLength(0);
  });

  it("collects collection > folder > request order", () => {
    const h = createHierarchy({
      collectionConfig: { scripts: { preRequest: "col-script" } },
      folderPath: [
        {
          id: "f1",
          name: "MyFolder",
          config: { scripts: { preRequest: "folder-script" } },
        },
      ],
    });
    const chain = collectPreRequestChain(h, { preRequest: "req-script" });
    expect(chain).toHaveLength(3);
    expect(chain[0]!.source).toBe("Collection");
    expect(chain[1]!.source).toBe("Folder: MyFolder");
    expect(chain[2]!.source).toBe("Request");
  });

  it("skips empty scripts", () => {
    const h = createHierarchy({
      collectionConfig: { scripts: { preRequest: "  " } },
    });
    const chain = collectPreRequestChain(h, { preRequest: "ok" });
    expect(chain).toHaveLength(1);
    expect(chain[0]!.source).toBe("Request");
  });
});

describe("collectPostResponseChain", () => {
  it("collects request > folder > collection (reverse) order", () => {
    const h = createHierarchy({
      collectionConfig: { scripts: { postResponse: "col-post" } },
      folderPath: [
        {
          id: "f1",
          name: "MyFolder",
          config: { scripts: { postResponse: "folder-post" } },
        },
      ],
    });
    const chain = collectPostResponseChain(h, { postResponse: "req-post" });
    expect(chain).toHaveLength(3);
    expect(chain[0]!.source).toBe("Request");
    expect(chain[1]!.source).toBe("Folder: MyFolder");
    expect(chain[2]!.source).toBe("Collection");
  });
});