import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Bookmark,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Gauge,
  Headphones,
  Highlighter,
  Languages,
  Link2,
  Loader2,
  LocateFixed,
  MessageSquareText,
  Moon,
  Pause,
  Play,
  Search,
  Settings2,
  SkipBack,
  SkipForward,
  Sun,
  Trash2,
  Type,
  Upload,
  X,
} from "lucide-react";
import { getUiLanguage, useT } from "@/lib/i18n";
import {
  sourceEBookAudiobookStream,
  type EBookAudioChapter,
  type EBookChapter,
  type EBookChapterContent,
} from "@/lib/ebook/providers";
import { createEBookFlipPages, type EBookFlipPages } from "@/lib/ebook/book-pages";
import {
  addEBookBookmark,
  loadEBookAnnotations,
  loadEBookBookmarks,
  loadEBookProgress,
  loadEBookReaderPrefs,
  markEBookChapterRead,
  removeEBookBookmark,
  removeEBookAnnotation,
  saveEBookAnnotation,
  saveEBookProgress,
  saveEBookResume,
  saveEBookReaderPrefs,
  type EBookAnnotation,
  type EBookReaderPrefs,
} from "@/lib/ebook/reader-state";
import { translateEBookChapter } from "@/lib/ebook/translation";
import { explainPassage, type WordExplanation } from "@/lib/ebook/explain";
import { BookFlip, type BookApi } from "@/views/manga/manga-reader/book-view";
import { useCustomFonts } from "@/lib/custom-fonts";
import { Flag } from "@/components/flag";
import {
  cancelNarration,
  clearNarrationCache,
  fetchEdgeNarrationVoices,
  narrationWordCount,
  synthesizeNarration,
  type EdgeNarrationVoice,
} from "@/lib/ebook/narration";

type Props = {
  profile: string;
  bookId: string;
  bookTitle: string;
  bookCover?: string;
  internalCover?: string;
  chapter: EBookChapter;
  content: EBookChapterContent;
  direction: "ltr" | "rtl";
  volumes: EBookReaderVolume[];
  onSelectChapter: (chapter: EBookChapter) => void;
  originalAudio?: { sourceRoute: string; chapter: EBookAudioChapter };
  onClose: () => void;
};

export type EBookReaderVolume = {
  volume: string;
  label: string;
  chapters: EBookChapter[];
};

type EBookFlipLayer = {
  id: number;
  pages: EBookFlipPages;
  resumePage: number;
  presentation: { rtl: boolean; background: string };
};

const releaseFlipPages = (pages: EBookFlipPages) => {
  pages.urls.forEach((url) => url.startsWith("blob:") && URL.revokeObjectURL(url));
};

const fontFamily = {
  literary: 'Georgia, "Times New Roman", serif',
  arabic: '"Traditional Arabic", "Noto Naskh Arabic", serif',
  classic: '"Book Antiqua", Palatino, serif',
};
const readerFontFamily = (prefs: EBookReaderPrefs) =>
  prefs.customFontId
    ? `"harbor-font-${prefs.customFontId}", Georgia, serif`
    : fontFamily[prefs.font];

const paper = {
  dark: { desk: "#090a0c", page: "#17181b", ink: "#e9e3d8", muted: "#8f8b84" },
  dim: { desk: "#17130f", page: "#2d261e", ink: "#eadbc5", muted: "#aa9a86" },
  light: { desk: "#c8c0b3", page: "#f4eddf", ink: "#29251f", muted: "#776f64" },
};

const inks = [
  "#f2c867",
  "#efa862",
  "#e89991",
  "#d184a5",
  "#bba4d9",
  "#9fc8dd",
  "#8fc9c2",
  "#b4cfa2",
];
const trackerColors = [
  "#ff9f4d",
  "#f2c867",
  "#e89991",
  "#d184a5",
  "#bba4d9",
  "#60a5fa",
  "#8fc9c2",
  "#b4cfa2",
];
const playbackRates = [1, 1.5, 2, 3] as const;
const narrationVoices = [
  { id: "en-US-AvaNeural", label: "Ava", tone: "American · Female", locale: "en-US" },
  { id: "en-US-AndrewNeural", label: "Andrew", tone: "American · Male", locale: "en-US" },
  { id: "en-US-AriaNeural", label: "Aria", tone: "American · Female", locale: "en-US" },
  { id: "en-US-GuyNeural", label: "Guy", tone: "American · Male", locale: "en-US" },
  { id: "en-US-JennyNeural", label: "Jenny", tone: "American · Female", locale: "en-US" },
  { id: "en-GB-SoniaNeural", label: "Sonia", tone: "British · Female", locale: "en-GB" },
  { id: "en-GB-RyanNeural", label: "Ryan", tone: "British · Male", locale: "en-GB" },
  { id: "en-GB-LibbyNeural", label: "Libby", tone: "British · Female", locale: "en-GB" },
  { id: "en-AU-NatashaNeural", label: "Natasha", tone: "Australian · Female", locale: "en-AU" },
  { id: "en-AU-WilliamNeural", label: "William", tone: "Australian · Male", locale: "en-AU" },
  { id: "en-CA-ClaraNeural", label: "Clara", tone: "Canadian · Female", locale: "en-CA" },
  { id: "en-CA-LiamNeural", label: "Liam", tone: "Canadian · Male", locale: "en-CA" },
  { id: "ar-SA-ZariyahNeural", label: "زارية", tone: "Saudi · Female", locale: "ar-SA" },
  { id: "ar-SA-HamedNeural", label: "حامد", tone: "Saudi · Male", locale: "ar-SA" },
  { id: "ar-EG-SalmaNeural", label: "سلمى", tone: "Egyptian · Female", locale: "ar-EG" },
  { id: "ar-EG-ShakirNeural", label: "شاكر", tone: "Egyptian · Male", locale: "ar-EG" },
  { id: "ar-AE-FatimaNeural", label: "فاطمة", tone: "Emirati · Female", locale: "ar-AE" },
  { id: "ar-AE-HamdanNeural", label: "حمدان", tone: "Emirati · Male", locale: "ar-AE" },
  { id: "ar-KW-NouraNeural", label: "نورة", tone: "Kuwaiti · Female", locale: "ar-KW" },
  { id: "ar-KW-FahedNeural", label: "فهد", tone: "Kuwaiti · Male", locale: "ar-KW" },
] as const;
type ReaderNarrationVoice = EdgeNarrationVoice & { label: string; tone: string };
const fallbackNarrationVoices: ReaderNarrationVoice[] = narrationVoices.map((voice) => ({
  ...voice,
  name: voice.label,
  gender: voice.tone.includes("Female") ? "Female" : "Male",
}));

const VOICE_SAMPLE_TEXT: Record<string, string> = {
  ar: "مرحباً، هذا نموذج قصير لاختبار نبرة الصوت ووضوح القراءة في هاربور.",
  en: "Welcome to Harbor. This short sample helps you compare the voice, tone, and reading clarity.",
  es: "Bienvenido a Harbor. Esta breve muestra permite comparar la voz, el tono y la claridad.",
  fr: "Bienvenue dans Harbor. Ce court extrait permet de comparer la voix, le ton et la clarté.",
  de: "Willkommen bei Harbor. Mit diesem kurzen Beispiel können Sie Stimme und Klarheit vergleichen.",
  it: "Benvenuto in Harbor. Questo breve esempio aiuta a confrontare voce, tono e chiarezza.",
  pt: "Bem-vindo ao Harbor. Esta breve amostra ajuda a comparar a voz, o tom e a clareza.",
  ru: "Добро пожаловать в Harbor. Этот короткий пример поможет сравнить голос и ясность чтения.",
  ja: "ハーバーへようこそ。この短いサンプルで、声の調子と読みやすさを比較できます。",
  ko: "하버에 오신 것을 환영합니다. 이 짧은 샘플로 목소리와 읽기 명료도를 비교할 수 있습니다.",
  zh: "欢迎使用 Harbor。这个简短示例可以帮助你比较声音、语调和朗读清晰度。",
  hi: "हार्बर में आपका स्वागत है। यह छोटा नमूना आवाज़ और पढ़ने की स्पष्टता की तुलना करता है।",
  tr: "Harbor'a hoş geldiniz. Bu kısa örnek ses tonunu ve okuma netliğini karşılaştırır.",
};
const VOICE_SAMPLE_BY_LOCALE: Record<string, string> = {
  "ar-SA": "هلا والله، كيف حالك؟ إن شاء الله أمورك طيبة. هذا صوت تجريبي من هاربور.",
  "ar-EG": "أهلاً وسهلاً، إزيّك؟ النهارده هنجرب الصوت ده ونشوف وضوحه ونبرته.",
  "ar-AE": "مرحبا الساع، شحالك؟ عساك بخير. خلّنا نجرّب هالصوت ونسمع نبرته.",
  "ar-KW": "هلا والله، شلونك؟ عساك بخير. خلّنا نسمع هالصوت ونجرب نبرته.",
  "ar-BH": "هلا وغلا، شخبارك؟ إن شاء الله بخير. هذا نموذج بسيط لتجربة الصوت.",
  "ar-DZ": "أهلاً، واش راك؟ اليوم نجرّبوا هاد الصوت ونشوفوا النبرة تاعو.",
  "ar-IQ": "هلا بيك، شلونك؟ إن شاء الله زين. خلّينا نجرّب هذا الصوت ونسمع نبرته.",
  "ar-JO": "أهلاً وسهلاً، كيفك؟ إن شاء الله تمام. خلّينا نجرّب هالصوت ونسمع نبرته.",
  "ar-LB": "أهلا وسهلا، كيفك اليوم؟ خلّينا نجرّب هالصوت ونسمع نبرته ووضوحه.",
  "ar-LY": "أهلاً بيك، شن حالك؟ إن شاء الله تمام. خلّينا نجربوا الصوت هذا.",
  "ar-MA": "مرحبا، كيداير؟ لاباس عليك؟ اليوم غادي نجربو هاد الصوت ونسمعو النبرة ديالو.",
  "ar-OM": "مرحبا، كيف حالك؟ عساك طيب. خلّنا نجرّب هذا الصوت ونسمع نبرته.",
  "ar-QA": "مرحبا، شلونك؟ عساك بخير. خلّنا نجرّب هالصوت ونسمع نبرته بوضوح.",
  "ar-SY": "أهلاً وسهلاً، شلونك اليوم؟ خلّينا نجرّب هالصوت ونسمع نبرته.",
  "ar-TN": "عسلامة، شنوّة أحوالك؟ اليوم باش نجرّبوا الصوت هذا ونسمعوا نبرتو.",
  "ar-YE": "يا مرحبا، كيف حالك؟ عساك بخير. خلّينا نجرّب هذا الصوت ونسمع نبرته.",
};

