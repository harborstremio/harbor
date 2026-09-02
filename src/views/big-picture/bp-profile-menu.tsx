import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { profileInitials, useProfiles } from "@/lib/profiles";
import { useBpT } from "./bp-i18n";
import { openBpWho } from "./bp-who-is-watching-layer";

// The bar asks the shell for the chooser, it never switches on its own. Cycling
// profiles on press would drop an adult into a locked kid profile with no PIN
// prompt and no surface to show one on, and the shell owns that surface.
//
// openBpWho is IMPORTED, not a second copy of the event name. Dispatcher and
// listener used to agree only because two files happened to hold the same
// string literal, so renaming the event in one of them left the avatar
// dispatching to nobody with a green build and no failing test.

type HintFn = (el: HTMLElement | null, label: string) => void;

// The disc is the specced 34px to 52px and the button around it is the tab
// height, so the target holds the 44px floor at 1280x800 while the disc still
// sits on the tab pills' baseline. The growth is on the button rather than the
// disc so motion-reduce is not stacked on a group-data variant, a form nothing
// else here uses, and a variant that fails to compile fails silently.
const HIT =
  "group flex h-[calc(clamp(44px,5vh,58px)*var(--bp-up,1))] w-[calc(clamp(44px,5vh,58px)*var(--bp-up,1))] shrink-0 items-center justify-center rounded-full transition-transform duration-[var(--bp-dur-fast)] ease-[var(--bp-ease)] data-[bp-focus=true]:scale-[1.06] motion-reduce:transition-none motion-reduce:data-[bp-focus=true]:scale-100";

const DISC =
  "relative flex h-[clamp(34px,4vh,52px)] w-[clamp(34px,4vh,52px)] items-center justify-center overflow-hidden rounded-full transition-[box-shadow] duration-[var(--bp-dur-fast)] ease-[var(--bp-ease)] group-data-[bp-focus=true]:shadow-[0_0_0_2px_var(--bp-void),0_0_0_4px_var(--bp-focus-stroke)] motion-reduce:transition-none";

export function BpProfileMenu({ onHint }: { onHint: HintFn }) {
  const t = useBpT();
  const { activeProfile } = useProfiles();
  const [broken, setBroken] = useState(false);

  const avatar = activeProfile?.avatar ?? null;
  const name = activeProfile?.name ?? "";
  const color = activeProfile?.color ?? "";

  // An avatar ref that resolves on the desktop can 404 on a television that has
  // never held the file, and a torn image in the nav is worse than initials.
  useEffect(() => setBroken(false), [avatar]);

  const showImage = Boolean(avatar) && !broken;
  // Composed from the bare key, which ar, pt and ru all carry. The parameterised
  // "Switch profile ({name})" existed in no catalog, so translate returned the raw key
  // and every non-English household got "Switch profile (Ana)" on the one control in
  // the bar whose only accessible name is this string. A colon and a proper noun need
  // no translation.
  const label = name ? `${t("Switch profile")}: ${name}` : t("Switch profile");

  return (
    <button
      type="button"
      data-bp-focusable
      onClick={openBpWho}
      onMouseEnter={(e) => onHint(e.currentTarget, name || label)}
      onMouseLeave={() => onHint(null, "")}
      onFocus={(e) => onHint(e.currentTarget, name || label)}
      onBlur={() => onHint(null, "")}
      aria-label={label}
      // The bar's own hint renders at top-full, and bp-tokens puts
      // content-visibility on any [data-bp-row] without the ring in it, which
      // carries paint containment and clips the hint to the nav's padding box.
      // Focus cancels that rule via :has, so the hover half is invisible on a
      // mouse. This control is the only one in the bar with no text and no icon
      // meaning, so it cannot be left with no name on hover.
      title={label}
      className={HIT}
    >
      <span
        className={DISC}
        style={{ background: showImage || !color ? "var(--bp-panel-2)" : color }}
      >
        {showImage && avatar ? (
          <img
            src={avatar}
            alt=""
            draggable={false}
            onError={() => setBroken(true)}
            className="h-full w-full object-cover"
          />
        ) : name ? (
          <span className="text-[clamp(13px,1.7vh,20px)] font-bold leading-none text-canvas">
            {profileInitials(name)}
          </span>
        ) : (
          <User strokeWidth={1.9} className="h-[52%] w-auto text-ink-subtle" />
        )}
        {/* An inset shadow on the disc itself paints under the image, so the
            identity ring needs its own layer above it. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            boxShadow: `inset 0 0 0 2px ${color || "var(--bp-edge-2)"}`,
          }}
        />
      </span>
    </button>
  );
}
