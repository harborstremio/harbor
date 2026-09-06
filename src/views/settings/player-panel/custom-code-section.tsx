import { AlertTriangle, ChevronDown, Eraser } from "../icons";
import { useState } from "react";
import { useSettings, type Settings } from "@/lib/settings";
import { Section } from "../shared";
import { ROW_ACTION, ROW_DESC } from "../kit";
import { SRow } from "../ui";
import { SubField } from "./internals";
import { useT } from "@/lib/i18n";

type Field = "customCss" | "customJs" | "customHtml";

const FIELDS: Array<{
  id: Field;
  label: string;
  placeholder: string;
  hint: string;
  rows: number;
}> = [
  {
    id: "customCss",
    label: "Custom CSS",
    placeholder:
      "/* override anything */\n.harbor-seek-fill { box-shadow: 0 0 12px var(--color-accent); }",
    hint: "Live-injected into the document. Use it to retheme buttons, change spacing, recolor anything.",
    rows: 7,
  },
  {
    id: "customJs",
    label: "Custom JS",
    placeholder:
      "// runs once whenever this field changes\nconsole.log('hello from your script');",
    hint: "Runs in the app's WebView. You're modding your own client. No sandbox, no safety net. Errors land in the console.",
    rows: 7,
  },
  {
    id: "customHtml",
    label: "Custom HTML overlay",
    placeholder: '<div style="position:fixed;bottom:12px;inset-inline-end:12px">hello</div>',
    hint: "Injected into a fixed-position layer above the app (pointer-events disabled by default). Wrap in a div with pointer-events:auto to make it interactive.",
    rows: 5,
  },
];

export function CustomCodeCard() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <Section
      title={t("Custom code")}
      subtitle={t(
        "Power-user knob. Inject your own CSS, JS, and HTML into Harbor. Lives in your local settings; nothing leaves your machine.",
      )}
    >
      <SRow
        title={open ? t("Hide the code editors") : t("Show the code editors")}
        description={t(
          "Opens three editors for CSS, JavaScript, and an HTML overlay. Changes apply as you type.",
        )}
        onClick={() => setOpen((v) => !v)}
        trailing={
          <ChevronDown
            size={18}
            strokeWidth={2}
            className={`text-ink-subtle transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        }
      />
      {open && <CustomCodePanel />}
    </Section>
  );
}

export function CustomCodePanel() {
  const t = useT();
  const { settings, update } = useSettings();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-2.5 rounded-[10px] bg-elevated px-4 py-3">
        <AlertTriangle size={18} strokeWidth={2.2} className="mt-[2px] shrink-0 text-danger" />
        <p className={`max-w-[66ch] ${ROW_DESC}`}>
          {t("You're modding your own client. Custom JS has full access to your Harbor session. Only paste code you wrote or fully trust.")}
        </p>
      </div>

      {FIELDS.map((f) => (
        <SubField
          key={f.id}
          label={t(f.label)}
          value={t("{n} chars", { n: String((settings[f.id] ?? "").length) })}
        >
          <textarea
            value={settings[f.id] ?? ""}
            onChange={(e) => update({ [f.id]: e.target.value } as Partial<Settings>)}
            placeholder={f.placeholder}
            rows={f.rows}
            spellCheck={false}
            className="w-full resize-y rounded-[10px] border border-edge-soft bg-elevated px-4 py-3 font-mono text-[15.5px] leading-[22px] text-ink outline-none transition-colors placeholder:text-ink-subtle/55 focus-visible:border-edge focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <span className={`max-w-[70ch] ${ROW_DESC}`}>{t(f.hint)}</span>
            <button
              type="button"
              onClick={
                settings[f.id] ? () => update({ [f.id]: "" } as Partial<Settings>) : undefined
              }
              aria-disabled={!settings[f.id]}
              className={`${ROW_ACTION}${settings[f.id] ? "" : " pointer-events-none opacity-45"}`}
            >
              <Eraser size={16} strokeWidth={2.4} />
              {t("Clear")}
            </button>
          </div>
        </SubField>
      ))}
    </div>
  );
}
