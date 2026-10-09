import { useEffect, useState } from "react";
import { fetchChannelAvatar } from "@/lib/sports/broadcast-channel";
import type { EsportsStream } from "@/lib/sports/esports-streams";
export function BroadcastChannelAvatar({ stream }: { stream: EsportsStream }) {
  const [image, setImage] = useState<{ url: string; src: string }>();
  useEffect(() => {
    let active = true;
    void fetchChannelAvatar(stream)
      .then((src) => {
        if (active && src) setImage({ url: stream.url, src });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [stream.url]);
  return (
    <span className="broadcast-channel-avatar" aria-hidden="true">
      {image?.url === stream.url ? (
        <img src={image.src} alt="" onError={() => setImage(undefined)} />
      ) : (
        stream.title.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
