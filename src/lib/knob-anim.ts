import { useLayoutEffect, useRef, useState } from "react";

export function useKnobAnim(on: boolean): string {
  const [anim, setAnim] = useState<"on" | "off" | null>(null);
  const prev = useRef(on);
  useLayoutEffect(() => {
    if (prev.current === on) return;
    prev.current = on;
    setAnim(on ? "on" : "off");
  }, [on]);
  if (anim === "on") return "animate-knob-on";
  if (anim === "off") return "animate-knob-off";
  return "";
}
