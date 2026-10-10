import type { GateDecision, Outcome } from "./fp-gate";

export type MismatchKind = "none" | "translated-sub" | "unknown-language";
export type AsrStrategy = "direct" | "translate-to-en" | "autodetect" | "suppressed";
export type SelectionRole =
  | "sub-language-match"
  | "original-for-translated-sub"
  | "default-fallback"
  | "first-fallback"
  | "single-track";
export type SelectionSource = "mpv" | "ffprobe" | "fallback";

export type AudioTrackInfoLike = {
  lang?: string;
  title?: string;
  channels?: string;
  channelCount?: number;
  default?: boolean;
  selected?: boolean;
  external?: boolean;
  kind?: "audio" | "subtitle";
};

export type AudioTrackSelection = {
  aIndex: number;
  mapSpec: string;
  role: SelectionRole;
  audioLang?: string;
  subLang: string;
  languageMatch: boolean;
  mismatch: MismatchKind;
  asrStrategy: AsrStrategy;
  confidence: number;
  streamCount: number;
  source: SelectionSource;
};

export type RustTrackSelection = {
  aIndex: number;
  mapSpec: string;
  role: SelectionRole;
  audioLang?: string | null;
  subLang: string;
  languageMatch: boolean;
  mismatch: MismatchKind;
  asrStrategy: AsrStrategy;
  confidence: number;
  streamCount: number;
};

export type ProbeFn = (
  url: string,
  headers: Record<string, string> | undefined,
  subLang: string,
) => Promise<RustTrackSelection | null>;

const LANG_ALIAS: Record<string, string> = {
  jpn: "ja", eng: "en", spa: "es", por: "pt", rus: "ru", ita: "it", kor: "ko",
  ara: "ar", hin: "hi", tur: "tr", pol: "pl", swe: "sv", dan: "da", fin: "fi",
  nor: "no", nob: "no", heb: "he", tha: "th", vie: "vi", ind: "id", ukr: "uk",
  nld: "nl", dut: "nl", deu: "de", ger: "de", fra: "fr", fre: "fr", ces: "cs",
  cze: "cs", ell: "el", gre: "el", isl: "is", ice: "is", ron: "ro", rum: "ro",
  slk: "sk", slo: "sk", zho: "zh", chi: "zh", fas: "fa", per: "fa", sqi: "sq",
  alb: "sq", hye: "hy", arm: "hy", eus: "eu", baq: "eu", mya: "my", bur: "my",
  kat: "ka", geo: "ka", mkd: "mk", mac: "mk", mri: "mi", mao: "mi", msa: "ms",
  may: "ms", bod: "bo", tib: "bo", cym: "cy", wel: "cy",
};

const UNKNOWN_CODES = new Set(["und", "mul", "zxx", "mis", ""]);

export function normalizeLang(code: string | undefined | null): string | undefined {
  if (!code) return undefined;
  const base = code.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  if (UNKNOWN_CODES.has(base)) return undefined;
  if (base.length === 2) return base;
  return LANG_ALIAS[base] ?? base;
}

