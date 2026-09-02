import { Check, Download, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { downloadShader } from "@/lib/shaders";
import { SHADER_CATALOG, type ShaderCatalogEntry } from "@/lib/player/shader-catalog";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { ExtLink } from "../shared";
import { ModalButton, SettingGroup, SettingsModal } from "../kit";
import { ActionButton, Pill } from "./action-button";
import { BeforeAfter } from "./before-after";
import { CONTENT_LABEL, STAGE_ICON, STAGE_LABEL, STAGE_SEQUENCE, TIER_LABEL } from "./stages";

function LibraryEntry({ entry }: { entry: ShaderCatalogEntry }) {
  const { settings, update } = useSettings();
  const t = useT();
  const state = settings.playerShaders?.[entry.id];
  const installed = !!state?.dir;
  const [busy, setBusy] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Icon = STAGE_ICON[entry.stage];

  const install = async (force = false) => {
    setBusy(true);
    setError(null);
    setJustUpdated(false);
    try {
      const dir = await downloadShader(entry.id, force);
      const prev = settings.playerShaders?.[entry.id] ?? { enabled: false };
      update({
        playerShaders: {
          ...settings.playerShaders,
          [entry.id]: { ...prev, dir, enabled: force ? state?.enabled : true },
        },
      });
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

  return (
    <div className="flex flex-col gap-3 rounded-md bg-elevated p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-ink-muted">
          <Icon size={16} strokeWidth={2.2} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-semibold text-ink">{t(entry.name)}</span>
            <Pill>{t(CONTENT_LABEL[entry.content])}</Pill>
            <Pill>{t(TIER_LABEL[entry.tier])}</Pill>
            {entry.verify && <Pill>{t("Unverified")}</Pill>}
            {installed && <Pill on={!!state?.enabled}>{state?.enabled ? t("On") : t("Installed")}</Pill>}
          </div>
          <span className="text-[12.5px] leading-relaxed text-ink-subtle">
            {t(entry.description)}
          </span>
          <span className="text-[11.5px] text-ink-muted">
            <ExtLink href={entry.source.url}>{entry.source.label}</ExtLink>
          </span>
        </div>
      </div>

      {entry.demo && <BeforeAfter demo={entry.demo} />}

      {error && (
        <span className="rounded-md bg-canvas px-3 py-2 text-[12.5px] leading-relaxed text-danger">
          {error}
        </span>
      )}

      {!installed ? (
        <ActionButton onClick={() => install(false)} disabled={busy}>
          {busy ? (
            <Loader2 size={14} className="animate-spin motion-reduce:hidden" strokeWidth={2.4} />
          ) : (
            <Download size={14} strokeWidth={2.4} />
          )}
          {busy ? t("Downloading…") : t("Download shader")}
        </ActionButton>
      ) : (
        <ActionButton ghost onClick={() => install(true)} disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={14} className="animate-spin motion-reduce:hidden" strokeWidth={2.4} />
              {t("Updating…")}
            </>
          ) : justUpdated ? (
            <>
              <Check size={14} strokeWidth={3} className="text-success" />
              {t("Updated")}
            </>
          ) : (
            <>
              <RefreshCw size={14} strokeWidth={2.4} />
              {t("Re-download")}
            </>
          )}
        </ActionButton>
      )}
    </div>
  );
}

export function ShaderLibraryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <SettingsModal
      open={open}
      onClose={onClose}
      title={t("Shader library")}
      sub={t(
        "Each shader is hosted by its author, not bundled with Harbor. Download the ones you want; Harbor chains them in the right order and applies them in the player.",
      )}
      actions={<ModalButton onClick={onClose}>{t("Done")}</ModalButton>}
    >
      {STAGE_SEQUENCE.map((stage) => {
        const items = SHADER_CATALOG.filter((e) => e.stage === stage);
        if (items.length === 0) return null;
        return (
          <SettingGroup key={stage} label={t(STAGE_LABEL[stage])}>
            {items.map((entry) => (
              <LibraryEntry key={entry.id} entry={entry} />
            ))}
          </SettingGroup>
        );
      })}
    </SettingsModal>
  );
}
