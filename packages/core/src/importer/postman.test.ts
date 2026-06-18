import { describe, it, expect } from "vitest";
import { parsePostman } from "./postman";

describe("postman parser", () => {
  it("parses Postman v2.1 collection with single request", () => {
    const json = JSON.stringify({
      info: { name: "API Tests", _postman_id: "uuid-123", schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
      item: [
        {
          name: "Get Users",
          request: {
            method: "GET",
            url: "https://api.example.com/users",
            header: [{ key: "Accept", value: "application/json" }],
          },
        },
      ],
    });
    const result = parsePostman(json);
    expect(result.collectionName).toBe("API Tests");
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0]!.name).toBe("Get Users");
    expect(result.requests[0]!.method).toBe("GET");
    expect(result.requests[0]!.url).toBe("https://api.example.com/users");
  });

  it("parses collection with multiple requests", () => {
    const json = JSON.stringify({
      info: { name: "Multi Requests" },
      item: [
        {
          name: "Get Users",
          request: { method: "GET", url: "https://api.example.com/users" },
        },
        {
          name: "Create User",
          request: { method: "POST", url: "https://api.example.com/users" },
        },
        {
          name: "Delete User",
          request: { method: "DELETE", url: "https://api.example.com/users/1" },
        },
      ],
    });
    const result = parsePostman(json);
    expect(result.requests).toHaveLength(3);
    expect(result.requests[0]!.method).toBe("GET");
    expect(result.requests[1]!.method).toBe("POST");
    expect(result.requests[2]!.method).toBe("DELETE");
  });

  it("parses Postman v2.0 collection", () => {
    const json = JSON.stringify({
      info: { name: "V2 Legacy", _postman_id: "legacy", schema: "https://schema.getpostman.com/json/collection/v2.0.0/collection.json" },
      item: [
        {
          name: "Ping",
          request: { method: "GET", url: "https://api.example.com/ping" },
        },
      ],
    });
    const result = parsePostman(json);
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0]!.method).toBe("GET");
  });

  it("handles collection with no items", () => {
    const json = JSON.stringify({
      info: { name: "Empty" },
      item: [],
    });
    const result = parsePostman(json);
    expect(result.requests).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("handles collection with auth at collection level (no request auth)", () => {
    const json = JSON.stringify({
      info: { name: "Auth Collection" },
      auth: { type: "bearer", bearer: [{ key: "token", value: "col-token", type: "string" }] },
      item: [
        {
          name: "Secured Endpoint",
          request: {
            method: "GET",
            url: "https://api.example.com/secure",
          },
        },
      ],
    });
    const result = parsePostman(json);
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0]!.name).toBe("Secured Endpoint");
  });

  it("parses request with raw JSON body", () => {
    const json = JSON.stringify({
      info: { name: "Raw Body" },
      item: [
        {
          name: "Create Item",
          request: {
            method: "POST",
            url: "https://api.example.com/items",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: { mode: "raw", raw: '{"name":"new item"}', options: { raw: { language: "json" } } },
          },
        },
      ],
    });
    const result = parsePostman(json);
    expect(result.requests[0]!.body).toBeDefined();
    expect(result.requests[0]!.body!.mode).toBe("raw");
    expect(result.requests[0]!.body!.content).toBe('{"name":"new item"}');
    expect(result.requests[0]!.body!.content_type).toBe("application/json");
    expect(result.requests[0]!.body!.language).toBe("json");
  });

  it("parses request with formdata body", () => {
    const json = JSON.stringify({
      info: { name: "Form Data" },
      item: [
        {
          name: "Upload",
          request: {
            method: "POST",
            url: "https://api.example.com/upload",
            body: {
              mode: "formdata",
              formdata: [
                { key: "file", type: "file", value: "" },
                { key: "name", value: "test" },
              ],
            },
          },
        },
      ],
    });
    const result = parsePostman(json);
    expect(result.requests[0]!.body).toBeDefined();
    expect(result.requests[0]!.body!.mode).toBe("formdata");
    expect(result.requests[0]!.body!.content_type).toBe("multipart/form-data");
  });

  it("parses request with urlencoded body", () => {
    const json = JSON.stringify({
      info: { name: "Urlencoded" },
      item: [
        {
          name: "Submit Form",
          request: {
            method: "POST",
            url: "https://api.example.com/submit",
            body: {
              mode: "urlencoded",
              urlencoded: [
                { key: "username", value: "admin" },
                { key: "password", value: "1234" },
              ],
            },
          },
        },
      ],
    });
    const result = parsePostman(json);
    expect(result.requests[0]!.body).toBeDefined();
    expect(result.requests[0]!.body!.mode).toBe("urlencoded");
    expect(result.requests[0]!.body!.content_type).toBe("application/x-www-form-urlencoded");
  });

  it("handles invalid/malformed JSON", () => {
    const result = parsePostman("{invalid json");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.requests).toHaveLength(0);
  });

  it("handles not a Postman format (wrong schema)", () => {
    const json = JSON.stringify({
      someRandomKey: "not postman",
      items: [{ name: "should fail" }],
    });
    const result = parsePostman(json);
    expect(result.requests).toHaveLength(0);
    expect(result.collectionName).toBe("Postman Import");
  });

  it("parses nested folders with requests", () => {
    const json = JSON.stringify({
      info: { name: "Nested" },
      item: [
        {
          name: "Auth Folder",
          item: [
            {
              name: "Login",
              request: { method: "POST", url: "https://api.example.com/login" },
            },
            {
              name: "User Profile",
              item: [
                {
                  name: "Get Profile",
                  request: { method: "GET", url: "https://api.example.com/profile" },
                },
              ],
            },
          ],
        },
      ],
    });
    const result = parsePostman(json);
    expect(result.requests).toHaveLength(2);
    expect(result.requests[0]!.name).toBe("Login");
    expect(result.requests[1]!.name).toBe("Get Profile");
  });
});