import { anime4kDir, downloadAnime4k } from "@/lib/anime4k";
import { anime4kChain, ANIME4K_MODES, type Anime4kMode, type Anime4kTier } from "@/lib/player/anime4k-modes";
import { useSettings } from "@/lib/settings";
import { Check, Download, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

export function Anime4kShaderList() {
  const { settings, update } = useSettings();
  const folder = settings.playerAnime4kFolder;
  const mode = (settings.playerAnime4kMode as Anime4kMode) || "A";
  const tier = (settings.playerAnime4kTier as Anime4kTier) || "hq";
  const [busy, setBusy] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (folder) return;
    let cancelled = false;
    anime4kDir()
      .then((dir) => {
        if (cancelled || !dir) return;
        update({ playerAnime4kFolder: dir, playerAnime4kShaders: anime4kChain(dir, mode, tier) });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setup = async (force = false) => {
    setBusy(true);
    setError(null);
    setJustUpdated(false);
    try {
      const dir = await downloadAnime4k(force);
      update({ playerAnime4kFolder: dir, playerAnime4kShaders: anime4kChain(dir, mode, tier) });
      if (force) {
        setJustUpdated(true);
        window.setTimeout(() => setJustUpdated(false), 2200);
      }
    } catch (e) {
      setError(typeof e === "string" ? e : "Download failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const pickMode = (m: Anime4kMode) =>
    update({ playerAnime4kMode: m, playerAnime4kShaders: anime4kChain(folder, m, tier) });
  const pickTier = (t: Anime4kTier) =>
    update({ playerAnime4kTier: t, playerAnime4kShaders: anime4kChain(folder, mode, t) });

  return (
    <div
      id="set-anime4k-presets"
      className="scroll-mt-28 flex flex-col gap-3.5 rounded-2xl border border-edge-soft bg-canvas/40 px-4 py-4"
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-[14px] font-semibold text-ink">Anime4K presets</span>
        <span className="text-[12.5px] leading-snug text-ink-subtle">
          GPU shaders that sharpen lines and clean up gradients on anime as it plays. Pick a mode, Harbor handles the
          shaders.
        </span>
      </div>

      {!folder ? (
        <div className="flex flex-col gap-3 rounded-xl border border-edge-soft bg-canvas/50 px-4 py-4">
          <span className="text-[12.5px] leading-snug text-ink-muted">
            One-time setup downloads the shader pack (about 1 MB) into Harbor. No files to hunt down.
          </span>
          {error && (
            <span className="rounded-lg bg-danger/15 px-3 py-2 text-[12px] text-danger ring-1 ring-danger/30">
              {error}
            </span>
          )}
          <button
            type="button"
            onClick={() => setup(false)}
            disabled={busy}
            className="flex h-11 w-fit items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-semibold text-canvas transition-colors hover:bg-ink/90 disabled:cursor-wait disabled:opacity-70"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} strokeWidth={2.2} />}
            {busy ? "Downloading shaders…" : "Set up Anime4K"}
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1 self-start rounded-full bg-elevated/50 p-1 ring-1 ring-edge-soft/60">
            <TierBtn active={tier === "hq"} onClick={() => pickTier("hq")} label="Quality" />
            <TierBtn active={tier === "fast"} onClick={() => pickTier("fast")} label="Performance" />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ANIME4K_MODES.map((m) => {
              const selected = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => pickMode(m.id)}
                  className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 text-start transition-colors ${
                    selected
                      ? "border-ink bg-elevated"
                      : "border-edge-soft bg-canvas/50 hover:border-edge hover:bg-canvas/70"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      selected ? "border-ink" : "border-edge"
                    }`}
                  >
                    {selected && <Check size={12} strokeWidth={3} className="text-ink" />}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[14px] font-semibold text-ink">{m.label}</span>
                    <span className="text-[12px] leading-snug text-ink-subtle">{m.sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-3 pt-0.5">
            <span className="flex items-center gap-1.5 text-[12px] text-ink-subtle">
              <Check size={13} className="text-emerald-300" strokeWidth={2.6} />
              Shaders installed
            </span>
            <button
              type="button"
              onClick={() => setup(true)}
              disabled={busy}
              className={`flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] transition-colors disabled:opacity-70 ${
                justUpdated ? "text-emerald-300" : "text-ink-subtle hover:text-ink"
              }`}
            >
              {busy ? (
                <>
                  <Loader2 size={12} className="animate-spin" strokeWidth={2.6} />
                  Updating…
                </>
              ) : justUpdated ? (
                <>
                  <Check size={12} strokeWidth={3} />
                  Updated
                </>
              ) : (
                <>
                  <RefreshCw size={12} strokeWidth={2.4} />
                  Re-download
                </>
              )}
            </button>
          </div>
          {error && (
            <span className="rounded-lg bg-danger/15 px-3 py-2 text-[12px] text-danger ring-1 ring-danger/30">
              {error}
            </span>
          )}
        </>
      )}
    </div>
  );
}

function TierBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
        active ? "bg-ink text-canvas" : "text-ink-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
