import flagAra from "@/assets/flags/flag-ara.svg";
import flagBra from "@/assets/flags/flag-bra.svg";
import flagCes from "@/assets/flags/flag-ces.svg";
import flagDan from "@/assets/flags/flag-dan.svg";
import flagDeu from "@/assets/flags/flag-deu.svg";
import flagEng from "@/assets/flags/flag-eng.svg";
import flagFin from "@/assets/flags/flag-fin.svg";
import flagFra from "@/assets/flags/flag-fra.svg";
import flagHeb from "@/assets/flags/flag-heb.svg";
import flagHin from "@/assets/flags/flag-hin.svg";
import flagHun from "@/assets/flags/flag-hun.svg";
import flagIta from "@/assets/flags/flag-ita.svg";
import flagJpn from "@/assets/flags/flag-jpn.svg";
import flagKor from "@/assets/flags/flag-kor.svg";
import flagNld from "@/assets/flags/flag-nld.svg";
import flagNor from "@/assets/flags/flag-nor.svg";
import flagPol from "@/assets/flags/flag-pol.svg";
import flagPrt from "@/assets/flags/flag-prt.svg";
import flagRon from "@/assets/flags/flag-ron.svg";
import flagRus from "@/assets/flags/flag-rus.svg";
import flagSpa from "@/assets/flags/flag-spa.svg";
import flagSwe from "@/assets/flags/flag-swe.svg";
import flagTha from "@/assets/flags/flag-tha.svg";
import flagTur from "@/assets/flags/flag-tur.svg";
import flagUkr from "@/assets/flags/flag-ukr.svg";
import flagVie from "@/assets/flags/flag-vie.svg";
import flagZho from "@/assets/flags/flag-zho.svg";
import { regionFlagSrc } from "@/lib/region-flags";

const FLAG: Record<string, string> = {
  English: flagEng,
  Italian: flagIta,
  Russian: flagRus,
  Hindi: flagHin,
  Spanish: flagSpa,
  "Spanish (Latin America)": flagSpa,
  Korean: flagKor,
  Japanese: flagJpn,
  Chinese: flagZho,
  "Chinese (Simplified)": flagZho,
  Portuguese: flagPrt,
  "Portuguese (Brazil)": flagBra,
  German: flagDeu,
  French: flagFra,
  Turkish: flagTur,
  Arabic: flagAra,
  Czech: flagCes,
  Danish: flagDan,
  Finnish: flagFin,
  Hebrew: flagHeb,
  Hungarian: flagHun,
  Dutch: flagNld,
  Norwegian: flagNor,
  Polish: flagPol,
  Romanian: flagRon,
  Swedish: flagSwe,
  Thai: flagTha,
  Ukrainian: flagUkr,
  Vietnamese: flagVie,
};

const LANG_COUNTRY: Record<string, string> = {
  Indonesian: "id",
  Greek: "gr",
  Tamil: "in",
  Telugu: "in",
  Malayalam: "in",
  Kannada: "in",
  Bengali: "bd",
  Marathi: "in",
  Gujarati: "in",
  Punjabi: "in",
  Urdu: "pk",
  Odia: "in",
  Assamese: "in",
  Nepali: "np",
  Sinhala: "lk",
  Malay: "my",
  Filipino: "ph",
  Burmese: "mm",
  Khmer: "kh",
  Lao: "la",
  Persian: "ir",
  Pashto: "af",
  Azerbaijani: "az",
  Georgian: "ge",
  Armenian: "am",
  Kazakh: "kz",
  Uzbek: "uz",
  Bulgarian: "bg",
  Serbian: "rs",
  Croatian: "hr",
  Bosnian: "ba",
  Slovak: "sk",
  Slovenian: "si",
  Lithuanian: "lt",
  Latvian: "lv",
  Estonian: "ee",
  Icelandic: "is",
  Irish: "ie",
  Catalan: "es-ct",
  Basque: "es-pv",
  Galician: "es-ga",
  Welsh: "gb-wls",
  Maltese: "mt",
  Albanian: "al",
  Macedonian: "mk",
  Belarusian: "by",
  Swahili: "tz",
  Amharic: "et",
  Afrikaans: "za",
  Hausa: "ng",
  Yoruba: "ng",
  Igbo: "ng",
  Zulu: "za",
};

function FiFlag({ cc, h, title }: { cc: string; h: number; title?: string }) {
  return (
    <span
      className={`fi fi-${cc}`}
      title={title}
      aria-label={title}
      style={{
        height: h,
        width: h * 1.5,
        borderRadius: 2,
        backgroundSize: "cover",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 1px 2px rgba(0,0,0,0.4)",
        display: "block",
      }}
    />
  );
}

export function countryFlagSrc(code: string): string | null {
  return regionFlagSrc(code);
}

export type FlagSize = "sm" | "md" | "lg";

const FLAG_HEIGHT: Record<FlagSize, number> = {
  sm: 12,
  md: 16,
  lg: 22,
};

