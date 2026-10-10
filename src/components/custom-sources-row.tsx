import { Row } from "./row";
import { SourceFolderCard } from "./source-folder-card";
import type { SourceRow } from "@/lib/custom-sources";

export function CustomSourcesRow({
  sourceRow,
  editMode,
  onEditFolderImages,
}: {
  sourceRow: SourceRow;
  editMode?: boolean;
  onEditFolderImages?: (sourceId: string, folderId: string, cover: string, gif: string) => void;
}) {
  if (!sourceRow.folders || sourceRow.folders.length === 0) return null;

  const isPoster = sourceRow.folders[0]?.tileShape === "POSTER";

  return (
    <Row
      title={sourceRow.title}
      min={isPoster ? 160 : 320}
      shape={isPoster ? "portrait" : "landscape"}
      scrollKey={`home:source:${sourceRow.id}`}
    >
      {sourceRow.folders.map((folder, index) => (
        <div key={`${folder.id}-${index}`} className={isPoster ? "w-[160px]" : "w-[320px]"}>
          <SourceFolderCard
            folder={folder}
            editMode={editMode}
            sourceId={sourceRow.id}
            onEditFolderImages={onEditFolderImages}
          />
        </div>
      ))}
    </Row>
  );
}
