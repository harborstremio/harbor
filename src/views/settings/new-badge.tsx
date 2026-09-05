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
      className="inline-flex h-[22px] shrink-0 items-center rounded-[6px] bg-accent-soft px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px] text-accent"
    >
      {t("NEW")}
    </span>
  );
}
