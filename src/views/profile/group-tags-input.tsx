import { X } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n";

const SUGGESTED = ["anime", "movies", "tv", "horror", "cozy", "chill", "chat", "gaming", "18+"];
const MAX = 6;
const TAG_MAX = 24;

function clean(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9 &+-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TAG_MAX);
}

export function GroupTagsInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const t = useT();
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const c = clean(raw);
    if (!c || tags.includes(c) || tags.length >= MAX) return;
    onChange([...tags, c]);
    setDraft("");
  };
  const remove = (tag: string) => onChange(tags.filter((x) => x !== tag));
  const suggestions = SUGGESTED.filter((s) => !tags.includes(s)).slice(0, 6);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-surface p-1.5 ring-1 ring-edge-soft">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-elevated px-2.5 py-1 text-[12.5px] font-medium text-ink"
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              aria-label={t("Remove")}
              className="text-ink-subtle transition-colors hover:text-ink"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          </span>
        ))}
        {tags.length < MAX && (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                add(draft);
              } else if (e.key === "Backspace" && !draft && tags.length) {
                remove(tags[tags.length - 1]);
              }
            }}
            onBlur={() => add(draft)}
            placeholder={tags.length ? "" : t("Add tags (anime, horror, cozy...)")}
            className="min-w-[8ch] flex-1 bg-transparent px-1.5 py-1 text-[13px] text-ink outline-none placeholder:text-ink-subtle"
          />
        )}
      </div>
      {suggestions.length > 0 && tags.length < MAX && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full px-2.5 py-1 text-[12px] text-ink-subtle ring-1 ring-edge-soft transition-colors hover:bg-elevated hover:text-ink"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
