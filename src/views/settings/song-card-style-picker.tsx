import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow, settingsAnchor, useSettingsActiveContext } from "./shared";
import { ROW_ACTION } from "./kit";
import { SongIdCard, type SongCardStyle } from "@/components/song-id-card";
import songArtwork from "@/assets/settings-preview/maple-leaf-rag.webp";
import filmStill from "@/assets/settings-preview/steamboat-river.webp";

export function SongCardStylePicker() {
  const { settings, update } = useSettings();
  const t = useT();
  const { setActive } = useSettingsActiveContext();
  const enabled = settings.songIdEnabled ?? false;
  const value = (settings.songCardStyle ?? "cinematic") as SongCardStyle;

  const options: { v: SongCardStyle; label: string; desc: string }[] = [
    {
      v: "compact",
      label: t("Compact"),
      desc: t("A small card with artwork beside the song title."),
    },
    {
      v: "cinematic",
      label: t("Cinematic"),
      desc: t("Larger artwork with the song title below it."),
    },
  ];

  return (
    <Section
      title={t("Now Playing card")}
      subtitle={t(
        "Show the song and artist when you identify music in the player. Choose your recognition service in Metadata.",
      )}
    >
      <ToggleRow
        label={t("Identify the current song")}
        sub={t("Adds the song identification button to the player.")}
        value={enabled}
        onChange={(v) => update({ songIdEnabled: v })}
      />

      {enabled && <div className="flex w-full flex-col items-start gap-4">
        <button type="button" className={ROW_ACTION} onClick={() => setActive("library", settingsAnchor("Song identification"))}>
          {t("Set up song identification")}
        </button>
        <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4">
          {options.map((o) => {
            const active = value === o.v;
            return (
              <button
                key={o.v}
                type="button"
                aria-pressed={active}
                aria-label={o.label}
                onClick={() => update({ songCardStyle: o.v })}
                className={`flex min-w-0 flex-col gap-3 rounded-[12px] border p-4 text-start transition-colors ${
                  active
                    ? "border-accent bg-accent-soft"
                    : "border-edge-soft bg-canvas hover:border-edge"
                }`}
              >
                <StyleThumb kind={o.v} showDetails={settings.songCardDetails ?? true} />
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      active ? "border-accent" : "border-edge"
                    }`}
                  >
                    {active ? <span className="h-2.5 w-2.5 rounded-full bg-accent" /> : null}
                  </span>
                  <span className="text-[16.5px] font-medium leading-[24px] tracking-[-0.1px] text-ink">{o.label}</span>
                </div>
                <span className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">{o.desc}</span>
              </button>
            );
          })}
        </div>

        <ToggleRow
          label={t("Show track details")}
          sub={t("Display the artist and album under the title on the card.")}
          value={settings.songCardDetails ?? true}
          onChange={(v) => update({ songCardDetails: v })}
        />
      </div>}
    </Section>
  );
}

function StyleThumb({ kind, showDetails }: { kind: SongCardStyle; showDetails: boolean }) {
  return (
    <div aria-hidden className="relative flex h-[280px] w-full items-center justify-center overflow-hidden rounded-[8px] bg-black">
      <img src={filmStill} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover opacity-35" />
      <div className="relative" style={{ zoom: 0.72 }}>
        <SongIdCard
          message={{ kind: "result", title: "Maple Leaf Rag", body: "Scott Joplin", art: songArtwork }}
          style={kind}
          showDetails={showDetails}
          animateArtwork={false}
        />
      </div>
    </div>
  );
}
