import { HarborMark } from "@/components/icons/harbor-mark";
import type { ControllerCursorId } from "@/lib/gamepad/cursor";

const OUTLINE = "rgba(0,0,0,0.62)";

export function GamepadCursor({
  id,
  image,
  className,
}: {
  id: ControllerCursorId;
  image?: string;
  className?: string;
}) {
  if (id === "custom") {
    return image ? (
      <img src={image} alt="" draggable={false} className={`${className ?? ""} object-contain`} />
    ) : (
      <Dot className={className} />
    );
  }
  if (id === "harbor") return <HarborMark className={className} />;
  if (id === "arrow") return <Arrow className={className} />;
  if (id === "ring") return <Ring className={className} />;
  return <Dot className={className} />;
}

function Dot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="6"
        fill="currentColor"
        stroke={OUTLINE}
        strokeWidth="3"
        paintOrder="stroke"
      />
    </svg>
  );
}

function Ring({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="8"
        fill="none"
        stroke={OUTLINE}
        strokeWidth="5.5"
      />
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2.6" />
      <circle
        cx="12"
        cy="12"
        r="2.1"
        fill="currentColor"
        stroke={OUTLINE}
        strokeWidth="2"
        paintOrder="stroke"
      />
    </svg>
  );
}

function Arrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M12 12 L12 21.43 L14.54 18.97 L16.1 22.33 L17.58 21.68 L16.02 18.4 L19.38 18.15 Z"
        fill="currentColor"
        stroke={OUTLINE}
        strokeWidth="2.6"
        strokeLinejoin="round"
        paintOrder="stroke"
      />
    </svg>
  );
}
