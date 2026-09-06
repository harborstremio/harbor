import {
  AlertCircle,
  ArrowRight,
  Blocks,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  Download,
  FileText,
  Folder,
  FolderOpen,
  Languages,
  Loader2,
  PackageOpen,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import "./ebook-sources-panel.css";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  addEBookRepo,
  browseEBookRepo,
  installEBookPlugin,
  installedEBookPlugins,
  loadEBookExtensions,
  ebookRepoUrls,
  removeEBookPlugin,
  removeEBookRepo,
  setEBookPluginEnabled,
  subscribeEBookExtensions,
  type EBookPluginManifest,
  type EBookPluginRepo,
} from "@/lib/ebook/extensions";
import {
  addEBookFolder,
  addEBookGutendex,
  hasEBookGutendex,
  listEBookSources,
  removeEBookSource,
  subscribeEBookSources,
  type EBookSource,
} from "@/lib/ebook/sources";
import { CARD, INPUT, PRIMARY_BTN } from "@/views/manga/manga-sources-panel/shared";
import { PluginGuide } from "@/views/manga/manga-sources-panel/plugin-guide";
import {
  googleBooksApiKey,
  setGoogleBooksApiKey,
  validateGoogleBooksApiKey,
} from "@/lib/ebook/api";
import deepseekLogo from "@/assets/ai-logos/deepseek.png";
import gutenbergLogo from "@/assets/gutenberg.png";
import {
  loadEBookTranslationSettings,
  saveEBookTranslationSettings,
  testEBookTranslationSettings,
  type EBookTranslationSettings,
} from "@/lib/ebook/translation";
import { LANGUAGES as UI_LANGUAGES, useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";

const CASE_SHELVES: Array<{
  base: number;
  books: Array<[number, number, number]>;
  accent: number;
  stack?: [number, number];
}> = [
  {
    base: 104,
    books: [
      [30, 15, 70],
      [48, 12, 79],
      [63, 20, 64],
      [86, 11, 74],
      [100, 16, 60],
      [119, 13, 68],
    ],
    accent: -1,
    stack: [168, 44],
  },
  {
    base: 197,
    books: [
      [96, 14, 62],
      [113, 19, 73],
      [135, 11, 56],
      [149, 16, 68],
      [168, 12, 64],
      [183, 17, 58],
    ],
    accent: 3,
    stack: [30, 52],
  },
  {
    base: 290,
    books: [
      [30, 18, 66],
      [51, 12, 75],
      [66, 15, 59],
      [84, 11, 70],
      [98, 20, 64],
      [121, 13, 56],
      [137, 16, 69],
      [156, 12, 61],
    ],
    accent: -1,
  },
];

function BookcaseArt() {
  return (
    <svg
      className="ebook-sources-case"
      viewBox="0 0 240 306"
      role="img"
      aria-label="An illustration of a bookcase"
      focusable="false"
    >
      <g className="ebook-case-frame">
        <path d="M12 6v294M228 6v294M12 8h216" />
        {CASE_SHELVES.map((shelf) => (
          <path key={shelf.base} d={`M12 ${shelf.base + 5}h216`} />
        ))}
      </g>
      {CASE_SHELVES.map((shelf) =>
        shelf.books.map(([x, width, height], index) => (
          <rect
            key={`${shelf.base}-${x}`}
            className={index === shelf.accent ? "ebook-case-book is-accent" : "ebook-case-book"}
            x={x}
            y={shelf.base - height}
            width={width}
            height={height}
            rx="1.5"
            opacity={index % 2 ? 1 : 0.78}
          />
        )),
      )}
      {CASE_SHELVES.map((shelf) =>
        shelf.stack ? (
          <g key={`stack-${shelf.base}`}>
            {[0, 1, 2].map((row) => (
              <rect
                key={row}
                className="ebook-case-book"
                x={shelf.stack![0] + row * 3}
                y={shelf.base - 10 - row * 9}
                width={shelf.stack![1] - row * 6}
                height="8"
                rx="1.5"
                opacity={0.7 + row * 0.1}
              />
            ))}
          </g>
        ) : null,
      )}
      <g className="ebook-case-lean">
        <rect
          x="0"
          y="0"
          width="13"
          height="58"
          rx="1.5"
          transform="translate(137 46) rotate(11)"
        />
      </g>
    </svg>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 px-1 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-subtle">
      {children}
    </p>
  );
}

function MetadataProviders() {
  const t = useT();
  const [key, setKey] = useState(googleBooksApiKey);
  const [state, setState] = useState<"idle" | "testing" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const save = async () => {
    if (state === "testing") return;
    setState("testing");
    setError("");
    try {
      await validateGoogleBooksApiKey(key);
      setGoogleBooksApiKey(key);
      setState("saved");
      window.setTimeout(() => setState("idle"), 1600);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not validate this API key."));
      setState("error");
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>{t("Metadata")}</SectionLabel>
      <div className={`${CARD} flex flex-col gap-3 p-5`}>
        <div>
          <p className="text-[15px] font-semibold text-ink">Google Books</p>
          <p className="text-[13px] text-ink-muted">
            {t(
              "Add a Google Books API key for book titles, covers, authors, and descriptions. Wikidata works automatically as the final metadata fallback.",
            )}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7.5rem]">
          <input
            type="password"
            value={key}
            onChange={(event) => {
              setKey(event.target.value);
              setState("idle");
              setError("");
            }}
            onKeyDown={(event) => event.key === "Enter" && void save()}
            placeholder={t("Google Books API key")}
            autoComplete="off"
            className={`${INPUT} min-w-0 flex-1`}
          />
          <button
            type="button"
            disabled={state === "testing"}
            aria-live="polite"
            className={`${PRIMARY_BTN} w-full min-w-[7.5rem] px-5 active:scale-[0.96] disabled:cursor-wait`}
            onClick={() => void save()}
          >
            {state === "testing" ? (
              <Loader2 size={17} className="animate-spin motion-reduce:animate-none" />
            ) : (
              <Check size={17} />
            )}
            {state === "testing" ? t("Testing") : state === "saved" ? t("Saved") : t("Save")}
          </button>
        </div>
        {error && (
          <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-danger">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function TranslationSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string; sub?: string }>;
  onChange: (value: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];
  const hasOptions = options.length > 0;
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
        {label}
      </span>
      <div ref={root} className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={!hasOptions}
          onClick={() => hasOptions && setOpen((current) => !current)}
          className={`flex h-12 w-full items-center gap-3 rounded-xl border px-3.5 text-start outline-none transition-all ${
            open
              ? "border-accent/70 bg-accent/5 shadow-[0_0_0_3px_rgba(255,159,77,0.10)]"
              : "border-edge bg-canvas hover:border-accent/40"
          }`}
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-accent shadow-[0_0_10px_rgba(255,159,77,0.55)]" />
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
            {selected?.label ?? t("Loading models…")}
          </span>
          <ChevronDown
            size={16}
            className={`shrink-0 text-ink-subtle transition-transform duration-200 ${open ? "rotate-180 text-accent" : ""}`}
          />
        </button>
        {open && (
          <div
            role="listbox"
            className="harbor-rise absolute inset-x-0 top-[calc(100%+7px)] z-40 max-h-[360px] overflow-y-auto overscroll-contain rounded-xl border border-edge bg-canvas/95 p-1.5 shadow-[0_20px_55px_-18px_rgba(0,0,0,0.82)] backdrop-blur-xl"
          >
            {options.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start transition-colors ${
                    active
                      ? "bg-accent/14 text-ink"
                      : "text-ink-muted hover:bg-elevated hover:text-ink"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-accent" : "bg-edge"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[13.5px] ${active ? "font-semibold" : "font-medium"}`}
                    >
                      {option.label}
                    </span>
                    {option.sub && (
                      <span className="mt-0.5 block truncate text-[11.5px] text-ink-subtle">
                        {option.sub}
                      </span>
                    )}
                  </span>
                  {active && <Check size={16} className="shrink-0 text-accent" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </label>
  );
}

function Translation() {
  const t = useT();
  const [settings, setSettings] = useState(loadEBookTranslationSettings);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState("");
  const patch = (next: Partial<EBookTranslationSettings>) =>
    setSettings((current) => ({ ...current, ...next }));
  const save = () => {
    const next = {
      ...settings,
      enabled: true,
      apiKey: settings.apiKey.trim(),
    };
    const persisted = saveEBookTranslationSettings(next);
    if (!persisted) {
      setTestResult(t("Storage is full. Clear Harbor cache storage, then try saving again."));
      return;
    }
    setSettings(next);
    setTestResult("");
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };
  const test = async () => {
    setTesting(true);
    setTestResult("");
    try {
      await testEBookTranslationSettings(settings);
      setTestResult(t("DeepSeek model is working."));
    } catch (error) {
      setTestResult(error instanceof Error ? error.message : t("Translation test failed"));
    } finally {
      setTesting(false);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>{t("Translation")}</SectionLabel>
      <div className={`${CARD} flex flex-col gap-4 p-5`}>
        <TranslationSelect
          label={t("Translate to")}
          value={settings.targetLanguage}
          onChange={(targetLanguage) =>
            patch({
              targetLanguage: targetLanguage as EBookTranslationSettings["targetLanguage"],
            })
          }
          options={UI_LANGUAGES.map(({ code, label, nativeLabel }) => ({
            value: code,
            label: t(label),
            sub: nativeLabel,
          }))}
        />
        <p className="text-[12.5px] leading-relaxed text-ink-subtle">
          {t(
            "Translation runs when a chapter opens and keeps the original if a request fails or is truncated.",
          )}
        </p>
      </div>
      <div>
        <div className={`${CARD} flex flex-col gap-4 p-5`}>
          <div className="flex items-center gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white ring-1 ring-black/10">
              <img src={deepseekLogo} alt="" className="h-7 w-7 object-contain" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <Languages size={17} /> {t("DeepSeek chapter translation")}
              </span>
              <span className="text-[13px] leading-relaxed text-ink-muted">
                {t(
                  "Sends only the chapter you open to DeepSeek. Volumes, chapters, and metadata stay unchanged.",
                )}
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.enabled}
              onClick={() => patch({ enabled: !settings.enabled })}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${settings.enabled ? "bg-accent" : "bg-edge"}`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-canvas shadow-sm transition-transform ${settings.enabled ? "start-6" : "start-1"}`}
              />
            </button>
          </div>
          <TranslationSelect
            label={t("Model")}
            value={settings.model}
            onChange={(model) => patch({ model })}
            options={[
              {
                value: "deepseek-v4-flash",
                label: "DeepSeek V4 Flash",
                sub: t("Fast · recommended for chapters"),
              },
              {
                value: "deepseek-v4-pro",
                label: "DeepSeek V4 Pro",
                sub: t("Higher quality · slower"),
              },
            ]}
          />
          <div className="flex gap-2">
            <input
              type="password"
              value={settings.apiKey}
              onChange={(event) => patch({ apiKey: event.target.value })}
              placeholder={t("DeepSeek API key (sk-...)")}
              autoComplete="off"
              className={`${INPUT} min-w-0 flex-1`}
            />
            <button
              type="button"
              disabled={testing}
              onClick={() => void test()}
              className="flex h-12 items-center justify-center gap-2 rounded-xl border border-edge px-4 text-[13px] font-semibold text-ink transition hover:bg-elevated disabled:cursor-wait disabled:opacity-50"
            >
              {testing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {t("Test")}
            </button>
            <button type="button" onClick={save} className={`${PRIMARY_BTN} px-5`}>
              <Check size={17} /> {saved ? t("Saved") : t("Save")}
            </button>
          </div>
          <p className="text-[12.5px] leading-relaxed text-ink-subtle">
            {t("Use your API key to Translate Chapters to Your Language. Get a key from the")}{" "}
            <a
              href="https://platform.deepseek.com/"
              target="_blank"
              rel="noreferrer"
              onClick={(event) => {
                event.preventDefault();
                void openUrl("https://platform.deepseek.com/");
              }}
              className="font-medium text-accent underline decoration-accent/45 underline-offset-2 transition-colors hover:text-ink"
            >
              DeepSeek Platform
            </a>
            .
          </p>
        </div>
      </div>
      {testResult && (
        <p role="status" className="px-1 text-[12.5px] leading-relaxed text-ink-muted">
          {testResult}
        </p>
      )}
    </div>
  );
}

function GutenbergMark({ size = "h-12 w-12" }: { size?: string }) {
  return (
    <img
      src={gutenbergLogo}
      alt=""
      className={`${size} shrink-0 rounded-xl object-cover ring-1 ring-edge-soft`}
    />
  );
}

function SourceIcon({ source }: { source: EBookSource }) {
  const [failed, setFailed] = useState(false);
  if (source.kind === "gutendex") return <GutenbergMark />;
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-canvas text-ink-muted ring-1 ring-edge-soft">
      {source.iconUrl && !failed ? (
        <img
          src={source.iconUrl}
          alt=""
          className="h-7 w-7 object-contain"
          onError={() => setFailed(true)}
        />
      ) : source.kind === "local" ? (
        <FolderOpen size={20} />
      ) : (
        <FileText size={20} />
      )}
    </span>
  );
}

function SourceRow({ source }: { source: EBookSource }) {
  const t = useT();
  const [removing, setRemoving] = useState(false);
  return (
    <div
      className={`overflow-hidden transition-all duration-300 ${removing ? "max-h-0 scale-95 opacity-0" : "max-h-28"}`}
    >
      <div className={CARD}>
        <div className="flex items-center gap-4 px-5 py-4">
          <SourceIcon source={source} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[16px] font-semibold text-ink">{source.name}</span>
            <span className="truncate text-[13px] text-ink-subtle">{source.location}</span>
          </span>
          <span className="rounded-md bg-raised px-2 py-0.5 text-[11px] font-bold text-ink-muted ring-1 ring-edge-soft">
            {source.kind === "local" ? t("Folder") : t("Site")}
          </span>
          <button
            type="button"
            aria-label={t("Remove {name}", { name: source.name })}
            onClick={() => {
              setRemoving(true);
              window.setTimeout(() => removeEBookSource(source.id), 240);
            }}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-raised text-ink-subtle ring-1 ring-edge-soft transition-all hover:text-danger active:scale-95"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function LocalFolderTutorial({ onClose, onChoose }: { onClose: () => void; onChoose: () => void }) {
  const t = useT();
  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[80] grid place-items-center bg-black/60 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-modal-in flex w-full max-w-md flex-col gap-5 rounded-2xl border border-edge bg-surface p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-[21px] font-medium tracking-tight text-ink">
            {t("Add a local folder")}
          </h2>
          <button
            type="button"
            aria-label={t("Close")}
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-edge-soft text-ink-subtle hover:bg-elevated hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <p className="text-[14px] leading-relaxed text-ink-muted">
          {t(
            "Pick one library folder. Add EPUB books, audiobook ZIPs, or M4B and common audio files. A subfolder groups multiple volumes or audiobook tracks into one title.",
          )}
        </p>
        <div className="flex flex-col gap-2 rounded-xl bg-canvas p-4 text-[13.5px] ring-1 ring-edge-soft">
          <span className="flex items-center gap-2 text-ink-muted">
            <FolderOpen size={16} /> {t("My eBooks")}
          </span>
          <span className="ms-6 flex items-center gap-2 font-semibold text-ink">
            <Folder size={16} className="text-accent" /> Lord of Mysteries
          </span>
          <span className="ms-12 flex items-center gap-2 text-ink-muted">
            <FileText size={16} /> Volume 1.epub
          </span>
          <span className="ms-12 flex items-center gap-2 text-ink-muted">
            <FileText size={16} /> Chapter 2.txt
          </span>
          <span className="ms-12 flex items-center gap-2 text-ink-muted">
            <BookOpen size={16} /> cover.jpg
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            onClose();
            onChoose();
          }}
          className={PRIMARY_BTN}
        >
          <FolderOpen size={18} /> {t("Choose folder")}
        </button>
      </div>
    </div>,
    document.body,
  );
}

function GutenbergQuickAdd() {
  const [added, setAdded] = useState(() => hasEBookGutendex());
  return (
    <div className={`group transition-all hover:ring-edge ${CARD}`}>
      <button
        type="button"
        disabled={added}
        onClick={() => setAdded(addEBookGutendex())}
        className="flex w-full items-center gap-4 px-5 py-4 text-start active:scale-[0.99] disabled:active:scale-100"
      >
        <GutenbergMark />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[16px] font-semibold text-ink">Project Gutenberg</span>
          <span className="truncate text-[13px] text-ink-muted">
            75,000 free public domain books, no account needed
          </span>
        </span>
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-raised text-ink-muted ring-1 ring-edge-soft">
          {added ? <Check size={18} /> : <Plus size={18} />}
        </span>
      </button>
    </div>
  );
}

function LocalFolder() {
  const t = useT();
  const [tutorial, setTutorial] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const choose = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const path = await open({
        directory: true,
        multiple: false,
        title: t("Choose eBook folder"),
      });
      if (typeof path === "string" && !addEBookFolder(path))
        setError(t("Could not add that folder"));
    } catch {
      setError(t("Folder selection is available in the Harbor app"));
    }
  };
  return (
    <>
      <div className={`group transition-all hover:ring-edge ${CARD}`}>
        <button
          type="button"
          onClick={() => setTutorial(true)}
          className="flex w-full items-center gap-4 px-5 py-4 text-start active:scale-[0.99]"
        >
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-canvas text-ink-muted ring-1 ring-edge-soft">
            <FolderOpen size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[16px] font-semibold text-ink">{t("Local folder")}</span>
            <span className="truncate text-[13px] text-ink-muted">
              {t("Read eBook files you already have")}
            </span>
          </span>
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-raised text-ink-muted ring-1 ring-edge-soft">
            <Plus size={18} />
          </span>
        </button>
        {error && <p className="px-5 pb-4 text-[13px] font-medium text-danger">{error}</p>}
      </div>
      {tutorial && <LocalFolderTutorial onClose={() => setTutorial(false)} onChoose={choose} />}
    </>
  );
}

function InstalledSourceRow({ item }: { item: ReturnType<typeof installedEBookPlugins>[number] }) {
  const t = useT();
  return (
    <div className="flex items-center gap-3.5 px-5 py-3.5">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-canvas text-[12px] font-bold text-ink-muted ring-1 ring-edge-soft">
        {item.name
          .replace(/[^a-z0-9]/gi, "")
          .slice(0, 2)
          .toUpperCase()}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold text-ink">{item.name}</span>
        <span className="text-[12.5px] text-ink-muted">
          {item.lang} · v{item.version}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-label={t("Enable {name}", { name: item.name })}
        aria-checked={item.enabled}
        onClick={() => void setEBookPluginEnabled(item.id, !item.enabled)}
        className={`relative h-6 w-10 rounded-full ${item.enabled ? "bg-ink" : "bg-edge"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-canvas transition-transform ${item.enabled ? "start-[18px]" : "start-0.5"}`}
        />
      </button>
      <button
        type="button"
        aria-label={t("Remove {name}", { name: item.name })}
        onClick={() => void removeEBookPlugin(item.id)}
        className="grid h-9 w-9 place-items-center rounded-lg bg-raised text-ink-subtle ring-1 ring-edge-soft hover:text-danger"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function PluginRow({ item, repoUrl }: { item: EBookPluginManifest; repoUrl: string }) {
  const t = useT();
  const installed = installedEBookPlugins().find((plugin) => plugin.id === item.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const action = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!installed) await installEBookPlugin(item, repoUrl);
      else await removeEBookPlugin(item.id);
    } catch {
      setError(t("Install failed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-3.5 px-5 py-3.5">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-canvas text-[12px] font-bold text-ink-muted ring-1 ring-edge-soft">
        {item.name
          .replace(/[^a-z0-9]/gi, "")
          .slice(0, 2)
          .toUpperCase()}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold text-ink">{item.name}</span>
        <span className="text-[12.5px] text-ink-muted">
          {item.lang} · v{item.version}
          {error && <span className="text-danger"> · {error}</span>}
        </span>
      </span>
      {installed && (
        <button
          type="button"
          role="switch"
          aria-label={t("Enable {name}", { name: item.name })}
          aria-checked={installed.enabled}
          onClick={() => void setEBookPluginEnabled(installed.id, !installed.enabled)}
          className={`relative h-6 w-10 rounded-full ${installed.enabled ? "bg-ink" : "bg-edge"}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-canvas transition-transform ${installed.enabled ? "start-[18px]" : "start-0.5"}`}
          />
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void action()}
        className={`flex h-9 min-w-[104px] items-center justify-center gap-1.5 rounded-xl px-4 text-[13.5px] font-semibold disabled:opacity-60 ${installed ? "bg-raised text-ink-subtle ring-1 ring-edge-soft hover:text-danger" : "bg-accent text-canvas"}`}
      >
        {busy ? (
          <Loader2 size={15} className="animate-spin" />
        ) : installed ? (
          <Trash2 size={15} />
        ) : (
          <Download size={15} />
        )}
        {installed ? t("Remove") : t("Install")}
      </button>
    </div>
  );
}

function RepoCard({ url }: { url: string }) {
  const t = useT();
  const [repo, setRepo] = useState<EBookPluginRepo | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setState("loading");
    void browseEBookRepo(url)
      .then((value) => {
        if (!cancelled) {
          setRepo(value);
          setState("ready");
        }
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [url]);
  const update = async () => {
    setUpdating(true);
    setUpdateError(false);
    try {
      const next = await browseEBookRepo(url);
      const installed = new Map(
        installedEBookPlugins()
          .filter((item) => item.repoUrl === url)
          .map((item) => [item.id, item]),
      );
      for (const item of next.plugins) {
        const current = installed.get(item.id);
        if (current && current.version !== item.version) await installEBookPlugin(item, url);
      }
      setRepo(next);
      setState("ready");
    } catch {
      setUpdateError(true);
    } finally {
      setUpdating(false);
    }
  };
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="flex items-center gap-3.5 px-5 py-3.5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-canvas text-ink-muted ring-1 ring-edge-soft">
          <PackageOpen size={18} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[15.5px] font-semibold text-ink">
          {repo?.name ?? new URL(url).host}
        </span>
        <button
          type="button"
          aria-label={t("Update repository")}
          title={t("Update repository")}
          disabled={updating || state === "loading"}
          onClick={() => void update()}
          className="grid h-9 w-9 place-items-center rounded-lg bg-raised text-ink-subtle ring-1 ring-edge-soft hover:text-accent disabled:opacity-50"
        >
          <RefreshCw size={16} className={updating ? "animate-spin" : ""} />
        </button>
        <button
          type="button"
          aria-label={t("Remove repository")}
          onClick={() => void removeEBookRepo(url)}
          className="grid h-9 w-9 place-items-center rounded-lg bg-raised text-ink-subtle ring-1 ring-edge-soft hover:text-danger"
        >
          <Trash2 size={16} />
        </button>
      </div>
      {updateError && (
        <p className="border-t border-edge-soft px-5 py-2.5 text-[13px] font-medium text-danger">
          {t("Repository update failed.")}
        </p>
      )}
      {state === "loading" && (
        <div className="flex items-center justify-center gap-2 border-t border-edge-soft py-8 text-[13.5px] text-ink-subtle">
          <Loader2 size={17} className="animate-spin" /> {t("Loading extensions…")}
        </div>
      )}
      {state === "error" && (
        <div className="flex items-center justify-center gap-2 border-t border-edge-soft py-8 text-[13.5px] text-ink-muted">
          <AlertCircle size={16} className="text-danger" /> {t("Could not reach this repository.")}
        </div>
      )}
      {state === "ready" &&
        repo &&
        (repo.plugins.length ? (
          <div className="divide-y divide-edge-soft border-t border-edge-soft">
            {repo.plugins.map((item) => (
              <PluginRow key={item.id} item={item} repoUrl={url} />
            ))}
          </div>
        ) : (
          <div className="border-t border-edge-soft py-8 text-center text-[13.5px] text-ink-muted">
            {t("This repository lists no eBook extensions.")}
          </div>
        ))}
    </div>
  );
}

function Extensions() {
  const t = useT();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      await addEBookRepo(url.trim());
      setUrl("");
    } catch {
      setError(t("Could not load that eBook extension repository"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>{t("Extensions")}</SectionLabel>
      <div className={`flex flex-col gap-3 px-5 py-4 ${CARD}`}>
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-canvas text-ink-muted ring-1 ring-edge-soft">
            <ShieldCheck size={18} />
          </span>
          <span className="text-[15.5px] font-semibold text-ink">
            {t("Bring your own extensions")}
          </span>
        </div>
        <p className="text-[13.5px] leading-relaxed text-ink-muted">
          {t(
            "eBook extensions use Harbor’s isolated worker, HTTP bridge, and HTML parser—the same sandbox used by Manga extensions. Only add repositories you trust.",
          )}
        </p>
      </div>
      <div className={`flex flex-col gap-2.5 px-5 py-4 ${CARD}`}>
        <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
          <Blocks size={16} /> {t("Add a repository")}
        </div>
        <div className="flex gap-2.5">
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && !busy && void add()}
            placeholder="https://example.com/ebooks.json"
            className={`${INPUT} min-w-0 flex-1`}
          />
          <button
            type="button"
            onClick={() => void add()}
            disabled={busy || !url.trim()}
            className="flex h-12 items-center gap-2 rounded-xl bg-accent px-5 text-[14.5px] font-semibold text-canvas disabled:opacity-60"
          >
            {busy ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />} {t("Add")}
          </button>
        </div>
        {error && <p className="text-[13px] font-medium text-danger">{error}</p>}
      </div>
      {ebookRepoUrls().length ? (
        ebookRepoUrls().map((item) => <RepoCard key={item} url={item} />)
      ) : (
        <p className="px-1 text-[13.5px] text-ink-subtle">
          {t("No repositories yet. Add one above to browse eBook extensions.")}
        </p>
      )}
    </div>
  );
}

function WorkspaceSection({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="ebook-source-workspace-section scroll-mt-6">
      <header className="ebook-source-workspace-heading">
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
            {eyebrow}
          </span>
          <h2 className="mt-1 font-display text-[21px] font-medium tracking-tight text-ink">
            {title}
          </h2>
          <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-ink-muted">
            {description}
          </p>
        </span>
      </header>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

export function EBookSourcesView({ onBack }: { onBack: () => void }) {
  const t = useT();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    void loadEBookExtensions();
    const bump = () => setTick((value) => value + 1);
    const sources = subscribeEBookSources(bump);
    const extensions = subscribeEBookExtensions(bump);
    return () => {
      sources();
      extensions();
    };
  }, []);
  const sources = useMemo(() => listEBookSources(), [tick]);
  const installed = useMemo(() => installedEBookPlugins(), [tick]);
  const total = sources.length + installed.length;
  const enabled = installed.filter((source) => source.enabled).length;
  const [activeSection, setActiveSection] = useState("ebook-source-library");
  useEffect(() => {
    const sections = [
      "ebook-source-library",
      "ebook-source-intelligence",
      "ebook-source-extensions",
    ]
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => !!element);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (visible?.target.id) setActiveSection(visible.target.id);
      },
      { rootMargin: "-12% 0px -58%", threshold: [0.05, 0.25, 0.6] },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);
  const jumpTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const contents = [
    {
      id: "ebook-source-library",
      label: t("Library"),
      sub: t("{count} connected", { count: sources.length + installed.length }),
    },
    {
      id: "ebook-source-intelligence",
      label: t("Intelligence"),
      sub: t("Metadata & translation"),
    },
    {
      id: "ebook-source-extensions",
      label: t("Extensions"),
      sub: t("{count} repositories", { count: ebookRepoUrls().length }),
    },
  ];
  return (
    <div
      className="ebook-sources-shell mx-auto flex w-full max-w-[1180px] flex-col gap-7"
      style={{ animation: "harbor-view-in 0.4s cubic-bezier(0.32,0.72,0.24,1) both" }}
    >
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl bg-elevated px-4 py-2.5 text-[15px] font-medium text-ink shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4)] ring-1 ring-edge-soft hover:bg-raised active:scale-[0.97]"
        >
          <ChevronLeft size={19} /> {t("Back")}
        </button>
        {total > 0 && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[15px] font-semibold text-canvas active:scale-[0.97]"
          >
            {t("Done")} <span className="text-canvas/80">· {total}</span>
            <ArrowRight size={18} />
          </button>
        )}
      </div>
      <section className="ebook-sources-hero">
        <div className="ebook-sources-hero-copy">
          <h1 className="font-display text-[28px] font-medium leading-tight text-ink">
            {t("Build your own library")}
          </h1>
          <p className="max-w-2xl text-[14px] leading-relaxed text-ink-muted">
            {t(
              "Connect books you own, reading sources, and metadata services. Harbor keeps the shelf coherent while every source stays under your control.",
            )}
          </p>
          <div className="ebook-sources-stats" aria-label={t("Source overview")}>
            <span>
              <strong>{total}</strong>
              <small>{t("Connected")}</small>
            </span>
            <span>
              <strong>{enabled}</strong>
              <small>{t("Active")}</small>
            </span>
            <span>
              <strong>{ebookRepoUrls().length}</strong>
              <small>{t("Repositories")}</small>
            </span>
          </div>
        </div>
        <BookcaseArt />
      </section>

      <div className="grid items-start gap-7 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="ebook-sources-contents lg:sticky lg:top-4">
          <p className="px-3 pb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-ink-subtle">
            {t("Contents")}
          </p>
          <nav className="flex flex-col gap-1" aria-label={t("eBook source settings")}>
            {contents.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => jumpTo(item.id)}
                className={`ebook-sources-content-link ${activeSection === item.id ? "is-active" : ""}`}
              >
                <span className="min-w-0 flex-1 text-start">
                  <strong>{item.label}</strong>
                  <small>{item.sub}</small>
                </span>
              </button>
            ))}
          </nav>
          <div className="ebook-sources-privacy-note">
            <ShieldCheck size={17} />
            <p>
              <strong>{t("Your shelf, your rules.")}</strong>
              <span>{t("Harbor never hosts your books.")}</span>
            </p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-7">
          <WorkspaceSection
            id="ebook-source-library"
            eyebrow={t("Collection")}
            title={t("Library sources")}
            description={t(
              "Manage every place Harbor can read from, whether it lives on disk or across the web.",
            )}
          >
            {installed.length > 0 && (
              <div className="flex flex-col gap-3">
                <SectionLabel>{t("Installed sources")}</SectionLabel>
                <div className={`${CARD} divide-y divide-edge-soft overflow-hidden`}>
                  {installed.map((source) => (
                    <InstalledSourceRow key={source.id} item={source} />
                  ))}
                </div>
              </div>
            )}
            {sources.length > 0 && (
              <div className="flex flex-col gap-3">
                <SectionLabel>{t("Your sources")}</SectionLabel>
                {sources.map((source) => (
                  <SourceRow key={source.id} source={source} />
                ))}
              </div>
            )}
            <div className="flex flex-col gap-3">
              <SectionLabel>{t("Bring your own")}</SectionLabel>
              <div className="grid gap-3">
                <GutenbergQuickAdd />
                <LocalFolder />
              </div>
            </div>
          </WorkspaceSection>

          <WorkspaceSection
            id="ebook-source-intelligence"
            eyebrow={t("Enrichment")}
            title={t("Library intelligence")}
            description={t(
              "Shape the metadata and reading language Harbor uses without changing your original files.",
            )}
          >
            <MetadataProviders />
            <Translation />
          </WorkspaceSection>

          <WorkspaceSection
            id="ebook-source-extensions"
            eyebrow={t("Expand")}
            title={t("Extension dock")}
            description={t(
              "Bring trusted source packages aboard through Harbor’s isolated extension worker.",
            )}
          >
            <Extensions />
            <PluginGuide kind="ebook" />
          </WorkspaceSection>
        </div>
      </div>
    </div>
  );
}
