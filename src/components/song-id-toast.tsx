import { useSettings } from "@/lib/settings";
import { onSongIdToast, type SongIdToastMsg } from "@/lib/song-id";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ArrowUpRight, Music } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type SongCardStyle = "compact" | "cinematic";

export function SongIdToast() {
  const { settings } = useSettings();
  const style = (settings.songCardStyle ?? "cinematic") as SongCardStyle;
  const showDetails = settings.songCardDetails ?? true;

  const [msg, setMsg] = useState<SongIdToastMsg | null>(null);
  const [enter, setEnter] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const off = onSongIdToast((t) => {
      setMsg(t);
      if (timer.current) window.clearTimeout(timer.current);
      if (t.kind !== "info") {
        timer.current = window.setTimeout(() => setMsg(null), 12000);
      }
    });
    return () => {
      off();
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (!msg) {
      setEnter(false);
      return;
    }
    setEnter(false);
    const id = requestAnimationFrame(() => setEnter(true));
    return () => cancelAnimationFrame(id);
  }, [msg]);

  if (!msg || !settings.songIdEnabled) return null;

  const listening = msg.kind === "info";
  const isResult = msg.kind === "result";
  const body = showDetails ? msg.body : undefined;

  const open = () => {
    if (msg.href) openUrl(msg.href).catch((e) => console.error("open failed", e));
  };

  const anim = [
    "origin-top transition-all duration-500 ease-out",
    enter ? "scale-100 opacity-100" : "scale-90 opacity-0",
    isResult ? "pointer-events-auto cursor-pointer hover:ring-white/25" : "",
  ].join(" ");

  return (
    <div className="pointer-events-none absolute left-1/2 top-8 z-30 flex -translate-x-1/2 flex-col items-center gap-3">
      <span className="rounded-full bg-black/70 px-4 py-1.5 text-sm font-semibold text-white/90 shadow-lg backdrop-blur">
        ▶ Now Playing
      </span>

      {style === "compact" ? (
        <div
          role={isResult ? "button" : undefined}
          onClick={isResult ? open : undefined}
          className={[
            "group flex items-center gap-4 rounded-3xl bg-black/85 p-4 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-xl",
            isResult ? "w-[min(88vw,440px)]" : "w-[min(80vw,340px)]",
            anim,
          ].join(" ")}
        >
          <Vinyl art={msg.art} size="h-20 w-20" listening={listening} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-lg font-semibold leading-tight">{msg.title}</span>
            {body ? <span className="truncate text-sm text-white/65">{body}</span> : null}
            {isResult ? (
              <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-white/85 transition-colors group-hover:bg-white/16 group-hover:text-white">
                Open on YouTube
                <ArrowUpRight size={13} strokeWidth={2.4} />
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div
          role={isResult ? "button" : undefined}
          onClick={isResult ? open : undefined}
          className={[
            "group flex flex-col items-center gap-4 rounded-3xl bg-black/90 p-6 text-center text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-xl",
            isResult ? "w-[min(82vw,360px)]" : "w-[min(80vw,320px)]",
            anim,
          ].join(" ")}
        >
          <Vinyl art={msg.art} size={isResult ? "h-44 w-44" : "h-32 w-32"} listening={listening} />
          <div className="flex w-full min-w-0 flex-col items-center gap-1">
            <span className="truncate text-xl font-bold leading-tight">{msg.title}</span>
            {body ? <span className="truncate text-sm text-white/65">{body}</span> : null}
            {isResult ? (
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-[13px] font-semibold text-white/85 transition-colors group-hover:bg-white/16 group-hover:text-white">
                Open on YouTube
                <ArrowUpRight size={15} strokeWidth={2.4} />
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function Vinyl({ art, size, listening }: { art?: string; size: string; listening: boolean }) {
  return (
    <div className={`relative flex-none ${size}`}>
      <div className="absolute inset-0 flex animate-spin items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-neutral-700 via-neutral-900 to-black [animation-duration:6s]">
        <div className="pointer-events-none absolute inset-[6%] rounded-full ring-1 ring-white/5" />
        <div className="pointer-events-none absolute inset-[12%] rounded-full ring-1 ring-white/5" />
        {art ? (
          <img src={art} alt="" className="h-2/3 w-2/3 rounded-full object-cover" />
        ) : (
          <div className="flex h-2/3 w-2/3 items-center justify-center rounded-full bg-white/10">
            <Music size={28} strokeWidth={1.8} className={listening ? "animate-pulse" : undefined} />
          </div>
        )}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black ring-2 ring-white/40" />
      </div>
    </div>
  );
}
