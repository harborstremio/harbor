import { useCallback } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useSettings } from "@/lib/settings";
import { useTogether } from "@/lib/together/provider";
import { usePlayerNavigation, type PlayEpisode } from "@/lib/view";

export function useCastModalPlay() {
  const { exitPlayer, openPicker } = usePlayerNavigation();
  const { settings } = useSettings();
  const { snapshot, claimHost } = useTogether();
  return useCallback(
    (m: Meta, ep?: PlayEpisode) => {
      const inSession = snapshot.state === "joined" && snapshot.participants.length >= 2;
      if (inSession) claimHost(true);
      exitPlayer();
      openPicker(m, ep, { autoPlay: settings.instantPlay, resume: true });
    },
    [
      exitPlayer,
      openPicker,
      settings.instantPlay,
      snapshot.state,
      snapshot.participants.length,
      claimHost,
    ],
  );
}
