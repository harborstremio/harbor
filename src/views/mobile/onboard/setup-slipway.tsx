import { useRef } from "react";
import { SetupBoat } from "./setup-boat";
import { StepMark } from "./setup-marks";
import type { SetupStepId } from "./setup-wire";

/**
 * The band every step opens with: the real mark of the service on the quay,
 * Harbor's boat on the waterline, and one more piece of that boat for every
 * step the TV has confirmed. `built` is captured at mount so arriving at a
 * later step does not replay pieces the viewer already earned; only a piece
 * that lands while this screen is open is hoisted.
 */
export function SetupSlipway({
  step,
  built,
  won,
}: {
  step: SetupStepId;
  built: number;
  won?: boolean;
}) {
  const start = useRef(built);
  const animate = built > start.current ? "latest" : "none";

  return (
    <div
      className={`setup-rise flex items-end justify-between gap-4 border-b border-edge-soft ${
        won ? "pt-2" : ""
      }`}
    >
      <StepMark step={step} className={won ? "h-14 w-14" : "h-11 w-11"} />
      <SetupBoat
        built={built}
        animate={animate}
        ghost
        className={`${won ? "w-[92px]" : "w-[58px]"} text-accent`}
      />
    </div>
  );
}
