import { invoke } from "@tauri-apps/api/core";

export interface VaultStatus {
  unlocked: boolean;
  secretCount: number;
}

export interface VaultSecret {
  name: string;
  createdAt: string;
}

export function vaultUnlock(password: string): Promise<void> {
  return invoke<void>("unlock_vault", { masterPassword: password });
}

export function vaultLock(): Promise<void> {
  return invoke<void>("lock_vault");
}

export function vaultStatus(): Promise<VaultStatus> {
  return invoke<VaultStatus>("is_vault_unlocked");
}

export function vaultEncrypt(name: string, plaintext: string): Promise<void> {
  return invoke<void>("encrypt_vault_secret", { name, plaintext });
}

export function vaultDecrypt(name: string): Promise<string> {
  return invoke<string>("decrypt_vault_secret", { name });
}

export function vaultListSecrets(): Promise<VaultSecret[]> {
  return invoke<VaultSecret[]>("list_vault_secrets");
}

export function vaultDeleteSecret(name: string): Promise<void> {
  return invoke<void>("delete_vault_secret", { name });
}
