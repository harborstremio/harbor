import type { CSSProperties } from "react";
import type { StoreBundle } from "@/lib/bundle-store";
import type { FitTokens } from "./fit-palette";
import { BundleFitBody } from "./bundle-fit";

function ThemeImage({ cover }: { cover: string }) {
  return (
    <img
      src={cover}
      alt=""
      draggable={false}
      loading="lazy"
      decoding="async"
      className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover/card:scale-[1.04] motion-reduce:transform-none"
    />
  );
}

function ThemeWash({ tokens }: { tokens?: FitTokens }) {
  return (
    <div
      className="relative h-full w-full overflow-hidden bg-canvas"
      style={tokens ? (tokens as unknown as CSSProperties) : undefined}
    >
      <div className="absolute inset-0 bg-[radial-gradient(115%_115%_at_16%_12%,var(--color-surface),transparent_58%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(92%_92%_at_102%_106%,var(--color-accent),transparent_44%)] opacity-70" />
    </div>
  );
}

export function Fit({
  kind,
  tokens,
  cover,
  icons,
  size = "card",
}: {
  kind: "theme" | "badge" | "award";
  tokens?: FitTokens;
  cover?: string | null;
  icons?: StoreBundle["icons"];
  size?: "card" | "hero";
}) {
  if (kind === "theme") {
    if (cover) return <ThemeImage cover={cover} />;
    return <ThemeWash tokens={tokens} />;
  }
  return <BundleFitBody icons={icons ?? []} cover={cover} size={size} />;
}
