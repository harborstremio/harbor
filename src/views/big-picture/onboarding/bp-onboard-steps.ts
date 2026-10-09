import tmdbMark from "@/assets/addon-logos/tmdb.png";

export type BpOnboardStepId =
  | "language"
  | "phone"
  | "tmdb"
  | "stremio"
  | "harbor"
  | "layout"
  | "streaming"
  | "subtitles"
  | "taste"
  | "done";

export type BpOnboardStep = {
  id: BpOnboardStepId;
  eyebrow: string;
  headline: string;
  body: string;
  /** Provider mark set beside the headline. The screen is asking the user to
   *  go and get something from this service, so name it in their language. */
  mark?: string;
  /** Where the ring lands when the screen opens, before any value is known. */
  focus: "decision" | "skip" | "primary";
  primary: string;
  /**
   * Replaces the primary once the screen reports itself satisfied. A screen
   * whose primary declines an offer has to stop declining it after the offer
   * has already been taken.
   */
  primaryDone?: string;
  /** Absent means the screen has no sideways exit. */
  skip?: string;
};

// Order is the product. Language first because it reframes every later screen.
// The phone offer sits second so the three screens that need typing are
// adjacent and the user picks the phone up once. Splash and welcome are gone:
// they wrote nothing, and Big Picture already owns its front door in BpIntro.
export const BP_ONBOARD_STEPS: readonly BpOnboardStep[] = [
  {
    id: "language",
    eyebrow: "Language",
    headline: "Choose your language",
    body: "Harbor speaks this everywhere. You can change it later in Settings.",
    focus: "decision",
    primary: "Continue",
  },
  {
    id: "phone",
    eyebrow: "Your phone",
    headline: "Finish setup on your phone",
    body: "The next three screens need typing. Scan this and your phone does it for you.",
    // One button, and it changes meaning when the phone lands. Parking the ring
    // on a decline is how the first OK press used to leave the one feature the
    // flow exists for.
    focus: "decision",
    primary: "Set this up on the TV instead",
    primaryDone: "Continue",
  },
  {
    id: "tmdb",
    eyebrow: "Artwork and rows",
    headline: "Connect TMDB",
    body: "Free, two minutes. Unlocks Trending, In Theaters, Top Rated and every service rail.",
    mark: tmdbMark,
    focus: "decision",
    primary: "Continue",
    skip: "Use Cinemeta instead",
  },
  {
    id: "stremio",
    eyebrow: "Your library",
    headline: "Bring in your library",
    body: "Your Continue Watching, your watchlist and your addons.",
    focus: "decision",
    primary: "Continue",
    skip: "Not now",
  },
  {
    id: "harbor",
    eyebrow: "Harbor account",
    headline: "Create a Harbor account",
    body: "Sync your profile, themes, lists and friends. You can do this any time.",
    focus: "skip",
    primary: "Continue",
    skip: "Later",
  },
  {
    id: "layout",
    eyebrow: "Home",
    headline: "How should the home screen read?",
    body: "Harbor leads with one big title. Classic leads with rows.",
    focus: "decision",
    primary: "Continue",
  },
  {
    id: "streaming",
    eyebrow: "Your services",
    headline: "Turn off what you do not have",
    body: "All of them start on. Take off the ones you do not pay for.",
    focus: "decision",
    primary: "Continue",
    skip: "Skip",
  },
  {
    id: "subtitles",
    eyebrow: "Subtitles",
    headline: "Which subtitle languages, in order?",
    body: "First match wins. Most people need only one.",
    focus: "decision",
    primary: "Continue",
    skip: "Skip",
  },
  {
    id: "taste",
    eyebrow: "Taste",
    headline: "What do you like?",
    body: "Pick up to five. It shapes what Harbor surfaces first.",
    focus: "decision",
    primary: "Continue",
    skip: "Skip",
  },
  {
    id: "done",
    eyebrow: "Ready",
    headline: "You are set up",
    body: "Saved on this device. Another Harbor install starts fresh.",
    focus: "primary",
    primary: "Start watching",
  },
];

export const BP_ONBOARD_LAST = BP_ONBOARD_STEPS.length - 1;
