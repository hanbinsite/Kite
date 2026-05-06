import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  queryCookies as ipcQuery,
  insertCookie as ipcInsert,
  deleteCookie as ipcDelete,
  clearCookies as ipcClear,
  type CookieEntry,
} from "@api-client/core/cookie";
import { handleError } from "@api-client/core/error";

export interface CookieState {
  cookies: CookieEntry[];
  filterDomain: string | null;
  loading: boolean;
  error: string | null;
}

export interface CookieActions {
  loadCookies: (domain?: string) => Promise<void>;
  addCookie: (cookie: Omit<CookieEntry, "id">) => Promise<void>;
  removeCookie: (id: number) => Promise<void>;
  clearAllCookies: () => Promise<void>;
  setFilterDomain: (domain: string | null) => void;
}

export type CookieStore = CookieState & CookieActions;

export const useCookieStore = create<CookieStore>()(
  immer((set, get) => ({
    cookies: [],
    filterDomain: null,
    loading: false,
    error: null,

    loadCookies: async (domain) => {
      set((state) => {
        state.loading = true;
        state.error = null;
      });
      try {
        const cookies = await ipcQuery(domain ?? get().filterDomain ?? undefined);
        set((state) => {
          state.cookies = cookies;
          state.loading = false;
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
          state.loading = false;
        });
      }
    },

    addCookie: async (cookie) => {
      try {
        await ipcInsert(cookie as CookieEntry);
        await get().loadCookies();
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
      }
    },

    removeCookie: async (id) => {
      try {
        await ipcDelete(id);
        set((state) => {
          state.cookies = state.cookies.filter((c: CookieEntry) => c.id !== id);
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
      }
    },

    clearAllCookies: async () => {
      try {
        await ipcClear();
        set((state) => {
          state.cookies = [];
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
      }
    },

    setFilterDomain: (domain) => {
      set((state) => {
        state.filterDomain = domain;
      });
      get().loadCookies(domain ?? undefined);
    },
  })),
);
