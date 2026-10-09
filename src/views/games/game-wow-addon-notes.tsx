import { useId, useState } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import type { WowAddonMedia } from "@/lib/games/wow-addon-media-data";

export function GameWowAddonNotes({ data }: { data: WowAddonMedia }) {
  const t = useT(), language = useUiLanguage(), id = useId();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const url = `https://www.wowinterface.com/downloads/info${data.id}.html`;
  return <div className="wow-addon-author-notes">
    {(data.author || data.version || data.updatedAt) && <div className="wow-addon-author-meta">
      {data.author && <span dir="auto">{data.author}</span>}
      {data.version && <span>{t("games.wow.addons.publishedVersion", { version: data.version })}</span>}
      {data.updatedAt && <time dateTime={new Date(data.updatedAt).toISOString()}>{t("games.wow.addons.publishedDate", { date: new Date(data.updatedAt).toLocaleDateString(language, { year: "numeric", month: "short", day: "numeric" }) })}</time>}
    </div>}
    {(["description", "changeLog"] as const).map(key => data[key] && <section key={key}>
      <button type="button" aria-expanded={!!expanded[key]} aria-controls={`${id}-${key}`} onClick={() => setExpanded(value => ({ ...value, [key]: !value[key] }))}>
        {t(key === "description" ? "games.wow.addons.about" : "games.wow.addons.changes")}<ChevronDown size={17} aria-hidden="true"/>
      </button>
      <div id={`${id}-${key}`} hidden={!expanded[key]}>{expanded[key] && <p dir="auto">{data[key]}</p>}</div>
    </section>)}
    {data.notesTruncated && <a href={url} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); openUrl(url); }}>{t("games.wow.addons.fullNotes")}<ArrowUpRight size={14}/></a>}
  </div>;
}
