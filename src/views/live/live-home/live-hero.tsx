import { useEffect, useRef, useState } from "react";
import { usePageVisible } from "@/lib/visibility";
import { RotateCcw, Tv } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import type { IptvChannel } from "@/lib/iptv/types";
import { MultiPlayer } from "@/views/multiview/multi-player";
import { fmtLeft } from "./now-format";
import { hydrationKey, type NowItem } from "./use-live-home";

export function LiveHero({
  items,
  nowMs,
  hydrations,
  onAmbient,
  onPlay,
}: {
  items: NowItem[];
  nowMs: number;
  hydrations: Map<string, Meta | null>;
  onAmbient?: (art: string | null) => void;
  onPlay: (ch: IptvChannel) => void;
}) {
  const t = useT();
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [playing, setPlaying] = useState(false);
  const key = items.map((i) => i.channel.id).join("|");
  const resetRef = useRef(key);
  if (resetRef.current !== key) {
    resetRef.current = key;
    if (idx !== 0) setIdx(0);
  }

  const activeIdx = Math.min(idx, items.length - 1);
  const active = items[activeIdx];
  const hydrated = active ? hydrations.get(hydrationKey(active)) ?? null : null;
  const heroArt = active
    ? hydrated?.background || active.current?.iconUrl || active.channel.logo || null
    : null;

  const pageVisible = usePageVisible();
  useEffect(() => {
    if (paused || playing || items.length < 2 || !pageVisible) return;
    const t = window.setInterval(() => setIdx((i) => (i + 1) % items.length), 9000);
    return () => window.clearInterval(t);
  }, [paused, playing, items.length, pageVisible]);

  useEffect(() => {
    setPlaying(false);
  }, [active?.channel.id]);

  useEffect(() => {
    onAmbient?.(heroArt);
  }, [heroArt, onAmbient]);

  if (!active) return null;
  const { channel, current, progress } = active;
  const left = current ? fmtLeft(current.endMs, nowMs, t) : null;
  const title = current?.title || hydrated?.name || channel.name;
  const meta = [channel.name, channel.group].filter(Boolean).join(" · ");

  return (
    <section
      onClick={() => onPlay(channel)}
      className="group relative h-[420px] min-w-0 flex-1 cursor-pointer overflow-hidden rounded-lg bg-canvas"
      style={{ isolation: "isolate" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {items.map((it, i) => (
        <HeroBackdrop
          key={it.channel.id}
          item={it}
          hydrated={hydrations.get(hydrationKey(it)) ?? null}
          visible={i === activeIdx}
        />
      ))}
      {channel.url && (
        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{ opacity: playing ? 1 : 0 }}
        >
          <MultiPlayer
            key={channel.id}
            url={channel.url}
            muted
            cover
            onPlaying={() => setPlaying(true)}
            onError={() => setPlaying(false)}
          />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/35 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-canvas/65 via-transparent to-transparent" />

      {channel.logo && <ChannelBug logo={channel.logo} />}

      <div
        key={channel.id}
        className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 p-8 pb-7"
        style={{ animation: "harbor-fade-in 420ms cubic-bezier(0.32,0.72,0.24,1) both" }}
      >
        <div className="flex items-center gap-3 text-[13px] font-semibold">
          <span className="flex h-[24px] items-center rounded-md bg-danger px-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
            {t("Live")}
          </span>
          {left && (
            <span className="flex items-center gap-1.5 text-ink">
              <RotateCcw size={14} strokeWidth={2.4} />
              {left}
            </span>
          )}
        </div>
        <h2 className="max-w-[88%] font-display text-[40px] font-semibold leading-[1.04] tracking-tight text-ink line-clamp-2">
          {title}
        </h2>
        {meta && <div className="text-[14px] font-medium text-ink-muted">{meta}</div>}
      </div>

      {progress != null && (
        <div className="absolute inset-x-0 bottom-0 h-[5px] bg-black/35">
          <div className="h-full bg-danger" style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      {items.length > 1 && (
        <div className="absolute end-6 top-6 z-10 flex gap-2">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                setIdx(i);
              }}
              aria-label={t("Spotlight {n}", { n: i + 1 })}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === activeIdx ? "w-8 bg-ink" : "w-4 bg-ink-muted/60 hover:bg-ink-muted"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ChannelBug({ logo }: { logo: string }) {
  const [err, setErr] = useState(false);
  if (err) return null;
  return (
    <div className="absolute start-6 top-6 z-10 flex h-12 items-center rounded-lg bg-canvas/85 px-3 backdrop-blur">
      <img
        src={logo}
        alt=""
        draggable={false}
        onError={() => setErr(true)}
        className="max-h-7 max-w-[92px] object-contain"
      />
    </div>
  );
}

function HeroBackdrop({
  item,
  hydrated,
  visible,
}: {
  item: NowItem;
  hydrated: Meta | null;
  visible: boolean;
}) {
  const [artErr, setArtErr] = useState(false);
  const [logoErr, setLogoErr] = useState(false);
  const backdrop = hydrated?.background || item.current?.iconUrl || null;
  const art = backdrop && !artErr ? backdrop : null;
  const logo = item.channel.logo && !logoErr ? item.channel.logo : null;
  return (
    <div className="absolute inset-0 transition-opacity duration-700" style={{ opacity: visible ? 1 : 0 }}>
      {art ? (
        <img
          src={art}
          alt=""
          draggable={false}
          fetchPriority={visible ? "high" : "low"}
          onError={() => setArtErr(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : logo ? (
        <>
          <img
            src={logo}
            alt=""
            aria-hidden
            draggable={false}
            className="absolute left-1/2 top-1/2 h-[150%] w-[60%] -translate-x-1/2 -translate-y-1/2 object-contain opacity-25 blur-3xl saturate-150"
          />
          <img
            src={logo}
            alt=""
            draggable={false}
            onError={() => setLogoErr(true)}
            className="absolute left-1/2 top-[38%] max-h-[42%] w-[40%] -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
          />
        </>
      ) : (
        <div className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 text-ink-subtle/40">
          <Tv size={110} strokeWidth={1} />
        </div>
      )}
    </div>
  );
}
