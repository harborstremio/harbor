import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { PersonPanel } from "@/components/player/cast-modal/person-panel";
import { TitlePanel } from "@/components/player/cast-modal/title-panel";
import { CollectionPane } from "./collection-pane";

export type ExploreFrame =
  | { kind: "title"; meta: Meta }
  | { kind: "person"; id: number; name: string }
  | { kind: "collection"; id: number; name: string; image: string | null };

export function ExplorePane({
  frame,
  depth,
  tmdbKey,
  onBack,
  onOpenPerson,
  onOpenTitle,
  onOpenDetail,
  onOpenPersonDetail,
  onOpenMusic,
}: {
  frame: ExploreFrame;
  depth: number;
  tmdbKey: string;
  onBack: () => void;
  onOpenPerson: (id: number, name: string) => void;
  onOpenTitle: (m: Meta) => void;
  onOpenDetail: (m: Meta) => void;
  onOpenPersonDetail: (id: number) => void;
  onOpenMusic?: (query: string) => void;
}) {
  const t = useT();
  const [backdrop, setBackdrop] = useState<string | null>(
    frame.kind === "title"
      ? frame.meta.background ?? null
      : frame.kind === "collection"
        ? frame.image
        : null,
  );
  return (
    <div className="flex flex-col">
      {frame.kind !== "person" && backdrop && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[400px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_40%,transparent_100%)]"
        >
          <img
            src={backdrop}
            alt=""
            draggable={false}
            className="h-full w-full object-cover object-[center_20%] opacity-50"
          />
          <div className="absolute inset-0 bg-black/35" />
        </div>
      )}
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-3.5 text-[12.5px] font-semibold text-white/85 backdrop-blur-sm transition-colors hover:border-white/30 hover:bg-black/45 hover:text-white"
        >
          <ArrowLeft size={14} strokeWidth={2.4} className="dir-icon" />
          {depth > 1 ? t("Back") : t("Back to results")}
        </button>
        {frame.kind === "person" && (
          <button
            type="button"
            onClick={() => onOpenPersonDetail(frame.id)}
            className="flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-3.5 text-[12.5px] font-semibold text-white/85 backdrop-blur-sm transition-colors hover:border-white/30 hover:bg-black/45 hover:text-white"
          >
            {t("View details")}
            <ArrowRight size={14} strokeWidth={2.4} className="dir-icon" />
          </button>
        )}
      </div>
      {frame.kind === "person" ? (
        <PersonPanel
          personId={frame.id}
          name={frame.name}
          tmdbKey={tmdbKey || null}
          onOpenTitle={onOpenTitle}
          onOpenMusic={onOpenMusic}
        />
      ) : frame.kind === "collection" ? (
        <CollectionPane
          id={frame.id}
          name={frame.name}
          image={frame.image}
          onOpenTitle={onOpenTitle}
          onBackdrop={setBackdrop}
        />
      ) : (
        <TitlePanel
          meta={frame.meta}
          tmdbKey={tmdbKey || null}
          showQueue={false}
          onBackdrop={setBackdrop}
          onOpenPerson={onOpenPerson}
          onOpenTitle={onOpenTitle}
          onOpenDetail={onOpenDetail}
        />
      )}
    </div>
  );
}
