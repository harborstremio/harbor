import { useEffect, useRef, useState } from "react";
import { SeekBarVisual } from "@/components/player/transport/seek-bar-visual";
import {
  type PlayerChromeConfig,
  type PlayerControlId,
  type PlayerSlot,
  type ThemeId,
} from "@/lib/player-chrome";
import { useSettings } from "@/lib/settings";

export function TopRow({
  theme,
  config,
  selectedId,
  onSelect,
  renderOne,
}: {
  theme: ThemeId;
  config: PlayerChromeConfig;
  selectedId: PlayerControlId | null;
  onSelect: (id: PlayerControlId | null) => void;
  renderOne: (id: PlayerControlId) => React.ReactNode;
}) {
  if (theme === "stremio") {
    return (
      <div className="absolute inset-x-0 top-0 z-30 flex h-[88px] items-center justify-between bg-gradient-to-b from-black/35 via-black/15 to-transparent px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <SlotZone
            slot="top-left"
            config={config}
            selectedId={selectedId}
            onSelect={onSelect}
            renderOne={renderOne}
          />
        </div>
        <div className="flex items-center gap-1">
          <SlotZone
            slot="top-right"
            config={config}
            selectedId={selectedId}
            onSelect={onSelect}
            renderOne={renderOne}
          />
        </div>
      </div>
    );
  }
  return (
    <div className="absolute inset-x-0 top-0 z-30 flex items-start justify-between bg-gradient-to-b from-black/55 via-black/15 to-transparent px-7 pt-4 pb-8">
      <div className="flex items-start gap-2">
        <SlotZone
          slot="top-left"
          config={config}
          selectedId={selectedId}
          onSelect={onSelect}
          renderOne={renderOne}
        />
      </div>
      <div className="flex items-start gap-2">
        <SlotZone
          slot="top-right"
          config={config}
          selectedId={selectedId}
          onSelect={onSelect}
          renderOne={renderOne}
        />
      </div>
    </div>
  );
}

export function FauxBackdrop({
  width,
  height,
  sizeLabel,
  bg,
}: {
  width: number;
  height: number;
  sizeLabel: string;
  bg: string | null;
}) {
  return (
    <div className="absolute inset-0">
      <CyclingBackdrop bg={bg} />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 35% 30%, oklch(0.32 0.10 260 / 0.45) 0%, transparent 60%), radial-gradient(ellipse at 75% 70%, oklch(0.28 0.08 320 / 0.35) 0%, transparent 65%), linear-gradient(180deg, oklch(0.08 0.02 260 / 0.45) 0%, oklch(0.06 0.02 260 / 0.62) 100%)",
        }}
      />
      <div className="absolute inset-x-0 top-[28%] flex flex-col items-center gap-3 text-center opacity-[0.07]">
        <span
          className="font-mono text-[16px] tracking-[0.32em] text-white"
          style={{ fontFeatureSettings: '"tnum" 1' }}
        >
          {width} × {height} · {sizeLabel.toUpperCase()}
        </span>
        <span
          className="text-[180px] font-medium leading-none tracking-tight text-white"
          style={{ fontFamily: '"Fraunces", "Iowan Old Style", "Georgia", serif' }}
        >
          PREVIEW
        </span>
      </div>
    </div>
  );
}

