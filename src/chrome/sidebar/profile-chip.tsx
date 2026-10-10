import { AccountMenu } from "@/chrome/account-menu/account-menu";

export function ProfileChip({ collapsed = false }: { collapsed?: boolean } = {}) {
  return <AccountMenu trigger="row" placement="up" align="stretch" collapsed={collapsed} />;
}
