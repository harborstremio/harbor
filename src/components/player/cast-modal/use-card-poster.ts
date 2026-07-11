import { usePosterChain } from "@/components/poster";
import type { Meta } from "@/lib/cinemeta";
import { useSettings } from "@/lib/settings";

export function useCardPoster(meta: Meta) {
  const { settings } = useSettings();
  return usePosterChain(settings.rpdbKey, meta.id, meta.poster, meta.type === "series" ? "series" : "movie");
}
