import { Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { RemoteProfile } from "@/lib/remote/protocol";
import { useT } from "@/lib/i18n";
import { useMobileRemote } from "./mobile-remote";

type TileState = "idle" | "chosen" | "dimmed";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const SWITCH_CSS = `
.harbor-ring-lock {
  animation: harbor-ring-lock 380ms var(--ease-out) both;
}
@keyframes harbor-ring-lock {
  0% { opacity: 0; transform: scale(1.28); }
  55% { opacity: 1; }
  72% { transform: scale(0.965); }
  100% { opacity: 1; transform: scale(1); }
}
.harbor-switch-out {
  animation: harbor-switch-out 200ms cubic-bezier(0.4, 0, 1, 1) both;
}
@keyframes harbor-switch-out {
  from { opacity: 1; }
  to { opacity: 0; }
}
`;

export function MobileWhosWatching({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { snapshot, sendCommand } = useMobileRemote();
  const profiles = snapshot.profiles;
  const activeId = snapshot.profile?.id ?? null;
  const [reduced] = useState(prefersReducedMotion);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [exiting, setExiting] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  const choose = (id: string) => {
    if (selectingId) return;
    const commit = () => {
      if (id !== activeId) sendCommand({ action: "setProfile", id });
      onClose();
    };
    if (reduced) {
      commit();
      return;
    }
    setSelectingId(id);
    timers.current.push(window.setTimeout(() => setExiting(true), 360));
    timers.current.push(window.setTimeout(commit, 560));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("Who's watching")}
      className={`fixed inset-0 z-[70] flex flex-col overflow-hidden bg-canvas ${
        exiting ? "harbor-switch-out pointer-events-none" : "animate-fade-in"
      }`}
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 22px)",
      }}
    >
      <style>{SWITCH_CSS}</style>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[46%]"
        style={{
          background:
            "radial-gradient(110% 78% at 50% -8%, color-mix(in oklch, var(--color-accent) 9%, transparent), transparent 68%)",
        }}
      />

      <header className="relative flex items-center justify-end px-5 pb-1">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("Close")}
          className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-full bg-elevated/60 text-ink-muted ring-1 ring-edge-soft backdrop-blur transition-transform duration-150 active:scale-[0.94] active:bg-raised"
        >
          <X size={18} strokeWidth={2.4} />
        </button>
      </header>

      <div className="relative flex flex-1 flex-col overflow-y-auto px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="my-auto flex w-full flex-col items-center py-8">
          <div
            className={`mb-9 flex flex-col items-center gap-1.5 ${reduced ? "" : "harbor-step"}`}
          >
            <h1 className="font-display text-[26px] font-medium tracking-tight text-ink">
              {t("Who's watching?")}
            </h1>
            <p className="text-[13.5px] text-ink-muted">
              {profiles.length
                ? t("Tap a profile to switch")
                : t("Connect to your computer to switch")}
            </p>
          </div>

          <div className="flex w-full max-w-[440px] flex-wrap justify-center gap-x-4 gap-y-7">
            {profiles.map((p, i) => {
              const state: TileState =
                selectingId == null ? "idle" : selectingId === p.id ? "chosen" : "dimmed";
              return (
                <ProfileTile
                  key={p.id ?? i}
                  profile={p}
                  active={!!p.id && p.id === activeId}
                  state={state}
                  reduced={reduced}
                  delay={110 + Math.min(i, 9) * 52}
                  onSelect={() => p.id && choose(p.id)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileTile({
  profile,
  active,
  state,
  reduced,
  delay,
  onSelect,
}: {
  profile: RemoteProfile;
  active: boolean;
  state: TileState;
  reduced: boolean;
  delay: number;
  onSelect: () => void;
}) {
  const t = useT();
  const stateClass =
    state === "chosen"
      ? "z-10 scale-[1.05]"
      : state === "dimmed"
        ? "scale-90 opacity-0"
        : reduced
          ? ""
          : "harbor-pop";
  const initial = profile.name.slice(0, 1).toUpperCase();

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={t("Switch to {name}", { name: profile.name })}
      className={`group flex w-[clamp(94px,27vw,116px)] touch-manipulation flex-col items-center gap-3 outline-none transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${stateClass}`}
      style={state === "idle" && !reduced ? { animationDelay: `${delay}ms` } : undefined}
    >
      <span className="relative">
        <span
          className={`flex h-[clamp(72px,22vw,94px)] w-[clamp(72px,22vw,94px)] items-center justify-center overflow-hidden rounded-full text-[26px] font-semibold text-white shadow-[0_12px_28px_-14px_rgba(0,0,0,0.75)] transition-transform duration-200 group-active:scale-[0.94] ${
            active
              ? "ring-2 ring-accent ring-offset-4 ring-offset-canvas"
              : "ring-1 ring-edge-soft/60"
          }`}
          style={{ background: profile.avatar ? undefined : profile.color }}
        >
          {profile.avatar ? (
            <img
              src={profile.avatar}
              alt=""
              draggable={false}
              className="h-full w-full object-cover"
            />
          ) : (
            initial
          )}
        </span>
        {state === "chosen" && (
          <span
            aria-hidden
            className="harbor-ring-lock pointer-events-none absolute -inset-[7px] rounded-full border-[2.5px] border-accent"
          />
        )}
        {active && (
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-0.5 -end-0.5 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-accent text-canvas shadow-md ring-2 ring-canvas"
          >
            <Check size={14} strokeWidth={3} />
          </span>
        )}
      </span>
      <span
        className={`max-w-full truncate text-center text-[14px] ${
          active ? "font-semibold text-ink" : "font-medium text-ink-muted"
        }`}
      >
        {profile.name}
      </span>
    </button>
  );
}
