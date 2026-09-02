import { ChevronDown } from "lucide-react";
import { SFX } from "@/lib/sfx";
import { useBpT } from "./bp-i18n";

// Two letters max: a longer monogram stops reading as a mark at ten feet. A
// source with no logo of its own gets these initials on its plate instead.
export function bpSourceInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "TV";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function BpLiveSourceButton({
  name,
  channelCount,
  onOpen,
}: {
  name: string;
  channelCount: number;
  onOpen: () => void;
}) {
  const t = useBpT();
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-restore-key="bp-live-source-trigger"
      onClick={() => {
        SFX.open();
        onOpen();
      }}
      aria-label={t("Change source, current source {name}", { name })}
      className="group flex h-[clamp(52px,6vh,72px)] max-w-[min(70vw,560px)] shrink-0 items-center gap-[clamp(10px,0.9vw,16px)] self-start rounded-[var(--bp-r-md)] border border-[var(--bp-edge)] bg-[var(--bp-panel)] ps-[clamp(8px,0.7vw,12px)] pe-[clamp(14px,1.2vw,22px)] text-start transition-[transform,background-color,border-color,color] duration-[var(--bp-dur-fast)] ease-[var(--bp-ease)] data-[bp-focus=true]:border-transparent data-[bp-focus=true]:bg-[var(--color-ink)] data-[bp-focus=true]:text-[var(--color-canvas)] data-[bp-focus=true]:[transform:scale(1.02)] motion-reduce:data-[bp-focus=true]:[transform:none]"
    >
      <span className="grid h-[clamp(38px,4.4vh,56px)] w-[clamp(38px,4.4vh,56px)] shrink-0 place-items-center rounded-[var(--bp-r-sm)] bg-[var(--bp-panel-2)] text-[clamp(13px,1.7vh,20px)] font-bold tracking-[0.02em] text-ink group-data-[bp-focus=true]:bg-[var(--bp-void)]/25 group-data-[bp-focus=true]:text-[var(--color-canvas)]">
        {bpSourceInitials(name)}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[clamp(16px,2vh,24px)] font-semibold leading-tight">
          {name}
        </span>
        <span className="truncate text-[clamp(11.5px,1.45vh,15px)] font-medium text-ink-subtle group-data-[bp-focus=true]:text-[var(--color-canvas)]/70">
          {channelCount > 0
            ? t("{n} channels", { n: channelCount.toLocaleString() })
            : t("Live TV source")}
        </span>
      </span>
      <ChevronDown
        size={20}
        strokeWidth={2.2}
        className="ms-[clamp(4px,0.4vw,10px)] shrink-0 text-ink-subtle group-data-[bp-focus=true]:text-[var(--color-canvas)]"
      />
    </button>
  );
}
