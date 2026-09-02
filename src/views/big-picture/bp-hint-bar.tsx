import { useGamepads } from "@/lib/gamepad/store";
import { isAndroid } from "@/lib/platform";
import { BP_NAV_JUMP } from "./bp-logic";
import { useBpT } from "./bp-i18n";

export type BpAction =
  | "select"
  | "back"
  | "exit"
  | "search"
  | "type"
  | "clear"
  | "toggle"
  | "phone"
  | "tabs"
  | "nav"
  | "actions"
  | "advance";

// Every other value in these three maps is a hardware key name, which is why
// they are not translated. The gesture hints stay pure glyphs for the same
// reason: the word "Hold" belongs in the label, where useBpT can reach it.
const PAD_GLYPH: Partial<Record<BpAction, string>> = {
  select: "A",
  toggle: "A",
  type: "A",
  back: "B",
  exit: "B",
  search: "Y",
  phone: "Y",
  tabs: "LB / RB",
  actions: "▼",
  advance: "▼",
};

// A hint with no entry here is dropped on a remote without a pad, so anything
// that describes a remote gesture has to be listed or it is invisible on the
// one device it was written for while still looking right in a browser.
const REMOTE_GLYPH: Partial<Record<BpAction, string>> = {
  select: "OK",
  toggle: "OK",
  type: "OK",
  back: "Back",
  exit: "Back",
  nav: "Menu",
  actions: "▼",
  advance: "▼",
};

const KEY_GLYPH: Record<BpAction, string> = {
  select: "Enter",
  toggle: "Enter",
  type: "Enter",
  back: "Esc",
  exit: "Esc",
  search: "Tab",
  phone: "Tab",
  clear: "Del",
  tabs: "PgUp / PgDn",
  nav: BP_NAV_JUMP.keyGlyph,
  actions: "↓",
  advance: "↓",
};

function useActionLabels(): Record<BpAction, string> {
  const t = useBpT();
  return {
    select: t("Select"),
    toggle: t("Toggle"),
    type: t("Type"),
    phone: t("Phone keyboard"),
    back: t("Back"),
    exit: t("Exit"),
    search: t("Search"),
    clear: t("Clear"),
    tabs: t("Switch tab"),
    nav: t("Nav"),
    actions: t("Hold to skip or continue"),
    advance: t("Hold to continue"),
  };
}

export function BpHintBar({
  actions,
  raised,
  jump,
}: {
  actions: BpAction[];
  raised?: boolean;
  /**
   * Advertise the jump-to-nav key. Only the caller knows whether it can work:
   * focusBpTopBar needs a [data-bp-top-bar] inside the same root and refuses
   * outright while any [data-bp-dialog] is open, and the player surface has no
   * top bar at all. Injecting it here unconditionally advertised a dead key on
   * the player and over every dialog the shell does not mark as raised.
   */
  jump?: boolean;
}) {
  const label = useActionLabels();
  const pads = useGamepads();
  const usingPad = pads.length > 0;
  const onTv = isAndroid();

  // First because the bar is right aligned: a narrow window sheds the leftmost
  // hint, and this is the one that can afford to go.
  const shown: BpAction[] = jump
    ? ["nav", ...actions.filter((a) => a !== "nav")]
    : actions.filter((a) => a !== "nav");

  // A connected pad does not mean an absent keyboard, so an action the pad has
  // no button for still shows the key that does work rather than vanishing.
  const usable = onTv && !usingPad ? shown.filter((a) => a in REMOTE_GLYPH) : shown;

  const hints = usable.map((a) => {
    const preferred = usingPad ? PAD_GLYPH[a] : onTv ? REMOTE_GLYPH[a] : undefined;
    const glyph = preferred ?? KEY_GLYPH[a];
    return { action: a, glyph, wide: glyph.length > 1 };
  });

  return (
    <footer
      data-bp-hint-bar
      className={`pointer-events-none absolute inset-x-0 bottom-0 flex h-[var(--bp-hint-h)] items-center justify-end px-[var(--bp-gutter)] pb-[var(--bp-safe-y,0px)] ${
        raised ? "z-[65]" : "z-30"
      }`}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[180%]"
        style={{ background: "var(--bp-scrim-up)" }}
      />
      <div className="relative flex items-center gap-[clamp(14px,1.6vw,30px)]">
        {hints.map((h) => (
          <span key={h.action} className="flex items-center gap-2.5">
            <span
              data-bp-hint-chip
              className={`flex h-[clamp(22px,2.5vh,28px)] items-center justify-center bg-[var(--bp-edge-2)] font-semibold text-ink ${
                h.wide
                  ? "rounded-[var(--bp-r-xs)] px-2.5 text-[clamp(12.5px,1.3vh,16px)]"
                  : "w-[clamp(22px,2.5vh,28px)] rounded-full text-[clamp(13.4px,1.5vh,18px)]"
              }`}
            >
              {h.glyph}
            </span>
            <span data-bp-hint-label className="text-[clamp(13.4px,1.5vh,18px)] font-medium text-ink-muted">
              {label[h.action]}
            </span>
          </span>
        ))}
      </div>
    </footer>
  );
}
