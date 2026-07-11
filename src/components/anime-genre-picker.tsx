import { useT } from "@/lib/i18n";
import { GENRE } from "@/lib/providers/jikan";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const OPTIONS: Array<{ id: number; label: string }> = [
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
  const [selected, setSelected] = useState<Set<number>>(() => new Set(initial));

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

  const save = () => {
    onSave(Array.from(selected));
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-center justify-center px-4 py-10">
      <button
        aria-label={t("Close")}
        onClick={onClose}
        className="absolute inset-0 -z-10 cursor-default bg-canvas/88"
      />
      <div className="relative flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-[26px] border border-edge-soft/70 bg-elevated shadow-[0_40px_120px_-30px_rgba(0,0,0,0.85)]">
        <button
          type="button"
          aria-label={t("Close")}
          onClick={onClose}
          className="absolute end-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-canvas/60 hover:text-ink"
        >
          <X size={16} strokeWidth={2.2} />
        </button>

        <div className="flex flex-col gap-1.5 px-8 pt-8">
          <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-ink-subtle">
            {t("Tune your picks")}
          </span>
          <h2 className="font-display text-[27px] font-medium leading-tight tracking-tight text-ink">
            {t("More of what you love.")}
          </h2>
          <p className="text-[13.5px] text-ink-muted">
            {t("Tap the genres you want more of. They steer the Top Picks row at the top of this page.")}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-7">
          <div className="flex flex-wrap gap-2.5">
            {OPTIONS.map((opt) => {
              const on = selected.has(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggle(opt.id)}
                  className={`h-11 rounded-full px-5 text-[14px] font-semibold transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.97] ${
                    on
                      ? "bg-ink text-canvas shadow-[0_6px_18px_-8px_rgba(0,0,0,0.55)]"
                      : "bg-canvas/50 text-ink-muted ring-1 ring-edge-soft hover:text-ink hover:ring-edge"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-edge-soft/45 px-8 py-5">
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className={`text-[12.5px] font-medium transition-colors ${
              selected.size > 0 ? "text-ink-subtle hover:text-ink" : "pointer-events-none text-transparent"
            }`}
          >
            {t("Clear all")}
          </button>
          <div className="flex items-center gap-4">
            <span className="text-[12.5px] tabular-nums text-ink-subtle">
              {selected.size > 0 ? t("{count} selected", { count: selected.size }) : t("None yet")}
            </span>
            <button
              type="button"
              onClick={save}
              className="h-11 rounded-full bg-ink px-7 text-[14px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.98]"
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
