import { User } from "lucide-react";
import { NavArrow } from "@/components/nav-arrow";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import type { SearchPerson } from "@/lib/search";
import { useView } from "@/lib/view";

const CARD_WIDTH = 104;
const GAP = 16;

export function PeopleRow({
  people,
  onClose,
  onOpenPerson,
}: {
  people: SearchPerson[];
  onClose: () => void;
  onOpenPerson?: (p: SearchPerson) => void;
}) {
  const { openPerson } = useView();
  const t = useT();
  const withPhotos = people.filter((p) => p.profile);
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ canLeft: false, canRight: false });

  const recompute = useCallback(() => {
    const el = trackRef.current;
    if (!el) {
      setScrollState({ canLeft: false, canRight: false });
      return;
    }
    const maxScroll = el.scrollWidth - el.clientWidth;
    setScrollState({
      canLeft: el.scrollLeft > 4,
      canRight: el.scrollLeft < maxScroll - 4,
    });
  }, []);

  useLayoutEffect(() => {
    recompute();
  }, [withPhotos.length, recompute]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener("scroll", recompute, { passive: true });
    const ro = new ResizeObserver(recompute);
    ro.observe(track);
    return () => {
      track.removeEventListener("scroll", recompute);
      ro.disconnect();
    };
  }, [recompute]);

  const page = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    const step = CARD_WIDTH + GAP;
    const visible = Math.max(1, Math.floor(el.clientWidth / step));
    el.scrollBy({ left: dir * step * visible, behavior: "smooth" });
  };

  if (withPhotos.length === 0) return null;

  return (
    <section>
      <SectionTitle>{t("People")}</SectionTitle>
      <div className="group/people relative">
        <div
          ref={trackRef}
          className="flex overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [scroll-snap-type:x_mandatory]"
          style={{ gap: `${GAP}px` }}
        >
          {withPhotos.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                if (onOpenPerson) {
                  onOpenPerson(p);
                  return;
                }
                openPerson(p.id);
                onClose();
              }}
              className="group flex shrink-0 flex-col items-center gap-2 text-center [scroll-snap-align:start]"
              style={{ width: `${CARD_WIDTH}px` }}
            >
              <div className="relative h-[84px] w-[84px] overflow-hidden rounded-full ring-1 ring-edge-soft transition-all duration-200 group-hover:ring-2 group-hover:ring-ink/40 group-active:scale-[0.97]">
                {p.profile ? (
                  <img
                    src={`https://image.tmdb.org/t/p/h632${p.profile}`}
                    alt={p.name}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.06]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-elevated text-ink-subtle">
                    <User size={36} strokeWidth={1.5} />
                  </div>
                )}
              </div>
              <div className="flex w-full flex-col px-1">
                <span className="truncate text-[13px] font-semibold text-ink">{p.name}</span>
                <span className="truncate text-[11.5px] text-ink-subtle">{p.knownFor}</span>
              </div>
            </button>
          ))}
        </div>
        <ArrowButton side="left" visible={scrollState.canLeft} onClick={() => page(-1)} />
        <ArrowButton side="right" visible={scrollState.canRight} onClick={() => page(1)} />
      </div>
    </section>
  );
}

function ArrowButton({
  side,
  visible,
  onClick,
}: {
  side: "left" | "right";
  visible: boolean;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <NavArrow
      dir={side}
      onClick={onClick}
      label={t(side === "left" ? "Scroll left" : "Scroll right")}
      size={26}
      className={`absolute top-[42px] z-10 h-10 w-10 -translate-y-1/2 ${
        side === "left" ? "start-1" : "end-1"
      } ${
        visible
          ? "opacity-0 group-hover/people:opacity-100 pointer-events-auto"
          : "pointer-events-none opacity-0"
      }`}
    />
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
      {children}
    </h3>
  );
}
