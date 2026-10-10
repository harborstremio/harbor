import { useEffect, useMemo, useRef, useState } from "react";
import { isAndroidTv } from "@/lib/platform";
import { hubLeague } from "@/lib/sports/hub-data";
import { useSportsArtwork } from "@/views/sports/use-artwork";
import { bpPushLayer, useBpPrune, type BpLayer } from "../bp-ambient-layers";
import { useBpDecorMotion } from "../bp-decor-motion";
import { bpSportsScenery } from "./bp-sports-art";
import type { BpSportsSubject } from "./bp-sports-types";

const SETTLE_MS = 200;

const ENVELOPE =
  "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.14) 22%, rgba(0,0,0,0.48) 48%, rgba(0,0,0,0.88) 70%, black 84%)";

const SCENERY_VEIL =
  "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.35) 24%, rgba(0,0,0,0.82) 50%, black 70%)";

const VERT_FADE =
  "linear-gradient(to bottom, color-mix(in oklab, var(--bp-void) 82%, transparent) 0%, transparent 27%, color-mix(in oklab, var(--bp-page) 30%, transparent) 42%, color-mix(in oklab, var(--bp-page) 74%, transparent) 58%, var(--bp-page) 74%, var(--bp-page) 100%)";

const LEFT_VOID =
  "radial-gradient(150% 120% at 6% 40%, var(--bp-void) 0%, color-mix(in oklab, var(--bp-void) 52%, transparent) 40%, transparent 72%)";

const SCRIM = `${VERT_FADE}, ${LEFT_VOID}`;

const DRIFT =
  "[animation:bp-kenburns_14s_cubic-bezier(0.22,1,0.36,1)_900ms_forwards] motion-reduce:[animation:none]";

const ART_OPACITY = 0.7;
const SCENERY_OPACITY = 0.58;
const SCENERY_CROP = "scale(1.14)";
const SCENERY_TONE = "saturate(0.72) brightness(0.86)";
const SCENERY_SOFT = `${SCENERY_TONE} blur(4px)`;

function useSettledSubject(subject: BpSportsSubject): BpSportsSubject {
  const [settled, setSettled] = useState(subject);
  const key = `${subject.game?.id ?? ""}:${subject.group}`;
  const live = useRef(subject);
  live.current = subject;

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(live.current), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [key]);

  return settled;
}

export function BpSportsBackdrop({ subject }: { subject: BpSportsSubject }) {
  const settled = useSettledSubject(subject);
  const game = settled.game;
  const art = useSportsArtwork(game ?? undefined);
  const decor = useBpDecorMotion();
  const group = (game ? hubLeague(game.league)?.group : "") || settled.group;
  const scenery = bpSportsScenery(group);
  const gameScenery = group === "esports" ? bpSportsScenery(group, game?.league) : "";

  const candidates = useMemo(() => {
    const list = [
      gameScenery,
      game?.artwork ?? "",
      game?.poster ?? "",
      art.backdrop ?? "",
      scenery,
    ].filter((src) => src.length > 0);
    return [...new Set(list)];
  }, [gameScenery, game?.artwork, game?.poster, art.backdrop, scenery]);

  const [layers, setLayers] = useState<BpLayer[]>([]);
  const scenerySrcs = useRef(new Set<string>());
  const seq = useRef(0);
  const committedFor = useRef("");
  const committedSrc = useRef("");
  const key = `${game?.id ?? ""}:${group}`;

  useEffect(() => {
    if (candidates.length === 0) return;
    const held =
      committedFor.current === key && committedSrc.current
        ? candidates.indexOf(committedSrc.current)
        : -1;
    const limit = held < 0 ? candidates.length : held;
    if (limit <= 0) return;
    let alive = true;
    let pending: HTMLImageElement | null = null;

    const walk = (i: number) => {
      if (!alive) return;
      if (i >= limit) return;
      const src = candidates[i];
      const img = new Image();
      pending = img;
      img.decoding = "async";
      let settledOnce = false;
      const commit = () => {
        if (!alive || settledOnce) return;
        settledOnce = true;
        committedFor.current = key;
        committedSrc.current = src;
        if (src === scenery || src === gameScenery) scenerySrcs.current.add(src);
        seq.current += 1;
        setLayers((prev) => bpPushLayer(prev, { src, id: seq.current }));
      };
      const next = () => {
        if (!alive || settledOnce) return;
        settledOnce = true;
        walk(i + 1);
      };
      img.onerror = next;
      img.src = src;
      void img.decode().then(commit, next);
    };

    walk(0);
    return () => {
      alive = false;
      if (!pending) return;
      pending.onerror = null;
      pending.src = "";
      pending = null;
    };
  }, [candidates, key, scenery, gameScenery]);

  useBpPrune(layers, setLayers);

  const soft = !isAndroidTv();

  return (
    <div
      aria-hidden
      data-bp-sports-backdrop
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[var(--bp-page)]"
    >
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ maskImage: ENVELOPE, WebkitMaskImage: ENVELOPE }}
      >
        <div
          data-bp-xfade
          className="absolute inset-0 transition-opacity duration-[520ms] ease-[var(--bp-ease)] motion-reduce:transition-none"
          style={{ opacity: layers.length > 0 ? 1 : 0 }}
        >
          {layers.map((l, i) => {
            const top = i === layers.length - 1;
            const dim = scenerySrcs.current.has(l.src);
            return (
              <img
                key={l.id}
                data-bp-xfade
                src={l.src}
                alt=""
                decoding="async"
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[480ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none ${
                  decor && !dim ? DRIFT : ""
                }`}
                style={{
                  opacity: top ? (dim ? SCENERY_OPACITY : ART_OPACITY) : 0,
                  zIndex: top ? 0 : 1,
                  transform: dim ? SCENERY_CROP : undefined,
                  filter: dim ? (soft ? SCENERY_SOFT : SCENERY_TONE) : undefined,
                  maskImage: dim ? SCENERY_VEIL : undefined,
                  WebkitMaskImage: dim ? SCENERY_VEIL : undefined,
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="absolute inset-0" style={{ background: "var(--bp-scrim-side)" }} />
      <div className="absolute inset-0" style={{ background: SCRIM }} />
    </div>
  );
}
