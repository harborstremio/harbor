import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { PickCard } from "@/components/pick-card";
import { Row } from "@/components/row";
import type { Meta } from "@/lib/cinemeta";
import { tmdbCollection } from "@/lib/providers/tmdb";
import { useActiveKid } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { dropAdultContent, dropUnreleased } from "@/views/kids/kids-filter";

export function CollectionRow({
  collection,
  currentId,
}: {
  collection: { id: number; name: string };
  currentId: string;
}) {
  const { settings } = useSettings();
  const { openCollection } = useView();
  const kid = useActiveKid();
  const [parts, setParts] = useState<Meta[]>([]);

  useEffect(() => {
    if (!settings.tmdbKey) return;
    let cancelled = false;
    setParts([]);
    tmdbCollection(settings.tmdbKey, collection.id)
      .then((c) => {
        if (cancelled || !c) return;
        const rest = c.parts.filter((p) => p.id !== currentId);
        setParts(kid ? dropAdultContent(dropUnreleased(rest)) : rest);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [settings.tmdbKey, collection.id, currentId, kid]);

  if (parts.length === 0) return null;

  return (
    <Row
      scrollKey={`collection-${collection.id}`}
      title={
        <button
          onClick={() => openCollection(collection.id)}
          className="group inline-flex items-center gap-1.5 text-start transition-colors hover:text-ink"
        >
          {collection.name}
          <ChevronRight
            size={18}
            strokeWidth={2.4}
            className="dir-icon text-ink-subtle transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
          />
        </button>
      }
    >
      {parts.map((m) => (
        <PickCard key={m.id} meta={m} kids={!!kid} />
      ))}
    </Row>
  );
}
