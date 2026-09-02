import { useState, type CSSProperties } from "react";
import { Loader2 } from "lucide-react";
import { VOYAGE_THEMES, THEME_PALETTE } from "@/lib/voyage/themes";
import { startVoyage } from "@/lib/voyage/store";
import type { VoyageTheme } from "@/lib/voyage/types";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";

export function VoyageChooser() {
  const t = useT();
  const { settings } = useSettings();
  const [busy, setBusy] = useState<string | null>(null);
  const [len, setLen] = useState(5);
  const [error, setError] = useState<string | null>(null);

  const start = async (theme: VoyageTheme) => {
    setBusy(theme.id);
    setError(null);
    const ok = await startVoyage(theme, len, settings.tmdbKey ?? "");
    if (!ok) {
      setError(t("That route wouldn't chart. Try a different direction."));
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">{t("New voyage")}</span>
          <h2 className="font-display text-[26px] font-medium tracking-tight text-ink">{t("Where to today?")}</h2>
          <p className="text-[13.5px] text-ink-muted">{t("Pick a direction. You steer from there, one film at a time.")}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[11px] text-ink-subtle">{t("How many films?")}</span>
          <LengthPicker value={len} onChange={setLen} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {VOYAGE_THEMES.map((theme) => (
          <ThemeTile key={theme.id} theme={theme} busy={busy === theme.id} disabled={!!busy} onPick={() => start(theme)} />
        ))}
      </div>

      {error && <p className="text-[12.5px] text-danger">{error}</p>}
    </div>
  );
}

const LENGTHS = [3, 5, 7];
const SEG_W = 36;
const SEG_GAP = 4;

function LengthPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [flip, setFlip] = useState(false);
  const index = Math.max(0, LENGTHS.indexOf(value));
  return (
    <div className="relative flex items-center rounded-md bg-canvas p-1" style={{ gap: SEG_GAP }}>
      <span
        aria-hidden
        className="harbor-seg-thumb absolute bottom-1 top-1 rounded-[6px] bg-ink"
        style={{
          left: 4 + index * (SEG_W + SEG_GAP),
          width: SEG_W,
          animation: `${flip ? "harbor-seg-b" : "harbor-seg-a"} 300ms ease-in-out`,
        }}
      />
      {LENGTHS.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => {
            if (n === value) return;
            setFlip((v) => !v);
            onChange(n);
          }}
          style={{ width: SEG_W }}
          className={`relative z-10 h-8 text-[12.5px] font-semibold transition-colors duration-200 ${
            value === n ? "text-canvas" : "text-ink-muted hover:text-ink"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function ThemeTile({
  theme,
  busy,
  disabled,
  onPick,
}: {
  theme: VoyageTheme;
  busy: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const pal = THEME_PALETTE[theme.id] ?? THEME_PALETTE.uncharted;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      className="harbor-tile group relative h-[132px] w-full overflow-hidden rounded-md text-start ring-1 ring-edge-soft hover:shadow-[0_26px_50px_-24px_rgba(0,0,0,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 disabled:pointer-events-none disabled:opacity-70"
      style={{ background: `linear-gradient(150deg, ${pal.from}, ${pal.to})` }}
    >
      {theme.backdrop && (
        <>
          <img
            src={theme.backdrop}
            alt=""
            draggable={false}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            className={`harbor-tile-art absolute inset-0 h-full w-full object-cover object-[center_30%] ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-canvas opacity-[0.45] transition-opacity duration-[340ms] ease-in-out group-hover:opacity-[0.28]"
          />
        </>
      )}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(105deg, color-mix(in oklch, var(--color-canvas), transparent 8%) 0%, color-mix(in oklch, var(--color-canvas), transparent 34%) 40%, color-mix(in oklch, var(--color-canvas), transparent 68%) 66%, transparent 88%)",
        }}
      />
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: "linear-gradient(to top, var(--color-canvas), transparent)" }} />
      <span
        aria-hidden
        className="harbor-tile-keel absolute inset-x-0 bottom-0 h-0.5"
        style={{ background: theme.accent }}
      />
      <span className="absolute inset-x-4 bottom-3.5 flex min-w-0 flex-col gap-0.5">
        <span
          className="harbor-tile-genre text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ "--tile-accent": theme.accent } as CSSProperties}
        >
          {theme.genre ?? "Wildcard"}
        </span>
        <span className="font-display text-[16px] font-medium leading-tight text-ink [text-shadow:0_1px_8px_var(--color-canvas),0_1px_3px_var(--color-canvas)]">{theme.label}</span>
        <span className="line-clamp-1 text-[12px] text-ink-muted [text-shadow:0_1px_6px_var(--color-canvas),0_1px_2px_var(--color-canvas)]">{theme.tagline}</span>
      </span>
      {busy && (
        <span className="absolute inset-0 z-10 grid place-items-center bg-canvas/50">
          <Loader2 size={20} className="animate-spin text-ink motion-reduce:animate-none" />
        </span>
      )}
    </button>
  );
}
