import type { CSSProperties } from "react";
import { UiIcon } from "@/components/ui-icon";

export function MoreLikeThisIcon({
  size = 14,
  className,
  style,
}: {
  size?: number | string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <UiIcon
      name="more-like-this"
      className={className}
      style={{ ...style, width: size, height: size }}
    />
  );
}
