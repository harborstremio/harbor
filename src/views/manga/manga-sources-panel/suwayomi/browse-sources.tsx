import { useState } from "react";
import type { ServerConfig, SuwayomiSource } from "@/lib/manga/sources/suwayomi/provider";
import type { MangaSummary } from "@/lib/manga/types";
import { BrowseResults } from "./browse-results";
import { SourcePicker } from "./source-picker";

export function BrowseSources({
  config,
  onOpen,
}: {
  config: ServerConfig;
  onOpen?: (item: MangaSummary) => void;
}) {
  const [picked, setPicked] = useState<SuwayomiSource | null>(null);

  if (picked) {
    return (
      <BrowseResults
        config={config}
        source={picked}
        onBack={() => setPicked(null)}
        onOpen={onOpen}
      />
    );
  }
  return <SourcePicker config={config} onPick={setPicked} />;
}
