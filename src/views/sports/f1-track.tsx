import { useT } from "@/lib/i18n";
import { MapPin } from "lucide-react";
import type { F1Race } from "@/lib/sports/f1-data";
import tracks from "@/assets/sports/circuits.json";

const IDS: Record<string, string> = {
  albert_park: "au-1953",
  bahrain: "bh-2002",
  shanghai: "cn-2004",
  catalunya: "es-1991",
  monaco: "mc-1929",
  villeneuve: "ca-1978",
  ricard: "fr-1969",
  red_bull_ring: "at-1969",
  silverstone: "gb-1948",
  hungaroring: "hu-1986",
  spa: "be-1925",
  monza: "it-1922",
  marina_bay: "sg-2008",
  suzuka: "jp-1962",
  americas: "us-2012",
  rodriguez: "mx-1962",
  interlagos: "br-1940",
  yas_marina: "ae-2009",
  imola: "it-1953",
  jeddah: "sa-2021",
  miami: "us-2022",
  losail: "qa-2004",
  madring: "es-2026",
  baku: "az-2016",
  vegas: "us-2023",
  zandvoort: "nl-1948",
  sepang: "my-1999",
};
export function F1CircuitIcon({ circuitId }: { circuitId: string }) {
  const track = tracks.find((item) => item.id === IDS[circuitId]);
  if (!track) return <MapPin size={24} aria-hidden />;
  return (
    <svg
      width={32}
      height={24}
      viewBox="0 0 600 330"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d={track.path}
        stroke="currentColor"
        strokeWidth={16}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function F1Track({ race }: { race: F1Race }) {
  const t = useT();
  const track = tracks.find((item) => item.id === IDS[race.Circuit.circuitId]);
  return (
    <section className="sh-f1-track">
      <div>
        <span className="sh-eyebrow">{t("THE CIRCUIT")}</span>
        <h3>{race.Circuit.circuitName}</h3>
        <p>
          {race.Circuit.Location.locality}, {race.Circuit.Location.country}
        </p>
        {track && (
          <strong>
            {(track.length / 1000).toFixed(3)} <small>km</small>
          </strong>
        )}
        <small>{t("Circuit outline · not live car positions")}</small>
      </div>
      {track ? (
        <svg
          viewBox="0 0 600 330"
          role="img"
          aria-label={`${race.Circuit.circuitName} — ${t("Circuit layout")}`}
        >
          <path d={track.path} className="sh-track-edge" />
          <path d={track.path} className="sh-track-surface" />
        </svg>
      ) : (
        <p>{t("A circuit map is not available yet.")}</p>
      )}
    </section>
  );
}
