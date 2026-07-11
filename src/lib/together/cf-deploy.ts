import { invoke } from "@tauri-apps/api/core";

export type CfAccount = { id: string; name: string };

export type DeployResult = {
  url: string;
  account_id: string;
  script_name: string;
  subdomain: string;
};

const NOT_NATIVE_MSG =
  "Relay deploy is only available in the Harbor desktop app. Open Harbor outside the browser to continue.";

function ensureNative(): void {
  const hasTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
  if (!hasTauri) {
    throw new Error(NOT_NATIVE_MSG);
  }
}

export function listAccounts(apiToken: string): Promise<CfAccount[]> {
  ensureNative();
  return invoke<CfAccount[]>("cf_list_accounts", { apiToken });
}

export function deployRelay(apiToken: string, accountId: string): Promise<DeployResult> {
  ensureNative();
  return invoke<DeployResult>("cf_deploy_relay", { apiToken, accountId });
}

export function deleteRelay(apiToken: string, accountId: string): Promise<void> {
  ensureNative();
  return invoke("cf_delete_relay", { apiToken, accountId });
}

export function relayStatus(apiToken: string, accountId: string): Promise<boolean> {
  ensureNative();
  return invoke<boolean>("cf_relay_status", { apiToken, accountId });
}
