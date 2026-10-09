import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { SimsPackCheckActions, SimsPackRequirements } from "./game-sims-packs";
import type { SimsMetadataReport } from "@/lib/games/sims";

export function GameSimsMetadata({ report }: { report: SimsMetadataReport }) {
  const t = useT(), [limit, setLimit] = useState(8);
  const entries = report?.files.flatMap(entry => entry.manifests.map((manifest, index) => ({ file: entry.file, manifest, key: `${entry.file}:${index}` }))) ?? [];
  const website = (url: string) => <button className="games-detail-text-button" onClick={() => void openUrl(url)}>{t("games.sims.infoWebsite")}<ArrowUpRight size={14}/></button>;
  return <>
        <p className="games-sims-info-note">{t("games.sims.infoNote")}</p>
        {entries.some(({ manifest }) => manifest.requiredPacks.length || manifest.incompatiblePacks.length) && <SimsPackCheckActions/>}
        {report?.partial && <p className="games-sims-notice" role="status">{t("games.sims.infoPartial")}</p>}
        {!entries.length && <p>{t("games.sims.infoEmpty")}</p>}
        {entries.slice(0, limit).map(({ file: source, manifest: value, key }) => <article className="games-sims-info-entry" key={key}>
          <h3 dir="auto">{value.name}</h3>
          {value.version && <p>{t("games.sims.infoVersion", { version: value.version })}</p>}
          {!!value.creators.length && <p dir="auto">{value.creators.join(" · ")}</p>}
          {value.description && <p className="games-sims-info-description" dir="auto">{value.description}</p>}
          {value.url && website(value.url)}
          <SimsPackRequirements values={value.requiredPacks} controls={false}/>
          <SimsPackRequirements values={value.incompatiblePacks} incompatible controls={false}/>
          {!!value.requirements.length && <div className="games-sims-info-requirements"><h4>{t("games.sims.infoRequirements")}</h4>{value.requirements.map((requirement, index) => <div key={index}>
            <strong dir="auto">{requirement.name}</strong>{requirement.version && <small>{t("games.sims.infoVersion", { version: requirement.version })}</small>}
            {!!requirement.creators.length && <small dir="auto">{requirement.creators.join(" · ")}</small>}
            {requirement.conditional && <p>{t("games.sims.infoConditional")}</p>}
            {!!requirement.features.length && <p>{t("games.sims.infoFeatures")} <span dir="auto">{requirement.features.join(" · ")}</span></p>}
            {requirement.url && website(requirement.url)}
          </div>)}</div>}
          <small className="games-sims-info-source" dir="auto">{source}</small>
        </article>)}
        {entries.length > limit && <button className="games-button" onClick={() => setLimit(n => n + 8)}>{t("games.details.showMore")}</button>}
  </>;
}
