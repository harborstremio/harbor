import { useT } from "@/lib/i18n";
import { Section } from "../shared";
import { SettingRow, SettingsWorkbench } from "../kit";
import { readRow, type TvDoc, type TvRow } from "./model";
import { SUB_LOOK_GROUP, SUB_PRESETS, SUB_TINTS, matchesPreset } from "./model-look";
import { TvRowControl } from "./sections";
import { SubPreview } from "./sub-preview";
import { writeTvLayout } from "./store";

const EDGE_ROW: TvRow = { kind: "choice", key: "subLookEdge", label: "", def: "Shadow", options: [] };
const BOX_ONLY = new Set(["subLookBoxTint", "subLookBoxOpacity"]);
const STROKE_ONLY = new Set(["subLookEdgeTint", "subLookOutline"]);
const TINT_KEYS = new Set(["subLookTint", "subLookEdgeTint", "subLookBoxTint"]);

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
      <SettingsWorkbench compact preview={<SubPreview doc={doc} />}>
      <SettingRow wide label={t("Start from a look")}>
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          {SUB_PRESETS.map((p) => {
            const on = matchesPreset(doc, p);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
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

      {rows.map((row) => TINT_KEYS.has(row.key) ? (
        <SettingRow key={row.key} wide label={t(row.label)}>
          <div className="grid w-full grid-cols-4 gap-2">
            {SUB_TINTS.map((tint) => {
              const selected = readRow(doc, row) === tint.value;
              return (
                <button
                  key={tint.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => writeTvLayout(profileId, { [row.key]: tint.value })}
                  className={`flex min-h-11 items-center gap-2.5 rounded-[8px] border px-3 py-2 text-start text-[14px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${selected ? "border-accent bg-accent/10 text-ink" : "border-edge-soft text-ink-muted hover:bg-elevated hover:text-ink"}`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-black/15" style={{ background: tint.css }} aria-hidden>
                    {selected && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="m2 6 2.5 2.5L10 3" stroke={tint.value === "Black" ? "white" : "#151515"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </span>
                  {t(tint.label)}
                </button>
              );
            })}
          </div>
        </SettingRow>
      ) : (
        <TvRowControl
          key={row.key}
          group={SUB_LOOK_GROUP}
          row={row}
          doc={doc}
          profileId={profileId}
        />
      ))}
      </SettingsWorkbench>
    </Section>
  );
}
