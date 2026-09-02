import { useCallback, useEffect, useState } from "react";
import { useProfiles } from "@/lib/profiles";

/**
 * The nav owns the top bar and the shell owns the layer chain, so the avatar
 * button asks for the chooser by event rather than by reaching into bp-shell.
 * Same idiom as bp:phone-typing.
 */
export const BP_WHO_EVENT = "bp:who";

export function openBpWho(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BP_WHO_EVENT));
}

export type BpWhoLayer = {
  open: boolean;
  /**
   * False only while no profile is active. Back is then swallowed and the
   * chooser is genuinely modal, because there is no valid state behind it.
   */
  canClose: boolean;
  close: () => void;
};

/**
 * Open policy is not reinvented here. ProfilesProvider already resolves
 * profilePromptInterval, defaultProfileId, the harbor.pickerShown session flag
 * and harbor.profile.lastSelectAt into pickerOpen, and it never opens for a
 * single-profile household. A second policy is how a household gets prompted
 * twice, so this reads that one and adds only the manual open.
 */
export function useBpWhoLayer(): BpWhoLayer {
  const { pickerOpen, closePicker, activeId } = useProfiles();
  const [manual, setManual] = useState(false);

  useEffect(() => {
    const onOpen = () => setManual(true);
    window.addEventListener(BP_WHO_EVENT, onOpen);
    return () => window.removeEventListener(BP_WHO_EVENT, onOpen);
  }, []);

  useEffect(() => {
    setManual(false);
  }, [activeId]);

  const canClose = activeId != null;

  const close = useCallback(() => {
    if (activeId == null) return;
    setManual(false);
    closePicker();
  }, [activeId, closePicker]);

  return { open: manual || pickerOpen, canClose, close };
}
