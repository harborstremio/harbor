import {
  AlertCircle,
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
  Scale,
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

const CARD = "ebook-source-card";
const INPUT = "ebook-source-input";
const PRIMARY_BTN = "ebook-source-button ebook-source-button-primary";

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[15px] font-semibold text-ink">
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
      <div className={`${CARD} flex flex-col gap-3 p-4`}>
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
            className={`${PRIMARY_BTN} w-full min-w-[7.5rem] px-5 disabled:cursor-wait`}
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
      <span className="text-[13px] font-medium text-ink-muted">
        {label}
      </span>
      <div ref={root} className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={!hasOptions}
          onClick={() => hasOptions && setOpen((current) => !current)}
          aria-label={label}
          className={`ebook-source-input flex items-center gap-3 text-start ${open ? "is-open" : ""}`}
        >
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
            aria-label={label}
            className="absolute inset-x-0 top-[calc(100%+6px)] z-40 max-h-[320px] overflow-y-auto overscroll-contain rounded-lg border border-edge bg-elevated p-1 shadow-lg"
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
                      ? "bg-raised text-ink"
                      : "text-ink-muted hover:bg-elevated hover:text-ink"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[13.5px] ${active ? "font-semibold" : "font-medium"}`}
                    >
                      {option.label}
                    </span>
                    {option.sub && (
                      <span className="mt-0.5 block truncate text-[12px] text-ink-muted">
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
      <div className={`${CARD} flex flex-col gap-4 p-4`}>
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
        <div className={`${CARD} flex flex-col gap-4 p-4`}>
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
              aria-label={t("DeepSeek chapter translation")}
              aria-checked={settings.enabled}
              onClick={() => patch({ enabled: !settings.enabled })}
              className="ebook-source-switch"
            >
              <span
                className="ebook-source-switch-knob"
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
              className="ebook-source-button"
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

function GutenbergMark({ size = "h-11 w-11" }: { size?: string }) {
  return (
    <img
      src={gutenbergLogo}
      alt=""
      className={`${size} shrink-0 rounded-md object-cover`}
    />
  );
}

function SourceIcon({ source }: { source: EBookSource }) {
  const [failed, setFailed] = useState(false);
  if (source.kind === "gutendex") return <GutenbergMark />;
  return (
    <span className="ebook-source-icon">
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
        <div className="flex items-center gap-4 px-4 py-4">
          <SourceIcon source={source} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[16px] font-semibold text-ink">{source.name}</span>
            <span className="truncate text-[13px] text-ink-subtle">{source.location}</span>
          </span>
          <span className="text-[12px] font-medium text-ink-muted">
            {source.kind === "local" ? t("Folder") : t("Site")}
          </span>
          <button
            type="button"
            aria-label={t("Remove {name}", { name: source.name })}
            onClick={() => {
              setRemoving(true);
              window.setTimeout(() => removeEBookSource(source.id), 240);
            }}
            className="ebook-source-icon-button hover:text-danger"
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
            "Pick one library folder. Each subfolder is one eBook. Put its chapters inside as TXT, Markdown, HTML, or EPUB files and optionally add a cover image.",
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
    <div className={`group ${CARD}`}>
      <button
        type="button"
        disabled={added}
        onClick={() => setAdded(addEBookGutendex())}
        className="ebook-source-add-row flex w-full items-center gap-4 px-4 py-4 text-start"
      >
        <GutenbergMark />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[16px] font-semibold text-ink">Project Gutenberg</span>
          <span className="truncate text-[13px] text-ink-muted">
            75,000 free public domain books, no account needed
          </span>
        </span>
        <span className="grid h-9 w-9 shrink-0 place-items-center text-ink-muted">
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
      <div className={`group ${CARD}`}>
        <button
          type="button"
          onClick={() => setTutorial(true)}
          className="ebook-source-add-row flex w-full items-center gap-4 px-4 py-4 text-start"
        >
          <span className="ebook-source-icon">
            <FolderOpen size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[16px] font-semibold text-ink">{t("Local folder")}</span>
            <span className="truncate text-[13px] text-ink-muted">
              {t("Read eBook files you already have")}
            </span>
          </span>
          <span className="grid h-9 w-9 shrink-0 place-items-center text-ink-muted">
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
    <div className="flex items-center gap-3.5 px-4 py-4">
      <span className="ebook-source-icon text-[12px] font-semibold">
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
        className="ebook-source-switch"
      >
        <span
          className="ebook-source-switch-knob"
        />
      </button>
      <button
        type="button"
        aria-label={t("Remove {name}", { name: item.name })}
        onClick={() => void removeEBookPlugin(item.id)}
        className="ebook-source-icon-button hover:text-danger"
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
    <div className="flex items-center gap-3.5 px-4 py-4">
      <span className="ebook-source-icon text-[12px] font-semibold">
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
          className="ebook-source-switch"
        >
          <span
            className="ebook-source-switch-knob"
          />
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void action()}
        className={`ebook-source-button ${installed ? "hover:text-danger" : "ebook-source-button-primary"}`}
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
      <div className="flex items-center gap-3.5 px-4 py-4">
        <span className="ebook-source-icon">
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
          className="ebook-source-icon-button"
        >
          <RefreshCw size={16} className={updating ? "animate-spin" : ""} />
        </button>
        <button
          type="button"
          aria-label={t("Remove repository")}
          onClick={() => void removeEBookRepo(url)}
          className="ebook-source-icon-button hover:text-danger"
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
      <aside className="ebook-source-legal" aria-labelledby="ebook-source-legal-title">
        <Scale size={18} aria-hidden="true" />
        <div>
          <h3 id="ebook-source-legal-title">{t("Copyright & third-party sources")}</h3>
          <p>{t("Use extensions only for content you may lawfully access, including public-domain books, licensed content, or uses permitted by law.")}</p>
          <p>{t("You are responsible for checking copyright status, local law, and each source’s terms.")}</p>
          <p>{t("Extensions come from repositories you add. Harbor does not verify their content rights.")} {t("Harbor does not support copyright infringement.")}</p>
        </div>
      </aside>
      <div className={`flex flex-col gap-2.5 px-5 py-4 ${CARD}`}>
        <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
          <Blocks size={16} /> {t("Add a repository")}
        </div>
        <div className="flex gap-2.5">
          <input
            value={url}
            aria-label={t("Add a repository")}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && !busy && void add()}
            placeholder="https://example.com/ebooks.json"
            className={`${INPUT} min-w-0 flex-1`}
          />
          <button
            type="button"
            onClick={() => void add()}
            disabled={busy || !url.trim()}
            className={PRIMARY_BTN}
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
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="ebook-source-workspace-section">
      <header className="ebook-source-workspace-heading">
        <span className="min-w-0">
          <h2 className="text-[20px] font-semibold tracking-tight text-ink">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-muted">
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
  const [activeSection, setActiveSection] = useState("ebook-source-library");
  useEffect(() => {
    const sections = [
      "ebook-source-library",
      "ebook-source-intelligence",
      "ebook-source-extensions",
    ]
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => !!element);
    const scroller = sections[0]?.closest("main");
    if (!scroller) return;
    let frame = 0;
    const update = () => {
      const readingLine = scroller.getBoundingClientRect().top + 100;
      let active = sections[0];
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= readingLine) active = section;
      }
      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) {
        active = sections[sections.length - 1];
      }
      if (active) setActiveSection(active.id);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const observer = new ResizeObserver(schedule);
    sections.forEach((section) => observer.observe(section));
    observer.observe(scroller);
    scroller.addEventListener("scroll", schedule, { passive: true });
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      scroller.removeEventListener("scroll", schedule);
    };
  }, []);
  const jumpTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "start",
    });
  };
  const contents = [
    {
      id: "ebook-source-library",
      label: t("Library"),
      sub: t("{count} connected", { count: sources.length + installed.length }),
    },
    {
      id: "ebook-source-intelligence",
      label: t("Metadata & translation"),
    },
    {
      id: "ebook-source-extensions",
      label: t("Extensions"),
      sub: t("{count} repositories", { count: ebookRepoUrls().length }),
    },
  ];
  return (
    <div className="ebook-sources-shell">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="ebook-source-back"
        >
          <ChevronLeft size={19} /> {t("Back")}
        </button>
        {total > 0 && (
          <button
            type="button"
            onClick={onBack}
            className={`${PRIMARY_BTN} min-w-20`}
          >
            {t("Done")}
          </button>
        )}
      </div>
      <header className="ebook-sources-header">
        <div className="ebook-sources-heading">
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink">
            {t("eBook source settings")}
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
              <strong>{ebookRepoUrls().length}</strong>
              <small>{t("Repositories")}</small>
            </span>
          </div>
        </div>
      </header>

      <div className="ebook-sources-workspace">
        <aside className="ebook-sources-contents">
          <nav className="flex flex-col gap-1" aria-label={t("eBook source settings")}>
            {contents.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => jumpTo(item.id)}
                aria-current={activeSection === item.id ? "location" : undefined}
                className={`ebook-sources-content-link ${activeSection === item.id ? "is-active" : ""}`}
              >
                <span className="min-w-0 flex-1 text-start">
                  <strong>{item.label}</strong>
                  {item.sub && <small>{item.sub}</small>}
                </span>
              </button>
            ))}
          </nav>
          <div className="ebook-sources-privacy-note">
            <ShieldCheck size={17} />
            <p>
              <span>{t("Harbor never hosts your books.")}</span>
            </p>
          </div>
        </aside>

        <div className="ebook-sources-sections">
          <WorkspaceSection
            id="ebook-source-library"
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
            title={t("Metadata & translation")}
            description={t(
              "Shape the metadata and reading language Harbor uses without changing your original files.",
            )}
          >
            <MetadataProviders />
            <Translation />
          </WorkspaceSection>

          <WorkspaceSection
            id="ebook-source-extensions"
            title={t("Extensions")}
            description={t(
              "Add eBook sources from a repository you trust.",
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
