import { useEffect, useRef } from "react";
import { notifyLocalBackCapability, registerLocalBackCapability } from "./app-back";

/** Query availability without dispatching an event that performs navigation. */
export function useLocalBackCapability(available: boolean): void {
  const current = useRef(available);
  current.current = available;
  useEffect(() => registerLocalBackCapability(() => current.current), []);
  useEffect(() => notifyLocalBackCapability(), [available]);
}
