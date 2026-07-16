import { useEffect, useState } from "react";
import { HarborLoader } from "@/components/harbor-loader";
import type { Meta } from "@/lib/cinemeta";
import { consumeRecentStubEvent } from "@/lib/dead-streams";
import { useT } from "@/lib/i18n";
import { useActiveKid } from "@/lib/profiles";
import { type PlayEpisode } from "@/lib/view";
import { Topbar } from "@/chrome/topbar";
import { LoaderLogoOrText } from "../player/loader-logo-or-text";

export function AutoPlayTransition({
  meta,
  episode,
  resolving,
  attemptIdx,
  onCancel,
  download = false,
}: {
  meta: Meta;
  episode?: PlayEpisode;
  resolving: boolean;
  attemptIdx?: number;
  onCancel: () => void;
  download?: boolean;
}) {
  void resolving;
  const t = useT();
  const kid = useActiveKid();
  const backdrop = episode?.still || meta.background || meta.poster;
  const [stubNotice, setStubNotice] = useState<string | null>(null);
  useEffect(() => {
    const ev = consumeRecentStubEvent(8000);
    if (!ev) return;
    setStubNotice("Last source wasn't actually cached on your debrid yet. Trying another.");
    const t = window.setTimeout(() => setStubNotice(null), 6000);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <main
      data-tv-focus-scope
      className={`fixed inset-0 z-[120] overflow-hidden ${kid ? "bg-[#0c4a6e]" : "bg-black"}`}
    >
      <Topbar connecting />
      {backdrop && (
        <img
          src={backdrop}
          alt=""
          aria-hidden
          className={`absolute inset-0 h-full w-full object-cover saturate-150 ${
            kid ? "opacity-20 blur-[36px]" : "opacity-40 blur-[28px]"
          }`}
        />
      )}
      <div
        className={`absolute inset-0 ${
          kid
            ? "bg-gradient-to-b from-[#3aa6c4]/85 via-[#1c789f]/88 to-[#0a3d5c]/94"
            : "bg-gradient-to-b from-black/65 via-black/55 to-black/85"
        }`}
      />
      {kid && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {[8, 22, 38, 55, 70, 84, 93].map((left, i) => (
            <span
              key={i}
              className="curfew-bubble absolute bottom-0 rounded-full bg-white/25"
              style={{
                left: `${left}%`,
                width: 12 + (i % 3) * 6,
                height: 12 + (i % 3) * 6,
                animationDelay: `-${(1 + ((i * 1.7) % 6)).toFixed(1)}s`,
                animationDuration: `${6 + (i % 4)}s`,
              }}
            />
          ))}
          <div className="curfew-bob absolute bottom-[14%] left-[10%]">
            <img
              src="/kids/doodles/liloctored.png"
              alt=""
              draggable={false}
              className="h-24 w-auto opacity-85"
            />
          </div>
          <img
            src="/kids/doodles/lilpurpocto.png"
            alt=""
            draggable={false}
            className="absolute bottom-[12%] right-[12%] h-20 w-auto opacity-75"
          />
          <img
            src="/kids/doodles/lilorangestar2.png"
            alt=""
            draggable={false}
            className="absolute right-[18%] top-[18%] h-10 w-auto opacity-90"
          />
        </div>
      )}
      <div className="relative flex h-full flex-col items-center justify-center gap-7 px-8 text-center">
        <LoaderLogoOrText logo={meta.logo ?? null} fallbackText={meta.name} />
        {episode && (
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.32em] text-white/70">
            S{episode.imdbSeason ?? episode.season} · E
            {String(episode.imdbEpisode ?? episode.episode).padStart(2, "0")}
            {episode.name ? ` · ${episode.name}` : ""}
          </p>
        )}
        <HarborLoader
          size="md"
          caption={
            download
              ? t("Preparing download")
              : attemptIdx && attemptIdx > 0
                ? `${t("Trying source")} ${attemptIdx + 1}`
                : t("Selecting best source")
          }
        />
        {stubNotice && (
          <p className="max-w-md text-[13px] leading-relaxed text-amber-200/80">{stubNotice}</p>
        )}
      </div>
      <button
        onClick={onCancel}
        data-tv-modal-close
        className="absolute bottom-10 left-1/2 z-10 flex h-11 -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-black/45 px-6 text-[13.5px] font-medium text-white/75 backdrop-blur-md transition-colors hover:border-white/30 hover:bg-black/60 hover:text-white"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M3.5 3.5l7 7M10.5 3.5l-7 7"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
        {t("Cancel")}
      </button>
    </main>
  );
}
