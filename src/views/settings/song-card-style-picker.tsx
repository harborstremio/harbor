import { useSettings } from "@/lib/settings";

import { Section, ToggleRow } from "./shared";

type SongCardStyle = "compact" | "cinematic";

export function SongCardStylePicker() {
  const { settings, update } = useSettings();
  const enabled = settings.songIdEnabled ?? false;
  const value = (settings.songCardStyle ?? "cinematic") as SongCardStyle;

  const options: { v: SongCardStyle; label: string; desc: string }[] = [
    {
      v: "compact",
      label: "Compact",
      desc: "Spinning disc beside the title with a small control bar.",
    },
    {
      v: "cinematic",
      label: "Cinematic",
      desc: "Large centered cover on a dark card with the disc behind it.",
    },
  ];

  return (
    <Section
      title="Now Playing card"
      subtitle="Adds an Identify-song button to the player that recognizes the current music via AudD and shows a Now Playing card. Off by default; needs an AudD key below."
    >
      <ToggleRow
        label="Identify the current song"
        sub="Show the in-player Identify-song button and Now Playing card."
        value={enabled}
        onChange={(v) => update({ songIdEnabled: v })}
      />

      <div className={`flex flex-col gap-4 ${enabled ? "" : "pointer-events-none opacity-40"}`}>
        <div className="grid grid-cols-2 gap-3">
          {options.map((o) => {
            const active = value === o.v;
            return (
              <button
                key={o.v}
                type="button"
                aria-pressed={active}
                onClick={() => update({ songCardStyle: o.v })}
                className={`flex flex-col gap-3 rounded-2xl border p-3 text-left transition-colors ${
                  active ? "border-accent bg-accent/10" : "border-edge-soft bg-canvas/50 hover:border-edge"
                }`}
              >
                <StyleThumb kind={o.v} />
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                      active ? "border-accent" : "border-edge"
                    }`}
                  >
                    {active ? <span className="h-2 w-2 rounded-full bg-accent" /> : null}
                  </span>
                  <span className="text-[13px] font-semibold text-ink">{o.label}</span>
                </div>
                <span className="text-[12px] leading-snug text-ink-muted">{o.desc}</span>
              </button>
            );
          })}
        </div>

        <ToggleRow
          label="Show track details"
          sub="Display the artist and album under the title on the card."
          value={settings.songCardDetails ?? true}
          onChange={(v) => update({ songCardDetails: v })}
        />
      </div>
    </Section>
  );
}

function StyleThumb({ kind }: { kind: SongCardStyle }) {
  if (kind === "compact") {
    return (
      <div className="flex h-24 w-full items-center gap-2.5 rounded-xl bg-black p-3">
        <Disc />
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="h-2 w-3/4 rounded bg-white/70" />
          <div className="h-1.5 w-1/2 rounded bg-white/30" />
          <MiniControls />
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-xl bg-black p-3">
      <Disc />
      <div className="h-1.5 w-2/3 rounded bg-white/70" />
      <div className="h-1 w-1/2 rounded bg-white/30" />
      <MiniControls />
    </div>
  );
}

function Disc() {
  return (
    <div className="relative h-9 w-9 flex-none rounded-full bg-gradient-to-br from-neutral-600 to-black ring-1 ring-white/10">
      <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40" />
    </div>
  );
}

function MiniControls() {
  return (
    <div className="mt-1 flex items-center gap-1.5">
      <div className="h-1.5 w-1.5 rounded-full bg-white/30" />
      <div className="h-2.5 w-2.5 rounded-full bg-white" />
      <div className="h-1.5 w-1.5 rounded-full bg-white/30" />
    </div>
  );
}
