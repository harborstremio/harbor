import { useState, type CSSProperties, type ReactNode } from "react";
import { UserRound } from "lucide-react";
import { SFX } from "@/lib/sfx";
import { BP_ACTION_RING } from "../bp-action-style";
import type { BpSportsWhoStat } from "./bp-sports-who-data";

export const BP_WHO_FLUSH: CSSProperties = { paddingInline: 0, marginInline: 0 };

export const BP_WHO_LIFT = { "--bp-focus-lift": "1.022" } as CSSProperties;

export const BP_WHO_EYEBROW =
  "text-[calc(clamp(11.5px,1.5vh,17px)*var(--bp-up,1))] font-bold uppercase tracking-[0.17em] text-ink-subtle";

export const BP_WHO_NAME =
  "font-display text-[calc(clamp(30px,4.4vh,60px)*var(--bp-up,1))] font-semibold leading-[1.04] tracking-[-0.028em] text-ink";

export const BP_WHO_LEAD =
  "text-[calc(clamp(14.5px,2vh,24px)*var(--bp-up,1))] font-semibold leading-[1.4] text-ink-muted";

export const BP_WHO_FIGURE =
  "font-display text-[calc(clamp(26px,3.5vh,48px)*var(--bp-up,1))] font-semibold leading-[0.98] tracking-[-0.03em] tabular-nums text-ink";

export const BP_WHO_TAG =
  "text-[calc(clamp(10.5px,1.4vh,15px)*var(--bp-up,1))] font-bold uppercase tracking-[0.14em] text-ink-subtle";

export const BP_WHO_LABEL =
  "text-[calc(clamp(11px,1.5vh,16px)*var(--bp-up,1))] font-bold uppercase tracking-[0.15em] text-ink-subtle";

export const BP_WHO_VALUE =
  "text-[calc(clamp(14px,1.95vh,23px)*var(--bp-up,1))] font-semibold leading-snug text-ink";

export const BP_WHO_BODY =
  "text-[calc(clamp(13px,1.8vh,21px)*var(--bp-up,1))] font-medium leading-[1.55] text-ink-subtle";

export const BP_WHO_NOTE =
  "text-[calc(clamp(12.5px,1.7vh,19px)*var(--bp-up,1))] font-semibold leading-[1.5] text-ink-subtle";

export const BP_WHO_CELL_NAME =
  "text-[calc(clamp(12.5px,1.7vh,19px)*var(--bp-up,1))] font-semibold leading-tight text-ink";

export const BP_WHO_CELL_SUB =
  "text-[calc(clamp(10.5px,1.42vh,15px)*var(--bp-up,1))] font-bold uppercase tracking-[0.12em] tabular-nums text-ink-subtle";

export const BP_WHO_CHIP = `flex h-[clamp(48px,5.6vh,68px)] shrink-0 items-center gap-[clamp(8px,0.7vw,14px)] rounded-[var(--bp-r-xs)] border border-[var(--bp-edge-2)] px-[clamp(18px,1.5vw,30px)] text-[calc(clamp(13.5px,1.85vh,22px)*var(--bp-up,1))] font-bold text-ink ${BP_ACTION_RING}`;

export const BP_WHO_HEADING =
  "mb-[clamp(4px,0.6vh,9px)] text-[length:var(--bp-detail-heading)] font-bold tracking-[-0.01em] text-ink";

export const BP_WHO_PAIRS =
  "grid gap-x-[clamp(20px,2.2vw,48px)] gap-y-[clamp(8px,1vh,15px)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,clamp(150px,14vw,250px)),1fr))]";

export type BpSportsWhoView = {
  eyebrow: string;
  lead: string;
  figures: BpSportsWhoStat[];
  facts: { label: string; value: string }[];
  body: string;
  note: string;
  link: { label: string; url: string } | null;
  loading: boolean;
  art: string;
  fit: string;
  extra: ReactNode;
};

export function BpSportsWhoArt({
  src,
  fit,
  fallback,
}: {
  src: string;
  fit: string;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  if (src === "" || failed) {
    return <span className="grid h-full w-full place-items-center">{fallback}</span>;
  }
  return (
    <img
      key={src}
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      data-on={ready ? "true" : undefined}
      onLoad={() => setReady(true)}
      onError={() => setFailed(true)}
      className={`h-full w-full opacity-0 transition-opacity duration-[var(--bp-dur-slow)] ease-[var(--bp-ease)] data-[on=true]:opacity-100 motion-reduce:transition-none ${fit}`}
    />
  );
}

export function BpSportsWhoFace({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const initial = name.trim().slice(0, 1).toLocaleUpperCase();
  return (
    <span className="grid h-[clamp(64px,7.6vh,104px)] w-[clamp(64px,7.6vh,104px)] shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bp-panel-2)] text-ink-subtle">
      {src !== "" && !failed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover object-top"
        />
      ) : initial === "" ? (
        <UserRound className="h-[52%] w-[52%]" />
      ) : (
        <span className={BP_WHO_FIGURE}>{initial}</span>
      )}
    </span>
  );
}

export function BpSportsWhoFigures({ figures }: { figures: BpSportsWhoStat[] }) {
  if (figures.length === 0) return null;
  return (
    <div className="flex flex-wrap items-end gap-x-[clamp(24px,2.6vw,60px)] gap-y-[clamp(10px,1.2vh,18px)]">
      {figures.map((figure) => (
        <span
          key={`${figure.name}:${figure.value}`}
          className="flex min-w-0 max-w-[clamp(150px,15vw,280px)] flex-col gap-[clamp(3px,0.4vh,6px)]"
        >
          <span className={`${BP_WHO_FIGURE} truncate`}>{figure.value}</span>
          <span className={`${BP_WHO_TAG} truncate`}>{figure.name}</span>
        </span>
      ))}
    </div>
  );
}

export function BpSportsWhoFacts({ facts }: { facts: { label: string; value: string }[] }) {
  if (facts.length === 0) return null;
  return (
    <div className={BP_WHO_PAIRS}>
      {facts.map((fact) => (
        <span
          key={`${fact.label}:${fact.value}`}
          className="flex min-w-0 flex-col gap-[clamp(2px,0.3vh,5px)]"
        >
          <span className={`${BP_WHO_LABEL} truncate`}>{fact.label}</span>
          <span className={`${BP_WHO_VALUE} truncate`}>{fact.value}</span>
        </span>
      ))}
    </div>
  );
}

export function BpSportsWhoChip({
  label,
  restoreKey,
  icon,
  onPress,
}: {
  label: string;
  restoreKey: string;
  icon?: ReactNode;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-chip
      data-bp-restore-key={restoreKey}
      onClick={() => {
        SFX.click();
        onPress();
      }}
      className={BP_WHO_CHIP}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
