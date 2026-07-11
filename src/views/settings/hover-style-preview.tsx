import { CardHoverOverlay, cardHoverPosterClass, type CardHoverStyle } from "@/components/pick-card/card-hover";
import { CustomHoverOverlay, customHoverPosterProps } from "@/components/pick-card/custom-hover";
import { topMovies, type Meta } from "@/lib/cinemeta";
import { listCustomHovers, subscribeCustomHovers, type CustomHoverConfig } from "@/lib/custom-hover";
import { useT } from "@/lib/i18n";
import { Pencil, Play, Plus, Star } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { CustomHoverEditor } from "./custom-hover-editor";

const STYLES: Array<{ id: CardHoverStyle; label: string; sub: string }> = [
  { id: "default", label: "Default", sub: "Info modal" },
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
          className="flex aspect-[2/3] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-edge-soft bg-canvas/40 text-ink-subtle transition-colors hover:border-edge hover:text-ink"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-raised">
            <Plus size={18} strokeWidth={2.4} />
          </span>
          <span className="text-[12px] font-semibold">{t("Custom")}</span>
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
      className={`flex flex-col gap-2 rounded-xl border p-2 text-start transition-colors ${
        selected ? "border-accent bg-accent/10" : "border-edge-soft bg-canvas/50 hover:border-edge"
      }`}
    >
      <div
        className={`relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-elevated ring-1 ring-edge-soft/60 ${cardHoverPosterClass(
          style,
          true,
        )}`}
      >
        {meta?.poster && (
          <img
            src={meta.poster}
            alt=""
            draggable={false}
            className={`absolute inset-0 h-full w-full rounded-lg object-cover ${
              style === "default" ? "scale-110 blur-md brightness-[0.45]" : ""
            }`}
          />
        )}
        {meta && style === "default" && <DefaultModalPreview meta={meta} />}
        {meta && inCard && <CardHoverOverlay meta={meta} style={style} onPlay={() => {}} preview />}
      </div>
      <div className="flex items-center justify-between px-0.5">
        <span className={`text-[12px] font-semibold ${selected ? "text-accent" : "text-ink"}`}>{label}</span>
        <span className="hidden text-[10px] text-ink-subtle sm:inline">{sub}</span>
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
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      aria-pressed={selected}
      className={`group/tile flex cursor-pointer flex-col gap-2 rounded-xl border p-2 text-start transition-colors ${
        selected ? "border-accent bg-accent/10" : "border-edge-soft bg-canvas/50 hover:border-edge"
      }`}
    >
      <div
        className={`relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-elevated ring-1 ring-edge-soft/60 ${props.className}`}
        style={props.style}
      >
        {meta?.poster && (
          <img
            src={meta.poster}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full rounded-lg object-cover"
          />
        )}
        {meta && <CustomHoverOverlay config={config} meta={meta} onPlay={() => {}} preview />}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          aria-label={t("Edit")}
          className="absolute end-1.5 top-1.5 z-30 flex h-6 w-6 items-center justify-center rounded-md bg-black/55 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover/tile:opacity-100"
        >
          <Pencil size={12} />
        </button>
      </div>
      <div className="flex items-center justify-between px-0.5">
        <span className={`line-clamp-1 text-[12px] font-semibold ${selected ? "text-accent" : "text-ink"}`}>
          {config.name}
        </span>
      </div>
    </div>
  );
}

function DefaultModalPreview({ meta }: { meta: Meta }) {
  const t = useT();
  return (
    <div className="absolute inset-x-2 top-1/2 z-10 -translate-y-1/2 overflow-hidden rounded-lg bg-canvas/95 shadow-[0_16px_36px_-12px_rgba(0,0,0,0.8)] ring-1 ring-edge-soft/60 backdrop-blur-md">
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
