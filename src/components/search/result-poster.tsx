import { Poster, usePosterChain } from "@/components/poster";
import { useSettings } from "@/lib/settings";

export function ResultPoster({ id, poster, className }: { id: string; poster?: string; className?: string }) {
  const { settings } = useSettings();
  const chain = usePosterChain(settings.rpdbKey, id, poster, "series");
  return <Poster src={chain.src} seed={id} ratio="portrait" className={className} onError={chain.onError} />;
}
