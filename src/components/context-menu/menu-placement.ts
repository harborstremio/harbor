import { fitMenu } from "@/lib/context-actions";

type Anchor = { left: number; right: number; top: number; bottom: number };
type Size = { width: number; height: number };
type Point = { x: number; y: number };

export type MenuReveal = {
  originX: number;
  originY: number;
  clipFrom: string;
  clipTo: string;
};

/** Sweep a straight, oblique edge across stationary content from its actual anchor. */
export function menuReveal(anchor: Point, position: Point, size: Size): MenuReveal {
  const width = Math.max(1, size.width);
  const height = Math.max(1, size.height);
  const originX = Math.max(0, Math.min(width, anchor.x - position.x));
  const originY = Math.max(0, Math.min(height, anchor.y - position.y));
  const dx = width / 2 - originX;
  const dy = height / 2 - originY;
  const length = Math.hypot(dx, dy);
  const nx = length ? dx / length : 1;
  const ny = length ? dy / length : 0;
  const extent = (Math.abs(nx) * width) / 2 + (Math.abs(ny) * height) / 2;
  const span = (width + height + 80) * 2;
  const clip = (distance: number) => {
    const point = (normal: number, tangent: number) => {
      const x = width / 2 + nx * normal - ny * tangent;
      const y = height / 2 + ny * normal + nx * tangent;
      return `${Number(((x / width) * 100).toFixed(5))}% ${Number(((y / height) * 100).toFixed(5))}%`;
    };
    // Constant vertex order permits interpolation even when the boundary
    // intersects a different pair of edges. The final clip includes shadows.
    return `polygon(${point(-span, -span)}, ${point(-span, span)}, ${point(distance, span)}, ${point(distance, -span)})`;
  };
  return {
    originX: (originX / width) * 100,
    originY: (originY / height) * 100,
    clipFrom: clip(-extent - 2),
    clipTo: clip(extent + 48),
  };
}

export function menuRevealStyle(reveal: MenuReveal | null) {
  return {
    "--context-menu-reveal-origin": `${reveal?.originY ?? 0}%`,
    "--context-menu-reveal-x": `${reveal?.originX ?? 0}%`,
    "--context-menu-reveal-from": reveal?.clipFrom ?? "inset(100%)",
    "--context-menu-reveal-to": reveal?.clipTo ?? "inset(-48px)",
  };
}

export function submenuPlacement(anchor: Anchor, size: Size, viewport: Size, rtl: boolean) {
  const preferred = rtl ? anchor.left - size.width : anchor.right;
  const fits = preferred >= 8 && preferred + size.width <= viewport.width - 8;
  const side = (fits ? rtl : !rtl) ? "left" : "right";
  const position = fitMenu(
    { x: fits ? preferred : rtl ? anchor.right : anchor.left - size.width, y: anchor.top },
    size,
    viewport,
  );
  // When the panel straddles its row, unfold around the row's actual center.
  // Horizontal collision handling must not decide the vertical reveal.
  const origin =
    position.y >= anchor.top
      ? 0
      : position.y + size.height <= anchor.bottom
        ? 100
        : Math.max(
            0,
            Math.min(100, (((anchor.top + anchor.bottom) / 2 - position.y) / size.height) * 100),
          );
  const reveal = menuReveal(
    {
      x: side === "right" ? anchor.right : anchor.left,
      y: position.y + (size.height * origin) / 100,
    },
    position,
    size,
  );
  return { ...position, side, origin, reveal } as const;
}
