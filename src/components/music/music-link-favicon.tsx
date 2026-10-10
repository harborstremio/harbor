import { useState, type ReactNode } from "react";

export function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function MusicLinkFavicon({
  url,
  fallback,
  size = 18,
}: {
  url: string;
  fallback: ReactNode;
  size?: number;
}) {
  const host = linkHost(url);
  const [failed, setFailed] = useState(false);
  if (!host || failed) return <>{fallback}</>;
  return (
    <img
      src={`https://icons.duckduckgo.com/ip3/${host}.ico`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="music-link-favicon"
    />
  );
}
