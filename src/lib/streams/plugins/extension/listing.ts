/** What a provider put in a listing title besides the title.
 *
 * A provider names a listing after everything it carries — the year, the audio, the quality, the
 * size, the kind of release — because in its own app that whole line is the name. Harbor shows the
 * title alone, so the rest of the line is read here and kept, rather than thrown away at the cut.
 * Nothing is badged unless it was recognised: an unfamiliar word is kept in `rest` and shown as it
 * was, because a badge that says Hindi on an English file is worse than no badge at all. */
export type ListingExtras = {
  /** The title itself, with the trailing detail cut off. */
  title: string;
  /** Four digits in brackets or standing alone, when one is present. */
  year: number | null;
  /** Languages recognised by name, in the order they were written. */
  languages: string[];
  /** Every resolution the listing names, by tier and ordered best first. `2160p`, `4K` and `UHD`
   * are one answer, so a line naming two of them is one tier rather than two. */
  resolutions: string[];
  /** How the file was made — a release, a codec — in the order it was written. A size is not here:
   * it says what the download costs, not how good the file is. */
  quality: string[];
  /** High dynamic range, when the listing says the file has any. Null means none was said, which is
   * not the same as saying it has none — most files say nothing, and that is not worth a badge. */
  hdr: string | null;
  /** Everything that followed the title, recognised or not, so nothing is lost. */
  rest: string;
};

/** Languages as providers write them. Matched on whole words only, so `TamilRockers` and `Hindilink`
 * are not a language and `Hin`/`Tam` are not read as Hindi and Tamil: an abbreviation read wrong is
 * a wrong badge, and the set of abbreviations in use is not knowable from here. */
const LANGUAGES: Record<string, string> = {
  hindi: "Hindi",
  english: "English",
  tamil: "Tamil",
  telugu: "Telugu",
  malayalam: "Malayalam",
  kannada: "Kannada",
  bengali: "Bengali",
  marathi: "Marathi",
  punjabi: "Punjabi",
  urdu: "Urdu",
  gujarati: "Gujarati",
  oriya: "Oriya",
  odia: "Odia",
  assamese: "Assamese",
  nepali: "Nepali",
  sinhala: "Sinhala",
  arabic: "Arabic",
  korean: "Korean",
  japanese: "Japanese",
  chinese: "Chinese",
  mandarin: "Mandarin",
  cantonese: "Cantonese",
  spanish: "Spanish",
  french: "French",
  german: "German",
  italian: "Italian",
  portuguese: "Portuguese",
  russian: "Russian",
  turkish: "Turkish",
  thai: "Thai",
  indonesian: "Indonesian",
  malay: "Malay",
  vietnamese: "Vietnamese",
  dutch: "Dutch",
  polish: "Polish",
  swedish: "Swedish",
  danish: "Danish",
  norwegian: "Norwegian",
  greek: "Greek",
  hebrew: "Hebrew",
  persian: "Persian",
  filipino: "Filipino",
  tagalog: "Tagalog",
};

/** What a provider writes where a reader expects a language but has not named one. `Multi` and
 * `Dual Audio` say there is more than one without saying which, which is worth saying. */
const MULTI = /^(?:multi|dualaudio|multiaudio|multiple)$/;

/** Quality as providers write it, each token mapped to the tier it means rather than to a label.
 *
 * Mapping to a tier is what stops one resolution becoming three badges: `2160p`, `4K` and `UHD` are
 * the same thing written three ways, and a line that names two of them was showing two pills for
 * one resolution. The label is chosen once, per tier, from `RESOLUTION_LABEL`. */
const RESOLUTION: Record<string, string> = {
  "480p": "480p",
  "540p": "540p",
  "576p": "576p",
  "720p": "720p",
  "1080p": "1080p",
  "1440p": "1440p",
  "2160p": "2160p",
  "4k": "2160p",
  uhd: "2160p",
  "8k": "4320p",
  fhd: "1080p",
  hd: "720p",
};

/** The one label a tier is shown as, whatever the provider called it. */
const RESOLUTION_LABEL: Record<string, string> = {
  "4320p": "8K",
  "2160p": "4K",
  "1440p": "1440p",
  "1080p": "1080p",
  "720p": "720p",
  "576p": "576p",
  "540p": "540p",
  "480p": "480p",
};

/** How the provider made the file, which is a separate statement from how big it is.
 *
 * A size is deliberately not here, and neither is a codec: `300MB` says what the download costs and
 * `x264` says what encoded it, and neither is what a reader is scanning a poster for. Both stay in
 * the raw line the tooltip shows. */
const QUALITY: Record<string, string> = {
  sd: "SD",
  hdrip: "HDRip",
  webrip: "WEBRip",
  webdl: "WEB-DL",
  bluray: "BluRay",
  bdrip: "BDRip",
  brrip: "BRRip",
  dvdrip: "DVDRip",
  hdtv: "HDTV",
  remux: "Remux",
};

/** High dynamic range, which is worth a badge because it is the exception. `SDR` is what a file is
 * when none of these is there and is deliberately not a badge: it would sit on nearly everything a
 * provider offers and say nothing. The two-word spellings are matched as phrases, ahead of the
 * word-by-word pass, because neither word means it alone. */
const HDR_TOKENS: Record<string, string> = {
  hdr: "HDR",
  hdr10: "HDR10",
  hdr10plus: "HDR10+",
  dv: "DV",
  dovi: "DV",
  hlg: "HLG",
};

const HDR_PHRASES = /(?:dolby\s*vision|dolby\s*atmos\s*vision)/i;

