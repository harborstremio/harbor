import { useState } from "react";
import { useBpT } from "../bp-i18n";
import type { BpPlayback } from "./use-bp-playback";

function episodeLine(playback: BpPlayback): string | null {
  const ep = playback.episode;
  if (!ep) return null;
  const code = `S${ep.season} E${String(ep.episode).padStart(2, "0")}`;
  return ep.name ? `${code} · ${ep.name}` : code;
}

function sourceLine(playback: BpPlayback): string | null {
  const s = playback.source;
  if (!s) return null;
  const parts = [s.resolution, s.quality, s.releaseGroup].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Loud then quiet. The clear logo is the subject at ten feet and everything
 * under it recedes, so the metadata line is genuinely small and dim rather than
 * a second heading competing with it.
 */
export function BpPlayerIdentity({ playback }: { playback: BpPlayback }) {
  const t = useBpT();
  const [logoFailed, setLogoFailed] = useState(false);
  const logo = logoFailed ? null : playback.logoUrl;
  const episode = episodeLine(playback);
  const source = sourceLine(playback);
  const quiet = [episode, source].filter(Boolean) as string[];

  return (
    <div className="flex min-w-0 max-w-[min(58ch,62vw)] flex-col gap-[clamp(5px,0.7vh,11px)]">
      {logo ? (
        <img
          src={logo}
          alt={playback.title}
          onError={() => setLogoFailed(true)}
          className="max-h-[clamp(44px,7.4vh,104px)] w-auto max-w-full self-start object-contain object-left drop-shadow-[0_4px_18px_rgba(0,0,0,0.75)]"
        />
      ) : (
        <h2 className="line-clamp-2 font-display text-[clamp(22px,3.4vh,46px)] font-semibold leading-[1.05] tracking-[-0.02em] text-ink">
          {playback.title || t("Now playing")}
        </h2>
      )}
      {quiet.length > 0 && (
        <p className="line-clamp-1 text-[clamp(12px,1.6vh,18px)] font-medium text-ink-subtle">
          {quiet.join("  ·  ")}
        </p>
      )}
      {playback.casting && (
        <p className="text-[clamp(10.5px,1.4vh,16px)] font-bold uppercase tracking-[0.16em] text-ink-muted">
          {t("Casting")}
        </p>
      )}
    </div>
  );
}
