import { memo } from "react";
import { useBpDecorMotion } from "../bp-decor-motion";

const IMG = "https://image.tmdb.org/t/p/w342";

const WALL = [
  "/iPOn6DinuVyLY17YM9mKuPofV08.jpg",
  "/7V0Ebks0GgpKvQ7QbLAIdX5dos4.jpg",
  "/5rhTDKUhPYvpdQIijFIs5VoWsON.jpg",
  "/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg",
  "/sfQtVlIHljToOwYjhe21KPGzZWK.jpg",
  "/rzpHPSEgPTpRs8EHbygwsOw7jC0.jpg",
  "/92Tsfx7SFafOqWsotvrlJbHyehd.jpg",
  "/acYXu4KaDj1NIkMgObnhe4C4a0T.jpg",
  "/1QCWdqzTfh2x9UylVpspIU6QTuM.jpg",
  "/bRwnj8WEKBCvmfeUNOukJPwB43K.jpg",
  "/iofokHZoUB4Qhik4PflvJl8TT6a.jpg",
  "/70kTz0OmjjZe7zHvIDrq2iKW7PJ.jpg",
];

const COLUMNS = [
  { items: [...WALL.slice(0, 3), ...WALL.slice(0, 3)], secs: 110, up: true },
  { items: [...WALL.slice(3, 6), ...WALL.slice(3, 6)], secs: 132, up: false },
];

function BpOnboardBackdropBody() {
  const drift = useBpDecorMotion();
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -inset-y-[18%] end-0 flex w-[min(46%,760px)] gap-[clamp(10px,1vw,20px)] opacity-[0.07]">
        {COLUMNS.map((col, c) => (
          <div
            key={c}
            className="flex flex-1 flex-col gap-[clamp(10px,1vw,20px)]"
            style={{
              animation: drift ? `bp-mosaic-drift ${col.secs}s linear infinite` : undefined,
              animationDirection: col.up ? "normal" : "reverse",
            }}
          >
            {col.items.map((path, i) => (
              <img
                key={`${path}-${i}`}
                src={`${IMG}${path}`}
                alt=""
                loading="lazy"
                decoding="async"
                className="w-full rounded-[var(--bp-r-sm)] object-cover [content-visibility:auto]"
                style={{ aspectRatio: "2 / 3" }}
              />
            ))}
          </div>
        ))}
      </div>

      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(100deg, var(--bp-page) 34%, color-mix(in srgb, var(--bp-page) 88%, transparent) 58%, color-mix(in srgb, var(--bp-page) 62%, transparent) 100%)",
        }}
      />
    </div>
  );
}

export const BpOnboardBackdrop = memo(BpOnboardBackdropBody);
