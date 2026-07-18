import { AlertTriangle, ChevronDown, Eraser } from "lucide-react";
import { useState } from "react";
import { useSettings, type Settings } from "@/lib/settings";
import { settingsAnchor } from "../shared";
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
    placeholder: "/* override anything */\n.harbor-seek-fill { box-shadow: 0 0 12px #ffca3a; }",
    hint: "Live-injected into the document. Use it to retheme buttons, change spacing, recolor anything.",
    rows: 7,
  },
  {
    id: "customJs",
    label: "Custom JS",
    placeholder: "// runs once whenever this field changes\nconsole.log('hello from your script');",
    hint: "Runs in the app's WebView. You're modding your own client. No sandbox, no safety net. Errors land in the console.",
    rows: 7,
  },
  {
    id: "customHtml",
    label: "Custom HTML overlay",
    placeholder: '<div style="position:fixed;bottom:12px;right:12px">hello</div>',
    hint: "Injected into a fixed-position layer above the app (pointer-events disabled by default). Wrap in a div with pointer-events:auto to make it interactive.",
    rows: 5,
  },
];

export function CustomCodeCard() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <section
      id={settingsAnchor("Custom code")}
      className="scroll-mt-28 flex flex-col gap-4 rounded-2xl border border-edge-soft bg-elevated/40 p-7"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-start justify-between gap-3 text-start"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-[19px] font-medium tracking-tight text-ink">{t("Custom code")}</h2>
          <span className="text-[13.5px] leading-relaxed text-ink-muted">
            {t(
              "Power-user knob. Inject your own CSS, JS, and HTML into Harbor. Lives in your local settings; nothing leaves your machine.",
            )}
          </span>
        </div>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-edge text-ink-muted transition-colors hover:bg-elevated hover:text-ink">
          <ChevronDown
            size={14}
            strokeWidth={2}
            className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      {open && <CustomCodePanel />}
    </section>
  );
}

export function CustomCodePanel() {
  const t = useT();
  const { settings, update } = useSettings();

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-3 text-[12px] leading-snug text-ink">
        <AlertTriangle size={14} strokeWidth={2.2} className="mt-0.5 shrink-0 text-danger" />
        <span>
          {t(
            "You're modding your own client. Custom JS has full access to your Harbor session. Only paste code you wrote or fully trust.",
          )}
        </span>
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
            className="w-full resize-y rounded-xl border border-edge-soft bg-canvas/40 px-3 py-2.5 font-mono text-[12px] leading-relaxed text-ink placeholder:text-ink-subtle/70 focus:border-edge focus:outline-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] leading-snug text-ink-subtle">{t(f.hint)}</span>
            {settings[f.id] && (
              <button
                type="button"
                onClick={() => update({ [f.id]: "" } as Partial<Settings>)}
                className="flex h-7 items-center gap-1 rounded-full bg-raised px-2.5 text-[11px] font-semibold text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
              >
                <Eraser size={11} strokeWidth={2.4} />
                {t("Clear")}
              </button>
            )}
          </div>
        </SubField>
      ))}
    </div>
  );
}
