import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const BACKDROP = "https://image.tmdb.org/t/p/w780/eGX66zonvc4bXg3rM08RUxdYSDx.jpg";
const LOGO = "https://image.tmdb.org/t/p/w300/7gQc9y2EORn9pZhGtAEdlEbpcpz.png";
const FACE = "https://image.tmdb.org/t/p/w185";

const CAST = [
  { path: "/yoQxpUPt3le9zY4Sab3g2ANy4CE.jpg", name: "David Corenswet" },
  { path: "/piB7t3ykZaylYTRoyK46FknyF2p.jpg", name: "Rachel Brosnahan" },
  { path: "/pXm8GWTm9eIA8pUGOjvmYjlxamu.jpg", name: "Nicholas Hoult" },
  { path: "/dt8yMyycDlzxkjhmuuJJ4tXDbp4.jpg", name: "Edi Gathegi" },
];

function BpAside({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.querySelector<HTMLElement>("[data-bp-onboard-aside]"));
  }, []);
  if (!host) return null;
  return createPortal(children, host);
}

export function BpTmdbShowcase() {
  return (
    <BpAside>
      <div
        aria-hidden
        className="pointer-events-none mt-auto flex w-full max-w-full flex-col gap-[clamp(11px,1.5vh,22px)] pb-[clamp(44px,6.4vh,104px)] [animation:bp-rise_var(--bp-dur-slow)_var(--bp-ease)_both] motion-reduce:[animation:none]"
      >
        <div className="relative w-full overflow-hidden rounded-[var(--bp-r-md)] bg-[var(--bp-panel-2)] ring-1 ring-[var(--bp-edge)]">
          <div style={{ aspectRatio: "16 / 9" }}>
            <img
              src={BACKDROP}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(0deg, var(--bp-void) 4%, color-mix(in oklab, var(--bp-void) 62%, transparent) 32%, transparent 68%)",
            }}
          />
          <img
            src={LOGO}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute bottom-[9%] start-[6%] max-h-[34%] w-auto max-w-[58%] object-contain drop-shadow-[0_4px_14px_rgba(0,0,0,0.8)]"
          />
        </div>

        <div className="flex items-center gap-[clamp(6px,0.7vw,12px)]">
          {CAST.map((c) => (
            <span
              key={c.path}
              className="flex min-w-0 flex-1 flex-col items-center gap-[clamp(4px,0.6vh,8px)]"
            >
              <span
                className="block w-full overflow-hidden rounded-[var(--bp-r-sm)] bg-[var(--bp-panel-2)] ring-1 ring-[var(--bp-edge)]"
                style={{ aspectRatio: "1" }}
              >
                <img
                  src={`${FACE}${c.path}`}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </span>
              <span className="w-full truncate text-center text-[clamp(8px,1.05vh,12px)] font-semibold leading-tight text-ink-subtle">
                {c.name}
              </span>
            </span>
          ))}
        </div>
      </div>
    </BpAside>
  );
}
