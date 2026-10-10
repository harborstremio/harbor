import { useEffect, useRef, useState } from "react";
import type { PreparationDraft } from "@/lib/games/download-preparation";

export type DownloadDestinationRequest = { name: string; filename?: string; filenames?: string[]; expectedBytes?: number };
export type DownloadDestinationSelection = { path: string; preparation: PreparationDraft | null };
export type DownloadDestinationPrompt = DownloadDestinationRequest & { profile: string; accept: (selection: DownloadDestinationSelection) => Promise<boolean>; finish: (accepted?: boolean) => void };

/** A canceled or stale picker must never enqueue a download for another profile. */
export function useGameDownloadDestination(profile: string, active: boolean) {
  const [prompt, setPrompt] = useState<DownloadDestinationPrompt | null>(null);
  const pending = useRef<DownloadDestinationPrompt | null>(null);
  const cancel = () => pending.current?.finish(false);
  useEffect(() => cancel, [profile]);
  useEffect(() => { if (!active) cancel(); }, [active]);
  const choose = (request: DownloadDestinationRequest, accept: DownloadDestinationPrompt["accept"]) => new Promise<boolean>(resolve => {
    cancel();
    let accepting = false;
    const next: DownloadDestinationPrompt = { ...request, profile, accept: async selection => {
      if (pending.current !== next || accepting) return false;
      accepting = true;
      try { return await accept(selection); }
      finally { accepting = false; }
    }, finish: accepted => {
      if (pending.current !== next) return;
      pending.current = null; setPrompt(null); resolve(accepted === true);
    } };
    pending.current = next; setPrompt(next);
  });
  return { prompt: prompt?.profile === profile ? prompt : null, choose };
}
