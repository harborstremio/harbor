import { useState } from "react";
import { MonitorSmartphone } from "lucide-react";
import { APP_VERSION } from "@/lib/build-info";
import { useMobileRemote } from "./mobile-remote";
import { useRegisterSheet } from "./mobile-sheet-lock";
import { RendererSheet } from "./renderer-sheet";

export function MobileDeviceSwitcher() {
  const { snapshot } = useMobileRemote();
  const [open, setOpen] = useState(false);
  useRegisterSheet(open);

  const label = snapshot.target.label || "This PC";
  const version = snapshot.hostVersion ?? APP_VERSION;

  return (
    <>
      <button
        type="button"
        aria-label={`Playing on ${label}. Change device`}
        onClick={() => setOpen(true)}
        className="flex h-11 max-w-full items-center gap-2 rounded-full border border-edge-soft/60 bg-elevated/85 pe-2.5 ps-2 text-ink shadow-[0_8px_24px_-10px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-transform duration-150 active:scale-[0.97]"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-raised text-ink-muted">
          <MonitorSmartphone size={16} strokeWidth={2} />
        </span>
        <span className="min-w-0 truncate text-[13.5px] font-semibold">{label}</span>
        <span className="shrink-0 rounded-md bg-raised px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-subtle">
          {version}
        </span>
      </button>
      <RendererSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
