import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { EpgProgram } from "@/lib/iptv/types";
import { useDvr } from "@/lib/dvr/provider";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT } from "@/lib/i18n";
import { ActiveView } from "./active-view";
import { NewRecordingView } from "./new-view";

export function DvrModal({
  open,
  onClose,
  url,
  channelName,
  channelLogo,
  currentProgram,
  nextProgram,
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  channelName: string;
  channelLogo: string | null;
  currentProgram: EpgProgram | null;
  nextProgram: EpgProgram | null;
}) {
  const { sessions, start, stop, reveal, defaultDir } = useDvr();
  const activeForChannel = useMemo(
    () =>
      sessions.find(
        (s) => s.channelName === channelName && (s.state === "recording" || s.state === "done"),
      ) ?? null,
    [sessions, channelName],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      data-tv-focus-scope
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/72 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        style={{
          backgroundColor: "var(--color-canvas)",
          backgroundImage: "linear-gradient(var(--color-elevated), var(--color-elevated))",
        }}
        className="flex w-[min(520px,92vw)] max-h-[88vh] flex-col overflow-hidden rounded-2xl border border-edge shadow-[0_28px_72px_-20px_rgba(0,0,0,0.85)] animate-in zoom-in-95 duration-200"
      >
        <Header channelName={channelName} channelLogo={channelLogo} onClose={onClose} />
        {activeForChannel ? (
          <ActiveView
            session={activeForChannel}
            onStop={() => stop(activeForChannel.id)}
            onReveal={() => reveal(activeForChannel.outputPath)}
          />
        ) : (
          <NewRecordingView
            url={url}
            channelName={channelName}
            currentProgram={currentProgram}
            nextProgram={nextProgram}
            onStart={async (payload) => {
              await start(payload);
              onClose();
            }}
            getDefaultDir={defaultDir}
          />
        )}
      </div>
    </div>
  );
}

function Header({
  channelName,
  channelLogo,
  onClose,
}: {
  channelName: string;
  channelLogo: string | null;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <div className="flex items-center gap-4 border-b border-edge-soft px-6 py-5">
      <ChannelMark logo={channelLogo} name={channelName} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-ink-subtle">
          <span className="h-1.5 w-1.5 rounded-full bg-danger" />
          {t("Record from live TV")}
        </span>
        <HoverTooltip label={channelName} className="min-w-0">
          <span className="block truncate text-[18px] font-semibold leading-tight tracking-[-0.005em] text-ink">
            {channelName}
          </span>
        </HoverTooltip>
      </div>
      <button
        onClick={onClose}
        data-tv-modal-close
        aria-label={t("Close")}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-raised text-ink-muted transition-colors hover:bg-raised/70 hover:text-ink"
      >
        <X size={17} strokeWidth={2.1} />
      </button>
    </div>
  );
}

function ChannelMark({ logo, name }: { logo: string | null; name: string }) {
  const [errored, setErrored] = useState(false);
  if (logo && !errored) {
    return (
      <img
        src={logo}
        alt=""
        draggable={false}
        onError={() => setErrored(true)}
        className="h-14 max-w-[120px] shrink-0 object-contain"
      />
    );
  }
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center font-display text-[36px] font-semibold leading-none text-ink-muted">
      {initial}
    </span>
  );
}
