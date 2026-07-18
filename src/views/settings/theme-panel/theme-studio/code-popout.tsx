import { BookOpen, Check, Copy, Download, Play, Redo2, Undo2 } from "lucide-react";
import { useState } from "react";
import { CodeEditor, type CodeLang } from "@/components/code-editor";
import { downloadText } from "@/lib/download-text";
import { CheatSheet } from "./cheat-sheet";
import { FileTree } from "./code-popout/file-tree";
import { IDE, THEME_FILES } from "./code-popout/files";
import { StatusBar } from "./code-popout/status-bar";

export function CodePopout({
  css,
  html,
  js,
  themeName,
  initialTab,
  onChange,
  onRunJs,
  onClose,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: {
  css: string;
  html: string;
  js: string;
  themeName: string;
  initialTab: CodeLang;
  onChange: (patch: { css?: string; html?: string; js?: string }) => void;
  onRunJs: () => void;
  onClose: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}) {
  const [tab, setTab] = useState<CodeLang>(initialTab);
  const [caret, setCaret] = useState({ line: 1, col: 1 });
  const [copied, setCopied] = useState(false);
  const [cheatOpen, setCheatOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const requestClose = () => {
    setClosing(true);
    window.setTimeout(onClose, 150);
  };
  const values: Record<CodeLang, string> = { css, html, js };
  const value = values[tab];
  const meta = THEME_FILES.find((f) => f.id === tab) ?? THEME_FILES[0];
  const lengths = { css: css.length, html: html.length, js: js.length };

  const download = (id: CodeLang) => {
    const f = THEME_FILES.find((x) => x.id === id);
    if (f) void downloadText(f.name, values[id], [f.id], "Harbor theme");
  };

  const copy = () => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1300);
  };

  return (
    <div
      className={`pointer-events-auto fixed inset-0 z-[230] flex flex-col ${
        closing ? "animate-[editorOut_150ms_ease-in_forwards]" : "animate-[editorIn_220ms_ease-out]"
      }`}
      style={{ background: IDE.overlay, color: IDE.text }}
    >
      <header
        className="flex h-14 shrink-0 items-center gap-3 px-4"
        style={{ background: IDE.panel, borderBottom: `1px solid ${IDE.border}` }}
      >
        <span className="flex items-center gap-2 text-[14px]">
          <span style={{ color: IDE.textDim }}>{themeName}</span>
          <span style={{ color: IDE.textFaint }}>/</span>
          <span className="font-semibold" style={{ color: IDE.text }}>
            Code
          </span>
        </span>
        <button
          type="button"
          onClick={requestClose}
          className="ms-auto flex h-10 items-center rounded-lg px-5 text-[14.5px] font-semibold transition-opacity hover:opacity-90"
          style={{ background: IDE.accent, color: IDE.overlay }}
        >
          Done
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <FileTree
          files={THEME_FILES}
          active={tab}
          lengths={lengths}
          projectName={themeName}
          onSelect={setTab}
          onDownload={download}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className="flex h-12 shrink-0 items-center"
            style={{ background: IDE.panel, borderBottom: `1px solid ${IDE.border}` }}
          >
            <div className="flex h-full items-stretch">
              {THEME_FILES.map((f) => {
                const Icon = f.icon;
                const on = f.id === tab;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTab(f.id)}
                    className="flex items-center gap-2 px-4 text-[14px] transition-colors"
                    style={{
                      background: on ? IDE.editor : "transparent",
                      borderRight: `1px solid ${IDE.border}`,
                      borderTop: on ? `2px solid ${IDE.accent}` : "2px solid transparent",
                      color: on ? "#fff" : IDE.textDim,
                      fontWeight: on ? 600 : 500,
                    }}
                  >
                    <Icon size={17} strokeWidth={2} style={{ color: f.tint }} />
                    {f.name}
                  </button>
                );
              })}
            </div>

            <div className="ms-auto flex items-center gap-1.5 pe-3">
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                title="Undo (Ctrl/Cmd + Z)"
                className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-30"
                style={{ color: IDE.textDim }}
              >
                <Undo2 size={16} strokeWidth={2.2} />
              </button>
              <button
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                title="Redo (Ctrl/Cmd + Shift + Z)"
                className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-30"
                style={{ color: IDE.textDim }}
              >
                <Redo2 size={16} strokeWidth={2.2} />
              </button>
              <span className="mx-0.5 h-5 w-px" style={{ background: IDE.border }} />
              <button
                type="button"
                onClick={() => setCheatOpen(true)}
                className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-medium transition-colors hover:bg-white/10"
                style={{ color: IDE.textDim }}
              >
                <BookOpen size={15} strokeWidth={2.2} />
                Cheat sheet
              </button>
              {tab === "js" && (
                <button
                  type="button"
                  onClick={onRunJs}
                  disabled={!value.trim()}
                  className="flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13.5px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-30"
                  style={{ background: "#98c379", color: IDE.overlay }}
                >
                  <Play size={14} strokeWidth={2.6} fill="currentColor" />
                  Run
                </button>
              )}
              <button
                type="button"
                onClick={copy}
                className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-medium transition-colors hover:bg-white/10"
                style={{ color: copied ? "#98c379" : IDE.textDim }}
              >
                {copied ? (
                  <Check size={15} strokeWidth={2.6} />
                ) : (
                  <Copy size={15} strokeWidth={2.2} />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={() => download(tab)}
                className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-medium transition-colors hover:bg-white/10"
                style={{ color: IDE.textDim }}
              >
                <Download size={15} strokeWidth={2.2} />
                Download
              </button>
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            <CodeEditor
              key={tab}
              value={value}
              onChange={(v) => onChange({ [tab]: v })}
              language={tab}
              autoFocus
              onCaret={(line, col) => setCaret({ line, col })}
              className="h-full"
            />
            {!value && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="text-[14px]" style={{ color: IDE.textFaint }}>
                  {meta.name} is empty. Start typing to restyle Harbor.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <StatusBar
        file={meta}
        line={caret.line}
        col={caret.col}
        lines={value.split("\n").length}
        chars={value.length}
      />

      {cheatOpen && <CheatSheet onClose={() => setCheatOpen(false)} />}
    </div>
  );
}
