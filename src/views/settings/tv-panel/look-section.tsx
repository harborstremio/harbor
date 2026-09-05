import { useT } from "@/lib/i18n";
import { Section } from "../shared";
import { SettingRow } from "../kit";
import { readRow, type TvDoc, type TvRow } from "./model";
import { SUB_LOOK_GROUP, SUB_PRESETS, matchesPreset } from "./model-look";
import { TvRowControl } from "./sections";
import { SubPreview } from "./sub-preview";
import { writeTvLayout } from "./store";

const EDGE_ROW: TvRow = { kind: "choice", key: "subLookEdge", label: "", def: "Shadow", options: [] };
const BOX_ONLY = new Set(["subLookBoxTint", "subLookBoxOpacity"]);
const STROKE_ONLY = new Set(["subLookEdgeTint", "subLookOutline"]);

export function TvSubLookSection({ profileId, doc }: { profileId: string; doc: TvDoc }) {
  const t = useT();
  const edge = readRow(doc, EDGE_ROW);
  const boxed = edge === "Box";
  const rows = SUB_LOOK_GROUP.rows.filter((r) =>
    boxed ? !STROKE_ONLY.has(r.key) : !BOX_ONLY.has(r.key),
  );

  return (
    <Section
      title={SUB_LOOK_GROUP.title}
      subtitle={SUB_LOOK_GROUP.subtitle}
      newId="tv:subtitle-look"
    >
      <SubPreview doc={doc} />

      <SettingRow wide label={t("Start from a look")}>
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          {SUB_PRESETS.map((p) => {
            const on = matchesPreset(doc, p);
            return (
              <button
                key={p.id}
                type="button"
                title={t(p.note)}
                onClick={() => writeTvLayout(profileId, p.values)}
                className={`flex h-11 items-center rounded-full px-4 text-[15px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  on ? "bg-ink text-canvas" : "bg-canvas text-ink-muted hover:text-ink"
                }`}
              >
                {t(p.label)}
              </button>
            );
          })}
        </div>
      </SettingRow>

      {rows.map((row) => (
        <TvRowControl
          key={row.key}
          group={SUB_LOOK_GROUP}
          row={row}
          doc={doc}
          profileId={profileId}
        />
      ))}
    </Section>
  );
}
