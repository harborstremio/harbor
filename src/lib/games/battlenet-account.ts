import type { LauncherGame, LauncherScan } from "./launchers";
export type BattleNetOwned = { id: string; productId: string; name: string };
export type BattleNetPartition = { games: BattleNetOwned[]; updatedAt: number; unresolved: number };
export type BattleNetAccountStatus = {
  connection: string | null; importInstalled: boolean; importUninstalled: boolean;
  snapshot: { modern: BattleNetPartition; classic: BattleNetPartition } | null; warnings: string[];
};
export const emptyBattleNetAccount = (): BattleNetAccountStatus => ({ connection: null, importInstalled: true, importUninstalled: false, snapshot: null, warnings: [] });
export function withBattleNetAccount(scan: LauncherScan | null, status: BattleNetAccountStatus): LauncherScan | null {
  const owned = new Map([...(status.snapshot?.modern.games ?? []), ...(status.snapshot?.classic.games ?? [])].map(game => [game.id, game]));
  if (!scan && (!status.importUninstalled || !owned.size)) return scan;
  const installed = new Set(scan?.games.filter(game => game.launcher === "battlenet").map(game => game.id));
  const games: LauncherGame[] = (scan?.games ?? []).filter(game => game.launcher !== "battlenet" || status.importInstalled)
    .map(game => game.launcher === "battlenet" && owned.has(game.id) ? { ...game, accountOwned: true } : game);
  if (status.importUninstalled) for (const game of owned.values()) {
    if (installed.has(game.id)) continue;
    games.push({ ...game, launcher: "battlenet", installPath: "", state: scan?.supported && !scan.warnings.length ? "notInstalled" : "unknown", launchMode: "client", accountOwned: true });
  }
  return { supported: scan?.supported ?? false, clients: scan?.clients ?? [], warnings: scan?.warnings ?? [], games };
}
export function battleNetAccountError(error: unknown) {
  const code = error instanceof Error ? error.message : String(error);
  if (code === "battlenet_account_canceled") return null;
  if (code === "battlenet_account_expired") return "games.battlenet.expired";
  if (code === "battlenet_account_changed") return "games.battlenet.changed";
  if (code === "battlenet_account_timeout") return "games.battlenet.timeout";
  if (code === "battlenet_account_busy") return "games.battlenet.busy";
  if (code.includes("not found")) return "games.battlenet.update";
  return "games.battlenet.error";
}
