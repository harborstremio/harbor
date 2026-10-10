import { useEffect, useMemo, useState } from "react";
import { useSettings } from "@/lib/settings";
import { observeWithin } from "@/lib/visibility";
import { profileTitleId, profileTitleMeta } from "./profile-title-meta";

/** Shared profile snapshots retain their owner's metadata; resolve visible titles for the viewer. */
export function useProfileTitle(
  id: string | undefined,
  title: string | undefined,
  poster: string | undefined,
  mediaType?: string,
) {
  const { settings } = useSettings();
  const [element, ref] = useState<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const imageLanguages = (settings.tmdbImageLangs ?? []).join(",");
  const request = useMemo(
    () => ({
      id: profileTitleId(id, mediaType),
      key: settings.tmdbKey,
      language: settings.translateTitles ? settings.tmdbLanguage || "en" : "en-US",
      translate: settings.translateTitles,
      imageLanguages,
    }),
    [id, mediaType, settings.tmdbKey, settings.tmdbLanguage, settings.translateTitles, imageLanguages],
  );
  const [resolved, setResolved] = useState<{
    request: typeof request;
    title?: string;
    poster?: string;
  } | null>(null);

  useEffect(() => {
    if (!element) return;
    return observeWithin(element, "100px", (entry) => setVisible(entry.isIntersecting));
  }, [element]);

  useEffect(() => {
    if (!visible || !request.id || !request.key) return;
    let alive = true;
    void profileTitleMeta(request.key, request.id, request.language, request.translate)
      .then((value) => {
        if (alive) setResolved({ request, ...value });
      })
      .catch(() => {
        /* Keep the published snapshot when metadata is unavailable. */
      });
    return () => { alive = false; };
  }, [visible, request]);

  const current = resolved?.request === request ? resolved : null;
  return { ref, title: current?.title || title, poster: current?.poster || poster };
}
