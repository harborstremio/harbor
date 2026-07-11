import type { CodeLang } from "@/components/code-editor";
import { BookOpen, Code2 } from "lucide-react";
import { useState } from "react";

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
  const anyCode = !!(css.trim() || html.trim() || js.trim());

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => onExpand("css")}
        className="flex h-14 items-center justify-center gap-2.5 rounded-lg bg-ink text-[15px] font-semibold text-canvas transition-opacity hover:opacity-90"
      >
        <Code2 size={18} strokeWidth={2.2} />
        Open code editor
      </button>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-edge-soft bg-elevated/15 px-4 py-3">
        <span className="text-[13px] text-ink-muted">
          {anyCode
            ? `CSS ${css.length.toLocaleString()} · HTML ${html.length.toLocaleString()} · JS ${js.length.toLocaleString()}`
            : "No custom code yet."}
        </span>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-edge-soft px-3.5 text-[14px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
        >
          <BookOpen size={16} strokeWidth={2.2} />
          Cheat sheet
        </button>
      </div>

      {sheetOpen && <CheatSheet onClose={() => setSheetOpen(false)} />}
    </div>
  );
}
