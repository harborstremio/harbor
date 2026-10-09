import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { ORIGIN_OPTIONS } from "@/lib/anime-filter";
import { GENRE } from "@/lib/providers/jikan";
import { ANIME_GENRE_ART } from "@/lib/anime-genre-art-map";
import { GENRE_ICON } from "./anime-genre-picker/genre-icons";

export const ANIME_GENRE_OPTIONS: Array<{ id: number; label: string }> = [
  { id: GENRE.Action, label: "Action" },
  { id: GENRE.Adventure, label: "Adventure" },
  { id: GENRE.Comedy, label: "Comedy" },
  { id: GENRE.Drama, label: "Drama" },
  { id: GENRE.Fantasy, label: "Fantasy" },
  { id: GENRE.SciFi, label: "Sci-Fi" },
  { id: GENRE.Romance, label: "Romance" },
  { id: GENRE.SliceOfLife, label: "Slice of Life" },
  { id: GENRE.Supernatural, label: "Supernatural" },
  { id: GENRE.Mystery, label: "Mystery" },
  { id: GENRE.Psychological, label: "Psychological" },
  { id: GENRE.Horror, label: "Horror" },
  { id: GENRE.Thriller, label: "Thriller" },
  { id: GENRE.Mecha, label: "Mecha" },
  { id: GENRE.Sports, label: "Sports" },
  { id: GENRE.Music, label: "Music" },
];

