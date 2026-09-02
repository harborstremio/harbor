import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";
import { Search } from "@/components/icons/search-icon";
import { AVATAR_CATALOG, avatarUrl } from "@/lib/avatars/catalog";
import { deleteAvatarPack, removeFromAvatarPack, UPLOADS_ID, useAvatarPacks } from "@/lib/avatars/packs";
import { flattenAvatar, loadPersonBg, savePersonBg } from "@/lib/avatars/flatten";
import { AvatarRail, type RailGroup } from "./avatar-rail";
import { AvatarGrid, type GridItem } from "./avatar-grid";
import { AvatarBgControl } from "./avatar-bg-control";
import { AvatarDropOverlay, AvatarImportProgress } from "./avatar-pack-import";
import { entriesFromFileList } from "./avatar-import";
import { useAvatarImport } from "./use-avatar-import";
import { AvatarPackHelp } from "./avatar-pack-help";
import { useT } from "@/lib/i18n";

type ViewGroup = { id: string; label: string; transparent?: boolean; packId?: string; items: GridItem[] };

export function AvatarCatalogModal({
  current,
  onPick,
  onClose,
}: {
  current?: string | null;
  onPick: (value: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const packs = useAvatarPacks();
  const [q, setQ] = useState("");
  const [section, setSection] = useState("all");
  const [helpOpen, setHelpOpen] = useState(false);
  const [personBg, setPersonBg] = useState(loadPersonBg);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const { importing, flashIds, uploadsBadge, fileRef, folderRef, importImages, importFolder, onInputChange, runImport } =
    useAvatarImport(section);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !helpOpen && !document.body.hasAttribute("data-color-popover")) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, helpOpen]);
  useEffect(() => savePersonBg(personBg), [personBg]);
  useEffect(() => {
    folderRef.current?.setAttribute("webkitdirectory", "");
    folderRef.current?.setAttribute("directory", "");
  }, [folderRef]);

  const groups = useMemo<ViewGroup[]>(() => {
    const catalog = AVATAR_CATALOG.map((g) => ({
      id: g.group,
      label: g.group,
      transparent: g.transparent,
      items: g.items.map((it) => ({
        key: it.id,
        name: it.name,
        value: avatarUrl(it.id),
        transparent: g.transparent,
      })),
    }));
    const packGroups = [...packs]
      .sort((a, b) => (a.id === UPLOADS_ID ? -1 : b.id === UPLOADS_ID ? 1 : a.createdAt - b.createdAt))
      .map((p) => ({
        id: p.id,
        label: p.name,
        packId: p.id,
        items: p.items.map((it) => ({ key: it.id, name: it.name, value: it.data })),
      }));
    return [...catalog, ...packGroups];
  }, [packs]);

  const total = useMemo(() => groups.reduce((n, g) => n + g.items.length, 0), [groups]);
  const railGroups = useMemo<RailGroup[]>(
    () =>
      groups.map((g) => ({
        id: g.id,
        label: g.label,
        count: g.items.length,
        packId: g.packId,
        badge: g.id === UPLOADS_ID ? uploadsBadge : 0,
      })),
    [groups, uploadsBadge],
  );

  const query = q.trim().toLowerCase();
  const searchResults = useMemo(
    () => (query ? groups.flatMap((g) => g.items).filter((it) => it.name.toLowerCase().includes(query)) : null),
    [groups, query],
  );
  const currentGroup = section === "all" ? null : groups.find((g) => g.id === section);

  const handlePick = async (item: GridItem) => {
    if (item.transparent) {
      try {
        onPick(await flattenAvatar(item.value, personBg));
        return;
      } catch {
        /* fall back to raw value */
      }
    }
    onPick(item.value);
  };

  const removePack = async (packId: string) => {
    await deleteAvatarPack(packId);
    if (section === packId) setSection("all");
  };

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  const onDragEnter = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current++;
    setDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    dragDepth.current--;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragging(false);
    }
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (e.dataTransfer.files?.length) void runImport(entriesFromFileList(e.dataTransfer.files));
  };

  const renderGroup = (g: ViewGroup) => (
    <GroupSection
      key={g.id}
      label={g.label}
      count={g.items.length}
      action={g.transparent ? <AvatarBgControl value={personBg} onChange={setPersonBg} /> : undefined}
    >
      <AvatarGrid
        items={g.items}
        current={current}
        tileBg={g.transparent ? personBg : undefined}
        onPick={handlePick}
        onDelete={g.packId ? (item) => void removeFromAvatarPack(g.packId as string, item.key) : undefined}
      />
    </GroupSection>
  );

  const contentKey = query ? "search" : section;

  return createPortal(
    <div
      className="animate-scrim-in fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onDragEnter={onDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className="animate-dialog-in relative flex h-[86vh] max-h-[760px] w-full max-w-[1040px] flex-col overflow-hidden rounded-md bg-surface shadow-[0_30px_90px_-24px_rgba(0,0,0,0.85)]"
      >
        <div className="flex items-center gap-4 px-6 pb-4 pt-5">
          <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
            <h2 className="font-display text-[19px] font-medium tracking-tight text-ink">
              {t("Choose an avatar")}
            </h2>
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
              {total}
              <Disclaimer />
            </span>
          </div>
          <div className="relative hidden sm:block">
            <Search
              size={15}
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-subtle"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
              placeholder={t("Search")}
              className="h-9 w-52 rounded-md bg-canvas ps-9 pe-3 text-[13px] text-ink outline-none transition-colors focus:bg-elevated"
            />
          </div>
          <button
            onClick={onClose}
            type="button"
            aria-label={t("common.close")}
            className="harbor-press-pop flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>

        <input ref={fileRef} type="file" accept="image/*" multiple onChange={onInputChange} className="hidden" />
        <input ref={folderRef} type="file" multiple onChange={onInputChange} className="hidden" />

        <div className="relative flex min-h-0 flex-1">
          <AvatarRail
            groups={railGroups}
            section={section}
            total={total}
            flashIds={flashIds}
            onSelect={(id) => {
              setQ("");
              setSection(id);
            }}
            onImport={importImages}
            onImportFolder={importFolder}
            onHelp={() => setHelpOpen(true)}
            onDeletePack={removePack}
          />
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div
              key={contentKey}
              className="animate-fade-in-soft flex flex-col gap-8"
            >
              {searchResults ? (
                searchResults.length ? (
                  <AvatarGrid items={searchResults} current={current} onPick={handlePick} />
                ) : (
                  <p className="py-16 text-center text-[13.5px] text-ink-subtle">{t("No matches.")}</p>
                )
              ) : section === "all" ? (
                groups.map(renderGroup)
              ) : currentGroup ? (
                renderGroup(currentGroup)
              ) : null}
            </div>
          </div>
          {importing && (
            <div className="animate-scrim-in absolute inset-0 z-20 flex bg-surface">
              <AvatarImportProgress done={importing.done} total={importing.total} />
            </div>
          )}
        </div>

        {dragging && <AvatarDropOverlay />}
      </div>
      {helpOpen && <AvatarPackHelp onClose={() => setHelpOpen(false)} />}
    </div>,
    document.body,
  );
}

function GroupSection({
  label,
  count,
  action,
  children,
}: {
  label: string;
  count: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2">
        <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.09em] text-ink-muted">{label}</h3>
        <span className="text-[11px] tabular-nums text-ink-subtle">{count}</span>
        {action && <div className="ms-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function Disclaimer() {
  const t = useT();
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const show = hover || pinned;
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setPinned((v) => !v)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        aria-label={t("Rights and usage")}
        className={`flex h-5 w-5 items-center justify-center rounded-md transition-colors ${
          show ? "bg-elevated text-ink-muted" : "text-ink-subtle hover:bg-elevated hover:text-ink-muted"
        }`}
      >
        <Info size={12.5} strokeWidth={2.2} />
      </button>
      {show && (
        <div className="animate-popover-in absolute start-0 top-full z-20 mt-1.5 w-[300px] rounded-md border border-edge-soft bg-elevated/97 px-3.5 py-3 text-start shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)] backdrop-blur-md">
          <p className="text-[12px] leading-relaxed text-ink-muted">
            {t(
              "These avatars are Harbor originals. Imported packs are stored only on this device: you choose what goes in them, and you are responsible for that content.",
            )}
          </p>
        </div>
      )}
    </span>
  );
}
