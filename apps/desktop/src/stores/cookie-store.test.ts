import { describe, it, expect, beforeEach } from "vitest";
import { useCookieStore } from "./cookie-store";

describe("cookie-store", () => {
  beforeEach(() => {
    useCookieStore.setState({
      cookies: [],
      filterDomain: null,
      loading: false,
      error: null,
    });
  });

  it("starts with empty cookies", () => {
    expect(useCookieStore.getState().cookies).toEqual([]);
    expect(useCookieStore.getState().filterDomain).toBeNull();
    expect(useCookieStore.getState().loading).toBe(false);
    expect(useCookieStore.getState().error).toBeNull();
  });

  it("setFilterDomain updates domain and triggers load", () => {
    useCookieStore.getState().setFilterDomain("example.com");
    expect(useCookieStore.getState().filterDomain).toBe("example.com");
  });

  it("setFilterDomain null clears filter", () => {
    useCookieStore.getState().setFilterDomain("example.com");
    useCookieStore.getState().setFilterDomain(null);
    expect(useCookieStore.getState().filterDomain).toBeNull();
  });
});