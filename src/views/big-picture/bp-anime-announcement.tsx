import type { Announcement } from "@/lib/announcements";
import { bpCardArt, bpViewportWidth } from "./bp-art";

const HERO_W_FRACTION = 0.58;

export function BpAnimeAnnouncement({ announcement }: { announcement: Announcement }) {
  return (
    <section
      aria-label={announcement.title}
      className="relative mx-[var(--bp-gutter)] flex h-[clamp(178px,27vh,340px)] flex-col justify-center gap-[clamp(5px,0.8vh,12px)] overflow-hidden rounded-[var(--bp-r-lg)] bg-[var(--bp-panel)] px-[clamp(16px,1.6vw,32px)]"
    >
      {announcement.hero && (
        <img
          src={bpCardArt(announcement.hero, bpViewportWidth() * HERO_W_FRACTION)}
          alt=""
          className="absolute inset-y-0 end-0 h-full w-[58%] object-cover opacity-70"
        />
      )}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, var(--bp-panel) 34%, color-mix(in oklch, var(--bp-panel), transparent 40%) 62%, transparent 92%)",
        }}
      />
      <div className="relative flex max-w-[min(56%,760px)] flex-col gap-[clamp(4px,0.7vh,11px)]">
        {announcement.label && (
          <span className="w-fit rounded-full border border-[var(--bp-edge-2)] px-[clamp(9px,0.85vw,15px)] py-[3px] text-[clamp(14px,1.9vh,18px)] font-bold uppercase tracking-[0.16em] text-ink-subtle">
            {announcement.label}
          </span>
        )}
        <h1 className="font-display text-[clamp(22px,3.8vh,54px)] font-semibold leading-[1.04] tracking-[-0.025em] text-ink">
          {announcement.title}
        </h1>
        {announcement.intro && (
          <p className="line-clamp-3 text-[clamp(17px,2.4vh,22px)] leading-[1.5] text-ink-subtle">
            {announcement.intro}
          </p>
        )}
      </div>
    </section>
  );
}
