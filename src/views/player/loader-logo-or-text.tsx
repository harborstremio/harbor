import { useState } from "react";

export function LoaderLogoOrText({ logo, fallbackText }: { logo: string | null; fallbackText: string }) {
  const [failed, setFailed] = useState(false);
  if (!logo || failed) {
    return (
      <p className="animate-loader-pulse font-display text-[64px] font-medium leading-[0.96] tracking-tight text-white drop-shadow-[0_18px_45px_rgba(0,0,0,0.7)]">
        {fallbackText}
      </p>
    );
  }
  return (
    <img
      src={logo}
      alt={fallbackText}
      onError={() => setFailed(true)}
      className="max-h-44 w-auto max-w-[72%] animate-loader-pulse object-contain drop-shadow-[0_24px_60px_rgba(0,0,0,0.65)]"
    />
  );
}
