import { Link2 } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { useMemo } from "react";
import { directUrlNotWebReady } from "@/lib/torrent/magnet";
import { useView, type PlayerSrc } from "@/lib/view";
import { useT } from "@/lib/i18n";

export function UrlCard({ raw, onClose }: { raw: string; onClose: () => void }) {
  const t = useT();
  const { openPlayer } = useView();
  const url = raw.trim();
  const fallbackTitle = t("Direct stream");
  const title = useMemo(() => fileTitle(url, fallbackTitle), [url, fallbackTitle]);

  const onPlay = () => {
    const src: PlayerSrc = {
      meta: { id: `url:${url}`, type: "movie", name: title },
      url,
      title,
      notWebReady: directUrlNotWebReady(url),
    };
    onClose();
    openPlayer(src);
  };

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-accent/40 bg-accent/10 px-5 py-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
        <Link2 size={22} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
          {t("Direct link")}
        </span>
        <span className="truncate text-[15px] font-semibold text-ink">{title}</span>
        <span className="truncate text-[12.5px] text-ink-subtle">{url}</span>
      </div>
      <button
        type="button"
        onClick={onPlay}
        className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-semibold text-canvas transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
      >
        <Play size={18} fill="currentColor" />
        {t("Play")}
      </button>
    </div>
  );
}

function fileTitle(url: string, fallback: string): string {
  try {
    const path = new URL(url).pathname;
    const base = path.split("/").filter(Boolean).pop();
    if (!base) return fallback;
    return decodeURIComponent(base);
  } catch {
    return fallback;
  }
}
