import { create } from "zustand";
import type { HttpRequestConfig, HttpResponse } from "@api-client/types";

export interface RequestState {
  isLoading: boolean;
  responses: Record<string, HttpResponse>;
  error: string | null;
  activeRequestConfig: HttpRequestConfig | null;
}

export interface RequestActions {
  setLoading: (loading: boolean) => void;
  setResponse: (tabId: string, response: HttpResponse) => void;
  setError: (error: string | null) => void;
  clearResponse: (tabId: string) => void;
  setActiveRequestConfig: (config: HttpRequestConfig | null) => void;
}

export type RequestStore = RequestState & RequestActions;

export const useRequestStore = create<RequestStore>()((set) => ({
  isLoading: false,
  responses: {},
  error: null,
  activeRequestConfig: null,

  setLoading: (loading) => set({ isLoading: loading }),

  setResponse: (tabId, response) =>
    set((state) => ({
      responses: { ...state.responses, [tabId]: response },
    })),

  setError: (error) => set({ error }),

  clearResponse: (tabId) =>
    set((state) => {
      const { [tabId]: _, ...rest } = state.responses;
      return { responses: rest };
    }),

  setActiveRequestConfig: (config) => set({ activeRequestConfig: config }),
}));
