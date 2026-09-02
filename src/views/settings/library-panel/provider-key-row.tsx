import type { ReactNode } from "react";
import { Key } from "lucide-react";
import { useT } from "@/lib/i18n";
import { SettingRow } from "../kit";
import type { LibraryKey } from "../library-panel";

export type KeyId = LibraryKey | "mdblist" | "postersrv" | "audd" | "songai" | "nyt";

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
            className="h-7 w-7 shrink-0 rounded-md object-contain"
          />
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-canvas text-ink-subtle">
            <Key size={14} />
          </span>
        )
      }
      label={
        <>
          {entry.name}
          {entry.badge && (
            <span className="rounded-full bg-accent-soft px-2 py-[3px] text-[9.5px] font-semibold uppercase tracking-wider text-accent">
              {entry.badge}
            </span>
          )}
        </>
      }
      desc={entry.desc}
    >
      <span
        className={`flex shrink-0 items-center gap-1.5 rounded-full bg-canvas px-2.5 py-1 text-[11.5px] font-semibold ${
          set ? "text-accent" : "text-ink-subtle"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${set ? "bg-accent" : "bg-edge"}`} />
        {set ? t("Active") : t("Not set")}
      </span>
      {entry.guide}
      <button
        type="button"
        onClick={onOpen}
        className="harbor-press-pop h-9 shrink-0 rounded-md bg-canvas px-4 text-[12.5px] font-semibold text-ink-muted transition-colors hover:text-ink"
      >
        {set ? t("Manage") : t("Add key")}
      </button>
    </SettingRow>
  );
}
