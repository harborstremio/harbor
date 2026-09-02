import { useState } from "react";
import aioStreamsLogo from "@/assets/addon-logos/aiostreams.png";
import allDebridLogo from "@/assets/addon-logos/alldebrid.webp";
import animeKitsuLogo from "@/assets/addon-logos/anime-kitsu.png";
import cometLogo from "@/assets/addon-logos/comet.png";
import debridLinkLogo from "@/assets/addon-logos/debridlink.png";
import easynewsLogo from "@/assets/addon-logos/easynews.png";
import localFilesLogo from "@/assets/addon-logos/local-files.png";
import mediafusionLogo from "@/assets/addon-logos/mediafusion.png";
import opensubtitlesLogo from "@/assets/addon-logos/opensubtitles.png";
import premiumizeLogo from "@/assets/addon-logos/premiumize.png";
import realDebridLogo from "@/assets/addon-logos/realdebrid.png";
import streamingCatalogsLogo from "@/assets/addon-logos/streaming-catalogs.png";
import torboxLogo from "@/assets/addon-logos/torbox.png";
import torrentioLogo from "@/assets/addon-logos/torrentio.png";

const BUNDLED: Array<{ match: (id: string, name: string) => boolean; src: string }> = [
  { match: (id, n) => id.includes("torrentio") || /torrentio/i.test(n), src: torrentioLogo },
  { match: (id, n) => id === "tb-library" || id.startsWith("tb-") || /torbox/i.test(id) || /\btorbox\b/i.test(n), src: torboxLogo },
  { match: (id, n) => id === "rd-library" || id.startsWith("rd-") || /real.?debrid/i.test(id) || /real.?debrid/i.test(n), src: realDebridLogo },
  { match: (id, n) => id === "ad-library" || id.startsWith("ad-") || /alldebrid/i.test(id) || /all.?debrid/i.test(n), src: allDebridLogo },
  { match: (id, n) => id === "pm-library" || id.startsWith("pm-") || /premiumize/i.test(id) || /premiumize/i.test(n), src: premiumizeLogo },
  { match: (id, n) => id === "dl-library" || id.startsWith("dl-") || /debrid.?link/i.test(id) || /debrid.?link/i.test(n), src: debridLinkLogo },
  { match: (id, n) => id.includes("comet") || /^comet\b/i.test(n), src: cometLogo },
  { match: (id, n) => id.includes("mediafusion") || /mediafusion/i.test(n), src: mediafusionLogo },
  { match: (id, n) => id.includes("aiostreams") || /aio.?streams/i.test(n), src: aioStreamsLogo },
  { match: (id, n) => id.includes("opensubtitles") || /opensubtitles/i.test(n), src: opensubtitlesLogo },
  { match: (id, n) => id.includes("anime-kitsu") || /anime.?kitsu/i.test(n), src: animeKitsuLogo },
  { match: (id, n) => id.includes("streaming-catalogs") || /streaming.catalog/i.test(n), src: streamingCatalogsLogo },
  { match: (id, n) => id.includes("easynews") || /easy.?news/i.test(n), src: easynewsLogo },
  { match: (id, n) => id === "org.stremio.local" || /^local files\b/i.test(n) || /local.?files/i.test(id), src: localFilesLogo },
];

export const BOAT_ADDON_LOGOS: string[] = [
  torrentioLogo,
  cometLogo,
  mediafusionLogo,
  aioStreamsLogo,
  animeKitsuLogo,
  opensubtitlesLogo,
  easynewsLogo,
  streamingCatalogsLogo,
  torboxLogo,
  realDebridLogo,
  allDebridLogo,
  premiumizeLogo,
  debridLinkLogo,
];

const PALETTE = [
  ["#f97373", "#b53b3b"],
  ["#7eb6ff", "#3a6fb8"],
  ["#9d7af6", "#5d3ec1"],
  ["#5ad6a4", "#2c8c66"],
  ["#f4b85a", "#a76f1f"],
  ["#ec78c9", "#a83a8a"],
  ["#5ad0d6", "#1f7a85"],
  ["#c0c8d4", "#5e6677"],
];

