import { useState } from "react";
import { useT } from "@/lib/i18n";
import { useSubTabs } from "./sub-tabs";
import { HomeTab } from "./library-panel/home-tab";
import { CardsTab } from "./library-panel/cards-tab";
import { DetailTab } from "./library-panel/detail-tab";
import { ProvidersTab } from "./library-panel/providers-tab";
import { AiTab } from "./library-panel/ai-tab";
import { LibraryTab } from "./library-panel/library-tab";

export type LibraryKey = "tmdb" | "omdb" | "rpdb" | "fanart" | "tvdb";

type Tab = "home" | "cards" | "detail" | "providers" | "ai" | "library";

export function LibraryPanel({
  tmdbDraft,
  omdbDraft,
  rpdbDraft,
  fanartDraft,
  tvdbDraft,
  setTmdbDraft,
  setOmdbDraft,
  setRpdbDraft,
  setFanartDraft,
  setTvdbDraft,
  savedKey,
  saveKey,
}: {
  tmdbDraft: string;
  omdbDraft: string;
  rpdbDraft: string;
  fanartDraft: string;
  tvdbDraft: string;
  setTmdbDraft: (v: string) => void;
  setOmdbDraft: (v: string) => void;
  setRpdbDraft: (v: string) => void;
  setFanartDraft: (v: string) => void;
  setTvdbDraft: (v: string) => void;
  savedKey: string | null;
  saveKey: (which: LibraryKey, value: string) => void;
}) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("home");
  const tabs = [
    { id: "home" as const, label: t("Home") },
    { id: "cards" as const, label: t("Cards") },
    { id: "detail" as const, label: t("Detail pages") },
    { id: "providers" as const, label: t("Metadata") },
    { id: "ai" as const, label: t("AI search") },
    { id: "library" as const, label: t("Library") },
  ];
  useSubTabs(tabs, tab, (id) => setTab(id as Tab));
  return (
    <>
      <div key={tab} className="harbor-cascade flex flex-col gap-10">
        {tab === "home" && <HomeTab />}
        {tab === "cards" && <CardsTab />}
        {tab === "detail" && <DetailTab />}
        {tab === "providers" && (
          <ProvidersTab
            tmdbDraft={tmdbDraft}
            omdbDraft={omdbDraft}
            rpdbDraft={rpdbDraft}
            fanartDraft={fanartDraft}
            tvdbDraft={tvdbDraft}
            setTmdbDraft={setTmdbDraft}
            setOmdbDraft={setOmdbDraft}
            setRpdbDraft={setRpdbDraft}
            setFanartDraft={setFanartDraft}
            setTvdbDraft={setTvdbDraft}
            savedKey={savedKey}
            saveKey={saveKey}
          />
        )}
        {tab === "ai" && <AiTab />}
        {tab === "library" && <LibraryTab />}
      </div>
    </>
  );
}
