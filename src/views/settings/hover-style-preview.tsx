import { ChevronDown, Pencil, Plus, Star, ThumbsUp } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { useEffect, useState, useSyncExternalStore } from "react";
import { topMovies, type Meta } from "@/lib/cinemeta";
import {
  CardHoverOverlay,
  cardHoverPosterClass,
  type CardHoverStyle,
} from "@/components/pick-card/card-hover";
import { CustomHoverOverlay, customHoverPosterProps } from "@/components/pick-card/custom-hover";
import { listCustomHovers, subscribeCustomHovers, type CustomHoverConfig } from "@/lib/custom-hover";
import { useT } from "@/lib/i18n";
import { CustomHoverEditor } from "./custom-hover-editor";

const STYLES: Array<{ id: CardHoverStyle; label: string; sub: string }> = [
  { id: "default", label: "Default", sub: "Info modal" },
  { id: "marquee", label: "Marquee", sub: "Trailer card" },
  { id: "elegant", label: "ElegantFin", sub: "Blur and actions" },
  { id: "frosted", label: "Frosted glass", sub: "Panel and play" },
  { id: "cinema", label: "Cinema", sub: "Zoom and play" },
  { id: "spotlight", label: "Spotlight", sub: "Glow and title" },
];

export function HoverStyleGallery({
  value,
  customHoverId,
  onChange,
}: {
  value: CardHoverStyle;
  customHoverId: string;
  onChange: (style: CardHoverStyle, customId?: string) => void;
}) {
  const t = useT();
  const [sample, setSample] = useState<Meta | null>(null);
  const customs = useSyncExternalStore(subscribeCustomHovers, listCustomHovers);
  const [editing, setEditing] = useState<CustomHoverConfig | null | "new">(null);
  useEffect(() => {
    let alive = true;
    topMovies()
      .then((list) => alive && list[0] && setSample(list[0]))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <div className="grid grid-cols-3 gap-3 max-[560px]:grid-cols-2">
        {STYLES.map((s) => (
          <Tile
            key={s.id}
            label={t(s.label)}
            sub={t(s.sub)}
            selected={value === s.id}
            onClick={() => onChange(s.id)}
            meta={sample}
            style={s.id}
          />
        ))}
        {customs.map((c) => (
          <CustomTile
            key={c.id}
            config={c}
            selected={value === "custom" && customHoverId === c.id}
            onClick={() => onChange("custom", c.id)}
            onEdit={() => setEditing(c)}
            meta={sample}
          />
        ))}
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex aspect-[2/3] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-edge-soft bg-canvas/40 text-ink-subtle transition-colors hover:border-edge hover:text-ink"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-raised">
            <Plus size={20} strokeWidth={2.4} />
          </span>
          <span className="text-[15.5px] font-semibold">{t("Custom")}</span>
        </button>
      </div>
      {editing && (
        <CustomHoverEditor
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(id) => onChange("custom", id)}
          onDeleted={() => {
            if (value === "custom" && editing !== "new" && customHoverId === editing.id) onChange("default");
          }}
        />
      )}
    </>
  );
}

function Tile({
  label,
  sub,
  selected,
  onClick,
  meta,
  style,
}: {
  label: string;
  sub: string;
  selected: boolean;
  onClick: () => void;
  meta: Meta | null;
  style: CardHoverStyle;
}) {
  const inCard = style === "elegant" || style === "frosted" || style === "cinema" || style === "spotlight";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-col gap-2 rounded-md border p-2 text-start transition-colors ${
        selected ? "border-accent bg-accent/10" : "border-edge-soft bg-canvas/50 hover:border-edge"
      }`}
    >
      <div
        className={`relative aspect-[2/3] w-full overflow-hidden rounded-md bg-elevated ring-1 ring-edge-soft/60 ${cardHoverPosterClass(
          style,
          true,
        )}`}
      >
        {meta?.poster && (
          <img
            src={meta.poster}
            alt=""
            draggable={false}
            className={`absolute inset-0 h-full w-full rounded-md object-cover ${
              style === "default" || style === "marquee" ? "scale-110 blur-md brightness-[0.45]" : ""
            }`}
          />
        )}
        {meta && style === "default" && <DefaultModalPreview meta={meta} />}
        {meta && style === "marquee" && <MarqueeModalPreview meta={meta} />}
        {meta && inCard && <CardHoverOverlay meta={meta} style={style} onPlay={() => {}} preview />}
      </div>
      <div className="flex items-center justify-between px-0.5">
        <span className={`min-w-0 truncate text-[15.5px] font-semibold ${selected ? "text-accent" : "text-ink"}`}>{label}</span>
        <span className="hidden shrink-0 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px] text-ink-subtle sm:inline">{sub}</span>
      </div>
    </button>
  );
}

function CustomTile({
  config,
  selected,
  onClick,
  onEdit,
  meta,
}: {
  config: CustomHoverConfig;
  selected: boolean;
  onClick: () => void;
  onEdit: () => void;
  meta: Meta | null;
}) {
  const t = useT();
  const props = customHoverPosterProps(config, true);
  return (
    <div
      className={`group/tile relative flex rounded-md border transition-colors ${
        selected ? "border-accent bg-accent/10" : "border-edge-soft bg-canvas/50 hover:border-edge"
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className="flex w-full flex-col gap-2 p-2 text-start"
      >
        <div className={`relative aspect-[2/3] w-full overflow-hidden rounded-md bg-elevated ring-1 ring-edge-soft/60 ${props.className}`} style={props.style}>
          {meta?.poster && (
            <img src={meta.poster} alt="" draggable={false} className="absolute inset-0 h-full w-full rounded-md object-cover" />
          )}
          {meta && <CustomHoverOverlay config={config} meta={meta} onPlay={() => {}} preview />}
        </div>
        <div className="flex items-center justify-between px-0.5">
          <span className={`line-clamp-1 text-[15.5px] font-semibold ${selected ? "text-accent" : "text-ink"}`}>{config.name}</span>
        </div>
      </button>
      <button
        type="button"
        onClick={onEdit}
        aria-label={t("Edit")}
        className="group/pencil absolute end-2 top-2 z-30 grid h-11 w-11 place-items-center opacity-60 transition-opacity hover:opacity-100 group-hover/tile:opacity-100"
      >
        <span className="grid h-7 w-7 place-items-center rounded-md bg-black/55 text-white transition-colors group-hover/pencil:bg-black/80">
          <Pencil size={14} />
        </span>
      </button>
    </div>
  );
}

