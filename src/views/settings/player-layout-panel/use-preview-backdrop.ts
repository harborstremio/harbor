import { useSampleArtwork } from "@/lib/sample-artwork";

export function usePreviewBackdrop(): string {
  return useSampleArtwork(2).background;
}
