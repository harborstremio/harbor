import { useMemo } from "react";
import { getUpvotedIds } from "@/lib/feed/preferences";
import { useSettings } from "@/lib/settings";
import { BpOnboardAside } from "./bp-onboard-aside";
import { useBpTasteTitles } from "./use-bp-taste-titles";

const IMG = "https://image.tmdb.org/t/p/w342";

const FALLBACK = [
  "/rzpHPSEgPTpRs8EHbygwsOw7jC0.jpg",
  "/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg",
  "/iPOn6DinuVyLY17YM9mKuPofV08.jpg",
  "/7V0Ebks0GgpKvQ7QbLAIdX5dos4.jpg",
  "/sfQtVlIHljToOwYjhe21KPGzZWK.jpg",
];

export function BpDoneFlourish() {
  const { settings } = useSettings();
  const items = useBpTasteTitles(settings.tmdbKey);

  // Their own five, not a stock fan. The last thing this flow says should be
  // made of what the person just chose.
  const art = useMemo(() => {
    const picked = getUpvotedIds();
    const mine = (items ?? []).filter((m) => picked.has(m.id) && m.poster).slice(0, 5);
    if (mine.length > 0) return mine.map((m) => m.poster as string);
    return FALLBACK.map((p) => `${IMG}${p}`);
  }, [items]);

  return (
    <BpOnboardAside>
      <div className="flex items-end pb-[clamp(14px,1.9vh,30px)]">
        {art.map((src, i) => {
          const off = i - (art.length - 1) / 2;
          return (
            <span
              key={`${src}-${i}`}
              className="block shrink-0 overflow-hidden rounded-[var(--bp-r-md)] bg-[var(--bp-panel-2)] ring-1 ring-[var(--bp-edge)] [animation:bp-done-deal_var(--bp-dur-slow)_var(--bp-ease)_both] motion-reduce:[animation:none]"
              style={{
                width: "clamp(58px, 6.6vw, 112px)",
                aspectRatio: "2 / 3",
                marginInlineStart: i === 0 ? 0 : "-11%",
                transform: `translateY(${Math.abs(off) * 7}px) rotate(${off * 5}deg)`,
                transformOrigin: "50% 100%",
                animationDelay: `${i * 80}ms`,
                zIndex: art.length - Math.abs(off),
                boxShadow: "0 18px 40px -14px rgba(0,0,0,0.9)",
              }}
            >
              <img
                src={src}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </span>
          );
        })}

        <span
          className="relative z-20 flex shrink-0 items-center justify-center self-end rounded-full ring-[3px] ring-[var(--bp-page)] [animation:bp-enter_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
          style={{
            width: "clamp(38px, 4.6vh, 64px)",
            height: "clamp(38px, 4.6vh, 64px)",
            background: "color-mix(in oklab, var(--bp-live) 26%, var(--bp-void))",
            animationDelay: "480ms",
            marginInlineStart: "-7%",
            marginBottom: "-2%",
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-[52%] w-[52%]">
            <path
              d="M5 12.5 L10 17.5 L19 7"
              stroke="var(--bp-live)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              className="[animation:bp-done-check_520ms_var(--bp-ease)_both] motion-reduce:[animation:none]"
              style={{ strokeDasharray: 1, animationDelay: "560ms" }}
            />
          </svg>
        </span>
      </div>
    </BpOnboardAside>
  );
}
