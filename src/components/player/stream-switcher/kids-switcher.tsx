import { Loader2, X } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { useT } from "@/lib/i18n";
import type { ScoredStream } from "@/lib/streams/types";
import { QUALITY_LABEL, qualityKey } from "./quality";
import { isCurrentStream, streamKey } from "./switcher-row";

const BUBBLES = [10, 26, 44, 62, 78, 90];

export function KidsStreamSwitcher({
  list,
  onPick,
  onClose,
  resolvingKey,
  currentUrl,
  currentInfoHash,
  currentFileIdx,
}: {
  list: ScoredStream[];
  onPick: (stream: ScoredStream) => void;
  onClose: () => void;
  resolvingKey: string | null;
  currentUrl: string;
  currentInfoHash?: string | null;
  currentFileIdx?: number | null;
}) {
  const t = useT();
  const options = list.slice(0, 6);

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-[60] flex items-center justify-center overflow-hidden bg-gradient-to-b from-[#3aa6c4]/95 via-[#1c789f]/96 to-[#0a3d5c]/98 px-8 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {BUBBLES.map((left, i) => (
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
        <div className="curfew-bob absolute bottom-[8%] left-[7%]">
          <img
            src="/kids/doodles/liloctored.png"
            alt=""
            draggable={false}
            className="h-20 w-auto opacity-80"
          />
        </div>
        <img
          src="/kids/doodles/lilpurpocto.png"
          alt=""
          draggable={false}
          className="absolute bottom-[7%] right-[8%] h-16 w-auto opacity-70"
        />
      </div>

      <div className="relative flex w-full max-w-[620px] flex-col items-center gap-6 text-center text-white">
        <button
          onClick={onClose}
          aria-label={t("Close")}
          className="absolute -top-1 end-0 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white ring-2 ring-white/30 transition-colors hover:bg-white/25"
        >
          <X size={24} strokeWidth={2.6} />
        </button>

        <h2 className="font-display text-[clamp(30px,5vw,46px)] font-extrabold leading-none tracking-tight drop-shadow-[0_3px_12px_rgba(0,0,0,0.35)]">
          {t("Pick a video")}
        </h2>
        <p className="max-w-md text-[19px] font-bold leading-snug text-white/90">
          {t("Tap one until your show plays nice and clear!")}
        </p>

        {options.length === 0 ? (
          <p className="mt-4 text-[17px] font-bold text-white/85">
            {t("No videos right now. Ask a grown-up!")}
          </p>
        ) : (
          <div className="flex w-full flex-col gap-3.5">
            {options.map((s, i) => {
              const resolving = resolvingKey === streamKey(s);
              const isCurrent = isCurrentStream(s, currentUrl, currentInfoHash, currentFileIdx);
              const quality = QUALITY_LABEL[qualityKey(s)];
              return (
                <button
                  key={`${s.addonId}-${s.infoHash ?? s.url ?? i}`}
                  type="button"
                  onClick={() => onPick(s)}
                  disabled={resolving}
                  className={`flex h-[76px] w-full items-center gap-4 rounded-3xl px-5 text-start transition-transform duration-150 active:scale-[0.98] disabled:cursor-default ${
                    isCurrent
                      ? "bg-white text-[#0c4a6e] ring-4 ring-white/60"
                      : "bg-white/15 text-white ring-2 ring-white/25 hover:bg-white/25 hover:scale-[1.02]"
                  }`}
                >
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[22px] font-extrabold ${
                      isCurrent ? "bg-[#1f8f88] text-white" : "bg-white/25 text-white"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[20px] font-extrabold leading-tight">
                      {isCurrent ? t("Playing now") : t("Video {n}", { n: i + 1 })}
                    </span>
                    {quality && (
                      <span className={`text-[14px] font-bold ${isCurrent ? "text-[#0c4a6e]/70" : "text-white/70"}`}>
                        {quality}
                      </span>
                    )}
                  </span>
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                      isCurrent ? "bg-[#1f8f88] text-white" : "bg-white/20 text-white"
                    }`}
                  >
                    {resolving ? (
                      <Loader2 size={24} strokeWidth={2.6} className="animate-spin" />
                    ) : (
                      <Play size={24} strokeWidth={0} fill="currentColor" className="ms-0.5" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
