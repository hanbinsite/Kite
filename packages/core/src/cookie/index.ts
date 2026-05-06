import { invoke } from "@tauri-apps/api/core";

export interface CookieEntry {
  id?: number;
  domain: string;
  name: string;
  value: string;
  path: string;
  expires?: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
}

export async function insertCookie(cookie: CookieEntry): Promise<number> {
  return invoke<number>("insert_cookie", { cookie });
}

export async function queryCookies(domain?: string): Promise<CookieEntry[]> {
  return invoke<CookieEntry[]>("query_cookies", { domain: domain ?? null });
}

export async function deleteCookie(id: number): Promise<void> {
  return invoke<void>("delete_cookie", { id });
}

export async function clearCookies(): Promise<void> {
  return invoke<void>("clear_cookies");
}
