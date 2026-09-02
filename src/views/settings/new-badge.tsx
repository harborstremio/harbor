import { useT } from "@/lib/i18n";
import { markSettingSeen, useSettingNew } from "./settings-new";

export function NewBadge({ id }: { id: string }) {
  const t = useT();
  const isNew = useSettingNew();
  if (!isNew(id)) return null;
  return (
    <span
      onMouseEnter={() => markSettingSeen(id)}
      onFocus={() => markSettingSeen(id)}
      className="rounded-full bg-accent-soft px-2 py-[3px] text-[9.5px] font-semibold uppercase tracking-wider text-accent"
    >
      {t("NEW")}
    </span>
  );
}
