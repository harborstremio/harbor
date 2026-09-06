import { AlertTriangle, ExternalLink, Loader2, Play } from "../icons";
import { useEffect, useState, type ReactNode } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { isLinuxDesktop } from "@/lib/platform";
import { openUrl } from "@/lib/window";
import { svpApply, svpLaunch, svpStatus, type SvpStatus } from "@/lib/svp";
import { ROW_DESC, Section, ToggleRow, Segmented } from "../shared";
import {
  ModalButton,
  ROW_ACTION,
  ROW_ACTION_PRIMARY,
  SettingGroup,
  SettingRow,
  SettingsModal,
  Nested,
} from "../kit";

type Tone = "neutral" | "ok" | "bad";

export function SvpSection() {
  const { settings, update } = useSettings();
  const t = useT();
  const [status, setStatus] = useState<SvpStatus | null>(null);
  const [statusFailed, setStatusFailed] = useState(false);
  const [checkAttempt, setCheckAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fixOpen, setFixOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatusFailed(false);
    svpStatus()
      .then((next) => { if (!cancelled) setStatus(next); })
      .catch(() => { if (!cancelled) setStatusFailed(true); });
    return () => { cancelled = true; };
  }, [checkAttempt]);

  const installed = status?.installed ?? false;
  const ready = status?.ready ?? false;
  const checking = status === null && !statusFailed;
  const supported = status?.supported ?? false;
  const linux = isLinuxDesktop();
  const loadFailed = status?.loadable === false;
  const getUrl = linux ? "https://www.svp-team.com/wiki/SVP:Linux" : "https://www.svp-team.com/get/";

  const openSvp = async () => {
    if (busy) return;
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
    if (busy) return;
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

  const engine: { pill: string; tone: Tone; desc: string } = statusFailed
    ? {
        pill: t("Check failed"),
        tone: "bad",
        desc: t("Harbor couldn't check the SVP installation. Try again."),
      }
    : checking
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
                  "Install SVP with its VapourSynth components, then check again so Harbor can find them.",
                ),
              };

  return (
    <Section
      title={t("SVP frame interpolation")}
      subtitle={
        linux
          ? t(
              "Uses your Linux SVP and VapourSynth installation to smooth motion inside Harbor's player.",
            )
          : t(
              "Uses SVP to smooth motion inside Harbor's player. Install SVP once; Harbor uses its engine and opens SVP Manager when needed.",
            )
      }
    >
      <SettingGroup label={t("Setup")}>
        <SettingRow wide label={t("SVP engine")} desc={engine.desc}>
          <span className="flex w-full min-w-0 flex-wrap items-center gap-2.5">
            <StatusReadout tone={engine.tone}>{engine.pill}</StatusReadout>
            {!checking && (
              <button
                type="button"
                onClick={() => { setStatus(null); setCheckAttempt((n) => n + 1); }}
                className={ROW_ACTION}
              >
                {t("Check again")}
              </button>
            )}
            {loadFailed && (
              <button type="button" onClick={() => setFixOpen(true)} className={ROW_ACTION}>
                {t("How to fix")}
              </button>
            )}
            {!supported ? null : installed ? (
              <button
                type="button"
                onClick={busy ? undefined : openSvp}
                aria-disabled={busy}
                className={`${ROW_ACTION}${busy ? " pointer-events-none opacity-45" : ""}`}
              >
                {busy ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Play size={18} strokeWidth={2.2} />
                )}
                {t("Open SVP")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openUrl(getUrl)}
                className={ROW_ACTION_PRIMARY}
              >
                {t("Get SVP")}
                <ExternalLink size={16} strokeWidth={2.2} />
              </button>
            )}
          </span>
        </SettingRow>
      </SettingGroup>

      <SettingGroup label={t("Playback")}>
        <ToggleRow
          label={t("Enable SVP")}
          sub={
            ready
              ? linux
                ? t(
                    "Uses SVP's motion engine through VapourSynth. Restart playback to apply.",
                  )
                : t(
                    "Smooths motion using SVP. Restart playback to apply; turn this off if video will not play.",
                  )
              : t(
                  "Install SVP and check again before enabling it.",
                )
          }
          value={settings.playerSvp}
          onChange={(v) => void onToggle(v)}
          lockReason={
            busy
              ? t("Setting up SVP…")
              : settings.playerSvp
                ? undefined
                : checking
                  ? t("Checking SVP installation…")
                  : statusFailed
                    ? t("Check the SVP installation above before enabling it.")
                    : !supported
                      ? (status?.reason ?? t("SVP is not supported by this Harbor package."))
                      : !ready || loadFailed
                        ? t("Finish setting up the SVP engine above before enabling it.")
                        : undefined
          }
        />

        <Nested>
          <SettingRow
            wide
            label={t("Apply SVP to")}
            desc={t(
              "Choose which videos use motion smoothing. Restart playback to apply.",
            )}
            lockReason={
              settings.playerSvp
                ? undefined
                : t("Turn on SVP above to choose where interpolation applies.")
            }
          >
            <fieldset
              disabled={!settings.playerSvp}
              className={`w-full min-w-0 ${settings.playerSvp ? "" : "pointer-events-none"}`}
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
            </fieldset>
          </SettingRow>
        </Nested>
      </SettingGroup>

      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-[10px] bg-elevated px-4 py-3">
          <AlertTriangle size={18} strokeWidth={2.4} className="mt-[2px] shrink-0 text-danger" />
          <p className={`max-w-[66ch] ${ROW_DESC}`}>{error}</p>
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
        <p className={`max-w-[70ch] ${ROW_DESC}`}>
          {t(
            "SVP's files are here but its VapourSynth engine won't load ({err}). This usually means a stale VapourSynth entry or a missing Microsoft VC++ runtime. Reinstall SVP, or install the latest \"Visual C++ Redistributable (x64)\" from Microsoft, then reopen Harbor.",
            { err: status?.load_error ?? "load error" },
          )}
        </p>
      </SettingsModal>
    </Section>
  );
}

function StatusReadout({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className="flex h-11 shrink-0 items-center gap-2 text-[15.5px] leading-[22px] text-ink-muted">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          tone === "ok" ? "bg-success" : tone === "bad" ? "bg-danger" : "bg-edge"
        }`}
      />
      {children}
    </span>
  );
}
