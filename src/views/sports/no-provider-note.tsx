import { Tv } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { usePlaylists } from "@/lib/iptv/playlists-store";
import { hasSportsSource } from "@/lib/sports/enabled";
import "./no-provider-note.css";

/** Scores need no provider, so say plainly where a stream would have to come from. */
export function SportsNoProviderNote() {
  const t = useT();
  const { setView } = useView();
  if (hasSportsSource(usePlaylists())) return null;
  return (
    <aside className="sports-no-provider" role="note">
      <Tv size={17} strokeWidth={1.9} aria-hidden="true" />
      <p>
        {t(
          "Scores, schedules and standings work without a provider. Harbor does not supply streams, so watching a game needs your own Live TV, M3U or Xtream source.",
        )}
      </p>
      <button type="button" onClick={() => setView("live")}>
        {t("Set up Live TV")}
      </button>
    </aside>
  );
}
