import { describe, it, expect } from "vitest";
import { buildAnalysisContext } from "./collection-analyzer";

describe("buildAnalysisContext", () => {
  it("includes total endpoint count", () => {
    const requests = [
      { name: "Get Users", method: "GET", url: "/users" },
      { name: "Create User", method: "POST", url: "/users" },
    ];
    const context = buildAnalysisContext(requests);
    expect(context).toContain("Total endpoints: 2");
  });

  it("includes unique methods", () => {
    const requests = [
      { name: "A", method: "GET", url: "/a" },
      { name: "B", method: "GET", url: "/b" },
      { name: "C", method: "POST", url: "/c" },
    ];
    const context = buildAnalysisContext(requests);
    expect(context).toContain("Methods: GET, POST");
  });

  it("reports endpoints without tests", () => {
    const requests = [
      { name: "A", method: "GET", url: "/a", hasTests: true },
      { name: "B", method: "POST", url: "/b" },
    ];
    const context = buildAnalysisContext(requests);
    expect(context).toContain("Endpoints without tests (1): POST /b");
  });

  it("does not report no tests when all have tests", () => {
    const requests = [
      { name: "A", method: "GET", url: "/a", hasTests: true },
      { name: "B", method: "POST", url: "/b", hasTests: true },
    ];
    const context = buildAnalysisContext(requests);
    expect(context).not.toContain("Endpoints without tests");
  });

  it("reports endpoints without docs", () => {
    const requests = [
      { name: "A", method: "GET", url: "/a", docs: "Gets A" },
      { name: "B", method: "POST", url: "/b" },
    ];
    const context = buildAnalysisContext(requests);
    expect(context).toContain("Endpoints without docs (1): POST /b");
  });

  it("does not report no docs when all have docs", () => {
    const requests = [
      { name: "A", method: "GET", url: "/a", docs: "Gets A" },
      { name: "B", method: "POST", url: "/b", docs: "Creates B" },
    ];
    const context = buildAnalysisContext(requests);
    expect(context).not.toContain("Endpoints without docs");
  });

  it("reports multiple auth types", () => {
    const requests = [
      { name: "A", method: "GET", url: "/a", auth: { type: "bearer" } },
      { name: "B", method: "GET", url: "/b", auth: { type: "basic" } },
    ];
    const context = buildAnalysisContext(requests);
    expect(context).toContain("Multiple auth types: bearer, basic");
  });

  it("does not report auth when only one type", () => {
    const requests = [
      { name: "A", method: "GET", url: "/a", auth: { type: "bearer" } },
      { name: "B", method: "GET", url: "/b", auth: { type: "bearer" } },
    ];
    const context = buildAnalysisContext(requests);
    expect(context).not.toContain("Multiple auth types");
  });

  it("does not report auth when none configured", () => {
    const requests = [
      { name: "A", method: "GET", url: "/a" },
      { name: "B", method: "GET", url: "/b", auth: null },
    ];
    const context = buildAnalysisContext(requests);
    expect(context).not.toContain("Multiple auth types");
  });

  it("detects hardcoded URLs", () => {
    const requests = [
      { name: "A", method: "GET", url: "https://example.com/api" },
      { name: "B", method: "GET", url: "http://other.com/v2" },
    ];
    const context = buildAnalysisContext(requests);
    expect(context).toContain("Hardcoded URLs detected in 2 endpoints");
  });

  it("handles empty request list", () => {
    const context = buildAnalysisContext([]);
    expect(context).toContain("Total endpoints: 0");
  });

  it("filters out requests with null auth", () => {
    const requests = [
      { name: "A", method: "GET", url: "/a", auth: null },
      { name: "B", method: "GET", url: "/b" },
    ];
    const context = buildAnalysisContext(requests);
    expect(context).not.toContain("Multiple auth types");
  });
});