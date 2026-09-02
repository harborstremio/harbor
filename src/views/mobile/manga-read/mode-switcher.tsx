import {
  BookOpen,
  Columns2,
  GalleryVertical,
  RectangleVertical,
  type LucideIcon,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import type { LocalMode } from "./local-reader-types";

const ITEMS: { mode: LocalMode; Icon: LucideIcon }[] = [
  { mode: "strip", Icon: GalleryVertical },
  { mode: "single", Icon: RectangleVertical },
  { mode: "double", Icon: Columns2 },
  { mode: "book", Icon: BookOpen },
];

export function ModeSwitcher({
  mode,
  onPick,
  reduce,
}: {
  mode: LocalMode;
  onPick: (m: LocalMode) => void;
  reduce: boolean;
}) {
  const t = useT();
  return (
    <div className="flex items-center gap-1 rounded-full bg-elevated/70 p-1 ring-1 ring-edge-soft/50 backdrop-blur-xl">
      {ITEMS.map(({ mode: m, Icon }) => {
        const active = m === mode;
        const label =
          m === "strip"
            ? t("Webtoon strip")
            : m === "single"
              ? t("Single page")
              : m === "double"
                ? t("Two pages")
                : t("Book flip");
        return (
          <button
            key={m}
            type="button"
            aria-label={label}
            aria-pressed={active}
            onClick={() => onPick(m)}
            className={`grid h-11 w-11 place-items-center rounded-full ${reduce ? "" : "transition-colors duration-150 motion-reduce:transition-none"} ${
              active ? "bg-accent text-canvas" : "text-ink-muted active:scale-90"
            }`}
          >
            <Icon size={20} strokeWidth={2.2} />
          </button>
        );
      })}
    </div>
  );
}