export function AnimeGenrePicker({
  initial,
  onSave,
  onClose,
}: {
  initial: number[];
  onSave: (genres: number[]) => void;
  onClose: () => void;
}) {
  const t = useT();
  const { settings, update } = useSettings();
  const [selected, setSelected] = useState<Set<number>>(() => new Set(initial));
  const [origins, setOrigins] = useState<Set<string>>(() => new Set(settings.animeExcludeOrigins));
  const [hideWatched, setHideWatched] = useState(settings.animeHideWatchedPicks);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const toggle = (id: number) => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleOrigin = (code: string) => {
    setOrigins((cur) => {
      const next = new Set(cur);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const save = () => {
    onSave(Array.from(selected));
    update({ animeExcludeOrigins: Array.from(origins), animeHideWatchedPicks: hideWatched });
    onClose();
  };

  const hiddenCount = origins.size + (hideWatched ? 1 : 0);

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-center justify-center px-4 py-10">
      <button
        aria-label={t("Close")}
        onClick={onClose}
        className="animate-scrim-in absolute inset-0 -z-10 cursor-default bg-canvas/80 backdrop-blur-[2px]"
      />
      <div className="animate-dialog-in relative flex max-h-full w-full max-w-[46rem] flex-col overflow-hidden rounded-lg bg-elevated ring-1 ring-edge-soft shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
        <div className="flex items-start gap-4 px-7 pt-7">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-ink-subtle">
              {t("Tune anime")}
            </span>
            <h2 className="font-display text-[22px] font-medium leading-tight tracking-tight text-ink">
              {t("Shape your anime feed.")}
            </h2>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              {t("Steer your Top Picks and hero toward what you love, and hide what you don't.")}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("Close")}
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/[0.06] text-ink-subtle transition-colors duration-150 hover:bg-white/[0.10] hover:text-ink active:scale-[0.97]"
          >
            <X size={15} strokeWidth={2.2} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-7 py-6">
          <div className="flex flex-col gap-3">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
              {t("Genres you want more of")}
            </span>
            <div className="harbor-cascade grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ANIME_GENRE_OPTIONS.map((opt) => {
                const on = selected.has(opt.id);
                const poster = ANIME_GENRE_ART[opt.label];
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggle(opt.id)}
                    aria-pressed={on}
                    className={`group relative isolate aspect-[16/10] overflow-hidden rounded-md text-start transition-[box-shadow,background-color] duration-150 ease-in-out active:scale-[0.98] motion-reduce:active:scale-100 ${
                      on
                        ? "bg-canvas ring-2 ring-inset ring-accent"
                        : "bg-canvas/60 ring-1 ring-inset ring-edge-soft hover:ring-edge"
                    }`}
                  >
                    {poster && (
                      <img
                        src={poster}
                        alt=""
                        draggable={false}
                        loading="lazy"
                        className={`absolute inset-0 -z-10 h-full w-full object-cover transition-[opacity,filter] duration-300 ease-in-out ${
                          on
                            ? "opacity-[0.85] saturate-100"
                            : "opacity-[0.34] saturate-[0.35] group-hover:opacity-[0.48]"
                        }`}
                      />
                    )}
                    <img
                      src={GENRE_ICON[opt.id]}
                      alt=""
                      draggable={false}
                      className={`pointer-events-none absolute -end-3 -top-2 h-20 w-20 transition-[opacity,filter,transform] duration-200 ease-in-out group-hover:scale-[1.04] motion-reduce:transform-none ${
                        on ? "opacity-45 saturate-100" : "opacity-[0.28] saturate-0"
                      }`}
                    />
                    <div
                      className={`absolute inset-x-0 bottom-0 flex items-center gap-1.5 px-2.5 py-2 transition-colors duration-150 ${
                        on ? "bg-canvas/90" : "bg-canvas/75"
                      }`}
                    >
                      <span
                        className={`min-w-0 flex-1 truncate text-[13px] transition-colors duration-150 ${
                          on ? "font-semibold text-ink" : "font-medium text-ink-muted"
                        }`}
                      >
                        {t(opt.label)}
                      </span>
                      {on && (
                        <Check
                          size={13}
                          strokeWidth={3}
                          className="harbor-pop shrink-0 text-accent"
                          aria-hidden
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-md bg-canvas/60 p-4 ring-1 ring-inset ring-edge-soft">
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
                {t("Hide from your picks")}
              </span>
              {hiddenCount > 0 && (
                <span className="rounded-full bg-white/[0.06] px-1.5 py-[1px] text-[10px] font-semibold tabular-nums text-ink-muted">
                  {hiddenCount}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ORIGIN_OPTIONS.map((opt) => {
                const on = origins.has(opt.code);
                return (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => toggleOrigin(opt.code)}
                    aria-pressed={on}
                    className={`h-8 rounded-full px-3.5 text-[12.5px] font-medium transition-colors duration-150 ease-in-out active:scale-[0.97] motion-reduce:active:scale-100 ${
                      on
                        ? "bg-danger/15 text-danger ring-1 ring-inset ring-danger/30"
                        : "bg-white/[0.06] text-ink-muted hover:bg-white/[0.10] hover:text-ink"
                    }`}
                  >
                    {t(opt.label)}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setHideWatched((v) => !v)}
              aria-pressed={hideWatched}
              className="group flex items-center gap-2.5 self-start text-start"
            >
              <span
                className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] transition-colors duration-150 ${
                  hideWatched
                    ? "bg-accent text-canvas"
                    : "bg-white/[0.06] text-transparent ring-1 ring-inset ring-edge-soft group-hover:bg-white/[0.10]"
                }`}
              >
                <Check size={12} strokeWidth={3} />
              </span>
              <span
                className={`text-[13px] transition-colors duration-150 ${
                  hideWatched ? "text-ink" : "text-ink-muted group-hover:text-ink"
                }`}
              >
                {t("Hide anime I've already watched")}
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-edge-soft/45 px-7 py-4">
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className={`text-[12.5px] font-medium transition-colors duration-150 ${
              selected.size > 0
                ? "text-ink-subtle hover:text-ink"
                : "pointer-events-none text-transparent"
            }`}
          >
            {t("Clear all")}
          </button>
          <div className="flex items-center gap-3.5">
            <span className="text-[12.5px] tabular-nums text-ink-subtle">
              {selected.size > 0 ? t("{count} selected", { count: selected.size }) : t("None yet")}
            </span>
            <button
              type="button"
              onClick={save}
              className="h-9 rounded-md bg-ink px-5 text-[13px] font-semibold text-canvas transition-opacity duration-150 hover:opacity-90 active:scale-[0.98] motion-reduce:active:scale-100"
            >
              {t("Done")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
