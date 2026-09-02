import { SlidersHorizontal } from "lucide-react";
import type { ShaderCatalogEntry } from "@/lib/player/shader-catalog";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Segmented, ToggleRow } from "../shared";
import { SettingRow, Nested } from "../kit";
import { Pill } from "./action-button";
import { appliesLabel, STAGE_ICON, TIER_LABEL } from "./stages";

export function ShaderRow({ entry }: { entry: ShaderCatalogEntry }) {
  const { settings, update } = useSettings();
  const t = useT();
  const state = settings.playerShaders?.[entry.id];
  const enabled = !!state?.enabled;
  const Icon = STAGE_ICON[entry.stage];

  const conflicted = entry.conflictsWith?.some((c) =>
    c === "hdrToSdr" ? settings.playerHdrToSdr : c === "rtxHdr" ? settings.playerRtxHdr : false,
  );
  const lockReason = conflicted
    ? t(
        "Harbor's built-in HDR to SDR conversion is on. Turn it off in Video tuning to use this instead. Running both double-processes the picture.",
      )
    : undefined;

  const patch = (next: { enabled?: boolean; variant?: string; dir?: string }) => {
    const prev = settings.playerShaders?.[entry.id] ?? { enabled: false };
    update({ playerShaders: { ...settings.playerShaders, [entry.id]: { ...prev, ...next } } });
  };

  const variants = entry.variants ?? [];
  const variantId = state?.variant ?? variants[0]?.id;
  const activeVariant = variants.find((v) => v.id === variantId) ?? variants[0];

  return (
    <>
      <ToggleRow
        label={t(entry.name)}
        leading={<Icon size={16} strokeWidth={2.2} className="text-ink-muted" />}
        sub={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Pill>{t(TIER_LABEL[entry.tier])}</Pill>
            <span>{t(appliesLabel(entry.content))}</span>
          </span>
        }
        value={enabled}
        onChange={(v) => patch({ enabled: v })}
        lockReason={lockReason}
      />
      {enabled && !lockReason && variants.length > 1 && activeVariant && (
        <Nested>
          <SettingRow
            label={t("Variant")}
            desc={t(activeVariant.sub)}
            icon={<SlidersHorizontal size={16} strokeWidth={2.2} />}
          >
            <Segmented
              value={activeVariant.id}
              options={variants.map((v) => ({ value: v.id, label: v.label }))}
              onChange={(v) => patch({ variant: v })}
            />
          </SettingRow>
        </Nested>
      )}
    </>
  );
}
