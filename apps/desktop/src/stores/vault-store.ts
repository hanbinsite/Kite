import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  vaultUnlock as ipcUnlock,
  vaultLock as ipcLock,
  vaultStatus as ipcStatus,
  vaultEncrypt as ipcEncrypt,
  vaultListSecrets as ipcList,
  vaultDeleteSecret as ipcDelete,
  vaultDecrypt as ipcDecrypt,
  type VaultStatus,
  type VaultSecret,
} from "@api-client/core/vault";
import { handleError } from "@api-client/core/error";

export interface VaultState {
  unlocked: boolean;
  secretCount: number;
  secrets: VaultSecret[];
  loading: boolean;
  error: string | null;
}

export interface VaultActions {
  checkStatus: () => Promise<void>;
  unlock: (password: string) => Promise<boolean>;
  lock: () => Promise<void>;
  refreshSecrets: () => Promise<void>;
  addSecret: (name: string, value: string) => Promise<boolean>;
  getSecret: (name: string) => Promise<string | null>;
  removeSecret: (name: string) => Promise<void>;
  clearError: () => void;
}

export type VaultStore = VaultState & VaultActions;

export const useVaultStore = create<VaultStore>()(
  immer((set, get) => ({
    unlocked: false,
    secretCount: 0,
    secrets: [],
    loading: false,
    error: null,

    checkStatus: async () => {
      try {
        const status: VaultStatus = await ipcStatus();
        set((state) => {
          state.unlocked = status.unlocked;
          state.secretCount = status.secretCount;
        });
        if (status.unlocked) {
          await get().refreshSecrets();
        } else {
          set((state) => {
            state.secrets = [];
          });
        }
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
      }
    },

    unlock: async (password) => {
      set((state) => {
        state.loading = true;
        state.error = null;
      });
      try {
        await ipcUnlock(password);
        const status = await ipcStatus();
        set((state) => {
          state.unlocked = status.unlocked;
          state.secretCount = status.secretCount;
          state.loading = false;
        });
        await get().refreshSecrets();
        return true;
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
          state.loading = false;
          state.unlocked = false;
        });
        return false;
      }
    },

    lock: async () => {
      try {
        await ipcLock();
        set((state) => {
          state.unlocked = false;
          state.secretCount = 0;
          state.secrets = [];
          state.error = null;
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
      }
    },

    refreshSecrets: async () => {
      try {
        const secrets = await ipcList();
        set((state) => {
          state.secrets = secrets;
          state.secretCount = secrets.length;
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
      }
    },

    addSecret: async (name, value) => {
      set((state) => {
        state.loading = true;
        state.error = null;
      });
      try {
        await ipcEncrypt(name, value);
        await get().refreshSecrets();
        set((state) => {
          state.loading = false;
        });
        return true;
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
          state.loading = false;
        });
        return false;
      }
    },

    getSecret: async (name) => {
      try {
        const plaintext = await ipcDecrypt(name);
        return plaintext;
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
        return null;
      }
    },

    removeSecret: async (name) => {
      try {
        await ipcDelete(name);
        set((state) => {
          state.secrets = state.secrets.filter((s: VaultSecret) => s.name !== name);
          state.secretCount = state.secrets.length;
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
      }
    },

    clearError: () => {
      set((state) => {
        state.error = null;
      });
    },
  })),
);
