import { useSettings } from "@/lib/settings";
import type { MetaFilter } from "@/lib/view";
import { useMemo } from "react";

import { CinemetaFallback } from "./cinemeta-fallback";
import { RailSection } from "./rail-section";
import { railsForFilter } from "./rails-config";
import { SpotlightSection } from "./spotlight-section";
import { TopicSection } from "./topic-section";

export function Rails({ filter }: { filter: MetaFilter }) {
  const { settings } = useSettings();
  const rails = useMemo(() => railsForFilter(filter), [filter]);
  if (!settings.tmdbKey) {
    return <CinemetaFallback filter={filter} />;
  }
  return (
    <>
      {rails.map((r) => {
        if (r.kind === "spotlight") {
          return <SpotlightSection key={r.id} spotlight={r.spotlight} genreId={r.genreId} />;
        }
        if (r.kind === "topic") {
          return <TopicSection key={r.id} topic={r.topic} mediaType={r.mediaType} />;
        }
        return <RailSection key={r.id} filter={filter} rail={r} />;
      })}
    </>
  );
}
