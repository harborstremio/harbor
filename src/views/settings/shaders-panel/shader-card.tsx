import { Check, Download, ExternalLink, Loader2, RefreshCw } from "lucide-react";
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
import { appliesLabel, segmentedWide, STAGE_ICON, TIER_LOAD } from "./stages";

export function ShaderCard({ entry }: { entry: ShaderCatalogEntry }) {
  const t = useT();
  const { settings, update } = useSettings();
  const state = settings.playerShaders?.[entry.id];
  const installed = !!state?.dir;
  const enabled = !!state?.enabled;
  const [busy, setBusy] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Icon = STAGE_ICON[entry.stage];
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
          leading={<Icon size={18} strokeWidth={2.2} />}
          sub={detail}
          value={enabled}
          onChange={(v) => patch({ enabled: v })}
          lockReason={lockReason}
          warn={verifyNote}
        />
      ) : (
        <SettingRow
          label={t(entry.name)}
          icon={<Icon size={18} strokeWidth={2.2} />}
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