function CyclingBackdrop({ bg }: { bg: string | null }) {
  const [layers, setLayers] = useState<Array<{ url: string; id: number }>>([]);
  const idRef = useRef(0);
  useEffect(() => {
    if (!bg) return;
    const id = idRef.current++;
    setLayers((cur) => {
      if (cur.length && cur[cur.length - 1].url === bg) return cur;
      return [...cur, { url: bg, id }].slice(-2);
    });
    const tid = setTimeout(() => setLayers((cur) => cur.slice(-1)), 2600);
    return () => clearTimeout(tid);
  }, [bg]);
  return (
    <>
      {layers.map((layer, i) => (
        <img
          key={layer.id}
          src={layer.url}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover opacity-[0.40] ${
            i === layers.length - 1 && layers.length > 1
              ? "animate-in fade-in duration-[2200ms] ease-out"
              : ""
          }`}
          style={{ filter: "saturate(1.15)" }}
          draggable={false}
        />
      ))}
    </>
  );
}

type LayoutProps = {
  config: PlayerChromeConfig;
  selectedId: PlayerControlId | null;
  onSelect: (id: PlayerControlId | null) => void;
  renderOne: (id: PlayerControlId) => React.ReactNode;
  isLive: boolean;
};

export function DefaultLayout({
  config,
  selectedId,
  onSelect,
  renderOne,
  isLive,
  compact,
}: LayoutProps & { compact: boolean }) {
  return (
    <>
      <div className="flex items-center gap-3">
        {isLive ? (
          <LiveSeekRowMock />
        ) : (
          <>
            <SlotZone
              slot="seek-leading"
              config={config}
              selectedId={selectedId}
              onSelect={onSelect}
              renderOne={renderOne}
            />
            <div className="flex-1">
              <SeekBarPlaceholder />
            </div>
            <SlotZone
              slot="seek-trailing"
              config={config}
              selectedId={selectedId}
              onSelect={onSelect}
              renderOne={renderOne}
            />
          </>
        )}
      </div>
      <div
        className={`grid items-center ${
          compact ? "grid-cols-[auto_1fr_auto] gap-2" : "grid-cols-[1fr_auto_1fr] gap-4"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2 justify-self-start">
          <SlotZone
            slot="bottom-left"
            config={config}
            selectedId={selectedId}
            onSelect={onSelect}
            renderOne={renderOne}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <SlotZone
            slot="bottom-center"
            config={config}
            selectedId={selectedId}
            onSelect={onSelect}
            renderOne={renderOne}
          />
        </div>
        <div className="flex items-center gap-1.5 justify-self-end">
          <SlotZone
            slot="bottom-right"
            config={config}
            selectedId={selectedId}
            onSelect={onSelect}
            renderOne={renderOne}
          />
        </div>
      </div>
    </>
  );
}

export function StremioLayout({ config, selectedId, onSelect, renderOne, isLive }: LayoutProps) {
  return (
    <>
      <div className="flex h-6 items-center">
        {isLive ? (
          <LiveSeekRowMock />
        ) : (
          <div className="min-w-0 flex-1">
            <SeekBarPlaceholder />
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <SlotZone
          slot="bottom-left"
          config={config}
          selectedId={selectedId}
          onSelect={onSelect}
          renderOne={renderOne}
        />
        <SlotZone
          slot="bottom-center"
          config={config}
          selectedId={selectedId}
          onSelect={onSelect}
          renderOne={renderOne}
        />
        <div className="flex-1" />
        <SlotZone
          slot="bottom-right"
          config={config}
          selectedId={selectedId}
          onSelect={onSelect}
          renderOne={renderOne}
        />
      </div>
    </>
  );
}

function LiveSeekRowMock() {
  const { settings } = useSettings();
  return (
    <>
      <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.22em] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
        <span className="h-2 w-2 rounded-full bg-danger shadow-[0_0_8px_var(--color-danger)]" />
        Live
      </span>
      <div className="pointer-events-none relative h-12 flex-1">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
          <SeekBarVisual settings={settings} pct={92} bufferedPct={95} />
        </div>
      </div>
      <span className="shrink-0 text-[12px] font-semibold uppercase tracking-[0.2em] text-white/85 drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
        Go to live{" "}
        <span className="ms-0.5 font-mono lowercase tracking-normal text-white/55">· 24s</span>
      </span>
    </>
  );
}

function SlotZone({
  slot,
  config,
  selectedId,
  onSelect,
  renderOne,
}: {
  slot: PlayerSlot;
  config: PlayerChromeConfig;
  selectedId: PlayerControlId | null;
  onSelect: (id: PlayerControlId | null) => void;
  renderOne: (id: PlayerControlId) => React.ReactNode;
}) {
  const allInSlot = config.controls
    .filter((c) => c.slot === slot && !c.hidden)
    .sort((a, b) => a.order - b.order);
  const items = allInSlot
    .map((c) => ({ c, rendered: renderOne(c.id) }))
    .filter(
      (x): x is { c: (typeof allInSlot)[number]; rendered: NonNullable<React.ReactNode> } =>
        x.rendered != null,
    );
  if (items.length === 0) return null;
  return (
    <>
      {items.map(({ c, rendered }) => (
        <ControlPick key={c.id} id={c.id} selected={selectedId === c.id} onSelect={onSelect}>
          {rendered}
        </ControlPick>
      ))}
    </>
  );
}

function ControlPick({
  id,
  selected,
  onSelect,
  children,
}: {
  id: PlayerControlId;
  selected: boolean;
  onSelect: (id: PlayerControlId | null) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      data-control-id={id}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect(selected ? null : id);
      }}
      className={`relative cursor-pointer rounded-xl p-1 transition-all duration-150 ${
        selected ? "bg-accent/15 ring-2 ring-accent" : "ring-2 ring-transparent hover:bg-white/8"
      }`}
    >
      <div className="pointer-events-none">{children}</div>
      <span className="pointer-events-auto absolute inset-0 z-10" />
    </div>
  );
}

function SeekBarPlaceholder() {
  const { settings } = useSettings();
  return (
    <div className="pointer-events-none relative h-12 w-full">
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
        <SeekBarVisual settings={settings} pct={21} bufferedPct={28} />
      </div>
    </div>
  );
}
