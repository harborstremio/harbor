import { Check, ExternalLink, Loader2, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { isLinuxDesktop } from "@/lib/platform";
import { openUrl } from "@/lib/window";
import { svpApply, svpLaunch, svpStatus, type SvpStatus } from "@/lib/svp";
import { Section, ToggleRow, Segmented } from "../shared";

export function SvpSection() {
  const { settings, update } = useSettings();
  const t = useT();
  const [status, setStatus] = useState<SvpStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <Step n={1} title={t("SVP (free)")} ok={ready && !loadFailed}>
        <p className="text-[12.5px] leading-relaxed text-ink-muted">
          {checking
            ? t("Checking the local SVP and VapourSynth installation...")
            : !supported
              ? t(status?.reason ?? "SVP is not supported by this Harbor package.")
              : loadFailed
                ? t(
                    "SVP's files are here but its VapourSynth engine won't load ({err}). This usually means a stale VapourSynth entry or a missing Microsoft VC++ runtime. Reinstall SVP, or install the latest \"Visual C++ Redistributable (x64)\" from Microsoft, then reopen Harbor.",
                    { err: status?.load_error ?? "load error" },
                  )
                : ready
                  ? linux
                    ? t(
                        "Installed and detected. Harbor found the native svpflow plugins and VapourSynth script library.",
                      )
                    : t(
                        "Installed and detected. Harbor found its interpolation engine and will drive it directly.",
                      )
                  : installed
                    ? t(
                        "SVP is installed but Harbor couldn't find its engine files (svpflow + VapourSynth). Try repairing the SVP install, or reopen SVP once.",
                      )
                    : t(
                        "Install SVP once (the free tier is enough). It bundles VapourSynth + svpflow; Harbor reuses them, no extra setup.",
                      )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {!supported ? null : installed ? (
            <button
              type="button"
              onClick={openSvp}
              disabled={busy}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-edge px-3 text-[12.5px] font-semibold text-ink transition-colors hover:bg-elevated disabled:opacity-60"
            >
              {busy ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Play size={13} strokeWidth={2.2} />
              )}
              {t("Open SVP")}
            </button>
          ) : (
            <LinkButton
              label={t("Get SVP (free)")}
              url={
                linux ? "https://www.svp-team.com/wiki/SVP:Linux" : "https://www.svp-team.com/get/"
              }
            />
          )}
        </div>
      </Step>

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

      {settings.playerSvp && (
        <div>
          <p className="mb-2 text-[12.5px] font-medium text-ink">{t("Apply SVP to")}</p>
          <Segmented
            value={settings.svpScope}
            options={[
              { value: "all", label: t("All content") },
              { value: "anime", label: t("Anime only") },
              { value: "non-anime", label: t("Movies & TV") },
            ]}
            onChange={(v) => update({ svpScope: v as "all" | "anime" | "non-anime" })}
          />
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-subtle">
            {t(
              "Frame interpolation shines on anime but can look off on live-action film. Limit it to the content you want, then restart playback.",
            )}
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-3 text-[12px] leading-snug text-ink">
          <span className="mt-0.5 shrink-0 font-bold text-danger">!</span>
          <span>{error}</span>
        </div>
      )}
    </Section>
  );
}

function Step({
  n,
  title,
  ok,
  children,
}: {
  n: number;
  title: string;
  ok?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3.5 rounded-xl border border-edge-soft bg-canvas/40 p-4">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
          ok ? "bg-emerald-500/15 text-emerald-400" : "bg-raised text-ink-muted"
        }`}
      >
        {ok ? <Check size={14} strokeWidth={2.8} /> : n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-[13.5px] font-semibold text-ink">{title}</span>
        {children}
      </div>
    </div>
  );
}

function LinkButton({ label, url }: { label: string; url: string }) {
  return (
    <button
      type="button"
      onClick={() => openUrl(url)}
      className="inline-flex items-center gap-1.5 self-start rounded-lg border border-edge bg-elevated/60 px-3 py-1.5 text-[11.5px] font-semibold text-ink transition-colors hover:border-ink"
    >
      {label}
      <ExternalLink size={11} strokeWidth={2.2} />
    </button>
  );
}
