import autoSync from "@/assets/ui-icons/auto-sync.svg?raw";
import customizeSubtitles from "@/assets/ui-icons/customize-subtitles.svg?raw";
import favorite from "@/assets/ui-icons/favorite.svg?raw";
import unfavorite from "@/assets/ui-icons/unfavorite.svg?raw";
import library from "@/assets/ui-icons/library.svg?raw";
import list from "@/assets/ui-icons/list.svg?raw";
import manualOffset from "@/assets/ui-icons/manual-offset.svg?raw";
import markUnwatched from "@/assets/ui-icons/mark-unwatched.svg?raw";
import markWatched from "@/assets/ui-icons/mark-watched.svg?raw";
import notification from "@/assets/ui-icons/notification.svg?raw";
import rate from "@/assets/ui-icons/rate.svg?raw";
import remindme from "@/assets/ui-icons/remindme.svg?raw";
import trailer from "@/assets/ui-icons/trailer.svg?raw";
import unrate from "@/assets/ui-icons/unrate.svg?raw";
import watchTogether from "@/assets/ui-icons/watch-together.svg?raw";
import xray from "@/assets/ui-icons/xray.svg?raw";
import allAddons from "@/assets/ui-icons/all-addons.svg?raw";
import help from "@/assets/ui-icons/help.svg?raw";
import playFilled from "@/assets/ui-icons/play-filled.svg?raw";
import saveBanner from "@/assets/ui-icons/save-banner.svg?raw";
import showcase from "@/assets/ui-icons/showcase.svg?raw";
import skipFwd from "@/assets/ui-icons/skip-fwd.svg?raw";
import thumbsUp from "@/assets/ui-icons/thumbs-up.svg?raw";

// These SVGs ship as solid #fff glyphs on a transparent canvas. Inline them and
// swap the hardcoded white for currentColor so they tint like the lucide icons
// they replaced (accent, muted, hover). Size comes from the wrapper span; the
// svg's own width/height are overridden by [&>svg]:h-full/w-full.
function prep(raw: string): string {
  return raw
    .replace(/<\?xml[^>]*\?>/i, "")
    .replace(/<!DOCTYPE[^>]*>/i, "")
    .replace(/(fill|stroke)="#[0-9a-fA-F]{3,6}"/g, '$1="currentColor"');
}

const ICONS = {
  "auto-sync": prep(autoSync),
  "customize-subtitles": prep(customizeSubtitles),
  favorite: prep(favorite),
  unfavorite: prep(unfavorite),
  library: prep(library),
  list: prep(list),
  "manual-offset": prep(manualOffset),
  "mark-unwatched": prep(markUnwatched),
  "mark-watched": prep(markWatched),
  notification: prep(notification),
  rate: prep(rate),
  remindme: prep(remindme),
  trailer: prep(trailer),
  unrate: prep(unrate),
  "watch-together": prep(watchTogether),
  xray: prep(xray),
  "all-addons": prep(allAddons),
  help: prep(help),
  "play-filled": prep(playFilled),
  "save-banner": prep(saveBanner),
  showcase: prep(showcase),
  "skip-fwd": prep(skipFwd),
  "thumbs-up": prep(thumbsUp),
} as const;

export type UiIconName = keyof typeof ICONS;

export function UiIcon({
  name,
  className,
  style,
}: {
  name: UiIconName;
  className?: string;
  style?: import("react").CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 select-none items-center justify-center [&>svg]:h-full [&>svg]:w-full ${className ?? ""}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}
