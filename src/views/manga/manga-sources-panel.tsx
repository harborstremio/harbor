import { ArrowRight, ChevronLeft, FolderOpen, Pencil, Plug, Plus, Server, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { LocalFolderTutorial } from "./manga-sources-panel/local-tutorial";
import {
  addMangaSource,
  listMangaSources,
  removeMangaSource,
  sourceIconUrl,
  subscribeMangaSources,
  type MangaSource,
  type MangaSourceKind,
} from "@/lib/manga/sources";
import { CARD, INPUT, PRIMARY_BTN } from "./manga-sources-panel/shared";
import { ExtensionsSection } from "./manga-sources-panel/extensions-section";
import { PluginGuide } from "./manga-sources-panel/plugin-guide";
import { SetupGuide } from "./manga-sources-panel/setup-guide";
import { CustomSource } from "./manga-sources-panel/custom-source";
import { SourceEditor } from "./manga-sources-panel/source-editor";
import { SuwayomiWorkspace } from "./manga-sources-panel/suwayomi/suwayomi-workspace";
import { listServers, subscribeServers } from "./manga-sources-panel/suwayomi/servers-store";
import { sourceMatchesServer } from "@/lib/manga/sources/suwayomi/server-link";
import { useT } from "@/lib/i18n";

const KIND_LABEL: Record<string, string> = { local: "Folder", suwayomi: "Server", plugin: "Plugin", html: "Site", mangayomi: "Extension" };
type IconType = ComponentType<{ size?: number; className?: string }>;

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 px-1 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-subtle">
      {children}
    </p>
  );
}

function SourceIcon({ src, name, icon: Icon }: { src?: string; name?: string; icon?: IconType }) {
  const [failed, setFailed] = useState(false);
  const initials = (name ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "?";
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-canvas ring-1 ring-edge-soft">
      {src && !failed ? (
        <img src={src} alt="" className="h-7 w-7 object-contain" onError={() => setFailed(true)} />
      ) : Icon ? (
        <Icon size={20} className="text-ink-muted" />
      ) : (
        <span className="text-[13px] font-bold text-ink-muted">{initials}</span>
      )}
    </span>
  );
}

const BYOS: Array<{ kind: MangaSourceKind; icon: IconType; iconUrl?: string; title: string; subtitle: string; placeholder: string }> = [
  { kind: "local", icon: FolderOpen, title: "Local folder", subtitle: "Read manga files you already have", placeholder: "" },
];

