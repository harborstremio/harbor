export type AudioProfileId = "off" | "bass" | "voice" | "bass-reduce" | "night" | "night-strong";

type Translate = (key: string) => string;

type AudioProfileDefinition = {
  label: (translate: Translate) => string;
  hint: (translate: Translate) => string;
  filter: string;
};

const AUDIO_PROFILE_DEFINITIONS = {
  off: {
    label: (t) => t("Flat"),
    hint: (t) => t("No shaping. The file plays as mastered."),
    filter: "",
  },
  bass: {
    label: (t) => t("Bass boost"),
    hint: (t) => t("Lifts the low end for small speakers."),
    filter: "lavfi=[bass=g=7:f=110:w=0.6]",
  },
  voice: {
    label: (t) => t("Vocal clarity"),
    hint: (t) => t("Cuts mud and lifts the dialogue band."),
    filter: "lavfi=[equalizer=f=300:t=q:w=1:g=-3,equalizer=f=2800:t=q:w=1:g=5]",
  },
  "bass-reduce": {
    label: (t) => t("Less bass"),
    hint: (t) => t("Trims the low end without touching the rest."),
    filter: "lavfi=[bass=g=-8:f=110:w=0.6]",
  },
  night: {
    label: (t) => t("Night mode"),
    hint: (t) => t("Gently compresses loud moments for late-night watching."),
    filter: "lavfi=[acompressor=ratio=3:threshold=-20dB:attack=20:release=300:makeup=4dB]",
  },
  "night-strong": {
    label: (t) => t("Night Strong"),
    hint: (t) =>
      t(
        "Compresses loud effects harder than Night mode and tames deep bass and harsh highs, so quiet dialogue stays clear at very low volume.",
      ),
    // Drop the sub-bass rumble that carries through walls, trim the low end, compress hard
    // so whispers and explosions land near the same level, then restore the dialogue band
    // and soften the sibilance that heavy compression exposes.
    filter:
      "lavfi=[highpass=f=45,bass=g=-6:f=110:w=0.6,acompressor=ratio=6:threshold=-28dB:attack=5:release=250:knee=8:makeup=12dB,equalizer=f=2200:t=q:w=1.1:g=4,treble=g=-4:f=9000:w=0.5]",
  },
} satisfies Record<AudioProfileId, AudioProfileDefinition>;

export type AudioProfileOption = {
  value: AudioProfileId;
  label: string;
};

function isAudioProfileId(value: unknown): value is AudioProfileId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(AUDIO_PROFILE_DEFINITIONS, value)
  );
}

export function resolveAudioProfileId(value: unknown): AudioProfileId {
  return isAudioProfileId(value) ? value : "off";
}

export function audioProfileOptions(translate: Translate): AudioProfileOption[] {
  return (
    Object.entries(AUDIO_PROFILE_DEFINITIONS) as Array<[AudioProfileId, AudioProfileDefinition]>
  ).map(([value, definition]) => ({ value, label: definition.label(translate) }));
}

export function audioProfileHint(profile: unknown, translate: Translate): string {
  const resolved = resolveAudioProfileId(profile);
  return AUDIO_PROFILE_DEFINITIONS[resolved].hint(translate);
}

export function buildAudioFilterChain(profile: unknown, normalize: boolean): string {
  const parts: string[] = [];
  if (normalize) parts.push("dynaudnorm=f=500:g=31:p=0.9:m=4");
  if (isAudioProfileId(profile) && AUDIO_PROFILE_DEFINITIONS[profile].filter) {
    parts.push(AUDIO_PROFILE_DEFINITIONS[profile].filter);
  }
  if (parts.length > 0) parts.push("lavfi=[alimiter=limit=0.97]");
  return parts.join(",");
}
