import { useEffect, useState } from "react";
import { MusicServiceLogo } from "./music-service-logo";
import { billboardHot100Rank } from "@/lib/music/billboard-rank";
import { useT } from "@/lib/i18n";

export function MusicBillboardRank({
  title,
  artist,
  className = "",
  logoSize = 15,
}: {
  title: string;
  artist: string;
  className?: string;
  logoSize?: number;
}) {
  const t = useT();
  const [rank, setRank] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    setRank(null);
    billboardHot100Rank({ title, artist })
      .then((found) => {
        if (active) setRank(found);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [title, artist]);
  if (!rank) return null;
  const label = t("music.billboard.rank", { rank });
  return (
    <span className={className} title={label} aria-label={label}>
      <MusicServiceLogo source="billboard" size={logoSize} />
      <span dir="ltr">#{rank}</span>
    </span>
  );
}
