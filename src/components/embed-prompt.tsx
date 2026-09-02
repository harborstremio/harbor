import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { spotifyEmbed, ytId } from "@/lib/social/bbcode";

export type EmbedKind = "youtube" | "spotify" | "img" | "video";

type Spec = {
  title: string;
  placeholder: string;
  hint: string;
  bad: string;
  build: (raw: string) => string | null;
};

const SPECS: Record<EmbedKind, Spec> = {
  youtube: {
    title: "Embed a YouTube video",
    placeholder: "https://youtu.be/...",
    hint: "Paste any YouTube link. Watch, share, shorts or embed all work.",
    bad: "That does not look like a YouTube link.",
    build: (raw) => {
      const id = ytId(raw);
      return id ? `[youtube]https://youtu.be/${id}[/youtube]` : null;
    },
  },
  spotify: {
    title: "Embed from Spotify",
    placeholder: "https://open.spotify.com/...",
    hint: "Paste a track, album or playlist link.",
    bad: "That does not look like a Spotify link.",
    build: (raw) => {
      const s = spotifyEmbed(raw);
      return s ? `[spotify]https://open.spotify.com/${s.type}/${s.id}[/spotify]` : null;
    },
  },
  img: {
    title: "Add an image",
    placeholder: "https://...",
    hint: "Paste a direct image link.",
    bad: "Image links need to start with https.",
    build: (raw) => {
      const u = raw.trim();
      return /^https:\/\/\S+$/i.test(u) ? `[img]${u}[/img]` : null;
    },
  },
  video: {
    title: "Add a video",
    placeholder: "https://...mp4",
    hint: "Paste a direct video file link.",
    bad: "Video links need to start with https.",
    build: (raw) => {
      const u = raw.trim();
      return /^https:\/\/\S+$/i.test(u) ? `[video]${u}[/video]` : null;
    },
  },
};

export function EmbedPrompt({
  kind,
  onInsert,
  onClose,
}: {
  kind: EmbedKind;
  onInsert: (bbcode: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const spec = SPECS[kind];
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    let cancelled = false;
    void navigator.clipboard
      ?.readText()
      .then((text) => {
        if (cancelled || !text || !spec.build(text)) return;
        setValue(text.trim());
        requestAnimationFrame(() => inputRef.current?.select());
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [spec]);

  const built = value.trim() ? spec.build(value) : null;
  const invalid = touched && value.trim().length > 0 && !built;

  const commit = () => {
    setTouched(true);
    if (!built) return;
    onInsert(built);
    onClose();
  };

  return (
    <div className="flex flex-col gap-2 rounded-md bg-canvas/50 p-2.5 ring-1 ring-edge-soft">
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-semibold text-ink">{t(spec.title)}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("Cancel")}
          className="ms-auto grid h-7 w-7 place-items-center rounded-sm text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
        >
          <X size={14} strokeWidth={2.2} />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setTouched(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
          placeholder={spec.placeholder}
          spellCheck={false}
          className={`h-11 min-w-0 flex-1 rounded-[8px] bg-elevated px-3 text-[13.5px] text-ink outline-none ring-1 transition-colors placeholder:text-ink-subtle ${
            invalid ? "ring-danger" : "ring-edge-soft focus:ring-edge"
          }`}
        />
        <button
          type="button"
          onClick={commit}
          disabled={!built}
          className="flex h-11 items-center gap-1.5 rounded-[8px] bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-35"
        >
          <Check size={14} strokeWidth={2.6} /> {t("Insert")}
        </button>
      </div>
      <p className={`text-[11.5px] ${invalid ? "text-danger" : "text-ink-subtle"}`}>
        {invalid ? t(spec.bad) : t(spec.hint)}
      </p>
    </div>
  );
}
