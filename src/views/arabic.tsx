import { BackToTop } from "@/components/back-to-top";
import { FeedShelf } from "@/components/feed-shelf";
import { LazyMount } from "@/components/lazy-mount";
import { ScrollRootContext } from "@/components/row";
import { ARABIC_ROWS } from "@/lib/arabic";
import { isRtl, useT, useUiLanguage } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useScrollMemory } from "@/lib/view";
import { useCallback, useRef, useState } from "react";

import { HubHeader } from "./arabic/hub-header";
import { useArabicRows } from "./arabic/use-arabic-rows";

export function ArabicHub({ active = true }: { active?: boolean }) {
  const t = useT();
  const rtl = isRtl(useUiLanguage());
  const { settings } = useSettings();
  const scrollRef = useRef<HTMLElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const scrollCb = useCallback((el: HTMLElement | null) => {
    (scrollRef as { current: HTMLElement | null }).current = el;
    setScrollEl(el);
  }, []);
  useScrollMemory("arabic", scrollRef, active);

  const { rows, loadMore } = useArabicRows(settings.tmdbKey);

  return (
    <main ref={scrollCb} dir={rtl ? "rtl" : "ltr"} className="flex-1 overflow-y-auto px-12 pb-20 pt-20">
      <ScrollRootContext.Provider value={scrollEl}>
        <div className="flex flex-col gap-14">
          <HubHeader rtl={rtl} />

          {!settings.tmdbKey && (
            <p className="text-[13.5px] text-ink-subtle">
              <bdi>{t("Add a TMDB key in Settings to load Arabic content.")}</bdi>
            </p>
          )}

          {ARABIC_ROWS.map((def) => (
            <LazyMount key={def.id} minHeight={340}>
              <FeedShelf
                shelf={{ id: def.id, title: t(def.titleKey), kicker: def.english }}
                items={rows[def.id] ?? null}
                scrollKey={`arabic:${def.id}`}
                onEndReached={() => loadMore(def.id)}
              />
            </LazyMount>
          ))}
        </div>
      </ScrollRootContext.Provider>
      <BackToTop scrollRef={scrollRef} />
    </main>
  );
}

export { ArabicHub as ArabicHubView };
export default ArabicHub;
