import type { CSSProperties } from "react";
import { UiIcon } from "@/components/ui-icon";

type GlyphProps = {
  size?: number | string;
  className?: string;
  strokeWidth?: number;
  fill?: string;
  style?: CSSProperties;
};

function sized(size: number | string | undefined, style: CSSProperties | undefined, extra?: string): CSSProperties {
  const base: CSSProperties = { ...style, width: size ?? 18, height: size ?? 18 };
  if (extra) base.transform = style?.transform ? `${style.transform} ${extra}` : extra;
  return base;
}

export function AllAddonsIcon({ size = 18, className, style }: GlyphProps) {
  return <UiIcon name="all-addons" className={className} style={sized(size, style)} />;
}

export function ThumbsUpIcon({ size = 18, className, style }: GlyphProps) {
  return <UiIcon name="thumbs-up" className={className} style={sized(size, style)} />;
}

export function ThumbsDownIcon({ size = 18, className, style }: GlyphProps) {
  return <UiIcon name="thumbs-up" className={className} style={sized(size, style, "rotate(180deg)")} />;
}

export function SkipIcon({ size = 18, className, style }: GlyphProps) {
  return <UiIcon name="skip-fwd" className={className} style={sized(size, style)} />;
}

export function SkipBackIcon({ size = 18, className, style }: GlyphProps) {
  return <UiIcon name="skip-fwd" className={className} style={sized(size, style, "scaleX(-1)")} />;
}

export function SaveIcon({ size = 18, className, style }: GlyphProps) {
  return <UiIcon name="save-banner" className={className} style={sized(size, style)} />;
}

export function ShowcaseIcon({ size = 18, className, style }: GlyphProps) {
  return <UiIcon name="showcase" className={className} style={sized(size, style)} />;
}
