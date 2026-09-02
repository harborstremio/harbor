import { BpOnboardAside } from "./bp-onboard-aside";

const IMG = "https://image.tmdb.org/t/p/w342";
const HERO = "https://image.tmdb.org/t/p/w780/eGX66zonvc4bXg3rM08RUxdYSDx.jpg";

const TILES = [
  "/iPOn6DinuVyLY17YM9mKuPofV08.jpg",
  "/7V0Ebks0GgpKvQ7QbLAIdX5dos4.jpg",
  "/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg",
  "/rzpHPSEgPTpRs8EHbygwsOw7jC0.jpg",
  "/sfQtVlIHljToOwYjhe21KPGzZWK.jpg",
];

function Poster({ path, w }: { path: string; w: string }) {
  return (
    <span
      className="block shrink-0 overflow-hidden rounded-[3px] bg-[var(--bp-panel-2)]"
      style={{ width: w, aspectRatio: "2 / 3" }}
    >
      <img src={`${IMG}${path}`} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
    </span>
  );
}

function Frame({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <div
      className="flex flex-1 flex-col gap-[clamp(4px,0.6vh,8px)] overflow-hidden rounded-[var(--bp-r-sm)] bg-[var(--bp-panel)] p-[clamp(5px,0.7vh,10px)] transition-opacity duration-[var(--bp-dur)] ease-[var(--bp-ease)] motion-reduce:transition-none"
      style={{ opacity: on ? 1 : 0.34, outline: on ? "2px solid var(--bp-focus-stroke)" : "none" }}
    >
      {children}
    </div>
  );
}

export function BpLayoutPreview({ mode }: { mode: "harbor" | "classic" }) {
  const w = "clamp(20px, 2.4vw, 40px)";

  return (
    <BpOnboardAside>
      <div className="flex items-stretch gap-[clamp(10px,1.1vw,20px)]">
        <Frame on={mode === "harbor"}>
          <span
            className="relative block w-full overflow-hidden rounded-[3px] bg-[var(--bp-panel-2)]"
            style={{ aspectRatio: "16 / 7" }}
          >
            <img src={HERO} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            <span
              className="absolute inset-0"
              style={{ background: "linear-gradient(0deg, var(--bp-void) 6%, transparent 62%)" }}
            />
            <span className="absolute bottom-[9%] start-[7%] h-[13%] w-[38%] rounded-[2px] bg-ink/85" />
          </span>
          <div className="flex gap-[clamp(3px,0.4vw,6px)]">
            {TILES.slice(0, 4).map((p) => (
              <Poster key={p} path={p} w={w} />
            ))}
          </div>
        </Frame>

        <Frame on={mode === "classic"}>
          <span className="h-[clamp(4px,0.5vh,7px)] w-[42%] rounded-full bg-ink/45" />
          <div className="flex gap-[clamp(3px,0.4vw,6px)]">
            {TILES.slice(0, 4).map((p) => (
              <Poster key={p} path={p} w={w} />
            ))}
          </div>
          <span className="mt-[clamp(2px,0.3vh,5px)] h-[clamp(4px,0.5vh,7px)] w-[32%] rounded-full bg-ink/45" />
          <div className="flex gap-[clamp(3px,0.4vw,6px)]">
            {TILES.slice(1, 5).map((p) => (
              <Poster key={p} path={p} w={w} />
            ))}
          </div>
        </Frame>
      </div>
    </BpOnboardAside>
  );
}
