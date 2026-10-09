import { useState } from "react";
import { Tv } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import type { EpgProgram, IptvChannel } from "@/lib/iptv/types";

export function BpGuidePortalArt({
  channel,
  program,
  hydrated,
}: {
  channel: IptvChannel;
  program: EpgProgram | null;
  hydrated: Meta | null;
}) {
  const [artErr, setArtErr] = useState(false);
  const [logoErr, setLogoErr] = useState(false);

  const backdrop = hydrated?.background || program?.iconUrl || null;
  const art = backdrop && !artErr ? backdrop : null;
  const logo = channel.logo && !logoErr ? channel.logo : null;

  if (art) {
    return (
      <img
        src={art}
        alt=""
        draggable={false}
        onError={() => setArtErr(true)}
        className="absolute inset-0 h-full w-full object-cover"
      />
    );
  }

  if (logo) {
    return (
      <>
        <img
          src={logo}
          alt=""
          aria-hidden
          draggable={false}
          className="absolute left-1/2 top-1/2 h-[150%] w-[60%] -translate-x-1/2 -translate-y-1/2 object-contain opacity-25 blur-2xl saturate-150"
        />
        <img
          src={logo}
          alt=""
          draggable={false}
          onError={() => setLogoErr(true)}
          className="absolute left-1/2 top-1/2 max-h-[46%] w-[42%] -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
        />
      </>
    );
  }

  return (
    <div
      className="absolute inset-0 grid place-items-center"
      style={{ background: "var(--bp-panel)" }}
    >
      <Tv size={64} strokeWidth={1} className="text-ink-subtle/30" />
    </div>
  );
}
