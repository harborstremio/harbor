import { mergeKeys, type KeyBase, type KeyValues, type SyncedSettingKey } from "./keys.ts";

const OWNER_KEY = "jl.account.keys.owner.v1";
const BASE_PREFIX = "jl.account.keys.base.v1.";
type StoragePort = Pick<Storage, "getItem" | "setItem" | "key" | "length">;

/** Existing device credentials must never be implicitly exported to a different JL account. */
export function claimKeySyncOwner(storage: StoragePort, accountId: string): boolean {
  try {
    const workspace = storage.getItem("jl.account.workspace.owner.v1");
    if (workspace) return workspace === accountId;
    const owner = storage.getItem(OWNER_KEY);
    if (owner) return owner === accountId;
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(BASE_PREFIX) && key !== `${BASE_PREFIX}${accountId}`) return false;
    }
    storage.setItem(OWNER_KEY, accountId);
    return true;
  } catch {
    return false;
  }
}

export async function runKeySync(ports: {
  assertCurrent: () => void;
  readLocal: () => KeyValues;
  readBase: () => KeyBase;
  writeBase: (base: KeyBase) => void;
  pull: () => Promise<KeyValues>;
  push: (key: SyncedSettingKey, value: string) => Promise<void>;
  apply: (values: KeyValues) => void;
}): Promise<void> {
  ports.assertCurrent();
  const remote = await ports.pull();
  ports.assertCurrent();
  const local = ports.readLocal();
  const merged = mergeKeys(ports.readBase(), local, remote);
  for (const [key, value] of Object.entries(merged.push) as Array<[SyncedSettingKey, string]>) {
    ports.assertCurrent();
    await ports.push(key, value);
  }
  ports.assertCurrent();
  const current = ports.readLocal();
  const apply: KeyValues = {};
  for (const [key, value] of Object.entries(merged.apply) as Array<[SyncedSettingKey, string]>) {
    if ((current[key] ?? "") === (local[key] ?? "")) apply[key] = value;
  }
  ports.apply(apply);
  ports.writeBase(merged.base);
}
