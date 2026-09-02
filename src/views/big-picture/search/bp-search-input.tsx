import { useState, type RefObject } from "react";
import { Keyboard, Smartphone, Trash2 } from "lucide-react";
import { Search } from "@/components/icons/search-icon";
import { isAndroid } from "@/lib/platform";
import { SFX } from "@/lib/sfx";
import { useBpT } from "../bp-i18n";

// The field holds three focusables. Without a track, Left/Right off any of them
// falls into free spatial mode and leaks down into the results. The page already
// pays the gutter, so [data-bp-row]'s own gutter pair has to be cancelled.
const FIELD_SCOPE = { paddingInline: 0, marginInline: 0, containIntrinsicSize: "auto 76px" } as const;

// Same reason as the field: a chip strip that inherits the 340px row default
// reserves five times its own height before it has rendered once.
const STRIP_SCOPE = { containIntrinsicSize: "auto 76px" } as const;

// A remote has no cursor to make a small target forgiving, so every chip on this
// surface is measured off one base that never drops under the 44px house floor.
const CHIP =
  "h-[clamp(44px,4.8vh,56px)] min-w-[44px] shrink-0 rounded-full px-[clamp(13px,1.1vw,20px)] text-[clamp(12px,1.62vh,18px)] font-semibold transition-colors duration-[var(--bp-dur-fast)]";

// Only the chips that pair a glyph with a label become flex boxes. CHIP stays
// display-agnostic because text-overflow never reaches an anonymous flex item,
// and the recent-query chip has to be able to clip.
const ICON_CHIP = `${CHIP} flex items-center gap-[clamp(5px,0.5vw,9px)]`;

const SCROLL_X =
  "flex items-center gap-[clamp(6px,0.6vw,12px)] overflow-x-auto py-[26px] -my-[26px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

// The field is uncapped, like the desktop one. Do not put the 60 character
// ceiling back: it cut long titles with no sign it had happened, and the engine
// then went and searched the truncated string.
export function BpSearchField({
  query,
  onQuery,
  typing,
  onStartTyping,
  inputRef,
}: {
  query: string;
  onQuery: (q: string) => void;
  typing: boolean;
  onStartTyping: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const t = useBpT();
  // The ring has to be painted here, not by the token sheet. data-bp-tile is on
  // this panel and data-bp-focusable is on the input inside it, and applyBpFocus
  // stamps data-bp-focus on the focusable element, so
  // [data-bp-tile][data-bp-focus="true"] never matches and the field was the one
  // thing on the screen that could hold the ring without lighting up.
  const [focused, setFocused] = useState(false);

  // Deliberately no transition on the border. [data-bp-root] [data-bp-tile] sets
  // transition-property in longhands that outrank every Tailwind transition-*
  // utility on the same element, so a class here would be dead code. The snap is
  // right anyway: the border is acting as a ring, and a ring must be instant.
  const lit = focused || typing;
  const panel = `flex h-[clamp(48px,6vh,70px)] items-center gap-3 rounded-[var(--bp-r-md)] border bg-[var(--bp-panel)] px-[clamp(16px,1.4vw,26px)] ${
    lit ? "border-[var(--bp-focus-stroke)]" : "border-[var(--bp-edge-2)]"
  }`;

  return (
    <div data-bp-row style={FIELD_SCOPE}>
      <div data-bp-tile data-bp-scroll-x className={panel}>
        <Search size={19} className="shrink-0 text-ink-subtle" strokeWidth={2.2} />
        <input
          ref={inputRef}
          data-bp-focusable
          data-bp-autofocus="true"
          data-bp-restore-key="bp-search-field"
          data-tv-text-auto
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onClick={onStartTyping}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.stopPropagation();
            onStartTyping();
            if (isAndroid()) {
              e.currentTarget.focus();
              return;
            }
            e.preventDefault();
          }}
          placeholder={t("Search Harbor")}
          aria-label={t("Search Harbor")}
          className="min-w-0 flex-1 bg-transparent text-[clamp(16px,2.4vh,30px)] font-semibold text-ink outline-none placeholder:text-ink-subtle"
        />
        <button
          type="button"
          data-bp-focusable
          data-bp-chip
          onClick={onStartTyping}
          aria-label={t("On-screen keyboard")}
          className={`${ICON_CHIP} ${typing ? "bg-[var(--bp-on)] text-ink" : "text-ink-subtle"}`}
        >
          <Keyboard size={16} strokeWidth={2.2} />
          {t("Type")}
        </button>
        <button
          type="button"
          data-bp-focusable
          data-bp-chip
          onClick={() => {
            SFX.open();
            window.dispatchEvent(new CustomEvent("bp:phone-typing"));
          }}
          aria-label={t("Type on your phone")}
          className={`${ICON_CHIP} border border-[var(--bp-edge)] text-ink-subtle`}
        >
          <Smartphone size={16} strokeWidth={2.2} />
          {t("Phone")}
        </button>
      </div>
    </div>
  );
}

export function BpRecentRow({
  recent,
  onPick,
  onClear,
}: {
  recent: readonly string[];
  onPick: (q: string) => void;
  onClear: () => void;
}) {
  const t = useBpT();
  if (recent.length === 0) return null;

  return (
    <div
      data-bp-row
      style={STRIP_SCOPE}
      className="mb-[clamp(11px,1.4vh,22px)] flex items-center gap-[clamp(6px,0.6vw,12px)]"
    >
      <span className="shrink-0 text-[clamp(11px,1.5vh,17px)] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
        {t("Recent")}
      </span>
      <div data-bp-scroll-x className={SCROLL_X}>
        {recent.map((q) => (
          <button
            key={q}
            type="button"
            data-bp-focusable
            data-bp-chip
            onClick={() => onPick(q)}
            className={`${CHIP} max-w-[320px] truncate border border-[var(--bp-edge)] text-ink-muted`}
          >
            {q}
          </button>
        ))}
        <button
          type="button"
          data-bp-focusable
          data-bp-chip
          onClick={onClear}
          aria-label={t("Clear recent searches")}
          className={`${ICON_CHIP} justify-center text-ink-subtle`}
        >
          <Trash2 size={15} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
