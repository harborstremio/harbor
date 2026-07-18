import { openInAppBrowser } from "@/lib/window";
import { useT } from "@/lib/i18n";
import { fmtDate } from "./person-utils";

export function BirthdayLink({ birthday, age }: { birthday: string; age: number | null }) {
  const t = useT();
  const date = new Date(birthday);
  if (Number.isNaN(date.getTime())) {
    return (
      <span>
        {t("Born {date}", { date: fmtDate(birthday) })}
        {age != null && ` · ${age}`}
      </span>
    );
  }
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const handle = () =>
    openInAppBrowser(`https://www.imdb.com/search/name/?birth_monthday=${m}-${d}`);
  return (
    <button
      onClick={handle}
      className="group inline-flex items-center gap-1 text-ink-muted underline decoration-edge underline-offset-4 transition-colors hover:text-ink hover:decoration-accent"
      title={t("See others born this day")}
    >
      {t("Born {date}", { date: fmtDate(birthday) })}
      {age != null && ` · ${age}`}
    </button>
  );
}

export function PlaceLink({ place }: { place: string }) {
  const t = useT();
  const handle = () => {
    const q = encodeURIComponent(place);
    openInAppBrowser(`https://www.imdb.com/search/name/?birth_place=${q}`);
  };
  return (
    <button
      onClick={handle}
      className="inline-flex items-center text-ink-muted underline decoration-edge underline-offset-4 transition-colors hover:text-ink hover:decoration-accent"
      title={t("See others from this place")}
    >
      {place}
    </button>
  );
}