function VoicePicker({
  voices,
  value,
  disabled,
  colors,
  onChange,
  previewingVoice,
  previewLoading,
  onPreview,
}: {
  voices: ReaderNarrationVoice[];
  value: string;
  disabled: boolean;
  colors: (typeof paper)[keyof typeof paper];
  onChange: (voice: string) => void;
  previewingVoice: string;
  previewLoading: boolean;
  onPreview: (voice: ReaderNarrationVoice) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const selected = voices.find((voice) => voice.id === value) ?? fallbackNarrationVoices[0];
  const selectedLanguage = selected.locale.split("-")[0].toLocaleLowerCase();
  const [activeLanguage, setActiveLanguage] = useState(selectedLanguage);
  const languageGroups = useMemo(() => {
    const groups = new Map<string, ReaderNarrationVoice[]>();
    for (const voice of voices) {
      const code = voice.locale.split("-")[0].toLocaleLowerCase();
      const group = groups.get(code) ?? [];
      group.push(voice);
      groups.set(code, group);
    }
    const displayNames = new Intl.DisplayNames([navigator.language || "en"], { type: "language" });
    return [...groups.entries()]
      .map(([code, items]) => ({
        code,
        name: displayNames.of(code) ?? code.toLocaleUpperCase(),
        voices: items,
      }))
      .sort((left, right) => {
        if (left.code === selectedLanguage) return -1;
        if (right.code === selectedLanguage) return 1;
        return left.name.localeCompare(right.name);
      });
  }, [selectedLanguage, voices]);
  const selectedLanguageName =
    languageGroups.find((group) => group.code === selectedLanguage)?.name ?? selectedLanguage;
  const filtered = useMemo(() => {
    const languageVoices =
      languageGroups.find((group) => group.code === activeLanguage)?.voices ?? voices;
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return languageVoices;
    return languageVoices.filter((voice) =>
      `${voice.label} ${voice.name} ${voice.locale} ${voice.gender} ${voice.tone}`
        .toLocaleLowerCase()
        .includes(needle),
    );
  }, [activeLanguage, languageGroups, query, voices]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  useEffect(() => {
    if (open) setActiveLanguage(selectedLanguage);
  }, [open, selectedLanguage]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 min-w-[168px] max-w-[220px] items-center gap-2 rounded-xl border px-2.5 text-start transition hover:border-accent/60 hover:bg-white/[.04] disabled:cursor-wait disabled:opacity-50"
        style={{ borderColor: `${colors.muted}45` }}
        title={t("Choose an Edge TTS voice before generating audio")}
      >
        <span className="grid h-7 w-8 shrink-0 place-items-center rounded-lg bg-white/[.04]">
          <Flag language={selectedLanguageName} size="sm" showLabel={false} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold" style={{ color: colors.ink }}>
            {selected.label}
          </span>
          <span
            className="block truncate text-[9px] uppercase tracking-[.12em]"
            style={{ color: colors.muted }}
          >
            {selected.locale} · {selected.gender}
          </span>
        </span>
        <ChevronDown
          size={13}
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          className="absolute bottom-[calc(100%+10px)] start-0 z-[140] w-[520px] overflow-hidden rounded-2xl border bg-[#111214]/[.98] p-2 shadow-2xl backdrop-blur-xl"
          style={{ borderColor: `${colors.muted}38` }}
        >
          <div
            className="mb-2 flex items-center gap-2 rounded-xl border bg-black/20 px-3"
            style={{ borderColor: `${colors.muted}30` }}
          >
            <Search size={14} style={{ color: colors.muted }} />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("Search {language}", {
                language:
                  languageGroups.find((group) => group.code === activeLanguage)?.name ??
                  t("voices"),
              })}
              className="h-10 min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/35"
            />
            <span className="text-[10px] tabular-nums text-white/35">{filtered.length}</span>
          </div>
          <div className="grid min-h-[280px] grid-cols-[158px_minmax(0,1fr)] gap-2">
            <nav
              aria-label={t("Voice languages")}
              className="max-h-[310px] space-y-1 overflow-y-auto overscroll-contain border-e border-white/[.07] pe-2"
            >
              <div className="mb-1 flex items-center gap-2 px-2 py-1 text-[9px] font-bold uppercase tracking-[.17em] text-white/30">
                <Languages size={12} /> {t("Language")}
              </div>
              {languageGroups.map((group) => {
                const active = group.code === activeLanguage;
                return (
                  <button
                    key={group.code}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setActiveLanguage(group.code);
                      setQuery("");
                    }}
                    className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-start transition ${active ? "bg-accent/15 text-accent" : "text-white/60 hover:bg-white/[.05] hover:text-white"}`}
                  >
                    <span className="grid h-7 w-8 shrink-0 place-items-center rounded-lg bg-white/[.05]">
                      <Flag language={group.name} size="sm" showLabel={false} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">
                      {group.name}
                    </span>
                    <span className="text-[9px] tabular-nums opacity-45">
                      {group.voices.length}
                    </span>
                  </button>
                );
              })}
            </nav>
            <div
              role="listbox"
              aria-label={t("{language} voices", {
                language:
                  languageGroups.find((group) => group.code === activeLanguage)?.name ?? "Edge TTS",
              })}
              className="max-h-[310px] space-y-1 overflow-y-auto overscroll-contain pe-1"
            >
              {filtered.map((voice) => {
                const active = voice.id === value;
                const previewing = previewingVoice === voice.id;
                return (
                  <div
                    key={voice.id}
                    role="option"
                    aria-selected={active}
                    className={`flex w-full items-center gap-1 rounded-xl pe-1 transition ${active ? "bg-accent/15 text-accent" : "text-white/85 hover:bg-white/[.06]"}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onChange(voice.id);
                        setOpen(false);
                        setQuery("");
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-start"
                    >
                      <span className="grid h-8 min-w-10 shrink-0 place-items-center rounded-lg bg-white/[.05] px-1.5 text-[9px] font-bold uppercase">
                        {voice.locale}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold">{voice.label}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-white/40">
                          {voice.locale} · {voice.gender}
                        </span>
                      </span>
                      {active && <Check size={15} className="shrink-0" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onPreview(voice)}
                      aria-label={
                        previewing
                          ? t("Stop {voice} sample", { voice: voice.label })
                          : t("Play {voice} sample", { voice: voice.label })
                      }
                      title={previewing ? t("Stop sample") : t("Test this voice")}
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${previewing ? "bg-accent text-black" : "bg-white/[.05] text-white/55 hover:bg-white/[.1] hover:text-white"}`}
                    >
                      {previewing && previewLoading ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : previewing ? (
                        <X size={13} strokeWidth={2.5} />
                      ) : (
                        <Play size={12} fill="currentColor" />
                      )}
                    </button>
                  </div>
                );
              })}
              {!filtered.length && (
                <p className="px-3 py-8 text-center text-xs text-white/40">
                  {t("No matching voices")}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
const formatAudioTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};
const trackerGutter = 8;
const EDGE_BOUNDARY_LEAD_SECONDS = 0.12;
const trackerRect = (rect: DOMRect) => ({
  top: rect.top - 2,
  left: rect.left - trackerGutter,
  width: rect.width + trackerGutter * 2,
  height: rect.height + 4,
});
const marks = /[\u0300-\u036f\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g;
const stripMarks = (value: string) => value.normalize("NFD").replace(marks, "").toLocaleLowerCase();
const textDirection = (text: string, fallback: "ltr" | "rtl") => {
  const rtl = text.match(/[\u0600-\u06ff\u0750-\u077f]/g)?.length ?? 0;
  const ltr = text.match(/[A-Za-z]/g)?.length ?? 0;
  return rtl || ltr ? (rtl > ltr ? "rtl" : "ltr") : fallback;
};
const etaParts = (milliseconds: number) => {
  const seconds = Math.max(1, Math.ceil(milliseconds / 1000));
  return seconds < 60
    ? { count: seconds, unit: "seconds" as const }
    : { count: Math.ceil(seconds / 60), unit: "minutes" as const };
};
const pageForParagraph = (starts: number[], target: number) => {
  for (let index = starts.length - 1; index >= 0; index -= 1) {
    if (starts[index] <= target) return index;
  }
  return 0;
};

function TranslationSpinner() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity=".2" />
      <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur=".8s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}
const referenceRanges = (text: string, phrase: string) => {
  let normalized = "";
  const offsets: number[] = [];
  let offset = 0;
  for (const character of text) {
    const clean = stripMarks(character);
    normalized += clean;
    for (let index = 0; index < clean.length; index += 1) offsets.push(offset);
    offset += character.length;
  }
  const needle = stripMarks(phrase.trim());
  if (!needle) return [];
  const matches: Array<{ start: number; end: number }> = [];
  const word = /[\p{L}\p{N}_]/u;
  let start = 0;
  while ((start = normalized.indexOf(needle, start)) >= 0) {
    const end = start + needle.length;
    const bounded =
      (!word.test(needle[0]) || !word.test(normalized[start - 1] ?? "")) &&
      (!word.test(needle.at(-1) ?? "") || !word.test(normalized[end] ?? ""));
    if (bounded) matches.push({ start: offsets[start] ?? 0, end: offsets[end] ?? text.length });
    start = end;
  }
  return matches;
};
type ReaderSelection = {
  ranges: EBookAnnotation["ranges"];
  text: string;
  x: number;
  y: number;
  annotationId?: string;
};

export function HarborReader({
  profile,
  bookId,
  bookTitle,
  bookCover,
  internalCover,
  chapter,
  content,
  direction,
  volumes,
  onSelectChapter,
  originalAudio,
  onClose,
}: Props) {
  const t = useT();
  const formatEtaLabel = (milliseconds: number) => {
    const eta = etaParts(milliseconds);
    return eta.unit === "seconds"
      ? t("≈{count}s left", { count: eta.count })
      : t("≈{count}m left", { count: eta.count });
  };
  const [prefs, setPrefs] = useState<EBookReaderPrefs>(loadEBookReaderPrefs);
  const [availableNarrationVoices, setAvailableNarrationVoices] =
    useState<ReaderNarrationVoice[]>(fallbackNarrationVoices);
  const [panel, setPanel] = useState<"settings" | "search" | "bookmarks" | "annotations" | null>(
    null,
  );
  const [chaptersOpen, setChaptersOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchEdgeNarrationVoices()
      .then((voices) => {
        if (!active || !voices.length) return;
        setAvailableNarrationVoices(
          voices
            .map((voice) => ({
              ...voice,
              label: voice.name.replace(/^Microsoft\s+/i, "").replace(/\s+Online.*$/i, ""),
              tone: `${voice.locale} · ${voice.gender}`,
            }))
            .sort(
              (left, right) =>
                left.locale.localeCompare(right.locale) || left.label.localeCompare(right.label),
            ),
        );
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  const [volumeMenuOpen, setVolumeMenuOpen] = useState(false);
  const currentVolume =
    volumes.find((volume) => volume.chapters.some((item) => item.id === chapter.id)) ?? volumes[0];
  const [sidebarVolume, setSidebarVolume] = useState(currentVolume?.volume ?? "");
  const shownVolume = volumes.find((volume) => volume.volume === sidebarVolume) ?? currentVolume;
  const shownChapters = shownVolume?.chapters ?? [];
  const bookChapters = useMemo(() => volumes.flatMap((volume) => volume.chapters), [volumes]);
  const chapterIndex = bookChapters.findIndex((item) => item.id === chapter.id);
  const previousChapter = chapterIndex > 0 ? bookChapters[chapterIndex - 1] : undefined;
  const nextChapter = chapterIndex >= 0 ? bookChapters[chapterIndex + 1] : undefined;
  const [query, setQuery] = useState("");
  const [showFutureResults, setShowFutureResults] = useState(false);
  const [current, setCurrent] = useState(0);
  const [readThrough, setReadThrough] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [narrationPaused, setNarrationPaused] = useState(false);
  const [narrationLoading, setNarrationLoading] = useState(false);
  const [narrationNotice, setNarrationNotice] = useState("");
  const [generationPercent, setGenerationPercent] = useState(0);
  const [audioPosition, setAudioPosition] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<(typeof playbackRates)[number]>(1);
  const audio = useRef<HTMLAudioElement | null>(null);
  const audioStart = useRef(0);
  const lastAudioUiUpdate = useRef(0);
  const audioUrl = useRef("");
  const voicePreviewAudio = useRef<HTMLAudioElement | null>(null);
  const voicePreviewUrl = useRef("");
  const voicePreviewRequestId = useRef("");
  const voicePreviewRun = useRef(0);
  const [voicePreviewId, setVoicePreviewId] = useState("");
  const [voicePreviewLoading, setVoicePreviewLoading] = useState(false);
  const narrationRun = useRef(0);
  const narrationRequestId = useRef("");
  const narrationLine = useRef(-1);
  const [readerText, setReaderText] = useState(content.text ?? "");
  const originalTitle = chapter.title || bookTitle;
  const originalText = content.originalText ?? content.text ?? "";
  const [readerTitle, setReaderTitle] = useState(content.translatedTitle ?? originalTitle);
  const [translation, setTranslation] = useState(() =>
    content.translated
      ? { title: content.translatedTitle ?? originalTitle, text: content.text ?? "" }
      : null,
  );
  const [showOriginal, setShowOriginal] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState(Boolean(content.translated));
  const [translationError, setTranslationError] = useState("");
  const [translationProgress, setTranslationProgress] = useState({
    percent: 0,
    etaMs: null as number | null,
  });
  const [chrome, setChrome] = useState(true);
  const [bookmarks, setBookmarks] = useState(() => loadEBookBookmarks(profile, bookId));
  const [annotations, setAnnotations] = useState(() => loadEBookAnnotations(profile, bookId));
  const [selection, setSelection] = useState<ReaderSelection | null>(null);
  const [explanation, setExplanation] = useState<{
    loading: boolean;
    results?: WordExplanation[];
    error?: string;
    x: number;
    y: number;
  } | null>(null);
  const [editing, setEditing] = useState<EBookAnnotation | null>(null);
  const [trace, setTrace] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const article = useRef<HTMLElement>(null);
  const blocks = useRef<Array<HTMLElement | null>>([]);
  const speechIndex = useRef(0);
  const tracedLine = useRef(-1);
  const smartTarget = useRef<number | null>(null);
  const chromeTimer = useRef<number | undefined>(undefined);
  const progressTimer = useRef<number | undefined>(undefined);
  const pendingProgress = useRef<number | null>(null);
  const audioFollowScrolling = useRef(false);
  const audioFollowScrollTimer = useRef<number | undefined>(undefined);
  const traceFrame = useRef(0);
  const traceY = useRef<number | null>(null);
  const annotationHoverTimer = useRef<number | undefined>(undefined);
  const annotationHideTimer = useRef<number | undefined>(undefined);
  const bookApi = useRef<BookApi | null>(null);
  const [flipPages, setFlipPages] = useState<EBookFlipPages>({ urls: [], paragraphStarts: [] });
  const flipPagesRef = useRef<EBookFlipPages>(flipPages);
  const [flipLayers, setFlipLayers] = useState<EBookFlipLayer[]>([]);
  const flipLayersRef = useRef<EBookFlipLayer[]>([]);
  const flipLayerSequence = useRef(0);
  const [activeFlipLayerId, setActiveFlipLayerId] = useState<number | null>(null);
  const activeFlipLayerIdRef = useRef<number | null>(null);
  const flipLayerRetireTimer = useRef<number | undefined>(undefined);
  const flipGeneration = useRef(0);
  const [flipPage, setFlipPage] = useState(0);
  const progressId = `${chapter.id}:harbor`;
  const paragraphs = useMemo(
    () =>
      readerText
        .replace(/\r/g, "")
        .split(/\n{2,}/)
        .map((value) => value.replace(/\n/g, " ").trim())
        .filter(Boolean),
    [readerText],
  );
  const resumeVolumeLabel =
    chapter.volumeTitle ||
    (chapter.volume ? t("Volume {volume}", { volume: chapter.volume }) : undefined);
  const persistReadingPosition = useCallback(
    (line: number) => {
      if (!paragraphs.length || chapterIndex < 0 || !bookChapters.length) return;
      const safeLine = Math.max(0, Math.min(paragraphs.length - 1, line));
      const chapterProgress =
        paragraphs.length <= 1 ? 100 : Math.round((safeLine / (paragraphs.length - 1)) * 100);
      const bookProgress = Math.round(
        ((chapterIndex + chapterProgress / 100) / bookChapters.length) * 100,
      );
      saveEBookProgress(profile, bookId, progressId, safeLine);
      if (chapterProgress >= 100) markEBookChapterRead(profile, bookId, chapter.id);
      saveEBookResume(profile, bookId, {
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        chapterLabel: chapter.chapter,
        volumeLabel: resumeVolumeLabel,
        chapterProgress,
        bookProgress,
        chapterIndex,
        totalChapters: bookChapters.length,
      });
    },
    [
      bookChapters.length,
      bookId,
      chapter,
      chapterIndex,
      paragraphs.length,
      profile,
      progressId,
      resumeVolumeLabel,
    ],
  );
  const scheduleReadingPosition = useCallback(
    (line: number) => {
      pendingProgress.current = line;
      window.clearTimeout(progressTimer.current);
      progressTimer.current = window.setTimeout(() => {
        if (pendingProgress.current != null) persistReadingPosition(pendingProgress.current);
        pendingProgress.current = null;
      }, 180);
    },
    [persistReadingPosition],
  );
  const colors = paper[prefs.background];
  const effectiveDirection =
    prefs.direction === "auto" ? textDirection(readerText, direction) : prefs.direction;

  const replaceFlipPages = useCallback(
    (
      next: EBookFlipPages,
      targetParagraph: number,
      presentation: { rtl: boolean; background: string },
    ) => {
      const page = pageForParagraph(next.paragraphStarts, targetParagraph);
      const layer: EBookFlipLayer = {
        id: ++flipLayerSequence.current,
        pages: next,
        resumePage: page,
        presentation,
      };
      const retained = flipLayersRef.current.filter(
        (item) => item.id === activeFlipLayerIdRef.current,
      );
      const discarded = flipLayersRef.current.filter(
        (item) => item.id !== activeFlipLayerIdRef.current,
      );
      const staged = [...retained, layer];
      flipLayersRef.current = staged;
      setFlipLayers(staged);
      if (discarded.length) {
        window.requestAnimationFrame(() =>
          discarded.forEach((item) => releaseFlipPages(item.pages)),
        );
      }
    },
    [],
  );

  const activateFlipLayer = useCallback((id: number, api: BookApi) => {
    const layer = flipLayersRef.current.find((item) => item.id === id);
    if (!layer || flipLayersRef.current.at(-1)?.id !== id) return;
    window.clearTimeout(flipLayerRetireTimer.current);
    bookApi.current = api;
    activeFlipLayerIdRef.current = id;
    setActiveFlipLayerId(id);
    flipPagesRef.current = layer.pages;
    setFlipPages(layer.pages);
    setFlipPage(layer.resumePage);
    flipLayerRetireTimer.current = window.setTimeout(() => {
      const retired = flipLayersRef.current.filter((item) => item.id !== id);
      const active = flipLayersRef.current.filter((item) => item.id === id);
      flipLayersRef.current = active;
      setFlipLayers(active);
      retired.forEach((item) => releaseFlipPages(item.pages));
    }, 260);
  }, []);

  useEffect(() => {
    window.clearTimeout(flipLayerRetireTimer.current);
    const previous = flipLayersRef.current;
    flipLayersRef.current = [];
    setFlipLayers([]);
    activeFlipLayerIdRef.current = null;
    setActiveFlipLayerId(null);
    bookApi.current = null;
    flipPagesRef.current = { urls: [], paragraphStarts: [] };
    setFlipPages({ urls: [], paragraphStarts: [] });
    previous.forEach((item) => releaseFlipPages(item.pages));
  }, [progressId]);

  useEffect(
    () => () => {
      flipGeneration.current += 1;
      window.clearTimeout(flipLayerRetireTimer.current);
      flipLayersRef.current.forEach((item) => releaseFlipPages(item.pages));
      flipLayersRef.current = [];
      flipPagesRef.current = { urls: [], paragraphStarts: [] };
    },
    [],
  );

  useEffect(() => {
    if (prefs.mode !== "book") return;
    const controller = new AbortController();
    const generation = ++flipGeneration.current;
    const active = flipPagesRef.current;
    const saved = loadEBookProgress(profile, bookId, progressId);
    const targetParagraph = active.urls.length ? Math.max(0, tracedLine.current) : saved;
    const timer = window.setTimeout(
      () => {
        void createEBookFlipPages({
          content: { ...content, text: readerText },
          title: readerTitle,
          direction: effectiveDirection,
          page: colors.page,
          ink: colors.ink,
          muted: colors.muted,
          fontFamily: readerFontFamily(prefs),
          fontCacheKey: prefs.customFontId ?? prefs.font,
          fontSize: prefs.fontSize,
          lineHeight: prefs.lineHeight,
          cover: chapterIndex === 0 ? internalCover || bookCover : undefined,
          signal: controller.signal,
        })
          .then((next) => {
            if (controller.signal.aborted || generation !== flipGeneration.current) {
              next.urls.forEach((url) => url.startsWith("blob:") && URL.revokeObjectURL(url));
              return;
            }
            replaceFlipPages(next, targetParagraph, {
              rtl: effectiveDirection === "rtl",
              background: colors.desk,
            });
          })
          .catch((error) => {
            if (!(error instanceof DOMException) || error.name !== "AbortError")
              console.warn("[ebook/book-pages]", error);
          });
      },
      active.urls.length ? 180 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    bookCover,
    bookId,
    chapterIndex,
    colors.ink,
    colors.muted,
    colors.page,
    content,
    effectiveDirection,
    internalCover,
    prefs.font,
    prefs.customFontId,
    prefs.fontSize,
    prefs.lineHeight,
    prefs.mode,
    profile,
    progressId,
    readerText,
    readerTitle,
    replaceFlipPages,
  ]);

  useEffect(() => {
    setReaderText(content.text ?? "");
    setReaderTitle(content.translatedTitle ?? originalTitle);
    setTranslation(
      content.translated
        ? { title: content.translatedTitle ?? originalTitle, text: content.text ?? "" }
        : null,
    );
    setShowOriginal(false);
    setTranslated(Boolean(content.translated));
    setTranslationError("");
    setTranslationProgress({ percent: 0, etaMs: null });
  }, [content.text, content.translated, content.translatedTitle, originalTitle]);

  const usesOriginalAudiobook = Boolean(originalAudio && !(translation && !showOriginal));
  const lineTrackerEnabled = !usesOriginalAudiobook || prefs.audiobookLineTracker;
  const updateTrace = useCallback(
    (mouseY?: number) => {
      if (!lineTrackerEnabled) return;
      if (mouseY != null) {
        traceY.current = mouseY;
        smartTarget.current = null;
      }
      cancelAnimationFrame(traceFrame.current);
      traceFrame.current = requestAnimationFrame(() => {
        const page = article.current;
        if (!page) return;
        if (mouseY == null && smartTarget.current != null) {
          const paragraph = blocks.current[smartTarget.current];
          if (!paragraph) return;
          const paragraphRect = paragraph.getBoundingClientRect();
          const next = trackerRect(paragraphRect);
          setTrace((previous) =>
            previous &&
            Math.abs(previous.top - next.top) < 1 &&
            previous.left === next.left &&
            previous.width === next.width &&
            previous.height === next.height
              ? previous
              : next,
          );
          return;
        }
        const pageRect = page.getBoundingClientRect();
        if (traceY.current == null) {
          const top = scroller.current?.getBoundingClientRect().top ?? 0;
          const anchor = blocks.current.find(
            (node) => node && node.getBoundingClientRect().bottom > top + 72,
          );
          const walker = anchor && document.createTreeWalker(anchor, NodeFilter.SHOW_TEXT);
          let textNode = walker?.nextNode();
          while (textNode && !textNode.textContent?.trim()) textNode = walker?.nextNode();
          if (textNode?.textContent) {
            const first = document.createRange();
            const offset = textNode.textContent.search(/\S/);
            first.setStart(textNode, Math.max(0, offset));
            first.setEnd(textNode, Math.min(textNode.textContent.length, Math.max(0, offset) + 1));
            const firstRect = first.getClientRects()[0];
            if (firstRect) traceY.current = firstRect.top + firstRect.height / 2;
          }
        }
        const y = traceY.current ?? Math.min(window.innerHeight * 0.3, pageRect.bottom - 24);
        const x = pageRect.left + pageRect.width / 2;
        const range = (
          document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null }
        ).caretRangeFromPoint?.(x, y);
        if (!range) return;
        const paragraph = (
          range.startContainer.nodeType === Node.ELEMENT_NODE
            ? (range.startContainer as Element)
            : range.startContainer.parentElement
        )?.closest<HTMLElement>("[data-reader-line]");
        if (!paragraph) return;
        let lineRect = range.getClientRects()[0];
        if (!lineRect && range.startContainer.nodeType === Node.TEXT_NODE) {
          const probe = range.cloneRange();
          const length = range.startContainer.textContent?.length ?? 0;
          if (range.startOffset < length) probe.setEnd(range.startContainer, range.startOffset + 1);
          else if (range.startOffset > 0)
            probe.setStart(range.startContainer, range.startOffset - 1);
          lineRect = probe.getClientRects()[0];
        }
        if (!lineRect) return;
        const paragraphRect = paragraph.getBoundingClientRect();
        const line = Number(paragraph.dataset.readerLine);
        if (Number.isInteger(line) && tracedLine.current !== line) {
          tracedLine.current = line;
          setCurrent(line);
          scheduleReadingPosition(line);
        }
        const next = trackerRect(paragraphRect);
        setTrace((previous) =>
          previous &&
          Math.abs(previous.top - next.top) < 1 &&
          previous.left === next.left &&
          previous.width === next.width &&
          previous.height === next.height
            ? previous
            : next,
        );
      });
    },
    [lineTrackerEnabled, scheduleReadingPosition],
  );

  useEffect(() => {
    if (lineTrackerEnabled) return;
    smartTarget.current = null;
    traceY.current = null;
    setTrace(null);
  }, [lineTrackerEnabled]);

  const patchPrefs = (patch: Partial<EBookReaderPrefs>) => {
    setPrefs((value) => {
      const next = { ...value, ...patch };
      saveEBookReaderPrefs(next);
      return next;
    });
  };

  const revealChrome = useCallback(() => {
    setChrome(true);
    window.clearTimeout(chromeTimer.current);
    if (prefs.focusMode) chromeTimer.current = window.setTimeout(() => setChrome(false), 2200);
  }, [prefs.focusMode]);

  const goTo = useCallback(
    (index: number, followAudio = false) => {
      const next = Math.max(0, Math.min(paragraphs.length - 1, index));
      if (prefs.mode === "book" && flipPages.urls.length) {
        const page = pageForParagraph(flipPages.paragraphStarts, next);
        bookApi.current?.goToPage(page + 1);
        setFlipPage(page);
        tracedLine.current = next;
        setCurrent(next);
        return;
      }
      smartTarget.current = next;
      if (followAudio) {
        audioFollowScrolling.current = true;
        window.clearTimeout(audioFollowScrollTimer.current);
        audioFollowScrollTimer.current = window.setTimeout(() => {
          audioFollowScrolling.current = false;
          updateTrace();
        }, 120);
      }
      blocks.current[next]?.scrollIntoView({ block: "center", behavior: "smooth" });
      tracedLine.current = next;
      setCurrent(next);
    },
    [flipPages.paragraphStarts, flipPages.urls.length, paragraphs.length, prefs.mode, updateTrace],
  );

  useEffect(() => {
    setReadThrough((line) => Math.max(line, current));
  }, [current]);

  useEffect(() => {
    const saveCurrentPassage = () => {
      window.clearTimeout(progressTimer.current);
      pendingProgress.current = null;
      if (tracedLine.current >= 0) persistReadingPosition(tracedLine.current);
    };
    const saveWhenHidden = () => {
      if (document.visibilityState === "hidden") saveCurrentPassage();
    };
    window.addEventListener("pagehide", saveCurrentPassage);
    document.addEventListener("visibilitychange", saveWhenHidden);
    return () => {
      saveCurrentPassage();
      window.removeEventListener("pagehide", saveCurrentPassage);
      document.removeEventListener("visibilitychange", saveWhenHidden);
    };
  }, [persistReadingPosition]);

  useEffect(() => {
    const saved = loadEBookProgress(profile, bookId, progressId);
    setReadThrough(saved);
    const timer = window.setTimeout(() => {
      goTo(saved);
      persistReadingPosition(saved);
      updateTrace();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [bookId, goTo, persistReadingPosition, profile, progressId, updateTrace]);

  useEffect(() => {
    if (!lineTrackerEnabled) return;
    const root = scroller.current;
    if (!root) return;
    let timer = 0;
    const update = () => {
      window.clearTimeout(timer);
      if (audioFollowScrolling.current) {
        window.clearTimeout(audioFollowScrollTimer.current);
        audioFollowScrollTimer.current = window.setTimeout(() => {
          audioFollowScrolling.current = false;
          updateTrace();
        }, 80);
        return;
      }
      timer = window.setTimeout(() => {
        updateTrace();
      }, 50);
    };
    root.addEventListener("scroll", update, { passive: true });
    return () => {
      root.removeEventListener("scroll", update);
      window.clearTimeout(timer);
    };
  }, [bookId, lineTrackerEnabled, prefs.mode, profile, progressId, updateTrace]);

  useEffect(() => {
    if (!lineTrackerEnabled) return;
    const page = article.current;
    if (!page) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (tracedLine.current >= 0) smartTarget.current = tracedLine.current;
        updateTrace();
      });
    });
    observer.observe(page);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [lineTrackerEnabled, prefs.mode, updateTrace]);

  useEffect(() => {
    if (!lineTrackerEnabled) return;
    const root = scroller.current;
    if (!root) return;
    let wheel = 0;
    let reset = 0;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || !paragraphs.length) return;
      event.preventDefault();
      wheel += event.deltaY;
      window.clearTimeout(reset);
      reset = window.setTimeout(() => {
        wheel = 0;
      }, 140);
      if (Math.abs(wheel) < 32) return;
      const direction = wheel > 0 ? 1 : -1;
      wheel = 0;
      const next = Math.max(
        0,
        Math.min(
          paragraphs.length - 1,
          (tracedLine.current < 0 ? 0 : tracedLine.current) + direction,
        ),
      );
      const paragraph = blocks.current[next];
      if (!paragraph || next === tracedLine.current) return;
      smartTarget.current = next;
      tracedLine.current = next;
      setCurrent(next);
      scheduleReadingPosition(next);
      const rect = paragraph.getBoundingClientRect();
      const safeTop = 88;
      const safeBottom = window.innerHeight - 104;
      let offset = 0;
      if (rect.height > safeBottom - safeTop) offset = rect.top - safeTop;
      else if (rect.bottom > safeBottom) offset = rect.bottom - safeBottom;
      else if (rect.top < safeTop) offset = rect.top - safeTop;
      if (offset) root.scrollBy({ top: offset, behavior: "auto" });
      updateTrace();
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      root.removeEventListener("wheel", onWheel);
      window.clearTimeout(reset);
    };
  }, [lineTrackerEnabled, paragraphs.length, prefs.mode, scheduleReadingPosition, updateTrace]);

  useEffect(() => {
    if (!lineTrackerEnabled) return;
    const root = scroller.current;
    if (!root) return;
    let hold = 0;
    let pointer = -1;
    let startX = 0;
    let startY = 0;
    let startScroll = 0;
    let ready = false;
    let dragging = false;
    let suppressClick = false;
    const restore = () => {
      window.clearTimeout(hold);
      ready = false;
      root.style.cursor = "";
      root.style.userSelect = "";
    };
    const down = (event: PointerEvent) => {
      if (
        event.pointerType !== "mouse" ||
        event.button !== 0 ||
        article.current?.contains(event.target as Node) ||
        (event.target as Element).closest("button,input,textarea,select,a,[contenteditable=true]")
      )
        return;
      pointer = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startScroll = root.scrollTop;
      dragging = false;
      hold = window.setTimeout(() => {
        ready = true;
        root.style.cursor = "grab";
      }, 100);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return;
      const x = event.clientX - startX;
      const y = event.clientY - startY;
      if (!ready && Math.hypot(x, y) > 5) {
        window.clearTimeout(hold);
        pointer = -1;
        return;
      }
      if (!ready || Math.abs(y) < 2) return;
      if (!dragging) {
        dragging = true;
        smartTarget.current = tracedLine.current;
        root.setPointerCapture(pointer);
        root.style.cursor = "grabbing";
        root.style.userSelect = "none";
        window.getSelection()?.removeAllRanges();
      }
      event.preventDefault();
      root.scrollTop = startScroll - y;
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return;
      if (dragging) {
        suppressClick = true;
        updateTrace();
        if (root.hasPointerCapture(pointer)) root.releasePointerCapture(pointer);
      }
      pointer = -1;
      dragging = false;
      restore();
    };
    const click = (event: MouseEvent) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    root.addEventListener("pointerdown", down);
    root.addEventListener("pointermove", move);
    root.addEventListener("pointerup", up);
    root.addEventListener("pointercancel", up);
    root.addEventListener("click", click, true);
    return () => {
      restore();
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerup", up);
      root.removeEventListener("pointercancel", up);
      root.removeEventListener("click", click, true);
    };
  }, [lineTrackerEnabled, prefs.mode, updateTrace]);

  useEffect(() => {
    return () => {
      window.clearTimeout(chromeTimer.current);
      window.clearTimeout(annotationHoverTimer.current);
      window.clearTimeout(annotationHideTimer.current);
      window.clearTimeout(audioFollowScrollTimer.current);
      cancelAnimationFrame(traceFrame.current);
      window.speechSynthesis?.cancel();
      if (narrationRequestId.current) void cancelNarration(narrationRequestId.current);
      if (voicePreviewRequestId.current) void cancelNarration(voicePreviewRequestId.current);
      audio.current?.pause();
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
      voicePreviewAudio.current?.pause();
      if (voicePreviewUrl.current) URL.revokeObjectURL(voicePreviewUrl.current);
    };
  }, []);

  const stopVoicePreview = () => {
    voicePreviewRun.current += 1;
    if (voicePreviewRequestId.current) void cancelNarration(voicePreviewRequestId.current);
    voicePreviewRequestId.current = "";
    voicePreviewAudio.current?.pause();
    voicePreviewAudio.current = null;
    if (voicePreviewUrl.current) URL.revokeObjectURL(voicePreviewUrl.current);
    voicePreviewUrl.current = "";
    setVoicePreviewId("");
    setVoicePreviewLoading(false);
  };

  const stopSpeech = () => {
    stopVoicePreview();
    narrationRun.current += 1;
    if (narrationRequestId.current) void cancelNarration(narrationRequestId.current);
    narrationRequestId.current = "";
    audio.current?.pause();
    audio.current = null;
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = "";
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setNarrationPaused(false);
    setNarrationLoading(false);
    setGenerationPercent(0);
    setAudioPosition(0);
    setAudioDuration(0);
    audioStart.current = 0;
    narrationLine.current = -1;
    setTrace(null);
  };

  const previewVoice = async (voice: ReaderNarrationVoice) => {
    if (voicePreviewId === voice.id) {
      stopVoicePreview();
      return;
    }
    stopSpeech();
    const language = voice.locale.split("-")[0].toLocaleLowerCase();
    const sample =
      VOICE_SAMPLE_BY_LOCALE[voice.locale] ??
      VOICE_SAMPLE_TEXT[language] ??
      paragraphs
        .slice(current, current + 2)
        .join(" ")
        .trim()
        .slice(0, 320);
    if (!sample) return;
    const run = ++voicePreviewRun.current;
    const requestId = `voice-preview-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    voicePreviewRequestId.current = requestId;
    setVoicePreviewId(voice.id);
    setVoicePreviewLoading(true);
    try {
      const { blob } = await synthesizeNarration(
        requestId,
        sample,
        voice.id,
        voice.locale,
        () => undefined,
      );
      if (run !== voicePreviewRun.current) return;
      voicePreviewRequestId.current = "";
      const url = URL.createObjectURL(blob);
      voicePreviewUrl.current = url;
      const player = new Audio(url);
      voicePreviewAudio.current = player;
      setVoicePreviewLoading(false);
      player.onended = stopVoicePreview;
      player.onerror = stopVoicePreview;
      await player.play();
    } catch {
      if (run === voicePreviewRun.current) stopVoicePreview();
    }
  };

  const toggleNarrationPause = () => {
    if (narrationPaused) {
      if (audio.current) void audio.current.play();
      else window.speechSynthesis?.resume();
      setNarrationPaused(false);
      return;
    }
    audio.current?.pause();
    window.speechSynthesis?.pause();
    setNarrationPaused(true);
  };

  const translateChapter = async () => {
    if (translated || translating || !originalText) return;
    setTranslating(true);
    setTranslationError("");
    try {
      const result = await translateEBookChapter(
        originalText,
        originalTitle,
        true,
        setTranslationProgress,
      );
      setTranslation(result);
      setReaderText(result.text);
      setReaderTitle(result.title);
      setShowOriginal(false);
      setTranslated(true);
    } catch (error) {
      setTranslationError(error instanceof Error ? error.message : t("Translation failed"));
    } finally {
      setTranslating(false);
    }
  };

  const toggleTranslation = () => {
    if (!translation) return;
    const original = !showOriginal;
    setShowOriginal(original);
    setReaderText(original ? originalText : translation.text);
    setReaderTitle(original ? originalTitle : translation.title);
  };

  const selectChapter = (target?: EBookChapter) => {
    if (!target) return;
    stopSpeech();
    setSelection(null);
    setEditing(null);
    onSelectChapter(target);
  };

  const speakWithDevice = (index = current) => {
    if (!("speechSynthesis" in window) || !paragraphs.length) return;
    window.speechSynthesis.cancel();
    speechIndex.current = index;
    setSpeaking(true);
    setNarrationPaused(false);
    const next = () => {
      const text = paragraphs[speechIndex.current];
      if (!text) return setSpeaking(false);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = effectiveDirection === "rtl" ? "ar" : "en";
      utterance.rate = 0.95;
      utterance.onstart = () => goTo(speechIndex.current);
      utterance.onend = () => {
        speechIndex.current += 1;
        next();
      };
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    };
    next();
  };

  const speakFrom = async (index = current): Promise<void> => {
    stopSpeech();
    const run = ++narrationRun.current;
    const requestId =
      globalThis.crypto?.randomUUID?.() ??
      `reader-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    narrationRequestId.current = requestId;
    const windowEnd = paragraphs.length;
    const chapterText = paragraphs.join("\n\n").trim();
    if (!chapterText) {
      setNarrationNotice("There is nothing to read aloud on this page.");
      return;
    }
    const selectedVoice =
      availableNarrationVoices.find((voice) => voice.id === prefs.narrationVoice) ??
      fallbackNarrationVoices.find((voice) => voice.id === prefs.narrationVoice) ??
      fallbackNarrationVoices[0];
    const spokenParagraphs = paragraphs;
    const timingLocale = originalAudio?.chapter.language ?? selectedVoice.locale;
    const spokenWeights = spokenParagraphs.map((text) =>
      Math.max(1, narrationWordCount(text, timingLocale)),
    );
    const totalWeight = spokenWeights.reduce((total, weight) => total + weight, 0);
    const spokenWordEnds: number[] = [];
    spokenWeights.reduce((total, count) => {
      const next = total + count;
      spokenWordEnds.push(next);
      return next;
    }, 0);
    const paragraphForTime = (
      position: number,
      duration: number,
      boundaries: Array<{ offsetMs: number }>,
    ) => {
      if (boundaries.length) {
        const targetMs = position * 1_000;
        let low = 0;
        let high = boundaries.length;
        while (low < high) {
          const middle = (low + high) >>> 1;
          if (boundaries[middle].offsetMs <= targetMs) low = middle + 1;
          else high = middle;
        }
        const spokenWord = Math.max(0, low - 1);
        let paragraphLow = 0;
        let paragraphHigh = spokenWordEnds.length;
        while (paragraphLow < paragraphHigh) {
          const middle = (paragraphLow + paragraphHigh) >>> 1;
          if (spokenWordEnds[middle] <= spokenWord) paragraphLow = middle + 1;
          else paragraphHigh = middle;
        }
        if (paragraphLow < spokenWordEnds.length) return paragraphLow;
      }
      if (!duration || !totalWeight) return 0;
      const target = Math.min(1, Math.max(0, position / duration)) * totalWeight;
      let accumulated = 0;
      for (let offset = 0; offset < spokenWeights.length; offset += 1) {
        accumulated += spokenWeights[offset];
        if (target <= accumulated) return offset;
      }
      return windowEnd - 1;
    };
    const timeForParagraph = (
      duration: number,
      boundaries: Array<{ offsetMs: number; text?: string }>,
    ) => {
      const firstWord = index > 0 ? spokenWordEnds[index - 1] : 0;
      const normalizeWord = (value: string) =>
        stripMarks(value).replace(/[^\p{L}\p{N}'’]+/gu, "");
      const passageWords =
        spokenParagraphs[index]
          ?.match(/[\p{L}\p{M}\p{N}'’]+/gu)
          ?.map(normalizeWord)
          .filter(Boolean) ?? [];
      const boundaryWords = boundaries.map((boundary) => normalizeWord(boundary.text ?? ""));
      let matched = -1;
      for (let length = Math.min(4, passageWords.length); length > 0 && matched < 0; length -= 1) {
        let distance = Number.POSITIVE_INFINITY;
        for (let cursor = 0; cursor <= boundaryWords.length - length; cursor += 1) {
          if (!passageWords.slice(0, length).every((word, offset) => boundaryWords[cursor + offset] === word))
            continue;
          const nextDistance = Math.abs(cursor - firstWord);
          if (nextDistance < distance) {
            matched = cursor;
            distance = nextDistance;
          }
        }
      }
      const boundary = boundaries[matched >= 0 ? matched : firstWord];
      if (boundary)
        return Math.max(0, boundary.offsetMs / 1_000 - EDGE_BOUNDARY_LEAD_SECONDS);
      if (!duration || !totalWeight) return 0;
      const precedingWeight = spokenWeights
        .slice(0, index)
        .reduce((total, weight) => total + weight, 0);
      return (precedingWeight / totalWeight) * duration;
    };
    setSpeaking(true);
    setNarrationPaused(false);
    setNarrationLoading(true);
    setGenerationPercent(1);
    setNarrationNotice("");
    try {
      const useOriginalAudio = originalAudio && !(translation && !showOriginal);
      const stream = useOriginalAudio
        ? await sourceEBookAudiobookStream(
            originalAudio.sourceRoute,
            originalAudio.chapter.id,
          )
        : null;
      if (useOriginalAudio && !stream) throw new Error(t("Audio is unavailable"));
      const generated = stream
        ? null
        : await synthesizeNarration(
            requestId,
            chapterText,
            selectedVoice.id,
            selectedVoice.locale,
            (progress) => setGenerationPercent(progress.percent),
          );
      if (run !== narrationRun.current) return;
      if (narrationRequestId.current === requestId) narrationRequestId.current = "";
      setGenerationPercent(100);
      const boundaries = generated?.boundaries ?? [];
      const url = stream?.url ?? URL.createObjectURL(generated!.blob);
      audioUrl.current = stream ? "" : url;
      const start = stream?.start ?? 0;
      const end = stream?.end ?? Number.POSITIVE_INFINITY;
      audioStart.current = start;
      const player = new Audio(url);
      player.playbackRate = playbackRate;
      audio.current = player;
      setAudioPosition(0);
      setAudioDuration(0);
      let positioned = false;
      player.ondurationchange = () => {
        const duration = Number.isFinite(end)
          ? Math.max(0, end - start)
          : (stream?.duration ?? (Number.isFinite(player.duration) ? player.duration - start : 0));
        setAudioDuration(duration);
        if (!positioned && duration > 0) {
          positioned = true;
          const position = timeForParagraph(duration, boundaries);
          player.currentTime = start + position;
          setAudioPosition(position);
          void player.play();
        }
      };
      let finish: () => void = () => {};
      let trackingTimer = 0;
      const stopTracking = () => window.clearInterval(trackingTimer);
      const trackPlayback = () => {
        if (player.paused || player.ended) return;
        const position = Math.max(0, player.currentTime - start);
        const duration = Number.isFinite(end)
          ? end - start
          : (stream?.duration ?? player.duration - start);
        if (player.currentTime >= end - 0.05) {
          player.pause();
          finish();
          return;
        }
        if (lineTrackerEnabled) {
          const timingPosition = position + (boundaries.length ? EDGE_BOUNDARY_LEAD_SECONDS : 0);
          const line = paragraphForTime(timingPosition, duration, boundaries);
          if (line !== narrationLine.current) {
            narrationLine.current = line;
            goTo(line, true);
          }
        }
      };
      player.onplay = () => {
        stopTracking();
        trackPlayback();
        trackingTimer = window.setInterval(trackPlayback, 50);
      };
      player.onpause = stopTracking;
      player.ontimeupdate = () => {
        const position = Math.max(0, player.currentTime - start);
        const now = performance.now();
        if (now - lastAudioUiUpdate.current >= 500) {
          lastAudioUiUpdate.current = now;
          setAudioPosition(position);
        }
      };
      narrationLine.current = index;
      goTo(index);
      setNarrationLoading(false);
      await new Promise<void>((resolve, reject) => {
        finish = resolve;
        player.onended = () => {
          stopTracking();
          resolve();
        };
        player.onerror = () => {
          stopTracking();
          reject(new Error(t("The generated audio could not be played")));
        };
      });
      stopTracking();
      if (!stream) URL.revokeObjectURL(url);
      audioUrl.current = "";
      if (run === narrationRun.current) {
        setSpeaking(false);
        setGenerationPercent(0);
        narrationLine.current = -1;
        setTrace(null);
      }
    } catch (error) {
      if (run !== narrationRun.current) return;
      setSpeaking(false);
      setNarrationLoading(false);
      setGenerationPercent(0);
      const message = error instanceof Error ? error.message : t("Edge TTS failed");
      if (/desktop app/i.test(message)) {
        setNarrationNotice(
          t("Edge voices need the Harbor desktop app. Reading with the device voice."),
        );
        speakWithDevice(index);
        return;
      }
      setNarrationNotice(
        t("{voice} could not be generated. {message}", {
          voice: selectedVoice?.label ?? t("That voice"),
          message,
        }),
      );
    }
  };

  const addBookmark = (index = current) => {
    persistReadingPosition(index);
    setBookmarks(
      addEBookBookmark(profile, {
        bookId,
        chapterId: chapter.id,
        chapterTitle:
          chapter.title || t("Chapter {chapter}", { chapter: chapter.chapter ?? "" }).trim(),
        chapterLabel: chapter.chapter
          ? t("Chapter {chapter}", { chapter: chapter.chapter })
          : chapter.title || t("Chapter"),
        volumeLabel: currentVolume?.label ?? t("Chapters"),
        line: index,
        preview: paragraphs[index]?.slice(0, 140) ?? "",
      }),
    );
    setPanel("bookmarks");
  };

  const results = useMemo(() => {
    const term = stripMarks(query.trim());
    if (!term) return [];
    return paragraphs
      .map((text, index) => ({ text, index }))
      .filter(({ text }) => stripMarks(text).includes(term));
  }, [paragraphs, query]);
  const shownResults = showFutureResults
    ? results
    : results.filter((result) => result.index <= current);
  const hiddenResults = results.length - shownResults.length;

  useEffect(() => setShowFutureResults(false), [query]);
  useEffect(() => {
    const owner = volumes.find((volume) => volume.chapters.some((item) => item.id === chapter.id));
    if (owner) setSidebarVolume(owner.volume);
  }, [chapter.id, volumes]);
  useEffect(() => {
    if (!chaptersOpen) return;
    const timer = window.setTimeout(
      () =>
        document
          .querySelector<HTMLElement>("[data-current-chapter=true]")
          ?.scrollIntoView({ block: "center" }),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [chapter.id, chaptersOpen, sidebarVolume]);
  useEffect(() => {
    traceY.current = null;
    setTrace(null);
    updateTrace();
  }, [prefs.fontSize, prefs.lineHeight, prefs.width, updateTrace]);

  useEffect(() => {
    if (prefs.mode !== "harbor") return;
    traceY.current = null;
    smartTarget.current = tracedLine.current >= 0 ? tracedLine.current : 0;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => updateTrace());
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [prefs.mode, updateTrace]);

  const captureSelection = (event: React.MouseEvent<HTMLElement>) => {
    const selected = window.getSelection();
    if (!selected || selected.isCollapsed || !selected.rangeCount) return setSelection(null);
    const source = selected.getRangeAt(0);
    const ranges = blocks.current.flatMap((paragraph, line) => {
      if (!paragraph || !source.intersectsNode(paragraph)) return [];
      const range = document.createRange();
      range.selectNodeContents(paragraph);
      if (paragraph.contains(source.startContainer))
        range.setStart(source.startContainer, source.startOffset);
      if (paragraph.contains(source.endContainer))
        range.setEnd(source.endContainer, source.endOffset);
      const text = range.toString();
      if (!text) return [];
      const before = document.createRange();
      before.selectNodeContents(paragraph);
      before.setEnd(range.startContainer, range.startOffset);
      const start = before.toString().length;
      return [{ line, start, end: start + text.length }];
    });
    if (!ranges.length) return setSelection(null);
    const rect = source.getBoundingClientRect();
    setExplanation(null);
    setSelection({
      ranges,
      text: selected.toString().trim(),
      x: rect.left + rect.width / 2,
      y: rect.top - 12,
    });
    event.stopPropagation();
  };

  const draftAnnotation = (reference = false, color = inks[0]): EBookAnnotation | null =>
    selection && {
      id: `an${Date.now().toString(36)}`,
      chapterId: chapter.id,
      chapterLabel: chapter.chapter
        ? t("Chapter {chapter}", { chapter: chapter.chapter })
        : chapter.title || t("Chapter"),
      volumeLabel: currentVolume?.label ?? t("Chapters"),
      text: selection.text,
      ranges: selection.ranges,
      color,
      density: 58,
      title: "",
      body: "",
      tags: [],
      reference,
      createdAt: Date.now(),
    };

  const explainSelection = async () => {
    if (!selection) return;
    const selected = selection;
    const line = selected.ranges[0]?.line ?? current;
    const context = paragraphs.slice(Math.max(0, line - 1), line + 2).join("\n\n");
    setExplanation({ loading: true, x: selected.x, y: selected.y });
    try {
      const results = await explainPassage(selected.text, context, getUiLanguage());
      setExplanation({ loading: false, results, x: selected.x, y: selected.y });
    } catch (error) {
      setExplanation({
        loading: false,
        error: error instanceof Error ? error.message : t("Wiktionary lookup failed."),
        x: selected.x,
        y: selected.y,
      });
    }
  };

  const storeAnnotation = (annotation: EBookAnnotation) => {
    setAnnotations(saveEBookAnnotation(profile, bookId, annotation));
    window.getSelection()?.removeAllRanges();
    setSelection(null);
    setEditing(null);
  };

  const quickHighlight = (color: string) => {
    const annotation = draftAnnotation(false, color);
    if (annotation) storeAnnotation(annotation);
  };
  const selectedAnnotation = selection?.annotationId
    ? annotations.find((annotation) => annotation.id === selection.annotationId)
    : undefined;
  const applyInk = (color: string) => {
    if (!selectedAnnotation) return quickHighlight(color);
    setAnnotations(saveEBookAnnotation(profile, bookId, { ...selectedAnnotation, color }));
    setSelection(null);
  };
  const cancelAnnotationDismiss = () => window.clearTimeout(annotationHideTimer.current);
  const scheduleAnnotationDismiss = (annotationId: string) => {
    cancelAnnotationDismiss();
    annotationHideTimer.current = window.setTimeout(() => {
      setSelection((current) => (current?.annotationId === annotationId ? null : current));
    }, 1500);
  };

  const renderText = (text: string, line: number) => {
    const ranges = annotations
      .flatMap((annotation) => {
        const direct =
          annotation.chapterId === chapter.id
            ? annotation.ranges
                .filter((range) => range.line === line)
                .map((range) => ({ ...range, annotation }))
            : [];
        if (!annotation.reference || !annotation.text) return direct;
        const found = referenceRanges(text, annotation.text).map((range) => ({
          line,
          ...range,
          annotation,
        }));
        return [...direct, ...found];
      })
      .sort((a, b) => a.start - b.start || b.end - a.end);
    if (!ranges.length) return text;
    const output: React.ReactNode[] = [];
    let cursor = 0;
    ranges.forEach(({ start: rawStart, end: rawEnd, annotation }) => {
      const start = Math.max(cursor, Math.min(text.length, rawStart));
      const end = Math.max(start, Math.min(text.length, rawEnd));
      if (start > cursor) output.push(text.slice(cursor, start));
      if (end > start)
        output.push(
          <mark
            key={`${annotation.id}:${line}:${start}`}
            className="reader-annotation"
            style={{
              background: `color-mix(in srgb, ${annotation.color} ${annotation.density}%, transparent)`,
            }}
            onMouseEnter={(event) => {
              const target = event.currentTarget;
              window.clearTimeout(annotationHoverTimer.current);
              cancelAnnotationDismiss();
              annotationHoverTimer.current = window.setTimeout(() => {
                const selected = window.getSelection();
                if (!target.isConnected || (!selected?.isCollapsed && selected?.toString().trim()))
                  return;
                const rect = target.getBoundingClientRect();
                setSelection({
                  ranges: annotation.ranges,
                  text: annotation.text,
                  x: rect.left + rect.width / 2,
                  y: rect.top - 12,
                  annotationId: annotation.id,
                });
              }, 1000);
            }}
            onMouseLeave={() => {
              window.clearTimeout(annotationHoverTimer.current);
              scheduleAnnotationDismiss(annotation.id);
            }}
            onClick={(event) => {
              event.stopPropagation();
              const selected = window.getSelection();
              if (!selected?.isCollapsed && selected?.toString().trim()) return;
              setEditing(annotation);
            }}
          >
            {text.slice(start, end)}
          </mark>,
        );
      cursor = end;
    });
    if (cursor < text.length) output.push(text.slice(cursor));
    return output;
  };

  return (
    <div
      className="fixed inset-0 z-[90] overflow-hidden transition-colors duration-300"
      style={{
        background: colors.desk,
        color: colors.ink,
        filter: `brightness(${prefs.brightness}%)`,
      }}
      onMouseMove={revealChrome}
      onClick={revealChrome}
    >
      <div
        data-tauri-drag-region
        className={`absolute inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b px-5 backdrop-blur-xl transition duration-300 ${chrome ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"}`}
        style={{ background: `${colors.desk}df`, borderColor: `${colors.muted}35` }}
      >
        <div className="flex items-center gap-1">
          <button
            className="reader-icon"
            onClick={() => {
              stopSpeech();
              onClose();
            }}
            aria-label={t("Close reader")}
          >
            <X size={20} />
          </button>
          <button
            className={`reader-icon ${chaptersOpen ? "reader-icon-accent" : ""}`}
            onClick={() => {
              setChaptersOpen((open) => !open);
              setVolumeMenuOpen(false);
              setPanel(null);
            }}
            aria-label={t("Chapters")}
          >
            <BookOpen size={19} />
          </button>
        </div>
        <div data-tauri-drag-region className="min-w-0 text-center">
          <div className="truncate text-sm font-semibold">{readerTitle}</div>
          <div className="mt-0.5 text-[11px]" style={{ color: colors.muted }}>
            {prefs.mode === "book"
              ? `${flipPage + 1} / ${Math.max(1, flipPages.urls.length)}`
              : `${current + 1} / ${Math.max(1, paragraphs.length)}`}{" "}
            · {bookTitle}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="reader-icon"
            onClick={() => {
              setPanel("search");
              setChaptersOpen(false);
            }}
            aria-label={t("Search chapter")}
          >
            <Search size={18} />
          </button>
          <button
            className="reader-icon"
            onClick={() => {
              setPanel("annotations");
              setChaptersOpen(false);
            }}
            aria-label={t("Notes and highlights")}
          >
            <Highlighter size={18} />
          </button>
          <button
            className="reader-icon"
            onClick={() => {
              setPanel("bookmarks");
              setChaptersOpen(false);
            }}
            aria-label={t("Bookmarks")}
          >
            <Bookmark size={18} />
          </button>
          <button
            className="reader-icon"
            onClick={() => {
              setPanel("settings");
              setChaptersOpen(false);
            }}
            aria-label={t("Reader settings")}
          >
            <Settings2 size={19} />
          </button>
        </div>
      </div>

      {prefs.mode === "book" ? (
        <div className="absolute inset-x-0 bottom-16 top-16 overflow-hidden">
          {flipLayers.map((layer) => {
            const isActive = layer.id === activeFlipLayerId;
            const isWaiting = !isActive && layer.id === flipLayers.at(-1)?.id;
            const isReplacement = isActive && flipLayers.length > 1;
            return (
              <div
                key={layer.id}
                className={`absolute inset-0 ${
                  isActive
                    ? `pointer-events-auto opacity-100 ${isReplacement ? "ebook-book-crossfade-in" : ""}`
                    : isWaiting
                      ? "pointer-events-none opacity-0"
                      : "pointer-events-none opacity-100 ebook-book-crossfade-out"
                }`}
                style={{ zIndex: isActive ? 2 : 1 }}
                aria-hidden={!isActive}
              >
                <BookFlip
                  instanceName={`harborEBook-${layer.id}`}
                  pages={layer.pages.urls}
                  rtl={layer.presentation.rtl}
                  bg={layer.presentation.background}
                  resumePage={layer.resumePage}
                  soundEnabled={isActive}
                  textureSize={1024}
                  pixelRatio={1}
                  onReady={(api) => activateFlipLayer(layer.id, api)}
                  onProgress={(page) => {
                    if (activeFlipLayerIdRef.current !== layer.id) return;
                    const paragraph = layer.pages.paragraphStarts[page] ?? 0;
                    setFlipPage(page);
                    setCurrent(paragraph);
                    tracedLine.current = paragraph;
                    persistReadingPosition(paragraph);
                  }}
                />
              </div>
            );
          })}
          {activeFlipLayerId == null && (
            <div className="grid h-full place-items-center text-sm" style={{ color: colors.muted }}>
              {t("Preparing book…")}
            </div>
          )}
        </div>
      ) : (
        <div ref={scroller} className="absolute inset-0 overflow-y-auto px-4 pb-32 pt-24 sm:px-8">
          <article
            ref={article}
            dir={effectiveDirection}
            className="relative mx-auto min-h-[calc(100vh-8rem)] select-text rounded-[2px] px-7 py-14 shadow-[0_28px_90px_rgba(0,0,0,.42)] transition-[width,background-color] duration-300 sm:px-14"
            style={
              {
                width: `min(100%, ${prefs.width}px)`,
                background: colors.page,
                color: colors.ink,
                "--reader-read-color": `color-mix(in srgb, ${prefs.lineTrackColor} 62%, ${colors.ink})`,
                WebkitUserSelect: "text",
                fontFamily: readerFontFamily(prefs),
                fontSize: `${prefs.fontSize}px`,
                lineHeight: prefs.lineHeight,
              } as CSSProperties
            }
            onMouseUp={captureSelection}
          >
            <div className="pointer-events-none absolute inset-y-0 start-0 w-px bg-gradient-to-b from-transparent via-black/10 to-transparent" />
            {chapterIndex === 0 && (internalCover || bookCover) && (
              <section
                aria-label={t("{title} cover", { title: bookTitle })}
                className="mb-14 flex min-h-[70vh] flex-col items-center justify-center border-b pb-14 text-center"
                style={{ borderColor: `${colors.muted}35` }}
              >
                <img
                  src={internalCover || bookCover}
                  alt={t("{title} internal cover", { title: bookTitle })}
                  className="h-full max-h-[72vh] w-full object-contain shadow-[0_22px_65px_rgba(0,0,0,.38)]"
                />
              </section>
            )}
            <header className="mb-12 border-b pb-7" style={{ borderColor: `${colors.muted}35` }}>
              <div
                className="mb-2 text-xs font-semibold uppercase tracking-[.24em]"
                style={{ color: colors.muted }}
              >
                {t("Harbor Reader")}
              </div>
              <h1 className="text-balance text-[1.85em] font-semibold leading-tight">
                {readerTitle}
              </h1>
            </header>
            {paragraphs.map((text, index) => (
              <p
                key={index}
                data-reader-line={index}
                ref={(node) => {
                  blocks.current[index] = node;
                }}
                className={`relative mb-[1.1em] scroll-mt-24 text-pretty transition-colors ${lineTrackerEnabled ? (index === current ? "reader-current" : index <= readThrough ? "reader-read" : "") : ""}`}
                style={{ textAlign: "start" }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  tracedLine.current = index;
                  setCurrent(index);
                  persistReadingPosition(index);
                  setExplanation(null);
                  setSelection({
                    ranges: [{ line: index, start: 0, end: text.length }],
                    text,
                    x: event.clientX,
                    y: event.clientY - 12,
                  });
                }}
                onDoubleClick={() => {
                  setCurrent(index);
                  addBookmark(index);
                }}
              >
                {renderText(text, index)}
              </p>
            ))}
            {(content.images ?? []).map((src, index) => (
              <img
                key={src + index}
                src={src}
                className="mx-auto my-10 max-h-[80vh] max-w-full rounded"
                alt=""
              />
            ))}
          </article>
        </div>
      )}

      {prefs.mode === "harbor" && lineTrackerEnabled && trace && (
        <div
          dir={effectiveDirection}
          className="pointer-events-none fixed z-20 rounded-md transition-[top,left,width,height] duration-200 ease-out will-change-[top,height]"
          style={{
            ...trace,
            background: `color-mix(in srgb, ${prefs.lineTrackColor} 15%, transparent)`,
          }}
        />
      )}

      {selection && !editing && !explanation && (
        <SelectionToolbar
          selection={selection}
          direction={effectiveDirection}
          onColor={applyInk}
          onListen={() => {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(selection.text);
            utterance.lang = effectiveDirection === "rtl" ? "ar" : "en";
            window.speechSynthesis.speak(utterance);
          }}
          onListenFrom={() => {
            const line = selection.ranges[0]?.line ?? current;
            setSelection(null);
            void speakFrom(line);
          }}
          onExplain={() => void explainSelection()}
          onNote={() => setEditing(selectedAnnotation ?? draftAnnotation(false))}
          onReference={() =>
            setEditing(
              selectedAnnotation
                ? { ...selectedAnnotation, reference: true }
                : draftAnnotation(true),
            )
          }
          onBookmark={() => {
            addBookmark(selection.ranges[0]?.line ?? current);
            setSelection(null);
          }}
          onCopy={() => navigator.clipboard.writeText(selection.text)}
          onHoverStart={cancelAnnotationDismiss}
          onHoverEnd={() =>
            selection.annotationId && scheduleAnnotationDismiss(selection.annotationId)
          }
        />
      )}

      {explanation && (
        <ExplanationCard
          explanation={explanation}
          direction={effectiveDirection}
          onClose={() => {
            setExplanation(null);
            setSelection(null);
          }}
        />
      )}

      <div
        className={`absolute inset-x-0 bottom-5 z-30 mx-auto flex w-fit items-center gap-1 rounded-full border p-1.5 shadow-2xl backdrop-blur-xl transition duration-300 ${chrome ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
        style={{ background: `${colors.desk}e8`, borderColor: `${colors.muted}45` }}
      >
        <button
          className="reader-icon"
          disabled={!previousChapter}
          onClick={() => selectChapter(previousChapter)}
          aria-label={t("Previous chapter")}
          title={t("Previous chapter")}
        >
          <SkipBack size={21} strokeWidth={2} fill="currentColor" />
        </button>
        <button
          className="reader-icon"
          onClick={() => addBookmark()}
          aria-label={t("Bookmark current passage")}
          title={t("Continue from this passage next time")}
        >
          <Bookmark size={18} />
        </button>
        {prefs.mode === "book" && (
          <>
            <button
              className="reader-icon"
              disabled={flipPage <= 0}
              onClick={() => bookApi.current?.prev()}
              aria-label={t("Previous page")}
            >
              {effectiveDirection === "rtl" ? (
                <ChevronRight size={20} />
              ) : (
                <ChevronLeft size={20} />
              )}
            </button>
            <button
              className="reader-icon"
              disabled={flipPage >= flipPages.urls.length - 1}
              onClick={() => bookApi.current?.next()}
              aria-label={t("Next page")}
            >
              {effectiveDirection === "rtl" ? (
                <ChevronLeft size={20} />
              ) : (
                <ChevronRight size={20} />
              )}
            </button>
          </>
        )}
        <button
          className={`reader-icon ${translation ? "reader-icon-accent reader-language-toggle" : translationError ? "text-red-400" : ""}`}
          disabled={translating}
          onClick={translation ? toggleTranslation : () => void translateChapter()}
          aria-label={
            translation
              ? showOriginal
                ? t("Show translation")
                : t("Show original language")
              : t("Translate chapter")
          }
          title={
            translationError ||
            (translation
              ? showOriginal
                ? t("Show translation")
                : t("Show original language")
              : t("Translate chapter"))
          }
        >
          {translating ? (
            <TranslationSpinner />
          ) : (
            <>
              <Languages size={18} />
              {translation && <span>{showOriginal ? t("Translation") : t("Original")}</span>}
            </>
          )}
        </button>
        {translating && (
          <div
            className="flex items-center gap-1 whitespace-nowrap pe-2 text-[11px] tabular-nums"
            style={{ color: colors.muted }}
          >
            <strong className="text-current">≈{translationProgress.percent}%</strong>
            <span>·</span>
            <span>
              {translationProgress.etaMs == null
                ? t("Estimating…")
                : formatEtaLabel(translationProgress.etaMs)}
            </span>
          </div>
        )}
        <VoicePicker
          voices={availableNarrationVoices}
          value={prefs.narrationVoice}
          disabled={narrationLoading}
          colors={colors}
          onChange={(voice) => {
            stopSpeech();
            patchPrefs({ narrationVoice: voice });
          }}
          previewingVoice={voicePreviewId}
          previewLoading={voicePreviewLoading}
          onPreview={(voice) => void previewVoice(voice)}
        />
        <button
          className={`reader-icon ${narrationLoading ? "reader-icon-cancel" : "reader-icon-accent"}`}
          onClick={
            narrationLoading ? stopSpeech : speaking ? toggleNarrationPause : () => void speakFrom()
          }
          aria-label={
            narrationLoading
              ? t("Cancel Edge TTS generation")
              : speaking
                ? narrationPaused
                  ? t("Resume narration")
                  : t("Pause narration")
                : originalAudio && !(translation && !showOriginal)
                  ? t("Play original audiobook chapter")
                  : t("Read chapter with Edge TTS")
          }
          title={
            narrationLoading
              ? t("Cancel audio generation")
              : narrationNotice ||
                (originalAudio && !(translation && !showOriginal)
                  ? t("Play original audiobook chapter")
                  : t("Read the complete chapter with Edge TTS"))
          }
        >
          {narrationLoading ? (
            <X size={18} strokeWidth={2.5} />
          ) : speaking && !narrationPaused ? (
            <Pause size={18} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" />
          )}
        </button>
        {narrationLoading && (
          <div
            className="flex items-center gap-1.5 pe-2 text-[11px] font-semibold tabular-nums"
            style={{ color: colors.muted }}
            title={t("Preparing narration audio")}
          >
            <Loader2 size={13} className="animate-spin motion-reduce:animate-none" />
            <span>{generationPercent > 1 ? `${generationPercent}%` : "Preparing"}</span>
          </div>
        )}
        {(speaking || audioDuration > 0) && (
          <div className="flex w-[clamp(210px,22vw,330px)] items-center gap-2 px-2">
            <span className="w-9 text-end text-[10px] tabular-nums" style={{ color: colors.muted }}>
              {formatAudioTime(audioPosition)}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(audioDuration, 0.01)}
              step={0.05}
              value={Math.min(audioPosition, Math.max(audioDuration, 0.01))}
              disabled={!audio.current || !audioDuration}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!audio.current || !Number.isFinite(next)) return;
                audio.current.currentTime = audioStart.current + next;
                lastAudioUiUpdate.current = performance.now();
                setAudioPosition(next);
              }}
              aria-label={t("Audio position")}
              className="ebook-audio-seeker h-5 min-w-0 flex-1 cursor-pointer disabled:cursor-wait disabled:opacity-35"
              style={
                {
                  "--audio-progress": `${audioDuration ? (audioPosition / audioDuration) * 100 : 0}%`,
                } as React.CSSProperties
              }
            />
            <span className="w-9 text-[10px] tabular-nums" style={{ color: colors.muted }}>
              -{formatAudioTime(Math.max(0, audioDuration - audioPosition))}
            </span>
            <button
              type="button"
              className="min-w-9 rounded-lg px-1.5 py-1 text-[11px] font-semibold tabular-nums hover:bg-white/[.08]"
              onClick={() => {
                const next = playbackRates[(playbackRates.indexOf(playbackRate) + 1) % playbackRates.length];
                setPlaybackRate(next);
                if (audio.current) audio.current.playbackRate = next;
              }}
              aria-label={t("Playback speed: {speed}x", { speed: playbackRate })}
              title={t("Change playback speed")}
            >
              {playbackRate}×
            </button>
          </div>
        )}
        {prefs.mode === "harbor" &&
          audioDuration > 0 &&
          narrationLine.current >= 0 &&
          current !== narrationLine.current && (
            <button
              className="reader-icon"
              onClick={() => {
                goTo(narrationLine.current);
                window.requestAnimationFrame(() => updateTrace());
              }}
              aria-label={t("Return to the audio line")}
              title={t("Return to the audio line")}
            >
              <LocateFixed size={18} />
            </button>
          )}
        <div className="px-3 text-xs tabular-nums" style={{ color: colors.muted }}>
          {Math.round(
            prefs.mode === "book"
              ? ((flipPage + 1) / Math.max(1, flipPages.urls.length)) * 100
              : ((current + 1) / Math.max(1, paragraphs.length)) * 100,
          )}
          %
        </div>
        <button
          className="reader-icon"
          disabled={!nextChapter}
          onClick={() => selectChapter(nextChapter)}
          aria-label={t("Next chapter")}
          title={t("Next chapter")}
        >
          <SkipForward size={21} strokeWidth={2} fill="currentColor" />
        </button>
      </div>

      {chaptersOpen && (
        <aside
          className="absolute inset-y-0 start-0 z-40 flex w-full max-w-[390px] flex-col border-e p-5 shadow-2xl backdrop-blur-2xl"
          style={{ background: `${colors.page}f7`, borderColor: `${colors.muted}35` }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div
                className="text-[10px] font-semibold uppercase tracking-[.2em]"
                style={{ color: colors.muted }}
              >
                {t("Chapters")}
              </div>
              <h2 className="mt-1 text-lg font-semibold">{shownVolume?.label ?? t("Chapters")}</h2>
            </div>
            <button
              className="reader-icon"
              onClick={() => {
                setChaptersOpen(false);
                setVolumeMenuOpen(false);
              }}
              aria-label={t("Close chapters")}
            >
              <X size={18} />
            </button>
          </div>
          {volumes.length > 1 && (
            <div className="relative mt-4">
              <div
                className="text-[10px] font-semibold uppercase tracking-[.18em]"
                style={{ color: colors.muted }}
              >
                {t("Volume")}
              </div>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={volumeMenuOpen}
                onClick={() => setVolumeMenuOpen((open) => !open)}
                className={`mt-2 flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-start transition ${volumeMenuOpen ? "border-accent/70 bg-accent/10 shadow-[0_0_0_3px_rgba(255,159,77,.08)]" : "hover:border-accent/40 hover:bg-white/[.04]"}`}
                style={{
                  backgroundColor: volumeMenuOpen ? undefined : `${colors.desk}70`,
                  borderColor: volumeMenuOpen ? undefined : `${colors.muted}45`,
                }}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
                  <BookOpen size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm leading-tight">
                    {shownVolume?.label}
                  </strong>
                  <span className="block text-[11px] leading-tight" style={{ color: colors.muted }}>
                    {shownChapters.length === 1
                      ? t("{count} chapter", { count: shownChapters.length })
                      : t("{count} chapters", { count: shownChapters.length })}
                  </span>
                </span>
                <ChevronDown
                  size={17}
                  className={`shrink-0 transition-transform duration-200 ${volumeMenuOpen ? "rotate-180 text-accent" : ""}`}
                />
              </button>
              {volumeMenuOpen && (
                <div
                  role="listbox"
                  aria-label={t("Volume")}
                  className="absolute inset-x-0 top-full z-50 mt-2 max-h-64 space-y-1 overflow-y-auto rounded-2xl border p-1.5 shadow-[0_18px_55px_rgba(0,0,0,.48)] backdrop-blur-2xl"
                  style={{ background: `${colors.page}fa`, borderColor: `${colors.muted}45` }}
                >
                  {volumes.map((volume) => {
                    const selected = volume.volume === shownVolume?.volume;
                    return (
                      <button
                        key={volume.volume || "chapters"}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          setSidebarVolume(volume.volume);
                          setVolumeMenuOpen(false);
                        }}
                        className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-start transition ${selected ? "bg-accent text-black shadow-[0_7px_20px_rgba(255,159,77,.18)]" : "hover:bg-white/[.06]"}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${selected ? "bg-black/70" : "bg-current opacity-25"}`}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                          {volume.label}
                        </span>
                        <span
                          className={`text-[11px] tabular-nums ${selected ? "text-black/65" : ""}`}
                          style={selected ? undefined : { color: colors.muted }}
                        >
                          {volume.chapters.length}
                        </span>
                        {selected && <Check size={16} strokeWidth={2.5} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div
            className="mt-4 flex items-center justify-between border-y py-3 text-xs"
            style={{ borderColor: `${colors.muted}25`, color: colors.muted }}
          >
            <span>
              {shownChapters.length === 1
                ? t("{count} chapter", { count: shownChapters.length })
                : t("{count} chapters", { count: shownChapters.length })}
            </span>
            <span>
              {shownChapters.some((item) => item.id === chapter.id)
                ? `${shownChapters.findIndex((item) => item.id === chapter.id) + 1} / ${shownChapters.length}`
                : t("Select a chapter")}
            </span>
          </div>
          <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto pe-1 pb-10">
            {shownChapters.map((item, index) => {
              const active = item.id === chapter.id;
              return (
                <button
                  key={item.id}
                  data-current-chapter={active || undefined}
                  onClick={() => !active && onSelectChapter(item)}
                  className={`group flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-start transition ${active ? "border-accent/50 bg-accent/10" : "border-transparent hover:border-white/10 hover:bg-white/5"}`}
                >
                  <span
                    className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] tabular-nums ${active ? "bg-accent text-black" : "bg-white/5"}`}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <strong className={`line-clamp-2 block text-sm ${active ? "text-accent" : ""}`}>
                      {item.title || t("Chapter {chapter}", { chapter: item.chapter ?? index + 1 })}
                    </strong>
                    <span className="mt-1 block text-[11px]" style={{ color: colors.muted }}>
                      {item.chapter
                        ? t("Chapter {chapter}", { chapter: item.chapter })
                        : t("Position {position}", { position: index + 1 })}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      )}

      {panel && (
        <div
          className="absolute inset-y-0 end-0 z-40 flex w-full max-w-[390px] flex-col border-s p-5 shadow-2xl backdrop-blur-2xl"
          style={{ background: `${colors.page}f7`, borderColor: `${colors.muted}35` }}
        >
          <div className="mb-6 flex shrink-0 items-center justify-between">
            <h2 className="text-lg font-semibold">
              {panel === "settings"
                ? t("Reading settings")
                : panel === "search"
                  ? t("Search chapter")
                  : panel === "annotations"
                    ? t("Notes & highlights")
                    : t("Bookmarks")}
            </h2>
            <button
              className="reader-icon"
              onClick={() => setPanel(null)}
              aria-label={t("Close panel")}
            >
              <X size={18} />
            </button>
          </div>
          <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {panel === "settings" && (
              <Settings
                prefs={prefs}
                patch={patchPrefs}
                colors={colors}
                audiobook={Boolean(originalAudio)}
              />
            )}
            {panel === "search" && (
              <div>
                <div
                  className="flex items-center gap-2 rounded-xl border px-3"
                  style={{ borderColor: `${colors.muted}45` }}
                >
                  <Search size={17} />
                  <input
                    autoFocus
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="h-11 min-w-0 flex-1 bg-transparent outline-none"
                    placeholder={t("Find a word or passage")}
                  />
                </div>
                <div
                  className="mt-3 rounded-xl border px-3 py-2 text-xs"
                  style={{ borderColor: `${colors.muted}25`, color: colors.muted }}
                >
                  {t("Diacritic-insensitive · results ahead stay sealed")}
                </div>
                <div className="mt-4 space-y-2 overflow-y-auto pb-10">
                  {shownResults.map((result) => (
                    <button
                      key={result.index}
                      onClick={() => {
                        goTo(result.index);
                        setPanel(null);
                      }}
                      className="w-full rounded-xl border p-3 text-start text-sm transition hover:border-accent/60"
                      style={{ borderColor: `${colors.muted}25` }}
                    >
                      <span className="mb-1 block text-[10px] uppercase tracking-widest opacity-50">
                        {t("Passage {passage}", { passage: result.index + 1 })}
                      </span>
                      {result.text.slice(0, 220)}
                    </button>
                  ))}
                  {hiddenResults > 0 && (
                    <button
                      onClick={() => setShowFutureResults(true)}
                      className="w-full rounded-xl border border-dashed border-accent/50 p-5 text-sm text-accent"
                    >
                      <strong className="block text-base">
                        {hiddenResults === 1
                          ? t("{count} match ahead", { count: hiddenResults })
                          : t("{count} matches ahead", { count: hiddenResults })}
                      </strong>
                      <span className="mt-1 block text-xs opacity-70">{t("Show them anyway")}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
            {panel === "annotations" && (
              <div className="space-y-2 overflow-y-auto pb-10">
                {!annotations.length && (
                  <p style={{ color: colors.muted }}>
                    {t("Select a passage to add a highlight, note, or reference.")}
                  </p>
                )}
                {annotations.map((annotation) => {
                  const savedVolume = volumes.find((volume) =>
                    volume.chapters.some((item) => item.id === annotation.chapterId),
                  );
                  const savedChapter = savedVolume?.chapters.find(
                    (item) => item.id === annotation.chapterId,
                  );
                  const chapterLabel =
                    annotation.chapterLabel ??
                    (savedChapter?.chapter
                      ? t("Chapter {chapter}", { chapter: savedChapter.chapter })
                      : savedChapter?.title || t("Chapter"));
                  const line = (annotation.ranges[0]?.line ?? 0) + 1;
                  return (
                    <button
                      key={annotation.id}
                      onClick={() => setEditing(annotation)}
                      className="w-full rounded-xl border p-3 text-start"
                      style={{ borderColor: `${colors.muted}25` }}
                    >
                      <span
                        className="mb-2 block h-1 w-10 rounded-full"
                        style={{ background: annotation.color, opacity: annotation.density / 100 }}
                      />
                      <div className="mb-2 flex flex-wrap gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
                        <span className="rounded-full bg-white/[.06] px-2 py-1">
                          {annotation.volumeLabel ?? savedVolume?.label ?? t("Chapters")}
                        </span>
                        <span className="rounded-full bg-white/[.06] px-2 py-1">
                          {chapterLabel}
                        </span>
                        <span className="rounded-full bg-accent/15 px-2 py-1 text-accent">
                          {t("Line {line}", { line })}
                        </span>
                      </div>
                      <strong className="block text-sm">
                        {annotation.title ||
                          (annotation.reference
                            ? t("Reference")
                            : annotation.body
                              ? t("Note")
                              : t("Highlight"))}
                      </strong>
                      <span
                        className="mt-1 line-clamp-3 block text-xs"
                        style={{ color: colors.muted }}
                      >
                        {annotation.text}
                      </span>
                      {annotation.tags.length > 0 && (
                        <span className="mt-2 block text-[10px] uppercase tracking-wider opacity-50">
                          {annotation.tags.join(" · ")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {panel === "bookmarks" && (
              <div className="space-y-2">
                {!bookmarks.length && (
                  <p style={{ color: colors.muted }}>{t("No saved passages yet.")}</p>
                )}
                {bookmarks.map((bookmark) => {
                  const savedVolume = volumes.find((volume) =>
                    volume.chapters.some((item) => item.id === bookmark.chapterId),
                  );
                  const savedChapter = savedVolume?.chapters.find(
                    (item) => item.id === bookmark.chapterId,
                  );
                  const chapterLabel =
                    bookmark.chapterLabel ??
                    (savedChapter?.chapter
                      ? t("Chapter {chapter}", { chapter: savedChapter.chapter })
                      : bookmark.chapterTitle);
                  return (
                    <div
                      key={bookmark.id}
                      className="flex gap-2 rounded-xl border p-3"
                      style={{ borderColor: `${colors.muted}25` }}
                    >
                      <button
                        className="min-w-0 flex-1 text-start"
                        onClick={() => {
                          if (!savedChapter || savedChapter.id === chapter.id) goTo(bookmark.line);
                          else {
                            saveEBookProgress(
                              profile,
                              bookId,
                              `${savedChapter.id}:harbor`,
                              bookmark.line,
                            );
                            onSelectChapter(savedChapter);
                          }
                          setPanel(null);
                        }}
                      >
                        <div className="mb-2 flex flex-wrap gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
                          <span className="rounded-full bg-white/[.06] px-2 py-1">
                            {bookmark.volumeLabel ?? savedVolume?.label ?? t("Chapters")}
                          </span>
                          <span className="rounded-full bg-white/[.06] px-2 py-1">
                            {chapterLabel}
                          </span>
                          <span className="rounded-full bg-accent/15 px-2 py-1 text-accent">
                            {t("Line {line}", { line: bookmark.line + 1 })}
                          </span>
                        </div>
                        <div className="line-clamp-3 text-xs" style={{ color: colors.muted }}>
                          {bookmark.preview}
                        </div>
                      </button>
                      {bookmark.chapterId === chapter.id && (
                        <button
                          onClick={() => {
                            setPanel(null);
                            void speakFrom(bookmark.line);
                          }}
                          className="flex shrink-0 items-center gap-1.5 self-start rounded-lg px-2 py-2 text-xs hover:bg-white/[.06]"
                          aria-label={t("Listen from here")}
                          title={t("Listen from here")}
                        >
                          <Play size={14} fill="currentColor" />
                          <span>{t("Listen from here")}</span>
                        </button>
                      )}
                      <button
                        onClick={() =>
                          setBookmarks(removeEBookBookmark(profile, bookId, bookmark.id))
                        }
                        className="self-start p-2"
                        aria-label={t("Delete bookmark")}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      {editing && (
        <AnnotationEditor
          annotation={editing}
          bookTitle={bookTitle}
          direction={effectiveDirection}
          onChange={setEditing}
          onSave={() => storeAnnotation(editing)}
          onDelete={() => {
            setAnnotations(removeEBookAnnotation(profile, bookId, editing.id));
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
      <style>{`.reader-icon{display:grid;width:42px;height:42px;place-items:center;border-radius:999px;color:inherit;transition:.16s ease}.reader-icon:hover{background:rgba(127,127,127,.16);transform:translateY(-1px)}.reader-icon:active{transform:scale(.92)}.reader-icon:disabled{pointer-events:none;opacity:.28}.reader-icon-accent{background:var(--color-accent);color:#111}.reader-icon-cancel{background:rgba(239,68,68,.16);color:#f87171;box-shadow:inset 0 0 0 1px rgba(248,113,113,.28)}.reader-icon-cancel:hover{background:rgba(239,68,68,.25);color:#fca5a5}.reader-language-toggle{display:flex;width:auto;gap:6px;padding:0 12px;font-size:11px;font-weight:700}.reader-current{border-radius:4px}.reader-read{color:var(--reader-read-color)}.reader-annotation{color:inherit;border-radius:3px;padding:.04em .02em;cursor:pointer}.reader-annotation:hover{outline:1px solid color-mix(in srgb,var(--color-accent) 60%,transparent)}.ebook-book-crossfade-in{animation:ebook-book-fade-in 240ms ease-out both;will-change:opacity}.ebook-book-crossfade-out{animation:ebook-book-fade-out 240ms ease-out both;will-change:opacity}@keyframes ebook-book-fade-in{from{opacity:0}to{opacity:1}}@keyframes ebook-book-fade-out{from{opacity:1}to{opacity:0}}@media(prefers-reduced-motion:reduce){.ebook-book-crossfade-in,.ebook-book-crossfade-out{animation:none}}.ebook-audio-seeker{appearance:none;background:transparent}.ebook-audio-seeker::-webkit-slider-runnable-track{height:4px;border-radius:99px;background:linear-gradient(90deg,var(--color-accent) var(--audio-progress),rgba(127,127,127,.28) var(--audio-progress))}.ebook-audio-seeker::-webkit-slider-thumb{appearance:none;width:12px;height:12px;margin-top:-4px;border:2px solid var(--color-accent);border-radius:50%;background:#111;box-shadow:0 0 0 3px color-mix(in srgb,var(--color-accent) 18%,transparent);transition:transform .15s}.ebook-audio-seeker:hover::-webkit-slider-thumb{transform:scale(1.2)}`}</style>
    </div>
  );
}

function SelectionToolbar({
  selection,
  direction,
  onColor,
  onListen,
  onListenFrom,
  onExplain,
  onNote,
  onReference,
  onBookmark,
  onCopy,
  onHoverStart,
  onHoverEnd,
}: {
  selection: ReaderSelection;
  direction: "ltr" | "rtl";
  onColor: (color: string) => void;
  onListen: () => void;
  onListenFrom: () => void;
  onExplain: () => void;
  onNote: () => void;
  onReference: () => void;
  onBookmark: () => void;
  onCopy: () => Promise<void>;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);
  const copy = async () => {
    try {
      await onCopy();
      setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div
      dir={direction}
      className="fixed z-[70] w-max max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-full overflow-hidden rounded-2xl border border-white/10 bg-[#101011]/95 text-[#e8e3d9] shadow-[0_22px_70px_rgba(0,0,0,.62)] backdrop-blur-2xl"
      style={{
        left: Math.min(window.innerWidth - 24, Math.max(24, selection.x)),
        top: Math.max(88, selection.y),
      }}
      onMouseDown={(event) => event.preventDefault()}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
        {inks.map((color) => (
          <button
            key={color}
            onClick={() => onColor(color)}
            className="h-6 w-6 rounded-full border border-white/20 shadow-inner transition hover:scale-110"
            style={{ background: color }}
            aria-label={t("Highlight {color}", { color })}
          />
        ))}
      </div>
      <div className="flex items-center overflow-x-auto p-1.5 text-xs">
        <SelectionAction icon={<Headphones size={15} />} label={t("Listen")} onClick={onListen} />
        <SelectionAction
          icon={<Play size={15} fill="currentColor" />}
          label={t("Listen from here")}
          onClick={onListenFrom}
        />
        <SelectionAction
          icon={<BookOpen size={15} />}
          label={t("Explain")}
          onClick={onExplain}
        />
        <SelectionAction
          icon={<MessageSquareText size={15} />}
          label={t("Note")}
          onClick={onNote}
        />
        <SelectionAction
          icon={<Link2 size={15} />}
          label={t("Add reference")}
          onClick={onReference}
        />
        <SelectionAction
          icon={<Bookmark size={15} />}
          label={t("Passage bookmark")}
          onClick={onBookmark}
        />
        <SelectionAction
          icon={copied ? <Check size={15} /> : <Copy size={15} />}
          label={copied ? t("Copied!") : t("Copy")}
          onClick={() => void copy()}
          active={copied}
        />
      </div>
    </div>
  );
}

function ExplanationCard({
  explanation,
  direction,
  onClose,
}: {
  explanation: {
    loading: boolean;
    results?: WordExplanation[];
    error?: string;
    x: number;
    y: number;
  };
  direction: "ltr" | "rtl";
  onClose: () => void;
}) {
  const t = useT();
  const results = explanation.results ?? [];
  const single = results.length === 1;
  return (
    <div
      dir={direction}
      className="fixed z-[80] w-[min(380px,calc(100vw-24px))] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#101011]/95 p-4 text-[#e8e3d9] shadow-[0_22px_70px_rgba(0,0,0,.62)] backdrop-blur-2xl"
      style={{
        left: Math.min(window.innerWidth - 202, Math.max(202, explanation.x)),
        top: Math.min(window.innerHeight - 280, Math.max(88, explanation.y)),
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-white/45">
            {t("Explain")}
          </p>
          {single && (
            <h3 className="mt-1 text-lg font-semibold">
              {results[0].word}{" "}
              <span className="text-xs font-normal text-white/50">
                · {results[0].partOfSpeech}
              </span>
            </h3>
          )}
          {!single && results.length > 0 && (
            <h3 className="mt-1 text-lg font-semibold">{t("Passage context")}</h3>
          )}
        </div>
        <button className="reader-icon -m-2" onClick={onClose} aria-label={t("Close")}>
          <X size={16} />
        </button>
      </div>
      {explanation.loading && (
        <div className="flex items-center gap-2 py-6 text-sm text-white/60">
          <Loader2 size={16} className="animate-spin" /> {t("Checking Wiktionary…")}
        </div>
      )}
      {explanation.error && <p className="text-sm text-red-300">{explanation.error}</p>}
      {results.length > 0 && (
        <div className="max-h-[min(55vh,520px)] space-y-3 overflow-y-auto text-sm leading-relaxed">
          {results.map((result) => (
            <div
              key={`${result.word}:${result.partOfSpeech}`}
              className="rounded-xl bg-white/[.06] p-3"
            >
              {!single && (
                <strong className="mb-1 block">
                  {result.word}{" "}
                  <span className="text-xs font-normal text-white/45">
                    · {result.partOfSpeech}
                  </span>
                </strong>
              )}
              <p>{result.meaning}</p>
              <p className="mt-2 text-white/65">{result.contextMeaning}</p>
              {result.translation && (
                <p className="mt-2">
                  <strong>{t("Arabic")}:</strong>{" "}
                  <span dir="rtl">{result.translation}</span>
                </p>
              )}
              <span className="mt-2 block text-[10px] uppercase tracking-wider text-white/35">
                {t("{confidence} confidence", { confidence: result.confidence })}
              </span>
            </div>
          ))}
          <div className="text-end text-[10px] uppercase tracking-wider text-white/35">
            {t("Source: Wiktionary")}
          </div>
        </div>
      )}
    </div>
  );
}

function SelectionAction({
  icon,
  label,
  onClick,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 transition ${active ? "bg-accent font-semibold text-black" : "hover:bg-white/10"}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function AnnotationEditor({
  annotation,
  bookTitle,
  direction,
  onChange,
  onSave,
  onDelete,
  onClose,
}: {
  annotation: EBookAnnotation;
  bookTitle: string;
  direction: "ltr" | "rtl";
  onChange: (annotation: EBookAnnotation) => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <div
      className="absolute inset-0 z-[80] grid place-items-center bg-black/65 p-4 backdrop-blur-md"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        dir={direction}
        className="grid max-h-[min(760px,92vh)] w-full max-w-[920px] overflow-hidden rounded-2xl border border-white/10 bg-[#111112] text-[#e8e3d9] shadow-[0_34px_100px_rgba(0,0,0,.72)] md:grid-cols-[1fr_280px]"
      >
        <main className="flex min-h-[500px] flex-col p-8 md:p-10">
          <div className="text-xs uppercase tracking-[.2em] text-accent">
            {annotation.reference ? t("Reference passage") : t("Highlighted passage")}
          </div>
          <blockquote
            className="mt-4 border-s-2 ps-4 text-lg leading-relaxed"
            style={{ borderColor: annotation.color }}
          >
            <mark
              style={{
                background: `color-mix(in srgb, ${annotation.color} ${annotation.density}%, transparent)`,
                color: "inherit",
              }}
            >
              {annotation.text}
            </mark>
          </blockquote>
          <input
            value={annotation.title}
            onChange={(event) => onChange({ ...annotation, title: event.target.value })}
            className="mt-8 border-b border-white/10 bg-transparent py-3 text-2xl outline-none placeholder:text-white/25"
            placeholder={t("Title (optional)")}
          />
          <textarea
            autoFocus
            value={annotation.body}
            onChange={(event) => onChange({ ...annotation, body: event.target.value })}
            className="mt-4 min-h-48 flex-1 resize-none bg-transparent text-lg leading-relaxed outline-none placeholder:text-white/25"
            placeholder={t("Write here… nothing will interrupt you.")}
          />
          <div className="border-t border-white/10 pt-3 text-xs text-white/35">
            {annotation.body.length === 1
              ? t("{count} character", { count: annotation.body.length })
              : t("{count} characters", { count: annotation.body.length })}
          </div>
        </main>
        <aside className="flex flex-col border-t border-white/10 bg-white/[.025] p-5 md:border-s md:border-t-0">
          <div className="flex items-center justify-between">
            <strong>{annotation.reference ? t("Reference") : t("Annotation")}</strong>
            <button className="reader-icon" onClick={onClose} aria-label={t("Close")}>
              <X size={17} />
            </button>
          </div>
          <Setting label={t("Ink colour")}>
            <div className="flex flex-wrap gap-2">
              {inks.map((color) => (
                <button
                  key={color}
                  aria-label={t("Use {color} ink", { color })}
                  onClick={() => onChange({ ...annotation, color })}
                  className={`h-8 w-8 rounded-full border-2 ${annotation.color === color ? "border-white" : "border-transparent"}`}
                  style={{ background: color }}
                />
              ))}
            </div>
          </Setting>
          <Range
            icon={<Highlighter size={16} />}
            label={t("Ink density")}
            value={annotation.density}
            min={20}
            max={90}
            step={5}
            onChange={(density) => onChange({ ...annotation, density })}
          />
          <Setting label={t("Tags")}>
            <input
              value={annotation.tags.join(", ")}
              onChange={(event) =>
                onChange({
                  ...annotation,
                  tags: event.target.value
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                })
              }
              className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm outline-none focus:border-accent/60"
              placeholder={t("study, character, quote")}
            />
          </Setting>
          <div className="mt-auto border-t border-white/10 pt-4 text-xs text-white/40">
            <div>{bookTitle}</div>
            <div className="mt-1">
              {annotation.reference
                ? t("Marks every recurrence of this phrase")
                : t("Saved to this passage")}
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={onSave}
              className="h-11 flex-1 rounded-xl bg-accent font-semibold text-black"
            >
              {t("Save")}
            </button>
            <button
              onClick={onDelete}
              className="reader-icon text-red-400"
              aria-label={t("Delete")}
            >
              <Trash2 size={17} />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Settings({
  prefs,
  patch,
  colors,
  audiobook,
}: {
  prefs: EBookReaderPrefs;
  patch: (value: Partial<EBookReaderPrefs>) => void;
  colors: (typeof paper)[keyof typeof paper];
  audiobook: boolean;
}) {
  const t = useT();
  const [adjustmentsOpen, setAdjustmentsOpen] = useState(true);
  const [audioCacheStatus, setAudioCacheStatus] = useState("");
  const { fonts, busy: fontBusy, error: fontError, addFont, removeFont } = useCustomFonts();
  const localizedFontError =
    fontError === "Use a TTF, OTF, WOFF or WOFF2 file."
      ? t("Use a TTF, OTF, WOFF or WOFF2 file.")
      : fontError === "That font is over 32 MB. Try a lighter file."
        ? t("That font is over 32 MB. Try a lighter file.")
        : fontError === "That file is not a valid font."
          ? t("That file is not a valid font.")
          : fontError;
  const fontInput = useRef<HTMLInputElement>(null);
  const importFont = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const id = await addFont(file);
    if (id) patch({ customFontId: id });
  };
  return (
    <div className="space-y-6">
      <Setting label={t("Reading mode")}>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { mode: "harbor", label: t("Harbor"), icon: <Type size={18} /> },
              { mode: "book", label: t("Book"), icon: <BookOpen size={18} /> },
            ] as const
          ).map((item) => (
            <button
              key={item.mode}
              type="button"
              aria-pressed={prefs.mode === item.mode}
              onClick={() => patch({ mode: item.mode })}
              className={`flex h-14 items-center justify-center gap-2 rounded-xl border transition ${prefs.mode === item.mode ? "border-accent bg-accent/10 text-accent" : "hover:bg-white/5"}`}
              style={{ borderColor: prefs.mode === item.mode ? undefined : `${colors.muted}35` }}
            >
              {item.icon}
              <span className="text-sm font-semibold">{item.label}</span>
            </button>
          ))}
        </div>
      </Setting>
      <Setting label={t("Saved audio")}>
        <button
          type="button"
          onClick={async () => {
            await clearNarrationCache();
            setAudioCacheStatus(t("Saved audio deleted"));
          }}
          className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border text-xs font-semibold transition hover:border-red-400/60 hover:text-red-400"
          style={{ borderColor: `${colors.muted}35` }}
        >
          <Trash2 size={14} /> {t("Delete saved audio")}
        </button>
        {audioCacheStatus && (
          <p className="mt-2 text-center text-[11px] text-emerald-400">{audioCacheStatus}</p>
        )}
      </Setting>
      <Setting label={t("Paper")}>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { background: "dark", label: t("Dark") },
              { background: "dim", label: t("Dim") },
              { background: "light", label: t("Light") },
            ] as const
          ).map(({ background, label }) => (
            <button
              key={background}
              aria-label={label}
              onClick={() => patch({ background })}
              className={`grid h-12 place-items-center rounded-xl border capitalize ${prefs.background === background ? "border-accent text-accent" : ""}`}
              style={{
                borderColor: prefs.background === background ? undefined : `${colors.muted}35`,
              }}
            >
              {background === "light" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          ))}
        </div>
      </Setting>
      <Setting label={t("Type")}>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { font: "literary", label: t("Literary") },
              { font: "arabic", label: t("Arabic") },
              { font: "classic", label: t("Classic") },
            ] as const
          ).map(({ font, label }) => (
            <button
              key={font}
              onClick={() => patch({ font, customFontId: undefined })}
              className={`rounded-xl border px-2 py-3 capitalize ${!prefs.customFontId && prefs.font === font ? "border-accent text-accent" : ""}`}
              style={{
                borderColor:
                  !prefs.customFontId && prefs.font === font ? undefined : `${colors.muted}35`,
                fontFamily: fontFamily[font],
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {fonts.length > 0 && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {fonts.map((font) => {
              const active = prefs.customFontId === font.id;
              return (
                <div
                  key={font.id}
                  className={`group relative rounded-xl border transition ${active ? "border-accent bg-accent/10 text-accent" : "hover:bg-white/5"}`}
                  style={{ borderColor: active ? undefined : `${colors.muted}35` }}
                >
                  <button
                    type="button"
                    onClick={() => patch({ customFontId: font.id })}
                    className="w-full px-3 py-3 pe-9 text-start"
                    style={{ fontFamily: `"harbor-font-${font.id}", serif` }}
                  >
                    <span className="block truncate text-base">Aa أب</span>
                    <span className="mt-1 block truncate text-[11px] opacity-60">{font.name}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={t("Remove {font}", { font: font.name })}
                    onClick={() => {
                      removeFont(font.id);
                      if (active) patch({ customFontId: undefined });
                    }}
                    className="absolute end-2 top-2 grid h-7 w-7 place-items-center rounded-lg opacity-55 transition hover:bg-red-500/15 hover:text-red-400 hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <button
          type="button"
          disabled={fontBusy}
          onClick={() => fontInput.current?.click()}
          className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-medium transition hover:border-accent/60 hover:text-accent disabled:opacity-60"
          style={{ borderColor: `${colors.muted}45` }}
        >
          {fontBusy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {fontBusy ? t("Importing font…") : t("Import font")}
        </button>
        <input
          ref={fontInput}
          type="file"
          accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
          onChange={importFont}
          className="sr-only"
        />
        {localizedFontError && <p className="mt-2 text-xs text-red-400">{localizedFontError}</p>}
      </Setting>
      <section>
        <button
          type="button"
          aria-expanded={adjustmentsOpen}
          onClick={() => setAdjustmentsOpen((open) => !open)}
          className="flex w-full items-center justify-between rounded-xl px-1 py-1 text-xs font-semibold uppercase tracking-[.18em] opacity-60 transition hover:opacity-100"
        >
          <span>{t("Reading adjustments")}</span>
          <ChevronDown
            size={16}
            className={`transition-transform duration-300 ease-out ${adjustmentsOpen ? "rotate-180 text-accent" : ""}`}
          />
        </button>
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${adjustmentsOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        >
          <div className="overflow-hidden" inert={!adjustmentsOpen}>
            <div
              className={`mt-2 space-y-5 rounded-2xl border p-4 transition-transform duration-300 ease-out ${adjustmentsOpen ? "translate-y-0" : "-translate-y-2"}`}
              style={{ background: `${colors.desk}55`, borderColor: `${colors.muted}30` }}
            >
              <Range
                icon={<Type size={16} />}
                label={t("Text size")}
                value={prefs.fontSize}
                min={15}
                max={34}
                onChange={(fontSize) => patch({ fontSize })}
              />
              <Range
                icon={<Gauge size={16} />}
                label={t("Line height")}
                value={prefs.lineHeight}
                min={1.25}
                max={2.4}
                step={0.05}
                onChange={(lineHeight) => patch({ lineHeight })}
              />
              <Range
                icon={<BookOpen size={16} />}
                label={t("Page width")}
                value={prefs.width}
                min={520}
                max={1080}
                step={20}
                onChange={(width) => patch({ width })}
              />
              <Range
                icon={<Sun size={16} />}
                label={t("Brightness")}
                value={prefs.brightness}
                min={55}
                max={120}
                onChange={(brightness) => patch({ brightness })}
              />
            </div>
          </div>
        </div>
      </section>
      <Setting label={t("Direction")}>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { direction: "auto", label: t("Auto") },
              { direction: "ltr", label: t("LTR") },
              { direction: "rtl", label: t("RTL") },
            ] as const
          ).map(({ direction, label }) => (
            <button
              key={direction}
              onClick={() => patch({ direction })}
              className={`rounded-xl border py-2 uppercase ${prefs.direction === direction ? "border-accent text-accent" : ""}`}
              style={{
                borderColor: prefs.direction === direction ? undefined : `${colors.muted}35`,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </Setting>
      <label className="flex items-center justify-between gap-4">
        <span>{t("Focus mode")}</span>
        <input
          type="checkbox"
          checked={prefs.focusMode}
          onChange={(event) => patch({ focusMode: event.target.checked })}
          className="h-5 w-5 accent-[var(--color-accent)]"
        />
      </label>
      {audiobook && (
        <label className="flex items-center justify-between gap-4">
          <span>{t("Line tracker")}</span>
          <input
            type="checkbox"
            checked={prefs.audiobookLineTracker}
            onChange={(event) => patch({ audiobookLineTracker: event.target.checked })}
            className="h-5 w-5 accent-[var(--color-accent)]"
          />
        </label>
      )}
      {(!audiobook || prefs.audiobookLineTracker) && <Setting label={t("Line tracker")}>
        <div
          className="rounded-2xl border p-4"
          style={{ background: `${colors.desk}55`, borderColor: `${colors.muted}30` }}
        >
          <div>
            <div className="mb-3 flex items-center justify-between text-xs">
              <span style={{ color: colors.muted }}>{t("Tracker color")}</span>
              <span className="font-mono uppercase" style={{ color: prefs.lineTrackColor }}>
                {prefs.lineTrackColor}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {trackerColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={t("Use {color} for the line tracker", { color })}
                  aria-pressed={prefs.lineTrackColor === color}
                  onClick={() => patch({ lineTrackColor: color })}
                  className={`grid h-8 w-8 place-items-center rounded-full border-2 transition hover:scale-110 ${prefs.lineTrackColor === color ? "border-white shadow-[0_0_0_3px_rgba(255,255,255,.10)]" : "border-transparent"}`}
                  style={{ background: color }}
                >
                  {prefs.lineTrackColor === color && (
                    <Check size={14} className="text-black/70" strokeWidth={3} />
                  )}
                </button>
              ))}
              <label
                aria-label={t("Choose a custom tracker color")}
                className="relative grid h-8 w-8 cursor-pointer place-items-center rounded-full border-2 border-transparent transition hover:scale-110"
                style={{
                  background: "conic-gradient(#f87171,#facc15,#4ade80,#60a5fa,#c084fc,#f87171)",
                }}
              >
                <span
                  className="h-4 w-4 rounded-full border border-black/20"
                  style={{ background: prefs.lineTrackColor }}
                />
                <input
                  type="color"
                  value={prefs.lineTrackColor}
                  onChange={(event) => patch({ lineTrackColor: event.target.value })}
                  className="sr-only"
                />
              </label>
            </div>
          </div>
        </div>
      </Setting>}
    </div>
  );
}

function Setting({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 text-xs font-semibold uppercase tracking-[.18em] opacity-60">
        {label}
      </div>
      {children}
    </section>
  );
}
function Range({
  icon,
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2">
          {icon}
          {label}
        </span>
        <span className="tabular-nums opacity-60">{value}</span>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[var(--color-accent)]"
      />
    </label>
  );
}
