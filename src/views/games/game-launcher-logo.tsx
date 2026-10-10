import { useState } from "react";
import { LAUNCHER_DISCOVERY } from "@/lib/games/launcher-discovery";

/** Provider-owned artwork, shared by discovery and library source controls. */
export function GameLauncherLogo({ launcher, size = 22, className = "" }: {
  launcher: string; size?: number; className?: string;
}) {
  const brand = LAUNCHER_DISCOVERY.find(item => item.id === launcher);
  const [failed, setFailed] = useState<string | null>(null);
  const style = { width: size, height: size, flex: `0 0 ${size}px`, objectFit: "contain" as const };
  if (!brand || failed === brand.logo) return <span className={className} aria-hidden="true" style={{ ...style, display: "inline-grid", placeItems: "center", fontSize: size * .45, fontWeight: 650 }}>{(brand?.name ?? launcher).slice(0, 2)}</span>;
  if (brand.monochrome) return <span className={className} aria-hidden="true" style={{ ...style, display: "inline-block", background: "currentColor", mask: `url("${brand.logo}") center / contain no-repeat` }}/>;
  return <img className={className} src={brand.logo} alt="" aria-hidden="true" width={size} height={size} style={style} loading="lazy" decoding="async" draggable={false} onError={() => setFailed(brand.logo)}/>;
}
