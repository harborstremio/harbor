import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import streemur from "@/assets/streemur.png";
import stremioWordmark from "@/assets/stremio-wordmark.png";
import { useBpT } from "../bp-i18n";

const IMG = "https://image.tmdb.org/t/p/w342";

const WALL = [
  "/iPOn6DinuVyLY17YM9mKuPofV08.jpg",
  "/7V0Ebks0GgpKvQ7QbLAIdX5dos4.jpg",
  "/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg",
];

function BpAside({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.querySelector<HTMLElement>("[data-bp-onboard-aside]"));
  }, []);
  if (!host) return null;
  return createPortal(children, host);
}

export function BpStremioShowcase() {
  const t = useBpT();

  return (
    <BpAside>
      <div
        aria-hidden
        className="pointer-events-none mt-auto flex w-full max-w-full flex-col gap-[clamp(14px,2vh,30px)] pb-[clamp(20px,3vh,50px)] [animation:bp-rise_var(--bp-dur-slow)_var(--bp-ease)_both] motion-reduce:[animation:none]"
      >
        <img
          src={stremioWordmark}
          alt=""
          draggable={false}
          className="h-[clamp(30px,4vh,56px)] w-auto select-none self-start opacity-45"
          style={{ filter: "invert(1) grayscale(1) brightness(1.1)" }}
        />

        <div className="relative flex max-w-full items-end gap-[clamp(7px,0.8vw,15px)] overflow-hidden ps-[clamp(58px,6.6vw,120px)] pb-[clamp(18px,2.5vh,38px)] pe-[clamp(6px,0.8vw,14px)]">
          {WALL.map((path, i) => (
            <span
              key={path}
              className="block shrink-0 overflow-hidden rounded-[var(--bp-r-sm)] bg-[var(--bp-panel-2)] ring-1 ring-[var(--bp-edge)]"
              style={{
                width: "clamp(46px, 5.2vw, 88px)",
                aspectRatio: "2 / 3",
                transform: `translateY(${Math.abs(i - 1) * 5}px) rotate(${(i - 1) * 1.5}deg)`,
                opacity: 0.78,
              }}
            >
              <img
                src={`${IMG}${path}`}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </span>
          ))}
          <img
            src={streemur}
            alt=""
            className="absolute bottom-0 start-0 h-[clamp(104px,13.5vh,190px)] w-auto object-contain"
          />
        </div>

        <div className="flex max-w-[40ch] items-start gap-[clamp(8px,0.8vw,14px)]">
          <span className="mt-[0.5em] h-[2px] w-[clamp(14px,1.4vw,26px)] shrink-0 rounded-full bg-[var(--bp-edge-2)]" />
          <span className="text-[clamp(9.5px,1.25vh,14px)] font-medium leading-relaxed text-ink-subtle">
            {t("Harbor is an independent client. It is not affiliated with or endorsed by Stremio.")}
          </span>
        </div>
      </div>
    </BpAside>
  );
}
