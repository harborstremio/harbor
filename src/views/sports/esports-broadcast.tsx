import { useEffect, useRef } from "react";
import { Play, Twitch, Youtube } from "lucide-react";
import { useView } from "@/lib/view";
import { officialBroadcastSource, type EsportsStream } from "@/lib/sports/esports-streams";

export function StreamPlatform({
  platform,
  size = 18,
}: {
  platform: EsportsStream["platform"];
  size?: number;
}) {
  return platform === "twitch" ? (
    <Twitch size={size} />
  ) : platform === "youtube" ? (
    <Youtube size={size} />
  ) : (
    <Play size={size} />
  );
}

/** Hand off once to the shared player, so navigation does not destroy the broadcast. */
export function EsportsBroadcast({
  stream,
  onClose,
}: {
  stream: EsportsStream;
  onClose: () => void;
}) {
  const { openPlayer } = useView();
  const launched = useRef("");
  useEffect(() => {
    if (launched.current === stream.url) return;
    launched.current = stream.url;
    const src = officialBroadcastSource(stream);
    if (src) openPlayer(src);
    onClose();
  }, [stream, openPlayer, onClose]);
  return null;
}
