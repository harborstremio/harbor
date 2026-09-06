import { ArrowUpRight, Music } from "@/views/settings/icons";
import { useT } from "@/lib/i18n";
import type { SongIdToastMsg } from "@/lib/song-id";

export type SongCardStyle = "compact" | "cinematic";

export function SongIdCard({
  message, style, showDetails, onOpen, className = "", animateArtwork = true,
}: {
  message: SongIdToastMsg;
  style: SongCardStyle;
  showDetails: boolean;
  onOpen?: () => void;
  className?: string;
  animateArtwork?: boolean;
}) {
  const t = useT();
  const compact = style === "compact";
  const listening = message.kind === "info";
  const isResult = message.kind === "result";
  const isError = message.kind === "error";
  const interactive = isResult && !!onOpen;
  const body = isError || showDetails ? message.body : undefined;
  const width = compact
    ? isResult ? "w-[min(88vw,440px)]" : "w-[min(80vw,340px)]"
    : isResult ? "w-[min(82vw,360px)]" : "w-[min(80vw,320px)]";

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onOpen : undefined}
      onKeyDown={interactive ? (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        onOpen?.();
      } : undefined}
      className={[
        "group flex items-center gap-4 rounded-3xl text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-xl",
        compact ? "bg-black/85 p-4" : "flex-col bg-black/90 p-6 text-center",
        interactive ? "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white" : "",
        width, className,
      ].join(" ")}
    >
      <Vinyl
        art={message.art}
        size={compact ? "h-20 w-20" : isResult ? "h-44 w-44" : "h-32 w-32"}
        listening={listening}
        animate={animateArtwork}
      />
      <div className={`flex min-w-0 flex-col gap-1 ${compact ? "flex-1" : "w-full items-center"}`}>
        <span className={`max-w-full truncate leading-tight ${compact ? "text-lg font-semibold" : "text-xl font-bold"}`}>
          {message.title}
        </span>
        {body && <span className={isError ? "text-[13px] leading-snug text-white/70" : "max-w-full truncate text-sm text-white/65"}>{body}</span>}
        {isResult && (
          <span className={`inline-flex w-fit items-center rounded-full bg-white/10 font-semibold text-white/85 transition-colors group-hover:bg-white/16 group-hover:text-white ${compact ? "mt-1 gap-1 px-3 py-1 text-[12px]" : "mt-2 gap-1.5 px-4 py-2 text-[13px]"}`}>
            {t("Open on YouTube")}
            <ArrowUpRight size={compact ? 13 : 15} strokeWidth={2.4} />
          </span>
        )}
      </div>
    </div>
  );
}

function Vinyl({ art, size, listening, animate }: { art?: string; size: string; listening: boolean; animate: boolean }) {
  return (
    <div className={`relative flex-none ${size}`}>
      <div className={`absolute inset-0 flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-neutral-700 via-neutral-900 to-black ${animate ? "motion-safe:animate-spin [animation-duration:6s]" : ""}`}>
        <div className="pointer-events-none absolute inset-[6%] rounded-full ring-1 ring-white/5" />
        <div className="pointer-events-none absolute inset-[12%] rounded-full ring-1 ring-white/5" />
        {art ? (
          <img src={art} alt="" draggable={false} className="h-2/3 w-2/3 rounded-full object-cover" />
        ) : (
          <div className="flex h-2/3 w-2/3 items-center justify-center rounded-full bg-white/10">
            <Music size={28} strokeWidth={1.8} className={listening && animate ? "motion-safe:animate-pulse" : undefined} />
          </div>
        )}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black ring-2 ring-white/40" />
      </div>
    </div>
  );
}
