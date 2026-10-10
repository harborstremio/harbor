import { useState } from "react";
import { Search } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { ChipItem } from "./rail-sources";
import { SourceChip } from "./source-chip";

export function SourceChipField({
  items,
  searchable,
  placeholder,
}: {
  items: ChipItem[];
  searchable?: boolean;
  placeholder?: string;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? items.filter((it) => it.selected || it.label.toLowerCase().includes(q)) : items;
  return (
    <div className="flex flex-col gap-3">
      {searchable && (
        <div className="flex h-10 items-center gap-2 rounded-xl bg-canvas px-3 ring-1 ring-edge-soft focus-within:ring-accent">
          <Search size={14} className="text-ink-subtle" strokeWidth={2} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder ?? t("Filter")}
            className="h-full flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-subtle outline-none"
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2 gap-y-2.5">
        {shown.map((it) => (
          <SourceChip key={it.key} label={it.label} selected={it.selected} onToggle={it.onToggle} leading={it.leading} />
        ))}
      </div>
      {q && shown.length === 0 && <p className="text-[12.5px] text-ink-subtle">{t("No matches")}</p>}
    </div>
  );
}
