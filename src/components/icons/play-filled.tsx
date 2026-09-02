import type { CSSProperties } from "react";
import { UiIcon } from "@/components/ui-icon";

export function Play({
  size = 20,
  className,
  style,
}: {
  size?: number | string;
  className?: string;
  strokeWidth?: number;
  fill?: string;
  style?: CSSProperties;
}) {
  return (
    <UiIcon
      name="play-filled"
      className={className}
      style={{ ...style, width: size, height: size, scale: "0.82" }}
    />
  );
}
