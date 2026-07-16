import { ArrowLeft, Check, Copy, Download, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { setCustomThemePreview } from "@/lib/custom-themes";
import { BETA_THEMES, type ThemePreset } from "@/lib/theme";
import { BetaThemesCard, BetaThemesModal } from "./beta-themes-modal";
import { clearUnseenDownloads, getUnseenDownloads, subscribeUnseen } from "@/lib/theme-store";
import { CommunityPane } from "./community-browser";
import type { LibraryEntry } from "./library-grid";
import { fileToPreviewDataUrl } from "./theme-upload/upload-utils";

export function LibraryBrowser({
  entries,
  activeId,
  onActivate,
  onExport,
  onDownload,
  onRemove,
  onClose,
}: {
  entries: LibraryEntry[];
  activeId: string;
  onActivate: (id: string) => void;
  onExport: (id: string) => void;
  onDownload: (id: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const [tab, setTab] = useState<"library" | "community">("library");
  const [betaOpen, setBetaOpen] = useState(false);
  const [unseen, setUnseen] = useState(() => getUnseenDownloads().length);

  useEffect(() => subscribeUnseen(() => setUnseen(getUnseenDownloads().length)), []);
  useEffect(() => {
    if (tab === "library") clearUnseenDownloads();
  }, [tab]);

  const builtIn = entries.filter((e) => e.category === "Built-in");
  const featured = entries.filter((e) => e.category === "Featured");
  const templates = entries.filter((e) => e.category === "Template");
  const yours = entries.filter((e) => e.category === "Yours");

  return createPortal(
    <div
      className="fixed inset-0 z-[210] flex flex-col bg-canvas"
      role="dialog"
      aria-label="Theme library"
      data-tv-focus-scope
    >
      <header data-tauri-drag-region className="flex shrink-0 items-center justify-between gap-4 border-b border-edge-soft bg-surface/40 px-10 py-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 items-center gap-2 rounded-full border border-edge-soft bg-canvas/60 px-4 text-[13px] font-semibold text-ink-muted transition-all hover:-translate-x-0.5 rtl:hover:translate-x-0.5 hover:border-edge hover:text-ink"
          >
            <ArrowLeft size={15} strokeWidth={2.2} className="dir-icon" />
            Back to settings
          </button>
          <div data-tauri-drag-region className="flex flex-col">
            <h1 className="pointer-events-none text-[24px] font-semibold tracking-tight text-ink">Theme Library</h1>
            <p className="pointer-events-none text-[13px] text-ink-subtle">
              {entries.length} themes. Click Apply on any card to use it.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          <X size={18} strokeWidth={2.2} />
        </button>
      </header>

      <div className="flex shrink-0 items-center gap-2 border-b border-edge-soft bg-surface/20 px-10 py-3">
        <TabBtn active={tab === "library"} onClick={() => setTab("library")}>
          My library
          {unseen > 0 && (
            <span className="harbor-pop ms-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-canvas">
              {unseen}
            </span>
          )}
        </TabBtn>
        <TabBtn active={tab === "community"} onClick={() => setTab("community")}>
          Community
        </TabBtn>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-10 py-10">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-12">
          {tab === "community" ? (
            <CommunityPane />
          ) : (
          <>
          {featured.length > 0 && (
            <BrowserSection title="Featured" subtitle="Hand-picked reskins from the Harbor crew.">
              <BrowserGrid
                entries={featured}
                activeId={activeId}
                onActivate={onActivate}
                onExport={onExport}
                onDownload={onDownload}
                onRemove={onRemove}
              />
            </BrowserSection>
          )}

          {BETA_THEMES.length > 0 && (
            <BrowserSection title="Beta" subtitle="Experimental 1:1 ports of other apps.">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <BetaThemesCard count={BETA_THEMES.length} onClick={() => setBetaOpen(true)} />
              </div>
            </BrowserSection>
          )}

          {builtIn.length > 0 && (
            <BrowserSection title="Built-in" subtitle="Ships with Harbor. Always available.">
              <BrowserGrid
                entries={builtIn}
                activeId={activeId}
                onActivate={onActivate}
                onExport={onExport}
                onDownload={onDownload}
                onRemove={onRemove}
              />
            </BrowserSection>
          )}

          {templates.length > 0 && (
            <BrowserSection title="Templates" subtitle="Starting points to remix and save your own.">
              <BrowserGrid
                entries={templates}
                activeId={activeId}
                onActivate={onActivate}
                onExport={onExport}
                onDownload={onDownload}
                onRemove={onRemove}
              />
            </BrowserSection>
          )}

          {yours.length > 0 && (
            <BrowserSection title="Your themes" subtitle="Themes you imported or built.">
              <BrowserGrid
                entries={yours}
                activeId={activeId}
                onActivate={onActivate}
                onExport={onExport}
                onDownload={onDownload}
                onRemove={onRemove}
              />
            </BrowserSection>
          )}
          </>
          )}
        </div>
      </div>
      <BetaThemesModal
        open={betaOpen}
        activeId={activeId}
        onActivate={onActivate}
        onClose={() => setBetaOpen(false)}
      />
    </div>,
    document.body,
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center rounded-full px-4 text-[13px] font-semibold transition-colors ${
        active ? "bg-ink text-canvas" : "text-ink-muted hover:bg-elevated hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function BrowserSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col">
        <h3 className="text-[17px] font-semibold tracking-tight text-ink">{title}</h3>
        <p className="text-[13px] text-ink-subtle">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function BrowserGrid({
  entries,
  activeId,
  onActivate,
  onExport,
  onDownload,
  onRemove,
}: {
  entries: LibraryEntry[];
  activeId: string;
  onActivate: (id: string) => void;
  onExport: (id: string) => void;
  onDownload: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {entries.map((e) => (
        <BrowserCard
          key={e.theme.id}
          theme={e.theme}
          removable={e.removable}
          active={activeId === e.theme.id}
          onActivate={() => onActivate(e.theme.id)}
          onExport={() => onExport(e.theme.id)}
          onDownload={() => onDownload(e.theme.id)}
          onRemove={() => onRemove(e.theme.id)}
        />
      ))}
    </div>
  );
}

function BrowserCard({
  theme,
  removable,
  active,
  onActivate,
  onExport,
  onDownload,
  onRemove,
}: {
  theme: ThemePreset;
  removable: boolean;
  active: boolean;
  onActivate: () => void;
  onExport: () => void;
  onDownload: () => void;
  onRemove: () => void;
}) {
  const hasImage = !!theme.previewImage;
  const bg = theme.background?.image ?? `linear-gradient(135deg, ${theme.swatch[0]}, ${theme.swatch[1]})`;
  const [busy, setBusy] = useState(false);
  const addImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      setBusy(true);
      const url = await fileToPreviewDataUrl(f);
      if (url) setCustomThemePreview(theme.id, url);
      setBusy(false);
    };
    input.click();
  };
  return (
    <div
      className={`group flex flex-col overflow-hidden rounded-2xl border transition-all ${
        active
          ? "border-accent shadow-[0_0_0_2px_var(--color-accent-soft),0_18px_40px_-22px_rgba(0,0,0,0.35)]"
          : "border-edge-soft bg-surface hover:border-edge"
      }`}
    >
      <div
        className="relative h-40 w-full"
        style={
          hasImage
            ? {
                backgroundImage: `url(${theme.previewImage})`,
                backgroundSize: "contain",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                backgroundColor: theme.swatch[0],
              }
            : { background: bg }
        }
      >
        {active && (
          <span className="absolute end-3 top-3 flex h-7 items-center gap-1.5 rounded-full bg-accent px-2.5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-canvas shadow-[0_4px_12px_-4px_rgba(0,0,0,0.4)]">
            <Check size={11} strokeWidth={3} /> Active
          </span>
        )}
        <div className="absolute bottom-0 left-0 right-0 flex h-2">
          {theme.swatch.map((c, i) => (
            <span key={i} className="flex-1" style={{ background: c }} />
          ))}
        </div>
        {removable && !hasImage && (
          <button
            type="button"
            onClick={addImage}
            disabled={busy}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-canvas/45 text-[12px] font-semibold text-ink-muted opacity-0 backdrop-blur-[1px] transition-opacity hover:text-ink group-hover:opacity-100"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} strokeWidth={1.9} />}
            {busy ? "Adding" : "Add image"}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[16px] font-semibold tracking-tight text-ink">{theme.name}</span>
          {theme.blurb && (
            <span className="line-clamp-2 text-[12.5px] leading-relaxed text-ink-muted">{theme.blurb}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onActivate}
            disabled={active}
            className={`h-10 flex-1 rounded-xl text-[13px] font-semibold transition-opacity ${
              active
                ? "bg-elevated/70 text-ink ring-1 ring-edge"
                : "bg-ink text-canvas hover:opacity-90"
            }`}
          >
            {active ? "Active" : "Apply"}
          </button>
          <IconButton label="Copy theme" onClick={onExport}>
            <Copy size={14} strokeWidth={2.2} />
          </IconButton>
          <IconButton label="Download" onClick={onDownload}>
            <Download size={14} strokeWidth={2.2} />
          </IconButton>
          {removable && (
            <IconButton label="Remove" onClick={onRemove} danger>
              <Trash2 size={14} strokeWidth={2.2} />
            </IconButton>
          )}
        </div>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded-xl border border-edge-soft text-ink-muted transition-colors ${
        danger ? "hover:border-danger/40 hover:text-danger" : "hover:border-edge hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
