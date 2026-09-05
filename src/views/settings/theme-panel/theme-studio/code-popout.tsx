import { BookOpen, Check, Copy, Download, Play, Redo2, Undo2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CodeEditor, type CodeLang } from "@/components/code-editor";
import { downloadText } from "@/lib/download-text";
import { useT } from "@/lib/i18n";
import { tvFocus } from "@/lib/keyboard-navigation";
import { isBackKey } from "@/lib/keyboard-navigation/geometry";
import { useSettings } from "@/lib/settings";
import { CheatSheet } from "./cheat-sheet";
import { FileTree } from "./code-popout/file-tree";
import { THEME_FILES } from "./code-popout/files";
import { StatusBar } from "./code-popout/status-bar";
import { SUITE_CHROME } from "./suite-theme";

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
  const t = useT();
  const { settings } = useSettings();
  const tvNav = settings.tvNavigation;
  const [tab, setTab] = useState<CodeLang>(initialTab);
  const [caret, setCaret] = useState({ line: 1, col: 1 });
  const [copied, setCopied] = useState(false);
  const [cheatOpen, setCheatOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const doneRef = useRef<HTMLButtonElement>(null);
  const requestClose = () => {
    setClosing(true);
    window.setTimeout(onClose, 150);
  };
  const closeRef = useRef(requestClose);
  closeRef.current = requestClose;

  useEffect(() => {
    if (tvNav && doneRef.current) tvFocus(doneRef.current);
  }, [tvNav]);

  useEffect(() => {
    if (cheatOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (!isBackKey(e)) return;
      if (document.querySelector("[data-search-editing]")) return;
      e.preventDefault();
      e.stopPropagation();
      closeRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [cheatOpen]);
  const values: Record<CodeLang, string> = { css, html, js };
  const value = values[tab];
  const meta = THEME_FILES.find((f) => f.id === tab) ?? THEME_FILES[0];
  const lengths = { css: css.length, html: html.length, js: js.length };

  const download = (id: CodeLang) => {
    const f = THEME_FILES.find((x) => x.id === id);
    if (f) void downloadText(f.name, values[id], [f.id], t("Harbor theme"));
  };

  const copy = () => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1300);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("Code")}
      style={SUITE_CHROME}
      className={`pointer-events-auto fixed inset-0 z-[244] flex flex-col bg-surface text-ink-muted ${
        closing ? "animate-[editorOut_150ms_ease-in_forwards]" : "animate-[editorIn_220ms_ease-out]"
      }`}
    >
      <header className="flex shrink-0 items-start gap-4 px-6 pb-5 pt-6">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[13px] font-extrabold uppercase leading-[18px] tracking-[0.72px] text-ink-subtle">{t("Code")}</span>
          <h2 className="truncate text-[17px] font-semibold tracking-tight text-ink">
            {themeName}
          </h2>
        </div>
        <button
          type="button"
          ref={doneRef}
          onClick={requestClose}
          aria-label={t("Done")}
          title={t("Done")}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
        >
          <X size={18} />
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
          <div className="flex h-14 shrink-0 items-center px-3">
            <div className="flex items-center gap-1">
              {THEME_FILES.map((f) => {
                const Icon = f.icon;
                const on = f.id === tab;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTab(f.id)}
                    className={`flex h-11 items-center gap-2 rounded-md px-3.5 text-[15.5px] transition-colors ${
                      on
                        ? "bg-elevated font-semibold text-ink"
                        : "font-medium text-ink-subtle hover:text-ink"
                    }`}
                  >
                    <Icon size={16} strokeWidth={2} style={{ color: f.tint }} />
                    {f.name}
                  </button>
                );
              })}
            </div>

            <div className="ms-auto flex items-center gap-1">
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                title={t("Undo (Ctrl/Cmd + Z)")}
                className="grid h-11 w-11 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-elevated hover:text-ink disabled:pointer-events-none disabled:opacity-30"
              >
                <Undo2 size={16} strokeWidth={2.2} />
              </button>
              <button
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                title={t("Redo (Ctrl/Cmd + Shift + Z)")}
                className="grid h-11 w-11 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-elevated hover:text-ink disabled:pointer-events-none disabled:opacity-30"
              >
                <Redo2 size={16} strokeWidth={2.2} />
              </button>
              <button
                type="button"
                onClick={() => setCheatOpen(true)}
                className="flex h-11 items-center gap-1.5 rounded-md px-3 text-[15.5px] font-semibold text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
              >
                <BookOpen size={16} strokeWidth={2.2} />
                {t("Cheat sheet")}
              </button>
              {tab === "js" && (
                <button
                  type="button"
                  onClick={onRunJs}
                  disabled={!value.trim()}
                  className="harbor-press-pop flex h-11 items-center gap-1.5 rounded-md bg-success px-4 text-[15.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-30"
                >
                  <Play size={16} strokeWidth={2.6} fill="currentColor" />
                  {t("Run")}
                </button>
              )}
              <button
                type="button"
                onClick={copy}
                className={`flex h-11 items-center gap-1.5 rounded-md px-3 text-[15.5px] font-semibold transition-colors hover:bg-elevated ${
                  copied ? "text-success" : "text-ink-subtle hover:text-ink"
                }`}
              >
                {copied ? (
                  <Check size={16} strokeWidth={2.6} />
                ) : (
                  <Copy size={16} strokeWidth={2.2} />
                )}
                {copied ? t("Copied") : t("Copy")}
              </button>
              <button
                type="button"
                onClick={() => download(tab)}
                className="flex h-11 items-center gap-1.5 rounded-md px-3 text-[15.5px] font-semibold text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
              >
                <Download size={16} strokeWidth={2.2} />
                {t("Download")}
              </button>
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            <CodeEditor
              key={tab}
              value={value}
              onChange={(v) => onChange({ [tab]: v })}
              language={tab}
              autoFocus={!tvNav}
              onCaret={(line, col) => setCaret({ line, col })}
              className="h-full"
            />
            {!value && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-subtle">
                  {t("{file} is empty. Start typing to restyle Harbor.", { file: meta.name })}
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
