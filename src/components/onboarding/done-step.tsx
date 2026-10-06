import { useMemo } from "react";
import { isInstalled } from "@/lib/addon-store";
import { useT } from "@/lib/i18n";
import { JL_DEBRID_OPTIONS, JL_TORRENTIO_ADDON_ID, summarizeJlSetup } from "@/lib/jl/onboarding";
import { useSettings } from "@/lib/settings";

export function DoneStep() {
  const { settings } = useSettings();
  const t = useT();
  const enabled = useMemo(
    () => Object.values(settings.streaming).filter(Boolean).length,
    [settings.streaming],
  );
  const jl = summarizeJlSetup({
    playlists: settings.iptvPlaylists,
    rdKey: settings.rdKey,
    tbKey: settings.tbKey,
    torrentioInstalled: isInstalled(JL_TORRENTIO_ADDON_ID),
  });
  const debridLabels = JL_DEBRID_OPTIONS.filter((o) => jl.debrid.includes(o.id)).map((o) => o.label);
  return (
    <div className="flex flex-col items-center gap-6 pt-4 text-center">
      <DoneCheck />

      <div className="flex flex-col gap-3">
        <h1 className="font-display text-[40px] font-medium leading-[1.05] tracking-tight text-ink">
          {t("You're set.")}
        </h1>
        <p className="max-w-md text-[15px] leading-relaxed text-ink-muted">
          {settings.tmdbKey
            ? t("TMDB connected. {n} streaming {services} on. Welcome aboard.", {
                n: enabled,
                services: t(enabled === 1 ? "service" : "services"),
              })
            : t("Running on Cinemeta for now. Add a TMDB key from Settings whenever you're ready.")}
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <SetupChip on={jl.playlists > 0}>
            {jl.playlists === 0
              ? t("No IPTV provider")
              : jl.playlists === 1
                ? t("1 IPTV provider")
                : t("{n} IPTV providers", { n: jl.playlists })}
          </SetupChip>
          <SetupChip on={debridLabels.length > 0}>
            {debridLabels.length > 0 ? debridLabels.join(" + ") : t("No debrid service")}
          </SetupChip>
          <SetupChip on={jl.torrentio}>{jl.torrentio ? "Torrentio" : t("Torrentio not installed")}</SetupChip>
        </div>
      </div>
    </div>
  );
}

function SetupChip({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-[12.5px] ${
        on ? "border-accent/40 bg-accent-soft text-accent" : "border-edge-soft text-ink-subtle"
      }`}
    >
      {children}
    </span>
  );
}

function DoneCheck() {
  return (
    <div className="animate-done-pop">
      <svg width="84" height="84" viewBox="0 0 84 84" fill="none">
        <circle
          cx="42"
          cy="42"
          r="36"
          stroke="oklch(0.78 0.17 145)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          className="animate-done-ring"
          transform="rotate(-90 42 42)"
        />
        <path
          d="M27 43 L37.5 53.5 L57 33"
          stroke="oklch(0.82 0.18 145)"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          className="animate-done-check"
        />
      </svg>
    </div>
  );
}
