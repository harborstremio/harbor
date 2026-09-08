import type { MouseEvent } from "react";
import { useContextMenu } from "@/lib/context-menu";
import { useView } from "@/lib/view";
import { t } from "@/lib/i18n";
import { userContextTarget } from "@/views/profile/context-targets";

/** Only attach to containers rendered by Harbor's escaping BBCode renderer.
 * These attributes describe links, never ownership or native capabilities. */
export function useRenderedContentContext() {
  const { open } = useContextMenu();
  const { openMeta, openManga } = useView();
  return (event: MouseEvent<HTMLElement>) => {
    const element = event.target instanceof Element ? event.target : null;
    const mention = element?.closest<HTMLElement>("[data-harbor-mention]");
    if (mention && event.currentTarget.contains(mention)) {
      const handle = mention.getAttribute("data-harbor-mention");
      if (handle && /^[a-z\d_.-]+$/i.test(handle)) open(event, userContextTarget(handle));
      return;
    }
    const card = element?.closest<HTMLElement>("[data-harbor-media]");
    if (!card || !event.currentTarget.contains(card)) return;
    const id = card.getAttribute("data-harbor-media");
    const kind = card.getAttribute("data-harbor-media-kind");
    const name = card.getAttribute("data-harbor-media-title") || t("Title");
    if (!id || !["movie", "series", "anime", "manga"].includes(kind ?? "")) return;
    const poster = card.getAttribute("data-harbor-media-poster") || undefined;
    // The embedded link may carry a user-written label. Resolve the real title
    // on its detail page before offering state mutations against its identity.
    open(event, {
      kind: "actions",
      id: `embedded:${kind}:${id}`,
      label: name,
      image: poster ? { src: poster } : undefined,
      actions: () => [
        {
          id: `embedded:open:${id}`,
          label: t("View details"),
          run: () => {
            if (kind === "manga") openManga(id);
            else openMeta({ id, type: kind === "movie" ? "movie" : "series", name, poster });
          },
        },
      ],
    });
  };
}
