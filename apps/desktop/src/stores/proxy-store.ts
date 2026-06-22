import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { ProxyStatus, InterceptedRequest, ProxyConfig } from "@api-client/core/proxy";
import { startProxy as startProxyCmd, stopProxy as stopProxyCmd, getProxyStatus, getInterceptedRequests, clearInterceptedRequests } from "@api-client/core/proxy";

export { type ProxyStatus, type InterceptedRequest, type ProxyConfig } from "@api-client/core/proxy";
export { startProxy as startProxyCmd, stopProxy as stopProxyCmd, getProxyStatus, getInterceptedRequests, clearInterceptedRequests } from "@api-client/core/proxy";

interface ProxyStoreState {
  status: ProxyStatus;
  requests: InterceptedRequest[];
  expandedId: string | null;

  setStatus: (status: ProxyStatus) => void;
  setExpandedId: (id: string | null) => void;

  startProxy: (config: ProxyConfig) => Promise<ProxyStatus>;
  stopProxy: () => Promise<ProxyStatus>;
  refreshStatus: () => Promise<void>;
  refreshRequests: () => Promise<void>;
  clearRequests: () => Promise<void>;
}

export const useProxyStore = create<ProxyStoreState>()(
  immer((set) => ({
    status: { running: false, port: null, interceptedCount: 0 },
    requests: [],
    expandedId: null,

    setStatus(status) {
      set((s) => { s.status = status; });
    },
    setExpandedId(id) {
      set((s) => { s.expandedId = id; });
    },

    async startProxy(config) {
      const status = await startProxyCmd(config);
      set((s) => { s.status = status; });
      return status;
    },
    async stopProxy() {
      const status = await stopProxyCmd();
      set((s) => { s.status = status; });
      return status;
    },
    async refreshStatus() {
      const status = await getProxyStatus();
      set((s) => { s.status = status; });
      await this.refreshRequests?.();
    },
    async refreshRequests() {
      const requests = await getInterceptedRequests();
      set((s) => { s.requests = requests; });
    },
    async clearRequests() {
      await clearInterceptedRequests();
      set((s) => { s.requests = []; s.status = { ...s.status, interceptedCount: 0 }; });
    },
  })),
);