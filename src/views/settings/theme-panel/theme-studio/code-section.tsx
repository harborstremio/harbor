import { BookOpen, Code2 } from "lucide-react";
import { useState } from "react";
import type { CodeLang } from "@/components/code-editor";
import { useT } from "@/lib/i18n";
import { CheatSheet } from "./cheat-sheet";

export function CodeSection({
  css,
  js,
  html,
  onExpand,
}: {
  css: string;
  js: string;
  html: string;
  onExpand: (tab: CodeLang) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const t = useT();
  const anyCode = !!(css.trim() || html.trim() || js.trim());

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => onExpand("css")}
        className="flex h-14 items-center justify-center gap-2.5 rounded-md bg-ink text-[15px] font-semibold text-canvas transition-opacity hover:opacity-90"
      >
        <Code2 size={18} strokeWidth={2.2} />
        {t("Open code editor")}
      </button>

      <div className="flex min-h-[68px] items-center justify-between gap-4 py-2">
        <span className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">
          {anyCode
            ? t("CSS {css} · HTML {html} · JS {js}", {
                css: css.length.toLocaleString(),
                html: html.length.toLocaleString(),
                js: js.length.toLocaleString(),
              })
            : t("No custom code yet.")}
        </span>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-md px-3.5 text-[15.5px] font-semibold text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          <BookOpen size={16} strokeWidth={2.2} />
          {t("Cheat sheet")}
        </button>
      </div>

      {sheetOpen && <CheatSheet onClose={() => setSheetOpen(false)} />}
    </div>
  );
}
