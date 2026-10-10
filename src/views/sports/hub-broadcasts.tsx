import { useState } from "react";
import { useDragScroll } from "@/lib/use-drag-scroll";
import { Play } from "lucide-react";
import { EsportsBroadcast } from "./esports-broadcast";
import { useT } from "@/lib/i18n";

import { SPORTS_BROADCASTS, type SportsBroadcast } from "@/lib/sports/broadcasts";

export function BroadcastPlayer({
  broadcast,
  onClose,
}: {
  broadcast: SportsBroadcast;
  onClose: () => void;
}) {
  return (
    <EsportsBroadcast
      stream={{
        title: `${broadcast.title} · ${broadcast.competition}`,
        url: `https://www.twitch.tv/${broadcast.channel}`,
        platform: "twitch",
      }}
      onClose={onClose}
    />
  );
}
export function HubBroadcasts() {
  const { ref, handlers } = useDragScroll<HTMLDivElement>();
  const t = useT();
  const [broadcast, setBroadcast] = useState<SportsBroadcast | null>(null);
  return (
    <section className="sh-section">
      <div className="sh-section-head">
        <div>
          <h2>{t("The esports arena")}</h2>
          <p>{t("Official channels. Live when they are. No account needed to browse.")}</p>
        </div>
      </div>
      <div className="sh-event-rail" ref={ref} {...handlers}>
        {SPORTS_BROADCASTS.map((item) => (
          <button
            className={`sh-broadcast-card sh-broadcast-${item.id}`}
            key={item.id}
            onClick={() => setBroadcast(item)}
          >
            {item.art && <img src={item.art} alt="" loading="lazy" />}
            <span className="sh-broadcast-brand">{item.title}</span>
            <span className="sh-broadcast-copy">
              <small>{item.competition}</small>
              <strong>{item.title}</strong>
              <span>
                <Play size={14} />
                {t("Open broadcast")}
              </span>
            </span>
          </button>
        ))}
      </div>
      {broadcast && <BroadcastPlayer broadcast={broadcast} onClose={() => setBroadcast(null)} />}
    </section>
  );
}
