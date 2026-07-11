import { AddonLogo } from "@/components/addon-logo";
import { useT } from "@/lib/i18n";
import type { ScoredStream } from "@/lib/streams/types";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { StreamPill } from "./stream-pill";

export function AddonGroup({
  addonId,
  addonName,
  addonLogo,
  streams,
  isCached,
  defaultOpen,
  onPick,
}: {
  addonId: string;
  addonName: string;
  addonLogo: string | null;
  streams: ScoredStream[];
  isCached: (s: ScoredStream) => boolean;
  defaultOpen: boolean;
  onPick: (s: ScoredStream) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(defaultOpen);
  const cachedCount = streams.filter(isCached).length;
  return (
    <div className="overflow-hidden rounded-2xl bg-elevated/30 ring-1 ring-edge-soft">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-3 text-start transition-colors hover:bg-elevated/60"
      >
        <AddonLogo addonId={addonId} addonName={addonName} manifestLogo={addonLogo} size="sm" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13.5px] font-semibold text-ink">{addonName}</span>
          <span className="text-[11px] text-ink-subtle">
            {streams.length === 1 ? t("{n} source", { n: streams.length }) : t("{n} sources", { n: streams.length })}
            {cachedCount > 0 ? t(" · {n} instant", { n: cachedCount }) : ""}
          </span>
        </div>
        <ChevronDown
          size={18}
          strokeWidth={2.4}
          className={`shrink-0 text-ink-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-2 px-3 pb-3">
          {streams.map((s, i) => (
            <StreamPill
              key={`${s.url ?? s.infoHash ?? s.title}-${i}`}
              stream={s}
              cached={isCached(s)}
              onPick={() => onPick(s)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
