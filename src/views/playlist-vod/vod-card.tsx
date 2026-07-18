import { memo, useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { Poster } from "@/components/poster";
import { useSettings } from "@/lib/settings";
import { enrichVod } from "@/lib/iptv/vod-enrich";

type Props = {
  kind: "movie" | "series";
  title: string;
  year: number | null;
  logo: string | null;
  seed: string;
  subtitle?: string;
  onClick: () => void;
};

export const VodCard = memo(function VodCard({
  kind,
  title,
  year,
  logo,
  seed,
  subtitle,
  onClick,
}: Props) {
  const { settings } = useSettings();
  const [poster, setPoster] = useState<string | null>(logo);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setPoster(logo);
    if (!settings.tmdbKey) return;
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        io.disconnect();
        enrichVod(settings.tmdbKey, kind, title, year)
          .then((e) => {
            if (!cancelled && e?.poster) setPoster(e.poster);
          })
          .catch(() => {});
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [settings.tmdbKey, kind, title, year, logo]);

  return (
    <button
      ref={ref}
      onClick={onClick}
      className="group flex w-full min-w-0 flex-col gap-2 text-start"
    >
      <Poster
        src={poster ?? undefined}
        seed={seed}
        className="w-full ring-1 ring-edge-soft/40 transition-transform duration-200 group-hover:scale-[1.03]"
      >
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="absolute inset-0 bg-canvas/35" />
          <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-canvas ring-1 ring-white/15">
            <Play size={20} fill="currentColor" className="ml-0.5 text-ink" />
          </span>
        </div>
      </Poster>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-ink">{title}</p>
        {(subtitle || year) && (
          <p className="truncate text-[11.5px] text-ink-subtle">{subtitle ?? year}</p>
        )}
      </div>
    </button>
  );
});
