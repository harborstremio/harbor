import { useState } from "react";
import { badgeLabel, FormatBadge, type BadgeKind } from "@/components/format-badge";
import { emitListToast } from "@/components/lists/list-toast";
import { setBadgeOverride, useBadgeState } from "@/lib/stream-badges";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { Section, ToggleRow } from "../shared";
import { SettingGroup } from "../kit";
import { ConfirmButton } from "./confirm-button";
import { KindEditorModal } from "./kind-editor-modal";

const GROUPS: Array<{ label: string; kinds: BadgeKind[] }> = [
  {
    label: "Resolution",
    kinds: ["8k", "4k-uhd", "uhd", "2k-qhd", "1080p", "1080i", "720p", "576p", "480p", "360p", "hd", "sd"],
  },
  {
    label: "Source",
    kinds: ["remux", "bluray", "webdl", "webrip", "hdtv", "dvb", "dvd", "3d", "imax", "cam", "hdcam", "telesync", "hdts", "telecine", "scr", "wp"],
  },
  { label: "HDR", kinds: ["dv", "hdr10-plus", "hdr10", "hdr", "hlg", "sdr"] },
  { label: "Codec", kinds: ["hevc", "av1"] },
  {
    label: "Audio",
    kinds: ["atmos", "atmos-912", "truehd", "dts-hd-ma", "dts-hd", "dts-x", "dts", "ddp", "dd", "eac3", "ac3", "aac", "flac", "mp3", "opus", "pcm", "lpcm", "stereo", "mono", "5.1", "7.1"],
  },
  { label: "Flags", kinds: ["extended", "remastered", "repack", "no-label", "unknown"] },
];

export function BadgesTab() {
  const t = useT();
  const state = useBadgeState();
  const { settings, update } = useSettings();
  const [selected, setSelected] = useState<BadgeKind | null>(null);
  const overrideCount = Object.keys(state.overrides).length;

  return (
    <>
      <Section
        title={t("Stream format chips")}
        subtitle={t("The little 4K, HDR, codec, and audio chips that ride along each stream in the play picker.")}
        newId="badges:stream-format-chips"
      >
        <ToggleRow
          label={t("Show format chips on stream rows")}
          sub={t("The picker tags each stream with resolution, HDR flavor, codec, and audio format. Off hides them all.")}
          value={settings.showQualityBadge}
          onChange={(v) => update({ showQualityBadge: v })}
        />
      </Section>

      <Section
        title={t("Badge art")}
        subtitle={t("Every format badge Harbor can show on streams. Click one to swap its art, hide it, or reset it. Changes apply everywhere badges appear.")}
      >
        {overrideCount > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-md bg-elevated px-4 py-2.5">
            <span className="text-[12.5px] text-ink-subtle">
              {t("{n} badges customized", { n: overrideCount })}
            </span>
            <ConfirmButton
              label={t("Reset all art")}
              confirmLabel={t("Tap again to reset {n} badges", { n: overrideCount })}
              onConfirm={() => {
                for (const k of Object.keys(state.overrides) as BadgeKind[]) {
                  setBadgeOverride(k, null);
                }
                emitListToast(t("Badge art back to default"));
              }}
            />
          </div>
        )}
        {GROUPS.map((g) => (
          <SettingGroup key={g.label} label={t(g.label)}>
            <div className="flex flex-wrap gap-1.5">
              {g.kinds.map((k) => {
                const o = state.overrides[k];
                const isSel = selected === k;
                return (
                  <button
                    key={k}
                    onClick={() => setSelected(k)}
                    title={badgeLabel(k)}
                    className={`relative flex h-16 min-w-[74px] items-center justify-center rounded-md px-3 transition-colors ${
                      isSel ? "bg-accent-soft" : "bg-elevated hover:bg-raised"
                    } ${o?.hidden ? "opacity-40" : ""}`}
                  >
                    {o?.hidden ? (
                      <span className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-subtle">
                        {badgeLabel(k)}
                      </span>
                    ) : (
                      <FormatBadge kind={k} size="sm" />
                    )}
                    {(o?.image || o?.hidden) && (
                      <span className="absolute -end-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent" />
                    )}
                  </button>
                );
              })}
            </div>
          </SettingGroup>
        ))}
        {selected && <KindEditorModal kind={selected} onClose={() => setSelected(null)} />}
      </Section>
    </>
  );
}
