import type { MouseEvent } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useContextMenuActions } from "@/lib/context-menu";

/** Capture the title/artwork at invocation. Carousel updates cannot retarget an
 * already open menu; the shared menu still owns page and actor invalidation. */
export function useTitleContext(meta: Meta | undefined, artwork?: string) {
  const { open } = useContextMenuActions();
  return (event: MouseEvent<HTMLElement>) => {
    if (!meta || event.defaultPrevented) return;
    const independent =
      event.target instanceof Element
        ? event.target.closest("button,a[href],input,textarea,[role='button']")
        : null;
    if (independent && independent !== event.currentTarget) return;
    open(event, {
      kind: "meta",
      meta: { ...meta },
      image: artwork ? { src: artwork, publicUrl: artwork, label: meta.name } : undefined,
    });
  };
}
