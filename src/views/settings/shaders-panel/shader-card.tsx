import { Check, Download, ExternalLink, Loader2, RefreshCw } from "../icons";
import { useEffect, useRef, useState } from "react";
import { downloadShader } from "@/lib/shaders";
import { tvFocus } from "@/lib/keyboard-navigation";
import { navOwnsFocus } from "@/lib/keyboard-navigation/geometry";
import type { ShaderCatalogEntry } from "@/lib/player/shader-catalog";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { RowNote, Segmented, ToggleRow } from "../shared";
import { Nested, ROW_ACTION, ROW_ACTION_PRIMARY, SettingRow } from "../kit";
import { SRow } from "../ui";
import { BeforeAfter } from "./before-after";
import { appliesLabel, segmentedWide, TIER_LOAD } from "./stages";
import amdLogo from "@/assets/shader-logos/amd.svg?url";
import nvidiaLogo from "@/assets/shader-logos/nvidia.svg?url";
import qualcommLogo from "@/assets/shader-logos/qualcomm.svg?url";

const SHADER_LOGO: Record<string, string> = {
  fsr: amdLogo,
  cas: amdLogo,
  nis: nvidiaLogo,
  sgsr: qualcommLogo,
};

const SHADER_MARK: Record<string, string> = {
  fsrcnnx: "FSX",
  ravu: "RAVU",
  nnedi3: "NN3",
  ssimsuperres: "SSR",
  krig: "KRIG",
  "adaptive-sharpen": "AS",
  "hdr-toys": "HDR",
};

function ShaderMark({ id }: { id: string }) {
  const logo = SHADER_LOGO[id];
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-elevated text-ink-muted">
      {logo ? (
        <img
          src={logo}
          alt=""
          aria-hidden
          className="h-[18px] w-[18px] object-contain"
          style={{ filter: "brightness(0) invert(0.72)" }}
        />
      ) : (
        <span className="text-[10.5px] font-bold leading-none tracking-tight">
          {SHADER_MARK[id] ?? id.slice(0, 3).toUpperCase()}
        </span>
      )}
    </span>
  );
}

export function ShaderCard({ entry }: { entry: ShaderCatalogEntry }) {
  const t = useT();
  const { settings, update } = useSettings();
  const state = settings.playerShaders?.[entry.id];
  const installed = !!state?.dir;
  const enabled = !!state?.enabled;
  const [busy, setBusy] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const downloadRef = useRef<HTMLButtonElement | null>(null);
  const handoff = useRef<{ parent: HTMLElement; index: number } | null>(null);

  useEffect(() => {
    const slot = handoff.current;
    handoff.current = null;
    if (!installed || !slot) return;
    const active = document.activeElement;
    if (active && active !== document.body && active !== document.documentElement) return;
    const row = slot.parent.children[slot.index];
    if (row instanceof HTMLElement) tvFocus(row);
  }, [installed]);

  const lockReason = entry.conflictsWith?.some((c) =>
    c === "hdrToSdr" ? settings.playerHdrToSdr : c === "rtxHdr" ? settings.playerRtxHdr : false,
  )
    ? t(
        "Harbor's built-in HDR to SDR conversion is on. Turn it off in Video tuning to use this instead. Running both double-processes the picture.",
      )
    : undefined;

  const patch = (next: { enabled?: boolean; variant?: string; dir?: string }) => {
    const prev = settings.playerShaders?.[entry.id] ?? { enabled: false };
    update({ playerShaders: { ...settings.playerShaders, [entry.id]: { ...prev, ...next } } });
  };

  const install = async (force = false) => {
    setBusy(true);
    setError(null);
    setJustUpdated(false);
    try {
      const dir = await downloadShader(entry.id, force);
      patch({ dir, enabled: force ? state?.enabled : true });
      if (force) {
        setJustUpdated(true);
        window.setTimeout(() => setJustUpdated(false), 2200);
      }
    } catch (e) {
      setError(
        typeof e === "string" ? e : t("Download failed. Check your connection and try again."),
      );
    } finally {
      setBusy(false);
    }
  };

  const startDownload = () => {
    if (busy) return;
    const btn = downloadRef.current;
    const row = btn && navOwnsFocus(btn) ? btn.closest<HTMLElement>(".hset-row") : null;
    const parent = row?.parentElement ?? null;
    handoff.current = row && parent ? { parent, index: [...parent.children].indexOf(row) } : null;
    void install(false);
  };

  const variants = entry.variants ?? [];
  const variantId = state?.variant ?? variants[0]?.id;
  const activeVariant = variants.find((v) => v.id === variantId) ?? variants[0];

  const detail = (
    <span className="flex flex-col gap-1">
      <span>{t(entry.description)}</span>
      <span>
        {t(TIER_LOAD[entry.tier])} {t(appliesLabel(entry.content))}
      </span>
    </span>
  );

  const verifyNote = entry.verify
    ? t("Not verified on macOS yet. It needs the gpu-next renderer, which is reliable on Windows.")
    : undefined;

  return (
    <>
      {installed ? (
        <ToggleRow
          label={t(entry.name)}
          leading={<ShaderMark id={entry.id} />}
          sub={detail}
          value={enabled}
          onChange={(v) => patch({ enabled: v })}
          lockReason={lockReason}
          warn={verifyNote}
        />
      ) : (
        <SettingRow
          label={t(entry.name)}
          icon={<ShaderMark id={entry.id} />}
          desc={detail}
          warn={verifyNote}
        >
          <button
            ref={downloadRef}
            type="button"
            onClick={startDownload}
            aria-busy={busy}
            className={ROW_ACTION_PRIMARY}
          >
            {busy ? (
              <Loader2 size={17} className="animate-spin motion-reduce:hidden" />
            ) : (
              <Download size={17} strokeWidth={2.2} />
            )}
            {busy ? t("Downloading…") : t("Download shader")}
          </button>
        </SettingRow>
      )}

      <Nested>
        {error && <RowNote>{error}</RowNote>}

        {entry.demo && <BeforeAfter demo={entry.demo} />}

        {installed && enabled && !lockReason && variants.length > 1 && activeVariant && (
          <SettingRow
            label={t("Variant")}
            desc={t(activeVariant.sub)}
            wide={segmentedWide(variants.map((v) => v.label))}
          >
            <Segmented
              value={activeVariant.id}
              options={variants.map((v) => ({ value: v.id, label: v.label }))}
              onChange={(v) => patch({ variant: v })}
            />
          </SettingRow>
        )}

        {installed && (
          <SettingRow
            label={t("Shader files")}
            desc={t(
              "Downloaded and ready to use. Re-download to pick up a newer version from the author.",
            )}
          >
            <button
              type="button"
              onClick={() => {
                if (busy) return;
                void install(true);
              }}
              aria-busy={busy}
              className={ROW_ACTION}
            >
              {busy ? (
                <>
                  <Loader2 size={17} className="animate-spin motion-reduce:hidden" />
                  {t("Updating…")}
                </>
              ) : justUpdated ? (
                <>
                  <Check size={17} strokeWidth={2.6} className="text-success" />
                  {t("Updated")}
                </>
              ) : (
                <>
                  <RefreshCw size={17} strokeWidth={2.2} />
                  {t("Re-download")}
                </>
              )}
            </button>
          </SettingRow>
        )}

        <SRow
          title={t("Source")}
          description={entry.source.label}
          onClick={() => openUrl(entry.source.url)}
          trailing={<ExternalLink size={18} className="shrink-0 text-ink-subtle" />}
        />
      </Nested>
    </>
  );
}