export type AddonLogoSize = "xs" | "sm" | "md" | "lg" | "xl" | "tile" | "2xl" | "3xl" | "4xl";

const SIZES: Record<AddonLogoSize, number> = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 28,
  xl: 36,
  tile: 56,
  "2xl": 96,
  "3xl": 156,
  "4xl": 220,
};

function radiusFor(px: number): number {
  return Math.max(4, Math.round(px * 0.22));
}

export function addonLogoSrc(addonId: string, addonName: string): string | null {
  const id = (addonId ?? "").toLowerCase();
  const name = addonName ?? "";
  for (const entry of BUNDLED) {
    if (entry.match(id, name)) return entry.src;
  }
  return null;
}

export function resolveAddonLogo(logo: string | null | undefined, transportUrl: string | null | undefined): string | null {
  if (!logo) return null;
  const trimmed = logo.trim();
  if (!trimmed) return null;
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  if (!transportUrl) return null;
  try {
    return new URL(trimmed, transportUrl).toString();
  } catch {
    return null;
  }
}

export function addonLogoMap(
  addons: ReadonlyArray<{ manifest?: { id?: string; logo?: string | null } | null; transportUrl?: string | null }>,
): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const a of addons) {
    const id = a.manifest?.id;
    if (!id) continue;
    out.set(id, resolveAddonLogo(a.manifest?.logo, a.transportUrl));
  }
  return out;
}

function paletteFor(seed: string): readonly [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length] as [string, string];
}

const PREFER_BUNDLED = (id: string, name: string): boolean => {
  const s = `${id} ${name}`.toLowerCase();
  return /mediafusion/.test(s);
};

export function AddonLogo({
  addonId,
  addonName,
  manifestLogo,
  size = "sm",
}: {
  addonId: string;
  addonName: string;
  manifestLogo?: string | null;
  size?: AddonLogoSize;
}) {
  const px = SIZES[size];
  const bundled = addonLogoSrc(addonId, addonName);
  const preferBundled = PREFER_BUNDLED(addonId, addonName) && !!bundled;
  const primary = preferBundled ? bundled : manifestLogo || bundled || null;
  const fallback = preferBundled ? null : manifestLogo && bundled ? bundled : null;
  const [remoteFailed, setRemoteFailed] = useState(false);
  const src = remoteFailed && fallback ? fallback : primary;
  const initial = (addonName || "?").trim().charAt(0).toUpperCase();
  const [from, to] = paletteFor(addonId || addonName || "?");

  const r = radiusFor(px);
  if (src) {
    return (
      <img
        src={src}
        alt={addonName}
        title={addonName}
        width={px}
        height={px}
        draggable={false}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => {
          if (!remoteFailed && fallback) setRemoteFailed(true);
        }}
        style={{
          height: px,
          width: px,
          borderRadius: r,
          objectFit: "cover",
          background: "rgba(255,255,255,0.06)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 1px 3px rgba(0,0,0,0.4)",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <span
      title={addonName}
      style={{
        height: px,
        width: px,
        borderRadius: r,
        background: `linear-gradient(135deg, ${from}, ${to})`,
        boxShadow: "0 0 0 1px rgba(255,255,255,0.1), 0 1px 3px rgba(0,0,0,0.4)",
        color: "rgba(255,255,255,0.95)",
        fontSize: Math.round(px * 0.5),
        fontWeight: 700,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        letterSpacing: 0,
      }}
    >
      {initial}
    </span>
  );
}

export function AddonLogoStack({
  addons,
  size = "sm",
  max = 5,
}: {
  addons: Array<{ id: string; name: string; logo?: string | null }>;
  size?: AddonLogoSize;
  max?: number;
}) {
  if (addons.length === 0) return null;
  const shown = addons.slice(0, max);
  const overlap = SIZES[size] * 0.32;

  return (
    <span className="inline-flex items-center" style={{ paddingLeft: overlap }}>
      {shown.map((a, i) => (
        <span
          key={`${a.id}-${i}`}
          style={{ marginLeft: -overlap, position: "relative", zIndex: shown.length - i }}
        >
          <AddonLogo addonId={a.id} addonName={a.name} manifestLogo={a.logo} size={size} />
        </span>
      ))}
    </span>
  );
}
