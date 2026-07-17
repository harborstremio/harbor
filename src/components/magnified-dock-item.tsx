import { motion, useSpring, useTransform, type MotionValue } from "framer-motion";
import { useRef, type ReactNode } from "react";

const SPRING = {
  mass: 0.1,
  stiffness: 170,
  damping: 12,
};

export function MagnifiedDockItem({
  children,
  mouseX,
  enabled = true,
  scaleFactor = 1.34,
  distance = 260,
  spread = 56,
  lift = 18,
}: {
  children: ReactNode;
  mouseX: MotionValue<number>;
  enabled?: boolean;
  scaleFactor?: number;
  distance?: number;
  spread?: number;
  lift?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  /*
   * Build UI's important detail:
   * measure the real viewport position of each item and compare it
   * with the shared mouse MotionValue.
   *
   * clientX and getBoundingClientRect() use the same coordinate space.
   */
  const pointerDistance = useTransform(mouseX, (currentMouseX) => {
    if (!enabled || !Number.isFinite(currentMouseX)) {
      return Number.NEGATIVE_INFINITY;
    }

    const bounds = ref.current?.getBoundingClientRect();

    if (!bounds) {
      return Number.NEGATIVE_INFINITY;
    }

    return currentMouseX - bounds.left - bounds.width / 2;
  });

  const scaleTarget = useTransform(pointerDistance, [-distance, 0, distance], [1, scaleFactor, 1], {
    clamp: true,
  });

  /*
   * Neighbouring cards move away from the active poster.
   * Cursor left of the item = item moves right.
   * Cursor right of the item = item moves left.
   */
  const xTarget = useTransform(pointerDistance, (currentDistance) => {
    if (!Number.isFinite(currentDistance)) {
      return 0;
    }

    const normalized = Math.max(-1, Math.min(1, currentDistance / distance));

    const influence = Math.max(0, 1 - Math.abs(currentDistance) / distance);

    return -normalized * spread * (0.35 + influence * 0.65);
  });

  const yTarget = useTransform(scaleTarget, [1, scaleFactor], [0, -lift]);

  const scale = useSpring(scaleTarget, SPRING);

  const x = useSpring(xTarget, SPRING);

  const y = useSpring(yTarget, SPRING);

  const zIndex = useTransform(scale, [1, scaleFactor], [1, 100]);

  return (
    <motion.div
      ref={ref}
      data-magnified-dock-item
      style={{
        x,
        y,
        scale,
        zIndex,
      }}
      className="
        relative
        w-full
        origin-bottom
        [backface-visibility:hidden]
        will-change-transform
      "
    >
      {children}
    </motion.div>
  );
}
