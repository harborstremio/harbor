import type { Meta } from "@/lib/cinemeta";
import { useSettings } from "@/lib/settings";
import { hasListingBadges, listingBadges, listingLine } from "@/views/plugins/listing-badges";

/** The languages and quality a plugin wrote on its listing line, as a strip on the poster.
 *
 * Off unless the user turned it on, and empty unless the listing carried something a badge could
 * read. A plain catalog row from an addon has no `listingExtras` at all, so this draws nothing for
 * it — which is what keeps every other surface in the app exactly as it was.
 *
 * The whole line is the tooltip. What is badged is a reading of it, and the reading can leave words
 * out; the tooltip is what the provider actually sent. */
export function ListingBadgeStrip({ meta }: { meta: Meta }) {
  const { settings } = useSettings();
  const want = {
    languages: settings.pluginsPosterLanguages,
    quality: settings.pluginsPosterQuality,
  };
  if (!want.languages && !want.quality) return null;
  if (!hasListingBadges(meta, want)) return null;
  const { languages, languagesMore, quality, qualityMore, resolutions, resolutionsMore } =
    listingBadges(meta, want);
  const line = listingLine(meta);

  return (
    <div
      title={line}
      className="pointer-events-none absolute inset-x-1.5 bottom-1.5 flex flex-wrap items-center gap-1"
    >
      {languages.length > 0 && (
        <span className="flex min-w-0 items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10.5px] font-medium leading-[14px] text-white/90 backdrop-blur-sm">
          <span className="truncate">
            {languages.join(" · ")}
            {languagesMore > 0 ? ` +${languagesMore}` : ""}
          </span>
        </span>
      )}
      {/* Resolutions lead, because that is what a reader is scanning for, and the rest are counted
          rather than dropped. High dynamic range is deliberately not here: it is on the detail page,
          where there is room to say it without crowding the artwork. A size is not here either — it
          says what the download costs, and the tooltip carries the whole line anyway. */}
      {resolutions.length > 0 && (
        <span className="rounded-md bg-black/55 px-1.5 py-0.5 text-[10.5px] font-medium leading-[14px] text-white/90 backdrop-blur-sm">
          {resolutions.join(" · ")}
          {resolutionsMore > 0 ? ` +${resolutionsMore}` : ""}
        </span>
      )}
      {quality.length > 0 && (
        <span className="rounded-md bg-black/55 px-1.5 py-0.5 text-[10.5px] font-medium leading-[14px] text-white/90 backdrop-blur-sm">
          {quality.join(" · ")}
          {qualityMore > 0 ? ` +${qualityMore}` : ""}
        </span>
      )}
    </div>
  );
}
