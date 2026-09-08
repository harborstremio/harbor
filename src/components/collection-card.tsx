import { Layers } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  collectionNameMatches,
  tmdbCollection,
  tmdbSearchCollectionId,
} from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { useContextMenu } from "@/lib/context-menu";

export function CollectionCard({
  id,
  name,
  knownBackdrop,
  knownCount,
}: {
  id: number;
  name: string;
  knownBackdrop?: string | null;
  knownCount?: number | null;
}) {
  const { settings } = useSettings();
  const { openCollection } = useView();
  const { open } = useContextMenu();
  const t = useT();
  const ref = useRef<HTMLButtonElement>(null);
  const [inView, setInView] = useState(false);
  const [backdrop, setBackdrop] = useState<string | null>(knownBackdrop ?? null);
  const [count, setCount] = useState<number | null>(knownCount ?? null);
  const [resolvedId, setResolvedId] = useState<number>(id);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "250px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    if (knownBackdrop && knownCount != null) return;
    let cancelled = false;
    void (async () => {
      let c = id > 0 ? await tmdbCollection(settings.tmdbKey, id).catch(() => null) : null;
      if (!c || (id <= 0 && !collectionNameMatches(c.name, name))) {
        const healedId = await tmdbSearchCollectionId(settings.tmdbKey, name).catch(() => null);
        if (healedId != null && healedId !== id) {
          c = await tmdbCollection(settings.tmdbKey, healedId).catch(() => null);
        }
      }
      if (cancelled || !c) return;
      setBackdrop(c.backdrop ?? null);
      setCount(c.parts.length);
      setResolvedId(c.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [inView, id, name, settings.tmdbKey, knownBackdrop, knownCount]);

  const hue = ((id || name.length * 37) * 47) % 360;
  const from = `oklch(0.42 0.13 ${hue})`;
  const to = `oklch(0.15 0.06 ${hue})`;

  return (
    <button
      ref={ref}
      type="button"
      onContextMenu={(event) =>
        open(event, {
          kind: "actions",
          id: `tmdb-collection:${resolvedId}`,
          label: name,
          image: backdrop
            ? {
                src: backdrop.replace("/t/p/original/", "/t/p/w780/"),
                originalSrc: backdrop,
                publicUrl: backdrop,
                label: name,
              }
            : undefined,
          actions: () => [
            {
              id: `tmdb-collection:open:${resolvedId}`,
              label: t("Open collection"),
              disabled: resolvedId <= 0,
              run: () => openCollection(resolvedId),
            },
          ],
        })
      }
      onClick={() => {
        if (resolvedId > 0) openCollection(resolvedId);
      }}
      className="group/card relative aspect-[16/9] w-full cursor-pointer overflow-hidden rounded-2xl border border-edge-soft text-start shadow-[0_4px_18px_-10px_rgba(0,0,0,0.5)] ring-1 ring-inset ring-white/0 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-edge hover:ring-white/15"
      style={{ background: `linear-gradient(140deg, ${from}, ${to})` }}
    >
      {backdrop && (
        <img
          src={backdrop.replace("/t/p/original/", "/t/p/w780/")}
          alt=""
          loading="lazy"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 data-[on=true]:opacity-100"
          onLoad={(e) => e.currentTarget.setAttribute("data-on", "true")}
        />
      )}
      <div
        aria-hidden
        className="absolute inset-0 bg-black/15 transition-colors duration-300 group-hover/card:bg-black/0"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/30 to-transparent"
      />
      <span className="absolute start-3.5 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/85 backdrop-blur-md">
        <Layers size={11} strokeWidth={2.4} />
        {count != null ? t("{count} films", { count }) : t("Collection")}
      </span>
      <h3 className="absolute inset-x-4 bottom-3.5 font-display text-[21px] font-medium leading-[1.08] tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)]">
        {name}
      </h3>
    </button>
  );
}
