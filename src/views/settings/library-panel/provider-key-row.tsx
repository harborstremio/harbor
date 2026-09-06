import type { ReactNode } from "react";
import { Key } from "../icons";
import { useT } from "@/lib/i18n";
import { ROW_ACTION, SettingRow } from "../kit";
import type { LibraryKey } from "../library-panel";

export type KeyId = LibraryKey | "mdblist" | "postersrv" | "audd" | "songai" | "nyt" | "sports";

export type KeyEntry = {
  id: KeyId;
  name: string;
  desc: string;
  value: string;
  logo?: string;
  mark?: ReactNode;
  badge?: string;
  guide?: ReactNode;
  field: ReactNode;
};

const KEY_BADGE =
  "inline-flex h-[22px] shrink-0 items-center rounded-[6px] bg-accent-soft px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px] text-accent";

export function ProviderKeyRow({ entry, onOpen }: { entry: KeyEntry; onOpen: () => void }) {
  const t = useT();
  const set = entry.value.trim().length > 0;
  return (
    <SettingRow
      icon={
        entry.mark ? (
          entry.mark
        ) : entry.logo ? (
          <img
            src={entry.logo}
            alt=""
            draggable={false}
            className="h-5 w-5 shrink-0 rounded-[6px] object-contain"
          />
        ) : (
          <Key size={18} strokeWidth={2} />
        )
      }
      label={
        <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0">{entry.name}</span>
          {entry.badge && <span className={KEY_BADGE}>{entry.badge}</span>}
        </span>
      }
      desc={entry.desc}
    >
      <span className="flex shrink-0 items-center gap-2 text-[15.5px] text-ink-muted">
        <span className={`h-2 w-2 shrink-0 rounded-full ${set ? "bg-success" : "bg-edge"}`} />
        {set ? t("Saved") : t("Not set")}
      </span>
      <button type="button" onClick={onOpen} className={ROW_ACTION}>
        {set ? t("Manage") : t("Add key")}
      </button>
    </SettingRow>
  );
}
