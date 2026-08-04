import { useEffect, useRef, useState, type ComponentType } from "react";
import { HomeIcon } from "@/components/icons/home-icon";
import { MoviesIcon } from "@/components/icons/movies-icon";
import { TvIcon } from "@/components/icons/tv-icon";
import { AnimeIcon } from "@/components/icons/anime-icon";
import { DiscoverIcon } from "@/components/icons/discover-icon";
import { useSettings } from "@/lib/settings";
import type { View } from "./mobile-browse";

type IconCmp = ComponentType<{ active?: boolean }>;

const VIEWS: Array<{ id: View; label: string; Icon: IconCmp }> = [
  { id: "home", label: "Home", Icon: HomeIcon },
  { id: "movies", label: "Movies", Icon: MoviesIcon },
  { id: "shows", label: "Shows", Icon: TvIcon },
  { id: "anime", label: "Anime", Icon: AnimeIcon },
  { id: "discover", label: "Discover", Icon: DiscoverIcon },
];

const SWITCHER_CSS = `
.harbor-vs-panel {
  transform-origin: top right;
  animation: harbor-vs-open 220ms var(--ease-out) both;
}
@keyframes harbor-vs-open {
  0% { opacity: 0; transform: scale(0.94) translateY(-8px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
.harbor-vs-row {
  animation: harbor-vs-row 260ms var(--ease-out) both;
}
@keyframes harbor-vs-row {
  0% { opacity: 0; transform: translateY(-5px); }
  100% { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .harbor-vs-panel,
  .harbor-vs-row {
    animation: none;
  }
}
`;

export function MobileViewSwitcher({
  view,
  onSelect,
}: {
  view: View;
  onSelect: (v: View) => void;
}) {
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const views = settings.hideContent.anime ? VIEWS.filter((v) => v.id !== "anime") : VIEWS;
  const current = VIEWS.find((v) => v.id === view) ?? VIEWS[0];
  const CurrentIcon = current.Icon;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const pick = (id: View) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative flex flex-col items-end">
      <style>{SWITCHER_CSS}</style>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Browsing ${current.label}. Change section`}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 items-center gap-1.5 rounded-[14px] border border-edge-soft/60 bg-elevated/85 pe-3 ps-2 text-ink shadow-[0_8px_24px_-10px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-transform duration-150 active:scale-[0.96]"
      >
        <span className="flex h-[26px] w-[26px] items-center justify-center">
          <CurrentIcon />
        </span>
        <span className="text-[13.5px] font-semibold">{current.label}</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Sections"
          className="harbor-vs-panel absolute right-0 top-[calc(100%+8px)] flex w-[186px] flex-col gap-0.5 rounded-[18px] border border-edge-soft/60 bg-elevated/95 p-1.5 shadow-[0_20px_46px_-16px_rgba(0,0,0,0.62)] backdrop-blur-xl"
        >
          {views.map((v, i) => {
            const on = v.id === view;
            const RowIcon = v.Icon;
            return (
              <button
                key={v.id}
                type="button"
                role="menuitem"
                aria-current={on ? "true" : undefined}
                onClick={() => pick(v.id)}
                style={{ animationDelay: `${i * 26}ms` }}
                className={`harbor-vs-row flex h-12 items-center gap-3 rounded-[13px] px-3 text-start transition-colors active:bg-raised/70 ${
                  on ? "bg-raised/55" : ""
                }`}
              >
                <span
                  className={`flex h-[26px] w-[26px] items-center justify-center ${
                    on ? "text-accent" : "text-ink-muted"
                  }`}
                >
                  <RowIcon active={on} />
                </span>
                <span className={`text-[15px] font-semibold ${on ? "text-ink" : "text-ink-muted"}`}>
                  {v.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
