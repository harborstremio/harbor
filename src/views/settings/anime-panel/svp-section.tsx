import { AlertTriangle, Cpu, ExternalLink, Filter, Loader2, Play } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { isLinuxDesktop } from "@/lib/platform";
import { openUrl } from "@/lib/window";
import { svpApply, svpLaunch, svpStatus, type SvpStatus } from "@/lib/svp";
import { Section, ToggleRow, Segmented } from "../shared";
import { ModalButton, SettingGroup, SettingRow, SettingsModal, Nested } from "../kit";

type Tone = "neutral" | "ok" | "bad";

export function SvpSection() {
  const { settings, update } = useSettings();
  const t = useT();
  const [status, setStatus] = useState<SvpStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fixOpen, setFixOpen] = useState(false);

  useEffect(() => {
    svpStatus()
      .then(setStatus)
      .catch(() => {});
  }, []);

  const installed = status?.installed ?? false;
  const ready = status?.ready ?? false;
  const checking = status === null;
  const supported = status?.supported ?? false;
  const linux = isLinuxDesktop();
  const loadFailed = ready && status?.loadable === false;
  const getUrl = linux ? "https://www.svp-team.com/wiki/SVP:Linux" : "https://www.svp-team.com/get/";

  const openSvp = async () => {
    setBusy(true);
    setError(null);
    try {
      await svpLaunch();
    } catch (e) {
      setError(t("Couldn't start SVP Manager: {err}", { err: String(e) }));
    } finally {
      setBusy(false);
    }
  };

  const onToggle = async (on: boolean) => {
    setError(null);
    if (!on) {
      update({ playerSvp: false });
      return;
    }
    setBusy(true);
    try {
      const vpy = await svpApply("60");
      update({ playerSvp: true, svpVpyPath: vpy });
      svpStatus()
        .then(setStatus)
        .catch(() => {});
    } catch (e) {
      setError(t("Couldn't set up SVP: {err}", { err: String(e) }));
    } finally {
      setBusy(false);
    }
  };

  const engine: { pill: string; tone: Tone; desc: string } = checking
    ? {
        pill: t("Checking"),
        tone: "neutral",
        desc: t("Checking the local SVP and VapourSynth installation..."),
      }
    : !supported
      ? {
          pill: t("Unavailable"),
          tone: "bad",
          desc: t(status?.reason ?? "SVP is not supported by this Harbor package."),
        }
      : loadFailed
        ? {
            pill: t("Needs repair"),
            tone: "bad",
            desc: t("SVP's files are here, but its VapourSynth engine won't load."),
          }
        : ready
          ? {
              pill: t("Ready"),
              tone: "ok",
              desc: linux
                ? t(
                    "Installed and detected. Harbor found the native svpflow plugins and VapourSynth script library.",
                  )
                : t(
                    "Installed and detected. Harbor found its interpolation engine and will drive it directly.",
                  ),
            }
          : installed
            ? {
                pill: t("Not detected"),
                tone: "bad",
                desc: t(
                  "SVP is installed but Harbor couldn't find its engine files (svpflow + VapourSynth). Try repairing the SVP install, or reopen SVP once.",
                ),
              }
            : {
                pill: t("Not installed"),
                tone: "neutral",
                desc: t(
                  "Install SVP once (the free tier is enough). It bundles VapourSynth + svpflow; Harbor reuses them, no extra setup.",
                ),
              };

  return (
    <Section
      title={t("SVP frame interpolation")}
      subtitle={
        linux
          ? t(
              "Native 48/60fps motion through your Linux SVP and VapourSynth installation, rendered inside Harbor's embedded player.",
            )
          : t(
              "Genuine 48/60fps motion on anime, rendered right inside Harbor's player. SVP supplies the engine (VapourSynth + svpflow) and runs in your tray for licensing; Harbor's own player applies the interpolation, so it stays embedded and fully under your control. One-time install, then flip it on.",
            )
      }
    >
      <SettingGroup label={t("Setup")}>
        <SettingRow icon={<Cpu size={16} />} label={t("SVP engine")} desc={engine.desc}>
          <StatusPill tone={engine.tone}>{engine.pill}</StatusPill>
          {loadFailed && (
            <RowAction onClick={() => setFixOpen(true)}>{t("How to fix")}</RowAction>
          )}
          {!supported ? null : installed ? (
            <RowAction onClick={openSvp} disabled={busy}>
              {busy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Play size={14} strokeWidth={2.2} />
              )}
              {t("Open SVP")}
            </RowAction>
          ) : (
            <RowAction primary onClick={() => openUrl(getUrl)}>
              {t("Get SVP (free)")}
              <ExternalLink size={12} strokeWidth={2.2} />
            </RowAction>
          )}
        </SettingRow>
      </SettingGroup>

      <SettingGroup label={t("Playback")}>
        <ToggleRow
          label={t("Enable SVP")}
          sub={
            ready
              ? linux
                ? t(
                    "Harbor loads the native svpflow filter through VapourSynth and starts SVP Manager when available. Restart playback to apply.",
                  )
                : t(
                    "Harbor's player applies the interpolation itself, embedded like normal playback, and starts SVP Manager in the tray for licensing. Restart playback to apply. If video goes black or won't start, turn this off.",
                  )
              : t(
                  "Finish the install above first. Flipping this on now won't do anything until Harbor can find SVP's engine.",
                )
          }
          value={settings.playerSvp}
          onChange={(v) => void onToggle(v)}
          lockReason={
            checking
              ? t("Checking SVP installation...")
              : !supported
                ? (status?.reason ?? t("SVP is not supported by this Harbor package."))
                : undefined
          }
        />

        <Nested>
          <SettingRow
            icon={<Filter size={16} />}
            label={t("Apply SVP to")}
            desc={t(
              "Frame interpolation shines on anime but can look off on live-action film. Limit it to the content you want, then restart playback.",
            )}
            lockReason={
              settings.playerSvp
                ? undefined
                : t("Turn on SVP above to choose where interpolation applies.")
            }
          >
            <div
              inert={!settings.playerSvp}
              className={settings.playerSvp ? "" : "pointer-events-none"}
            >
              <Segmented
                value={settings.svpScope}
                options={[
                  { value: "all", label: t("All content") },
                  { value: "anime", label: t("Anime only") },
                  { value: "non-anime", label: t("Movies & TV") },
                ]}
                onChange={(v) => update({ svpScope: v as "all" | "anime" | "non-anime" })}
              />
            </div>
          </SettingRow>
        </Nested>
      </SettingGroup>

      {error && (
        <div className="flex items-start gap-2.5 rounded-md bg-elevated px-4 py-3.5 text-[12.5px] leading-relaxed text-ink">
          <AlertTriangle size={14} strokeWidth={2.4} className="mt-[2px] shrink-0 text-danger" />
          <span className="min-w-0">{error}</span>
        </div>
      )}

      <SettingsModal
        open={fixOpen}
        onClose={() => setFixOpen(false)}
        title={t("Fix the SVP engine")}
        sub={t("SVP's files are here, but its VapourSynth engine won't load.")}
        actions={
          <>
            <ModalButton ghost onClick={() => setFixOpen(false)}>
              {t("Close")}
            </ModalButton>
            <ModalButton onClick={openSvp}>{t("Open SVP")}</ModalButton>
          </>
        }
      >
        <div className="rounded-md bg-elevated px-4 py-3.5 text-[12.5px] leading-relaxed text-ink-muted">
          {t(
            "SVP's files are here but its VapourSynth engine won't load ({err}). This usually means a stale VapourSynth entry or a missing Microsoft VC++ runtime. Reinstall SVP, or install the latest \"Visual C++ Redistributable (x64)\" from Microsoft, then reopen Harbor.",
            { err: status?.load_error ?? "load error" },
          )}
        </div>
      </SettingsModal>
    </Section>
  );
}

function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`shrink-0 rounded-full bg-canvas px-2.5 py-1 text-[11.5px] font-semibold tracking-wide ${
        tone === "ok" ? "text-success" : tone === "bad" ? "text-danger" : "text-ink-subtle"
      }`}
    >
      {children}
    </span>
  );
}

function RowAction({
  onClick,
  primary,
  disabled,
  children,
}: {
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`harbor-press-pop flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3.5 text-[12.5px] font-semibold transition-opacity disabled:opacity-60 ${
        primary ? "bg-ink text-canvas hover:opacity-90" : "bg-canvas text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
