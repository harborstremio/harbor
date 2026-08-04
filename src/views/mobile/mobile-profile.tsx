import {
  Check,
  ChevronRight,
  FileText,
  HelpCircle,
  LogOut,
  MonitorSmartphone,
  Users,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useProfiles } from "@/lib/profiles";
import { MobileWhosWatching } from "./mobile-whos-watching";
import { useMobileRemote } from "./mobile-remote";
import { setMobileRemoteStyle, useMobileRemoteStyle, type MobileRemoteStyle } from "./remote-style";

export function MobileProfile({ onOpenRemote }: { onOpenRemote: () => void }) {
  const { user, signOut } = useAuth();
  const { activeProfile } = useProfiles();
  const { snapshot } = useMobileRemote();
  const remote = snapshot.profile;
  const name = remote?.name || activeProfile?.name || user?.email?.split("@")[0] || "Guest";
  const avatar = remote?.avatar ?? activeProfile?.avatar ?? null;
  const color = remote?.color ?? activeProfile?.color ?? "oklch(0.78 0.13 60)";
  const [switching, setSwitching] = useState(false);

  return (
    <div className="flex h-full flex-col gap-6 px-5 pt-4">
      <header className="flex items-center justify-center">
        <h1 className="font-display text-[22px] font-medium text-ink">Profile</h1>
      </header>

      <button
        type="button"
        onClick={() => setSwitching(true)}
        className="flex flex-col items-center gap-3 transition-transform active:scale-[0.98]"
      >
        <span
          className="flex h-[84px] w-[84px] items-center justify-center overflow-hidden rounded-full text-[30px] font-bold text-white shadow-[0_10px_28px_-10px_rgba(0,0,0,0.6)]"
          style={{ background: avatar ? undefined : color }}
        >
          {avatar ? (
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            name.slice(0, 1).toUpperCase()
          )}
        </span>
        <span className="text-[18px] font-semibold text-ink">{name}</span>
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-accent">
          <Users size={14} strokeWidth={2.4} />
          Switch profile
        </span>
      </button>

      <section className="flex flex-col gap-3">
        <h2 className="px-1 text-[12px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
          Remote style
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <StylePreview kind="dpad" label="D-pad" />
          <StylePreview kind="minimal" label="Touchpad" />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-edge-soft/70 bg-elevated/40">
        <Row
          icon={<MonitorSmartphone size={20} strokeWidth={2} />}
          label="Remote"
          onClick={onOpenRemote}
        />
        <Divider />
        <Row
          icon={<HelpCircle size={20} strokeWidth={2} />}
          label="Help & feedback"
          onClick={() => window.open("https://bugs.harbor.site", "_blank")}
        />
        <Divider />
        <Row icon={<FileText size={20} strokeWidth={2} />} label="Legal" onClick={() => {}} />
        {user && (
          <>
            <Divider />
            <Row
              icon={<LogOut size={20} strokeWidth={2} />}
              label="Sign out"
              danger
              onClick={signOut}
            />
          </>
        )}
      </section>

      {switching && <MobileWhosWatching onClose={() => setSwitching(false)} />}
    </div>
  );
}

function StylePreview({ kind, label }: { kind: MobileRemoteStyle; label: string }) {
  const active = useMobileRemoteStyle() === kind;
  return (
    <button
      type="button"
      onClick={() => setMobileRemoteStyle(kind)}
      className={`relative flex flex-col items-center gap-3 rounded-2xl border bg-surface/50 p-4 transition-colors ${
        active ? "border-accent ring-1 ring-accent" : "border-edge-soft/70"
      }`}
    >
      {active && (
        <span className="absolute end-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-canvas">
          <Check size={12} strokeWidth={3} />
        </span>
      )}
      <span className="flex h-[104px] w-full items-center justify-center rounded-xl bg-canvas/60">
        {kind === "dpad" ? <DpadGlyph /> : <TouchpadGlyph />}
      </span>
      <span className={`text-[13.5px] font-semibold ${active ? "text-ink" : "text-ink-muted"}`}>
        {label}
      </span>
    </button>
  );
}

function DpadGlyph() {
  return (
    <span className="relative grid h-[74px] w-[74px] place-items-center rounded-full bg-elevated/70 ring-1 ring-edge-soft/70">
      <span className="absolute top-1.5 h-0 w-0 border-x-[5px] border-b-[7px] border-x-transparent border-b-ink-muted" />
      <span className="absolute bottom-1.5 h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-ink-muted" />
      <span className="absolute start-1.5 h-0 w-0 border-y-[5px] border-e-[7px] border-y-transparent border-e-ink-muted" />
      <span className="absolute end-1.5 h-0 w-0 border-y-[5px] border-s-[7px] border-y-transparent border-s-ink-muted" />
      <span className="h-7 w-7 rounded-full bg-raised" />
    </span>
  );
}

function TouchpadGlyph() {
  return (
    <span className="relative flex h-[62px] w-[74px] items-center justify-center rounded-2xl bg-elevated/70 ring-1 ring-edge-soft/70">
      <span className="h-2 w-2 rounded-full bg-ink-muted" />
      <span className="absolute h-[3px] w-8 -rotate-[18deg] rounded-full bg-ink-subtle/50" />
    </span>
  );
}

function Row({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3.5 px-4 py-3.5 text-start transition-colors active:bg-raised/60"
    >
      <span className={danger ? "text-danger" : "text-ink-muted"}>{icon}</span>
      <span className={`flex-1 text-[15px] font-medium ${danger ? "text-danger" : "text-ink"}`}>
        {label}
      </span>
      {!danger && <ChevronRight size={18} strokeWidth={2.2} className="dir-icon text-ink-subtle" />}
    </button>
  );
}

function Divider() {
  return <span className="mx-4 block h-px bg-edge-soft/60" />;
}
