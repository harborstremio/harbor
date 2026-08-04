import {
  BookOpen,
  Columns2,
  GalleryVertical,
  RectangleVertical,
  type LucideIcon,
} from "lucide-react";
import type { LocalMode } from "./local-reader-types";

const ITEMS: { mode: LocalMode; label: string; Icon: LucideIcon }[] = [
  { mode: "strip", label: "Webtoon strip", Icon: GalleryVertical },
  { mode: "single", label: "Single page", Icon: RectangleVertical },
  { mode: "double", label: "Two pages", Icon: Columns2 },
  { mode: "book", label: "Book flip", Icon: BookOpen },
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
  return (
    <div className="flex items-center gap-1 rounded-full bg-elevated/70 p-1 ring-1 ring-edge-soft/50 backdrop-blur-xl">
      {ITEMS.map(({ mode: m, label, Icon }) => {
        const active = m === mode;
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
