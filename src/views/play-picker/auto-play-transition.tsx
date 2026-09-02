import { useEffect, useState } from "react";
import { HarborLoader } from "@/components/harbor-loader";
import type { Meta } from "@/lib/cinemeta";
import { consumeRecentStubEvent } from "@/lib/dead-streams";
import { useActiveKid } from "@/lib/profiles";
import { type PlayEpisode } from "@/lib/view";
import { LogoOrText } from "./logo-or-text";
import { useT } from "@/lib/i18n";

const P2P_SEARCHING_DELAY_MS = 6000;
const P2P_SLOW_DELAY_MS = 25000;

export function AutoPlayTransition({
  meta,
  episode,
  resolving,
  p2p = false,
  attemptIdx,
  onCancel,
  download = false,
}: {
  meta: Meta;
  episode?: PlayEpisode;
  resolving: boolean;
  p2p?: boolean;
  attemptIdx?: number;
  onCancel: () => void;
  download?: boolean;
}) {
  const kid = useActiveKid();
  const t = useT();
  const backdrop = episode?.still || meta.background || meta.poster;
  const [stubNotice, setStubNotice] = useState<string | null>(null);
  const [p2pStage, setP2pStage] = useState<0 | 1 | 2>(0);
  useEffect(() => {
    const ev = consumeRecentStubEvent(8000);
    if (!ev) return;
    setStubNotice(t("Last source wasn't actually cached on your debrid yet. Trying another."));
    const timer = window.setTimeout(() => setStubNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [t]);
  useEffect(() => {
    setP2pStage(0);
    if (!resolving || !p2p) return;
    const searchingTimer = window.setTimeout(() => setP2pStage(1), P2P_SEARCHING_DELAY_MS);
    const slowTimer = window.setTimeout(() => setP2pStage(2), P2P_SLOW_DELAY_MS);
    return () => {
      window.clearTimeout(searchingTimer);
      window.clearTimeout(slowTimer);
    };
  }, [attemptIdx, p2p, resolving]);

  const caption = download
    ? t("Preparing download")
    : p2pStage === 2
      ? `P2P · ${t("Stream is taking a while")}`
      : p2pStage === 1
        ? `P2P · ${t("Searching sources…")}`
        : attemptIdx && attemptIdx > 0
          ? t("Trying source {n}", { n: attemptIdx + 1 })
          : t("Connecting");
  return (
    <main className={`harbor-connecting fixed inset-0 z-[120] overflow-hidden ${kid ? "bg-[#0c4a6e]" : "bg-black"}`}>
      <div data-tauri-drag-region className="absolute inset-x-0 top-0 z-20 h-16" />
      {backdrop && (
        <img
          src={backdrop}
          alt=""
          aria-hidden
          className={`harbor-connecting-art absolute inset-0 h-full w-full object-cover saturate-150 ${
            kid ? "opacity-20 blur-[36px]" : "opacity-40 blur-[28px]"
          }`}
        />
      )}
      <div
        className={`harbor-connecting-veil absolute inset-0 ${
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
      <div className="harbor-connecting-body relative flex h-full flex-col items-center justify-center gap-7 px-8 text-center">
        <LogoOrText
          logo={meta.logo ?? null}
          fallbackText={meta.name}
          imgClass="max-h-44 w-auto max-w-[72%] animate-loader-pulse object-contain drop-shadow-[0_24px_60px_rgba(0,0,0,0.65)]"
          textClass="animate-loader-pulse font-display text-[64px] font-medium leading-[0.96] tracking-tight text-white drop-shadow-[0_18px_45px_rgba(0,0,0,0.7)]"
        />
        {episode && (
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.32em] text-white/70">
            S{episode.imdbSeason ?? episode.season} · E
            {String(episode.imdbEpisode ?? episode.episode).padStart(2, "0")}
            {episode.name ? ` · ${episode.name}` : ""}
          </p>
        )}
        <HarborLoader size="md" caption={caption} />
        {p2pStage === 2 && !download && (
          <p className="max-w-md text-[13px] leading-relaxed text-white/60" role="status">
            {t("This source is slow. Try another.")}
          </p>
        )}
        {stubNotice && (
          <p className="max-w-md text-[13px] leading-relaxed text-amber-200/80">{stubNotice}</p>
        )}
      </div>
      <button
        onClick={onCancel}
        className="harbor-connecting-btn absolute bottom-10 left-1/2 z-10 flex h-11 -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full bg-[#34343b] px-6 text-[13.5px] font-medium text-white/85 transition-colors hover:bg-[#41414a]"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M3.5 3.5l7 7M10.5 3.5l-7 7"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
        {p2pStage === 2 && !download ? t("Choose another source") : t("Cancel")}
      </button>
    </main>
  );
}
