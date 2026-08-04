import { useEffect } from "react";
import { Cast, Check, MonitorSmartphone } from "lucide-react";
import { useMobileRemote } from "./mobile-remote";
import { SHEET_EXIT_CSS, useSheetPresence } from "./remote-extras";
import { APP_VERSION } from "@/lib/build-info";

export function RendererSheet({
  open,
  onClose,
  title = "Play on",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
}) {
  const { snapshot, sendCommand } = useMobileRemote();
  const { render, leaving } = useSheetPresence(open);
  const hostVersion = snapshot.hostVersion ?? APP_VERSION;

  useEffect(() => {
    if (open) sendCommand({ action: "castDiscover" });
  }, [open, sendCommand]);

  if (!render) return null;

  const target = snapshot.target;
  const localActive = target.kind === "local";

  return (
    <div
      className={`fixed inset-0 z-[70] flex flex-col justify-end bg-black/60 backdrop-blur-sm ${leaving ? "harbor-sheet-scrim-out" : "animate-fade-in"}`}
      onClick={onClose}
    >
      <style>{SHEET_EXIT_CSS}</style>
      <div
        className={`rounded-t-[28px] border-t border-edge-soft/60 bg-elevated ${leaving ? "harbor-sheet-panel-out" : "animate-in slide-in-from-bottom-4 duration-300"}`}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 22px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-ink/20" />
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h3 className="text-[16px] font-semibold text-ink">{title}</h3>
          {snapshot.castDiscovering && (
            <span className="text-[12px] text-ink-subtle">Scanning…</span>
          )}
        </div>
        <div className="flex flex-col px-2 pb-2">
          <DeviceRow
            name="Your computer"
            badge={`Harbor ${hostVersion}`}
            icon={<MonitorSmartphone size={20} strokeWidth={2} />}
            active={localActive}
            onSelect={() => {
              sendCommand({ action: "setTarget", target: "local" });
              onClose();
            }}
          />
          {snapshot.castDevices.map((d) => (
            <DeviceRow
              key={d.id}
              name={d.name}
              sub={d.model ?? d.kind}
              icon={<Cast size={20} strokeWidth={2} />}
              active={target.kind === "cast" && target.deviceId === d.id}
              onSelect={() => {
                sendCommand({ action: "setTarget", target: { castDeviceId: d.id } });
                onClose();
              }}
            />
          ))}
          {snapshot.castDevices.length === 0 && !snapshot.castDiscovering && (
            <p className="px-4 py-6 text-center text-[13px] text-ink-muted">
              No cast devices found on your network.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function DeviceRow({
  name,
  sub,
  badge,
  icon,
  active,
  onSelect,
}: {
  name: string;
  sub?: string;
  badge?: string;
  icon: React.ReactNode;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex items-center gap-3.5 rounded-2xl px-4 py-3 text-start transition-colors active:bg-raised/60"
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-accent-soft text-accent" : "bg-raised text-ink-muted"}`}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span
            className={`truncate text-[15px] font-semibold ${active ? "text-accent" : "text-ink"}`}
          >
            {name}
          </span>
          {badge && (
            <span className="shrink-0 rounded-md bg-raised px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-subtle">
              {badge}
            </span>
          )}
        </span>
        {sub && <span className="truncate text-[12px] text-ink-subtle">{sub}</span>}
      </span>
      {active && <Check size={19} strokeWidth={2.6} className="text-accent" />}
    </button>
  );
}
