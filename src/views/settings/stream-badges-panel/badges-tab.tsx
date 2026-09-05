import { useRef, useState } from "react";
import { EyeOff, Palette } from "lucide-react";
import { badgeLabel, FormatBadge, type BadgeKind } from "@/components/format-badge";
import { emitListToast } from "@/components/lists/list-toast";
import { setBadgeOverride, useBadgeState } from "@/lib/stream-badges";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { Section, ToggleRow } from "../shared";
import { SettingGroup, SettingRow } from "../kit";
import { usePageActions } from "../page-actions";
import { handoffFocus } from "./focus-handoff";
import { KindEditorModal } from "./kind-editor-modal";
import { StreamRowPreview } from "./stream-row-preview";

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

const TILE_GRID = "grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2.5";

export function BadgesTab() {
  const t = useT();
  const state = useBadgeState();
  const { settings, update } = useSettings();
  const [selected, setSelected] = useState<BadgeKind | null>(null);
  const [armed, setArmed] = useState(false);
  const firstTileRef = useRef<HTMLButtonElement>(null);
  const overrideCount = Object.keys(state.overrides).length;

  usePageActions(
    overrideCount > 0
      ? [
          {
            id: `badges-reset-art-${overrideCount}`,
            tone: "danger",
            label: armed ? "Tap again to reset" : "Reset all badge art",
            onSelect: () => {
              if (!armed) {
                setArmed(true);
                window.setTimeout(() => setArmed(false), 3000);
                return;
              }
              setArmed(false);
              handoffFocus(() => {
                for (const k of Object.keys(state.overrides) as BadgeKind[]) {
                  setBadgeOverride(k, null);
                }
                emitListToast(t("Badge art back to default"));
              }, firstTileRef.current);
            },
          },
        ]
      : [],
    armed ? "There is no undo for this." : undefined,
  );

  return (
    <>
      <Section
        title={t("Stream format chips")}
        subtitle={t("The little 4K, HDR, codec, and audio chips that ride along each stream in the play picker.")}
        newId="badges:stream-format-chips"
      >
        <StreamRowPreview
          caption={t("Every change on this page shows up here first. The art you pick below rides on rows exactly like this one.")}
        />
        <ToggleRow
          label={t("Show format chips on stream rows")}
          sub={t("The picker tags each stream with resolution, HDR flavor, codec, and audio format. Off hides them all.")}
          value={settings.showQualityBadge}
          onChange={(v) => update({ showQualityBadge: v })}
        />
      </Section>

      <Section
        title={t("Badge art")}
        subtitle={t("Every format badge Harbor can show on streams. Pick one to swap its art, hide it, or put it back. Changes apply everywhere badges appear.")}
      >
        {overrideCount > 0 && (
          <SettingRow
            icon={<Palette size={18} strokeWidth={2} />}
            label={t("Badges you have changed")}
            desc={t("{n} badges use art you picked instead of Harbor's default.", { n: overrideCount })}
          />
        )}
        {GROUPS.map((g, gi) => (
          <SettingGroup key={g.label} label={t(g.label)}>
            <div className={TILE_GRID}>
              {g.kinds.map((k, ki) => {
                const o = state.overrides[k];
                const customized = !!(o?.image || o?.hidden);
                return (
                  <button
                    key={k}
                    ref={gi === 0 && ki === 0 ? firstTileRef : undefined}
                    type="button"
                    onClick={() => setSelected(k)}
                    className={`flex flex-col items-center gap-2 rounded-[10px] border bg-elevated p-2.5 text-center transition-colors ${
                      selected === k ? "border-accent" : "border-edge-soft hover:border-edge"
                    }`}
                  >
                    <span className="relative grid h-14 w-full place-items-center rounded-[6px] bg-canvas">
                      {o?.hidden ? (
                        <EyeOff size={20} strokeWidth={2} className="text-ink-subtle" />
                      ) : (
                        <FormatBadge kind={k} size="sm" />
                      )}
                      {customized && (
                        <span className="absolute end-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-accent" />
                      )}
                    </span>
                    <span className="w-full text-[15.5px] leading-[20px] text-ink">
                      {badgeLabel(k)}
                    </span>
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