function CustomRow({ source, flash, onRemove }: { source: MangaSource; flash: boolean; onRemove: () => void }) {
  const t = useT();
  const [removing, setRemoving] = useState(false);
  const [editing, setEditing] = useState(false);
  const remove = () => {
    setRemoving(true);
    window.setTimeout(onRemove, 240);
  };
  const editable =
    source.kind === "html" || source.kind === "suwayomi" || source.kind === "local";
  const Icon =
    source.kind === "local" ? FolderOpen : source.kind === "suwayomi" ? Server : Plug;
  return (
    <div
      className={`overflow-hidden transition-all duration-300 ${
        removing ? "max-h-0 scale-95 opacity-0" : editing ? "max-h-[900px]" : "max-h-28"
      }`}
    >
      <div
        className={`transition-all duration-500 ${CARD} ${
          flash ? "scale-[1.012] ring-2 ring-accent/60" : ""
        }`}
      >
        <div className="flex items-center gap-4 px-5 py-4">
          <SourceIcon icon={Icon} src={sourceIconUrl(source)} name={source.name} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex items-center gap-2.5">
              <span className="truncate text-[16px] font-semibold text-ink">{source.name}</span>
              <span className="shrink-0 rounded-md bg-raised px-2 py-0.5 text-[11px] font-bold text-ink-muted ring-1 ring-edge-soft">
                {t(KIND_LABEL[source.kind ?? "suwayomi"])}
              </span>
            </div>
            <span className="truncate text-[13px] text-ink-subtle">{source.baseUrl}</span>
          </span>
          {editable && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              aria-label={t("Edit {name}", { name: source.name })}
              aria-expanded={editing}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1 ring-edge-soft transition-all active:scale-95 motion-reduce:active:scale-100 ${
                editing ? "bg-accent/15 text-accent" : "bg-raised text-ink-subtle hover:text-ink"
              }`}
            >
              <Pencil size={17} strokeWidth={2} />
            </button>
          )}
          <button
            type="button"
            onClick={remove}
            aria-label={t("Remove {name}", { name: source.name })}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-raised text-ink-subtle ring-1 ring-edge-soft transition-all hover:text-danger active:scale-95 motion-reduce:active:scale-100"
          >
            <Trash2 size={18} strokeWidth={2} />
          </button>
        </div>
        {editing && (
          <div className="harbor-rise border-t border-edge-soft p-5">
            <SourceEditor source={source} onDone={() => setEditing(false)} />
          </div>
        )}
      </div>
    </div>
  );
}

function ByosOption({ kind, icon: Icon, iconUrl, title, subtitle, placeholder }: (typeof BYOS)[number]) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [tut, setTut] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pickFolder = async () => {
    try {
      const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
      const dir = await openDialog({ directory: true, multiple: false, title: t("Choose manga folder") });
      if (typeof dir === "string" && !addMangaSource("", dir, "local")) setError(t("Could not add that folder"));
    } catch {
      setError(t("Folder picker is only available in the desktop app"));
    }
  };

  const add = () => {
    if (!addMangaSource("", url, kind)) {
      setError(t("Enter a valid http(s):// URL"));
      return;
    }
    setUrl("");
    setError(null);
    setOpen(false);
  };

  const row = (
    <div className="flex items-center gap-4 px-5 py-4">
      <SourceIcon icon={Icon} src={iconUrl} name={title} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[16px] font-semibold text-ink">{t(title)}</span>
        <span className="truncate text-[13px] text-ink-muted">{t(subtitle)}</span>
      </div>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-raised text-ink-muted ring-1 ring-edge-soft transition-colors group-hover/byos:text-ink">
        <Plus size={18} strokeWidth={2.4} className={`transition-transform ${kind !== "local" && open ? "rotate-45" : ""}`} />
      </span>
    </div>
  );

  if (kind === "local") {
    return (
      <>
        <div className={`group/byos transition-all hover:ring-edge ${CARD}`}>
          <button type="button" onClick={() => setTut(true)} className="w-full text-start active:scale-[0.99]">
            {row}
          </button>
          {error && <p className="px-5 pb-4 text-[13px] font-medium text-danger">{error}</p>}
        </div>
        {tut && <LocalFolderTutorial onClose={() => setTut(false)} onChoose={pickFolder} />}
      </>
    );
  }

  return (
    <div className={`group/byos transition-all ${open ? "ring-edge" : "hover:ring-edge"} ${CARD}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full text-start active:scale-[0.99]">
        {row}
      </button>
      {open && (
        <div className="harbor-rise flex flex-col gap-2.5 border-t border-edge-soft p-5">
          <input
            value={url}
            autoFocus
            onChange={(e) => setUrl(e.target.value)}
            placeholder={placeholder}
            inputMode="url"
            autoCapitalize="off"
            spellCheck={false}
            className={INPUT}
          />
          {error && <p className="text-[13px] font-medium text-danger">{error}</p>}
          <button type="button" onClick={add} className={PRIMARY_BTN}>
            <Plus size={18} strokeWidth={2.4} />
            {t("Add {name}", { name: t(title).toLowerCase() })}
          </button>
        </div>
      )}
    </div>
  );
}

export function MangaSourcesView({
  onBack,
  onOpenManga,
}: {
  onBack: () => void;
  onOpenManga?: (id: string) => void;
}) {
  const t = useT();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const un = subscribeMangaSources(() => setTick((n) => n + 1));
    return () => un();
  }, []);

  useEffect(() => subscribeServers(() => setTick((n) => n + 1)), []);

  const customs = useMemo(() => {
    const servers = listServers();
    return listMangaSources().filter(
      (s) =>
        !s.builtin &&
        s.id !== "all" &&
        !(s.kind === "suwayomi" && servers.some((sv) => sourceMatchesServer(s.baseUrl, sv.baseUrl))),
    );
  }, [tick]);
  const total = useMemo(() => listMangaSources().filter((s) => s.id !== "all").length, [tick]);

  const prevIds = useRef<Set<string>>(new Set(customs.map((s) => s.id)));
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const cur = new Set(customs.map((s) => s.id));
    const fresh = [...cur].filter((id) => !prevIds.current.has(id));
    prevIds.current = cur;
    if (fresh.length === 0) return;
    setFlashIds(new Set(fresh));
    const timer = window.setTimeout(() => setFlashIds(new Set()), 1000);
    return () => window.clearTimeout(timer);
  }, [customs]);

  return (
    <div
      className="mx-auto flex w-full max-w-2xl flex-col gap-6"
      style={{ animation: "harbor-view-in 0.4s cubic-bezier(0.32,0.72,0.24,1) both" }}
    >
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl bg-elevated px-4 py-2.5 text-[15px] font-medium text-ink shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4)] ring-1 ring-edge-soft transition-all hover:bg-raised active:scale-[0.97]"
        >
          <ChevronLeft size={19} strokeWidth={2.4} />
          {t("Back")}
        </button>
        {total > 0 && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[15px] font-semibold text-canvas shadow-[0_6px_18px_-8px_rgba(0,0,0,0.5)] transition-all hover:opacity-90 active:scale-[0.97]"
          >
            {t("Done")} <span className="text-canvas/80">· {total}</span>
            <ArrowRight size={18} strokeWidth={2.4} />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        <h1 className="font-display text-[34px] font-medium tracking-tight text-ink">{t("Manga sources")}</h1>
        <p className="max-w-xl text-[15.5px] leading-relaxed text-ink-muted">
          {t(
            "Harbor does not host any manga or any sources. Connect your own server or open a folder you already have, and mix as many as you like.",
          )}
        </p>
      </div>

      {customs.length > 0 && (
        <div className="flex flex-col gap-3">
          <SectionLabel>{t("Your sources")}</SectionLabel>
          {customs.map((s) => (
            <CustomRow
              key={s.id}
              source={s}
              flash={flashIds.has(s.id)}
              onRemove={() => removeMangaSource(s.id)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <SectionLabel>{t("Bring your own")}</SectionLabel>
        {BYOS.map((o) => (
          <ByosOption key={o.kind} {...o} />
        ))}
        <CustomSource />
      </div>

      <SuwayomiWorkspace onOpen={onOpenManga} />
      <ExtensionsSection />
      <PluginGuide />
      <SetupGuide />
    </div>
  );
}