function MarqueeModalPreview({ meta }: { meta: Meta }) {
  const genres = (meta.genres ?? []).slice(0, 2);
  return (
    <div className="absolute inset-x-2 top-1/2 z-10 -translate-y-1/2 overflow-hidden rounded-md bg-elevated shadow-[0_16px_36px_-12px_rgba(0,0,0,0.8)] ring-1 ring-edge-soft">
      <div
        className="relative h-12 w-full bg-cover bg-center"
        style={{ backgroundImage: `url(${meta.background ?? meta.poster ?? ""})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-elevated via-elevated/60 to-transparent" />
        <span className="absolute bottom-1 start-1.5 line-clamp-1 max-w-[68%] text-[9px] font-bold text-ink">
          {meta.name}
        </span>
      </div>
      <div className="flex flex-col gap-1 p-1.5">
        <div className="flex items-center gap-1">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-ink text-canvas">
            <Play size={7} fill="currentColor" strokeWidth={0} />
          </span>
          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-edge text-ink-muted">
            <Plus size={8} />
          </span>
          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-edge text-ink-muted">
            <ThumbsUp size={7} />
          </span>
          <span className="ms-auto flex h-4 w-4 items-center justify-center rounded-full border border-edge text-ink-muted">
            <ChevronDown size={8} />
          </span>
        </div>
        <div className="flex items-center gap-1 text-[7px] text-ink-subtle">
          {meta.imdbRating && (
            <span className="flex items-center gap-0.5 text-ink">
              <Star size={6} className="fill-amber-400 text-amber-400" />
              {meta.imdbRating}
            </span>
          )}
          {genres.map((g, i) => (
            <span key={g}>
              {i > 0 && <span className="text-accent/70">{" ● "}</span>}
              {g}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function DefaultModalPreview({ meta }: { meta: Meta }) {
  const t = useT();
  return (
    <div className="absolute inset-x-2 top-1/2 z-10 -translate-y-1/2 overflow-hidden rounded-md bg-canvas/95 shadow-[0_16px_36px_-12px_rgba(0,0,0,0.8)] ring-1 ring-edge-soft/60 backdrop-blur-md">
      <div
        className="h-10 w-full bg-cover bg-center"
        style={{ backgroundImage: `url(${meta.background ?? meta.poster ?? ""})` }}
      />
      <div className="flex flex-col gap-1 p-2">
        <span className="line-clamp-1 text-[10.5px] font-bold text-ink">{meta.name}</span>
        <span className="flex items-center gap-1 text-[8.5px] text-ink-muted">
          {meta.imdbRating && (
            <span className="flex items-center gap-0.5">
              <Star size={7} className="fill-amber-400 text-amber-400" />
              {meta.imdbRating}
            </span>
          )}
          {meta.releaseInfo && <span>· {meta.releaseInfo}</span>}
        </span>
        {meta.description && (
          <span className="line-clamp-2 text-[8px] leading-tight text-ink-subtle">{meta.description}</span>
        )}
        <div className="mt-0.5 flex items-center gap-2 text-[8px] font-bold uppercase tracking-wide text-ink-muted">
          <span className="flex items-center gap-0.5 text-ink">
            <Play size={7} fill="currentColor" strokeWidth={0} />
            {t("Play")}
          </span>
          <span className="text-ink-subtle">{t("Details")}</span>
        </div>
      </div>
    </div>
  );
}