function channelsOf(t: AudioTrackInfoLike): number {
  if (typeof t.channelCount === "number" && t.channelCount > 0) return t.channelCount;
  const parsed = t.channels ? parseInt(t.channels, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function commentaryTitle(title: string | undefined): boolean {
  const t = (title ?? "").toLowerCase();
  return t.includes("comment") || t.includes("director");
}

function descriptiveTitle(title: string | undefined): boolean {
  const t = (title ?? "").toLowerCase();
  return (
    t.includes("descri") ||
    t.includes("audio description") ||
    t.includes("visual impair") ||
    t === "ad" ||
    t.endsWith(" ad")
  );
}

function asrFor(mismatch: MismatchKind, subN: string | undefined): AsrStrategy {
  if (mismatch === "none") return "direct";
  if (mismatch === "unknown-language") return "autodetect";
  return subN === "en" ? "translate-to-en" : "suppressed";
}

function containerAudio(tracks: AudioTrackInfoLike[]): AudioTrackInfoLike[] {
  return tracks.filter((t) => (t.kind ? t.kind === "audio" : true) && !t.external);
}

export function selectFromSnapshot(
  tracks: AudioTrackInfoLike[],
  subLang: string,
): AudioTrackSelection | null {
  const audio = containerAudio(tracks);
  if (audio.length === 0) return null;
  const subN = normalizeLang(subLang);

  const eligible = audio
    .map((t, i) => ({ t, i, lang: normalizeLang(t.lang) }))
    .filter(({ t }) => !commentaryTitle(t.title) && !descriptiveTitle(t.title));
  const pool = eligible.length > 0 ? eligible : audio.map((t, i) => ({ t, i, lang: normalizeLang(t.lang) }));

  if (subN) {
    const matches = pool.filter((e) => e.lang === subN);
    if (matches.length > 0) {
      matches.sort((a, b) => {
        const d = Number(b.t.default ?? false) - Number(a.t.default ?? false);
        if (d !== 0) return d;
        const c = channelsOf(b.t) - channelsOf(a.t);
        if (c !== 0) return c;
        return a.i - b.i;
      });
      const w = matches[0];
      return {
        aIndex: w.i,
        mapSpec: `0:a:${w.i}`,
        role: "sub-language-match",
        audioLang: w.lang,
        subLang,
        languageMatch: true,
        mismatch: "none",
        asrStrategy: "direct",
        confidence: 0.95,
        streamCount: audio.length,
        source: "mpv",
      };
    }
  }

  if (audio.length === 1) {
    const w = pool[0] ?? { t: audio[0], i: 0, lang: normalizeLang(audio[0].lang) };
    const mismatch: MismatchKind = w.lang && subN ? "translated-sub" : "unknown-language";
    return {
      aIndex: w.i,
      mapSpec: `0:a:${w.i}`,
      role: "single-track",
      audioLang: w.lang,
      subLang,
      languageMatch: false,
      mismatch,
      asrStrategy: asrFor(mismatch, subN),
      confidence: 0.6,
      streamCount: 1,
      source: "mpv",
    };
  }

  return null;
}

function fromRust(r: RustTrackSelection): AudioTrackSelection {
  return {
    aIndex: r.aIndex,
    mapSpec: r.mapSpec,
    role: r.role,
    audioLang: r.audioLang ?? undefined,
    subLang: r.subLang,
    languageMatch: r.languageMatch,
    mismatch: r.mismatch,
    asrStrategy: r.asrStrategy,
    confidence: r.confidence,
    streamCount: r.streamCount,
    source: "ffprobe",
  };
}

function fallbackSelection(subLang: string): AudioTrackSelection {
  const subN = normalizeLang(subLang);
  return {
    aIndex: 0,
    mapSpec: "0:a:0",
    role: "first-fallback",
    audioLang: undefined,
    subLang,
    languageMatch: false,
    mismatch: "unknown-language",
    asrStrategy: subN ? "autodetect" : "suppressed",
    confidence: 0.3,
    streamCount: 1,
    source: "fallback",
  };
}

export async function selectAudioTrack(params: {
  subLang: string;
  audioTracks?: AudioTrackInfoLike[];
  mediaUrl: string;
  headers?: Record<string, string>;
  probe?: ProbeFn;
  preferProbe?: boolean;
}): Promise<AudioTrackSelection> {
  const { subLang, audioTracks, mediaUrl, headers, probe, preferProbe } = params;

  if (!preferProbe && audioTracks && audioTracks.length > 0) {
    const snap = selectFromSnapshot(audioTracks, subLang);
    if (snap) return snap;
  }

  if (probe) {
    try {
      const r = await probe(mediaUrl, headers, subLang);
      if (r) return fromRust(r);
    } catch {
      void 0;
    }
  }

  if (audioTracks && audioTracks.length > 0) {
    const snap = selectFromSnapshot(audioTracks, subLang);
    if (snap) return snap;
  }

  return fallbackSelection(subLang);
}

export function shouldRunAsrForSelection(sel: AudioTrackSelection): boolean {
  return sel.asrStrategy !== "suppressed";
}

export function resolveAsrLanguage(
  sel: AudioTrackSelection,
): { run: boolean; lang?: string; translate: boolean } {
  switch (sel.asrStrategy) {
    case "direct":
      return { run: true, lang: sel.subLang, translate: false };
    case "translate-to-en":
      return { run: true, lang: undefined, translate: true };
    case "autodetect":
      return { run: true, lang: undefined, translate: false };
    default:
      return { run: false, translate: false };
  }
}

export function isRiskyMismatch(sel: AudioTrackSelection): boolean {
  if (sel.mismatch === "translated-sub") return true;
  return sel.mismatch === "unknown-language" && sel.streamCount > 1;
}

const RANK: Record<Outcome, number> = { refuse: 0, offer: 1, apply: 2 };

export function applyAudioMismatchCeiling(
  decision: GateDecision,
  sel: AudioTrackSelection,
  ctx: { identityBacked: boolean; linguisticVerified: boolean },
): GateDecision {
  if (!isRiskyMismatch(sel)) return decision;
  if (ctx.identityBacked || ctx.linguisticVerified) return decision;
  if (RANK[decision.decision] <= RANK.offer) return decision;
  return {
    ...decision,
    decision: "offer",
    reason: `audio language ${sel.mismatch}: no in-language verifier, confirm before applying`,
    bindingRule: "audio-track-mismatch",
  };
}
