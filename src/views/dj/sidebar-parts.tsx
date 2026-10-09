import { useEffect, useRef } from "react";
import { useT } from "@/lib/i18n";
import type { MusicTrack } from "@/lib/music/types";
import type { DeckSample } from "./deck-store";
import { samplePeaks } from "./sample-audio";

const COLUMNS = 56;
const WIDTH = 168;
const HEIGHT = 24;

export function Waveform({ sample }: { sample: DeckSample }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    void samplePeaks(sample, COLUMNS)
      .then((shape) => {
        const node = canvas.current;
        if (!live || !node) return;
        const paint = node.getContext("2d");
        if (!paint) return;
        const tone = getComputedStyle(node).getPropertyValue("--dj-cyan").trim() || "#3ab8ff";
        paint.clearRect(0, 0, WIDTH, HEIGHT);
        paint.fillStyle = tone;
        paint.globalAlpha = 0.68;
        const step = WIDTH / shape.length;
        const bar = Math.max(1, step - 1.2);
        for (let index = 0; index < shape.length; index += 1) {
          const tall = Math.max(1.5, shape[index] * (HEIGHT - 2));
          paint.fillRect(index * step, (HEIGHT - tall) / 2, bar, tall);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [sample]);
  return (
    <canvas
      ref={canvas}
      className="dj-browser-wave"
      width={WIDTH}
      height={HEIGHT}
      aria-hidden="true"
    />
  );
}

export function UpNext({ tracks }: { tracks: MusicTrack[] }) {
  const t = useT();
  return (
    <section className="dj-browser-part dj-browser-next">
      <h3>{t("dj.upNext")}</h3>
      {tracks.length === 0 ? (
        <p className="dj-browser-blank">{t("dj.queueEmpty")}</p>
      ) : (
        <ol className="dj-browser-queue">
          {tracks.map((item, index) => (
            <li key={`${item.id}:${index}`}>
              <span className="dj-browser-step">{String(index + 1).padStart(2, "0")}</span>
              {item.artwork ? (
                <img src={item.artwork} alt="" draggable={false} />
              ) : (
                <span className="dj-browser-art" aria-hidden="true" />
              )}
              <span className="dj-browser-copy">
                <strong>{item.title}</strong>
                <small>{item.artist}</small>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
