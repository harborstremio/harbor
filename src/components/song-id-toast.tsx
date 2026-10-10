import { useEffect, useRef, useState } from "react";
import { SongIdCard, type SongCardStyle } from "./song-id-card";
import { useT } from "@/lib/i18n";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useSettings } from "@/lib/settings";
import { onSongIdToast, type SongIdToastMsg } from "@/lib/song-id";

export function SongIdToast() {
  const t = useT();
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

  const open = () => {
    if (msg.href) openUrl(msg.href).catch((e) => console.error("open failed", e));
  };

  const anim = [
    "origin-top transition-all duration-500 ease-out motion-reduce:transition-none",
    enter ? "scale-100 opacity-100" : "scale-90 opacity-0",
    msg.kind === "result" ? "pointer-events-auto cursor-pointer hover:ring-white/25" : "",
  ].join(" ");

  return (
    <div className="pointer-events-none absolute left-1/2 top-8 z-30 flex -translate-x-1/2 flex-col items-center gap-3">
      <span className="rounded-full bg-black/70 px-4 py-1.5 text-sm font-semibold text-white/90 shadow-lg backdrop-blur">
        ▶ {t("Now Playing")}
      </span>
      <SongIdCard message={msg} style={style} showDetails={showDetails} onOpen={open} className={anim} />
    </div>
  );
}