const LABEL_SIZE: Record<FlagSize, number> = {
  sm: 11,
  md: 13,
  lg: 15,
};

export function languageHasFlag(language: string): boolean {
  return language in FLAG || language in LANG_COUNTRY;
}

export function flagSrc(language: string): string | null {
  return FLAG[language] ?? null;
}

const SPLIT_FLAG: Record<string, [string, string]> = {
  "Portuguese (Brazil)": [flagPrt, flagBra],
};

export function Flag({
  language,
  size = "md",
  showLabel = true,
}: {
  language: string;
  size?: FlagSize;
  showLabel?: boolean;
}) {
  if (language === "Multi") {
    return (
      <span
        className="inline-flex items-center gap-0 rounded-[3px] bg-accent/15 px-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.18em] text-accent ring-1 ring-accent/35"
        style={{ height: FLAG_HEIGHT[size] + 4, lineHeight: 1 }}
      >
        Multi
      </span>
    );
  }

  const split = SPLIT_FLAG[language];
  const src = FLAG[language];
  const cc = src ? undefined : LANG_COUNTRY[language];
  const h = FLAG_HEIGHT[size];

  if (split) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-label={language}
          role="img"
          style={{
            position: "relative",
            display: "block",
            height: h,
            width: h * 1.5,
            overflow: "hidden",
            borderRadius: 2,
            boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 1px 2px rgba(0,0,0,0.4)",
          }}
        >
          <img
            src={split[0]}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              height: "100%",
              width: "100%",
              objectFit: "cover",
              clipPath: "polygon(0 0, 0 100%, 100% 100%)",
            }}
          />
          <img
            src={split[1]}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              height: "100%",
              width: "100%",
              objectFit: "cover",
              clipPath: "polygon(0 0, 100% 0, 100% 100%)",
            }}
          />
          <span
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to top right, transparent calc(50% - 0.5px), rgba(255,255,255,0.55) calc(50% - 0.5px), rgba(255,255,255,0.55) calc(50% + 0.5px), transparent calc(50% + 0.5px))",
            }}
          />
        </span>
        {showLabel && (
          <span
            className="font-semibold tracking-[0.01em] text-ink-muted"
            style={{ fontSize: LABEL_SIZE[size] }}
          >
            {language}
          </span>
        )}
      </span>
    );
  }

  if (!src && !cc) {
    return showLabel ? (
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
        {language}
      </span>
    ) : null;
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {src ? (
        <img
          src={src}
          alt={language}
          height={h}
          style={{
            height: h,
            width: h * 1.5,
            display: "block",
            borderRadius: 2,
            objectFit: "cover",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 1px 2px rgba(0,0,0,0.4)",
          }}
          draggable={false}
        />
      ) : (
        <FiFlag cc={cc!} h={h} title={language} />
      )}
      {showLabel && (
        <span
          className="font-semibold tracking-[0.01em] text-ink-muted"
          style={{ fontSize: LABEL_SIZE[size] }}
        >
          {language}
        </span>
      )}
    </span>
  );
}

export function FlagStack({
  languages,
  max = 4,
  size = "md",
}: {
  languages: string[];
  max?: number;
  size?: FlagSize;
}) {
  if (languages.length === 0) return null;
  const shown = languages.slice(0, max);
  const extra = languages.length - shown.length;
  const h = FLAG_HEIGHT[size];

  return (
    <span className="inline-flex items-center gap-1">
      {shown.map((lang) => {
        if (lang === "Multi") {
          return (
            <span
              key={lang}
              className="inline-flex items-center justify-center rounded-[3px] bg-accent/15 px-1.5 text-[9px] font-extrabold uppercase tracking-[0.16em] text-accent ring-1 ring-accent/35"
              style={{ height: h + 2, lineHeight: 1 }}
            >
              M
            </span>
          );
        }
        const src = FLAG[lang];
        const cc = src ? undefined : LANG_COUNTRY[lang];
        if (!src && !cc) {
          return (
            <span
              key={lang}
              className="inline-flex items-center justify-center rounded-[3px] bg-canvas/70 px-1 text-[9px] font-bold uppercase tracking-[0.14em] text-ink-subtle ring-1 ring-edge-soft"
              style={{ height: h + 2, lineHeight: 1 }}
            >
              {lang.slice(0, 2)}
            </span>
          );
        }
        return src ? (
          <img
            key={lang}
            src={src}
            alt={lang}
            title={lang}
            style={{
              height: h,
              width: h * 1.5,
              display: "block",
              borderRadius: 2,
              objectFit: "cover",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 1px 2px rgba(0,0,0,0.4)",
            }}
            draggable={false}
          />
        ) : (
          <FiFlag key={lang} cc={cc!} h={h} title={lang} />
        );
      })}
      {extra > 0 && (
        <span
          className="text-[10px] font-semibold tracking-[0.04em] text-ink-subtle"
          style={{ lineHeight: 1 }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
