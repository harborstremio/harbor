import { useT } from "@/lib/i18n";
import { Search } from "lucide-react";

export function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useT();
  return (
    <div className="relative h-10 w-full min-w-0 rounded-full border border-edge-soft bg-elevated/40 transition-colors focus-within:border-edge">
      <Search size={14} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("Search addons")}
        className="h-full w-full bg-transparent ps-9 pe-4 text-[13px] text-ink placeholder:text-ink-subtle outline-none"
      />
    </div>
  );
}
