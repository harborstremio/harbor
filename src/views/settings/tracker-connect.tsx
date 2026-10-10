import { ExternalLink } from "./icons";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";
import { ROW_ACTION_PRIMARY } from "./kit";
import { settingsAnchor } from "./shared";

export function TrackerConnect({
  service, logo, description, onConnect, website,
}: {
  service: string;
  logo: string;
  description: string;
  onConnect: () => void;
  website: string;
}) {
  const t = useT();
  return (
    <div className="flex items-start gap-6 pb-5 pt-1">
      <div className="grid size-[72px] shrink-0 place-items-center rounded-[18px] bg-elevated">
        <img src={logo} alt="" draggable={false} className="size-10 object-contain" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
        <h2 className="text-[24px] font-semibold leading-8 tracking-[-0.5px] text-ink">{service}</h2>
        <p className="max-w-[56ch] text-[15.5px] leading-[23px] text-ink-muted">{description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
          <button type="button" id={settingsAnchor(`Connect ${service}`)} onClick={onConnect} className={ROW_ACTION_PRIMARY}>
            {t("Connect {service}", { service })}
          </button>
          <button
            type="button"
            id={settingsAnchor(`About ${service}`)}
            onClick={() => openUrl(website)}
            className="inline-flex min-h-11 items-center gap-2 text-[15px] text-ink-muted transition-colors hover:text-ink"
          >
            {t("About {service}", { service })}
            <ExternalLink size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
