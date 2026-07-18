import { useState } from "react";
import { SERVICES } from "@/lib/providers/streaming";
import type { StreamingService } from "@/lib/settings";

export function ServiceLogo({
  service,
  height = 28,
}: {
  service: StreamingService;
  height?: number;
}) {
  const [failed, setFailed] = useState(false);
  const meta = SERVICES[service];
  if (!meta) return null;
  if (failed) {
    return (
      <span className="text-[14.5px] font-semibold tracking-tight" style={{ color: meta.tint }}>
        {meta.name}
      </span>
    );
  }
  const finalHeight = meta.logoHeight ? Math.round(height * (meta.logoHeight / 32)) : height;
  return (
    <img
      src={meta.logo}
      alt={meta.name}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      draggable={false}
      style={{
        height: finalHeight,
        width: "auto",
        maxWidth: "100%",
        filter: "var(--service-logo-filter, brightness(0) invert(1))",
      }}
      className="select-none object-contain"
    />
  );
}
