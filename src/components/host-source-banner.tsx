import { Crown } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { SourceDescriptor } from "@/lib/together/protocol";
import { formatBytes, formatRuntime } from "@/lib/together/source-descriptor";

function Chip({ label }: { label: string }) {
  return (
    <span className="rounded-md bg-raised px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
      {label}
    </span>
  );
}

export function HostSourceBanner({
  source,
  compact = false,
}: {
  source: SourceDescriptor;
  compact?: boolean;
}) {
  const t = useT();
  return (
    <div
      className={`flex items-center gap-3 border border-accent/30 bg-accent/10 ${
        compact ? "mx-4 mt-3 rounded-xl px-3.5 py-2.5" : "rounded-2xl px-5 py-3.5"
      }`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
        <Crown size={14} strokeWidth={2.2} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-accent">
          {t("Host is watching")}
        </span>
        <span className="truncate text-[12.5px] font-medium text-ink">
          {source.title ?? t("Unknown release")}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {source.resolution && <Chip label={source.resolution} />}
        {source.sizeBytes != null && source.sizeBytes > 0 && (
          <Chip label={formatBytes(source.sizeBytes)} />
        )}
        {source.durationSec != null && source.durationSec > 0 && (
          <Chip label={formatRuntime(source.durationSec)} />
        )}
      </div>
    </div>
  );
}
