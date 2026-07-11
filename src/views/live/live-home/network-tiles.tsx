import type { IptvChannel } from "@/lib/iptv/types";
import { useState } from "react";

export function NetworkTiles({ channels, onPlay }: { channels: IptvChannel[]; onPlay: (ch: IptvChannel) => void }) {
  if (channels.length === 0) return null;
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 ps-[9px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {channels.map((ch) => (
        <Tile key={ch.id} channel={ch} onPlay={onPlay} />
      ))}
    </div>
  );
}

function Tile({ channel, onPlay }: { channel: IptvChannel; onPlay: (ch: IptvChannel) => void }) {
  const [err, setErr] = useState(false);
  return (
    <button
      data-art={channel.logo || ""}
      onClick={() => onPlay(channel)}
      title={channel.name}
      className="flex h-16 w-[148px] shrink-0 items-center justify-center rounded-lg border border-edge-soft/45 bg-elevated px-4 transition-colors duration-150 hover:border-edge hover:bg-raised"
    >
      {channel.logo && !err ? (
        <img
          src={channel.logo}
          alt={channel.name}
          draggable={false}
          loading="lazy"
          onError={() => setErr(true)}
          className="max-h-9 max-w-full object-contain"
        />
      ) : (
        <span className="truncate text-[13px] font-semibold text-ink">{channel.name}</span>
      )}
    </button>
  );
}
