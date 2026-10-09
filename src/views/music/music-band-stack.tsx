import { LazyMount } from "@/components/lazy-mount";
import {
  applyPageRows,
  movePageRow,
  orderedRowKeys,
  renamePageRow,
  togglePageRowHidden,
  type PageRowCustomization,
} from "@/lib/page-rows";
import { RowControls } from "@/views/home/row-controls";
import type { MusicBand } from "./music-band-types";

const EAGER_BANDS = 2;

export function MusicBandStack({
  bands,
  custom,
  editMode,
  onPersist,
}: {
  bands: MusicBand[];
  custom: PageRowCustomization;
  editMode: boolean;
  onPersist: (next: PageRowCustomization) => void;
}) {
  const allKeys = bands.map((band) => band.key);
  const display = applyPageRows(bands, custom, editMode);
  const orderKeys = orderedRowKeys(allKeys, custom);

  return (
    <>
      {display.map((band, index) => {
        const hidden = custom.hidden.includes(band.key);
        if (hidden && !editMode) return null;
        const at = orderKeys.indexOf(band.key);
        const node = band.render(band.title);
        return (
          <div key={band.key} data-scroll-anchor={`row:${band.key}`}>
            {editMode && (
              <RowControls
                name={band.title}
                hidden={hidden}
                canMoveUp={at > 0}
                canMoveDown={at >= 0 && at < orderKeys.length - 1}
                onMoveUp={() => onPersist(movePageRow(custom, allKeys, band.key, -1))}
                onMoveDown={() => onPersist(movePageRow(custom, allKeys, band.key, 1))}
                onToggleHidden={() => onPersist(togglePageRowHidden(custom, band.key))}
                onRename={(label) => onPersist(renamePageRow(custom, band.key, label))}
                onResetName={() => onPersist(renamePageRow(custom, band.key, ""))}
                isRenamed={band.key in custom.renamed}
              />
            )}
            {!hidden &&
              (index < EAGER_BANDS ? node : <LazyMount minHeight={280}>{node}</LazyMount>)}
          </div>
        );
      })}
    </>
  );
}