/** Where the title ends. Whatever follows is the provider's own detail rather than the name. */
const TITLE_BREAK = /[({\[]/;
const RELEASE_BREAK =
  /(?:\s|^)(?:web-?dl|webrip|bluray|bdrip|hdrip|dvdrip|remux|[a-z]{2,3}rip|[sh][0-9]{1,2}(?:e[0-9]{1,3})?|[0-9]{3,4}[pi])(?=\s|$)/i;

const YEAR = /\b(19[3-9][0-9]|20[0-9]{2})\b/;

/** The words of a tail, with the punctuation a provider uses to separate them taken out. A `+` is
 * kept as its own word because `Hindi + English` means two languages and `Hindi+English` is the
 * same statement written without spaces.
 *
 * A hyphen between two words is also a separator, which is why this is done on the run of letters
 * rather than by splitting the whole line on `-`: `WEB-DL`, `Blu-Ray` and `HD-Rip` are single names
 * that happen to contain one, and breaking them apart would lose them. Only `Hindi-English`, where
 * both halves are words on their own, is two statements. */
function words(text: string): string[] {
  return text
    .replace(/[()[\]{}]/g, " ")
    .split(/[\s/,|·•+&]+/u)
    // A hyphenated pair is offered both ways: whole, and split, so a name that contains a hyphen is
    // still readable as itself and a pair of languages is readable as two.
    .flatMap((w) => (/-/.test(w) ? [w, ...w.split("-")] : [w]))
    .map((w) => w.trim())
    .filter(Boolean);
}

/** Words that only mean something together: `Dual Audio` says there is more than one audio track,
 * and neither word says it alone. Read off the tail's own text, ahead of the word-by-word pass. */
const MULTI_PHRASES = /(?:dual\s*audio|multi\s*audio|multiple\s*audio)/i;

/** The keyword a word could be, with what surrounds it taken off: `WEB-DL`, `[Hindi]` and `Hindi:`
 * are all the same word as `Hindi` once the furniture is gone. */
function keyword(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function readListing(rawName: string): ListingExtras {
  const raw = rawName.trim();
  const title = listingTitle(raw);
  if (!raw) {
    return { title, year: null, languages: [], quality: [], resolutions: [], hdr: null, rest: "" };
  }

  // The tail is everything the title cut off, or the whole line when nothing was cut. The markers
  // are searched in the line rather than derived by removing the title, because the title is cleaned
  // of trailing punctuation and would not line up with it.
  const marks = [raw.search(TITLE_BREAK), raw.search(RELEASE_BREAK)].filter((at) => at >= 0);
  const cut = marks.length ? Math.min(...marks) : raw.length;
  const rest = raw.slice(cut).trim();

  // The year is read from the detail rather than from the whole line, or a name made of four digits
  // would be read as one: 2001: A Space Odyssey is a name, not a year.
  const year = Number(YEAR.exec(rest)?.[1] ?? NaN);
  const languages: string[] = [];
  const quality: string[] = [];
  const resolutions: string[] = [];
  let hdr: string | null = null;
  let multiAudio = MULTI_PHRASES.test(rest);
  if (HDR_PHRASES.test(rest)) hdr = "DV";
  for (const word of words(rest)) {
    const key = keyword(word);
    if (!key) continue;
    const language = LANGUAGES[key];
    if (language) {
      if (!languages.includes(language)) languages.push(language);
      continue;
    }
    if (MULTI.test(key)) {
      multiAudio = true;
      continue;
    }
    // Collected by tier so `4K` and `2160p` on one line are one answer rather than two, and laid out
    // best first at the end.
    const tier = RESOLUTION[key];
    if (tier) {
      if (!resolutions.includes(tier)) resolutions.push(tier);
      continue;
    }
    const range = HDR_TOKENS[key];
    if (range) {
      // The first one written wins, so a line naming both does not read as two files.
      hdr ??= range;
      continue;
    }
    const mark = QUALITY[key];
    if (mark && !quality.includes(mark)) quality.push(mark);
  }
  // Named languages win over a bare claim that there are several.
  //
  // `Dual Audio (Hindi-Telugu)` has already said which tracks the file has, so a `Multi audio`
  // badge beside `Hindi · Telugu` contradicts it rather than adding to it. The badge is for the
  // listing that says it carries several and does not say which, which is the only case where it
  // tells the reader something the languages do not.
  if (multiAudio && languages.length === 0) languages.push("Multi audio");
  const ranked = [...resolutions].sort(
    (a, b) => Number(b.replace("p", "")) - Number(a.replace("p", "")),
  );
  return {
    title,
    year: Number.isFinite(year) ? year : null,
    languages,
    quality,
    resolutions: ranked.map((tier) => RESOLUTION_LABEL[tier] ?? tier),
    hdr,
    rest,
  };
}

/** A provider names a row after everything it carries -- the season range, the audio, the quality,
 * the size -- so the title it is actually about has to be taken back out of it before the row can
 * be shown, or searched for by name. In practice that trailing detail begins at the first bracket,
 * or at a release marker standing on its own. */
export function listingTitle(name: string): string {
  const raw = name.trim();
  if (!raw) return raw;
  const marks = [raw.search(TITLE_BREAK), raw.search(RELEASE_BREAK)].filter((at) => at >= 0);
  if (!marks.length) return raw;
  const head = raw
    .slice(0, Math.min(...marks))
    .replace(/[\s\-–—|·:,]+$/u, "")
    .trim();
  // "(500) Days of Summer" starts with a bracket and would leave nothing behind, so too short a
  // cut is refused rather than guessed at.
  return head.length >= 2 ? head : raw;
}
