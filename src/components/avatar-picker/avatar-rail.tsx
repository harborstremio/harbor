import { Download, FileJson, FolderInput, FolderPlus, HelpCircle, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";

export type RailGroup = {
  id: string;
  label: string;
  count: number;
  packId?: string;
  badge?: number;
};

export function AvatarRail({
  groups,
  section,
  total,
  flashIds,
  onSelect,
  onImport,
  onImportFolder,
  onImportPack,
  onExportPack,
  onHelp,
  onDeletePack,
}: {
  groups: RailGroup[];
  section: string;
  total: number;
  flashIds?: string[];
  onSelect: (id: string) => void;
  onImport: () => void;
  onImportFolder: () => void;
  onImportPack: () => void;
  onExportPack?: (packId: string) => void;
  onHelp: () => void;
  onDeletePack: (packId: string) => void;
}) {
  const t = useT();
  return (
    <div className="flex w-[184px] shrink-0 flex-col border-e border-edge-soft p-2.5">
      <RailItem
        label={t("All")}
        count={total}
        active={section === "all"}
        onClick={() => onSelect("all")}
      />
      <div className="mx-2 my-1.5 h-px bg-edge-soft/70" />
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto [scrollbar-width:thin]">
        {groups.map((g) => (
          <RailItem
            key={g.id}
            label={g.label}
            count={g.count}
            badge={g.badge}
            active={section === g.id}
            flash={flashIds?.includes(g.id)}
            onClick={() => onSelect(g.id)}
            onDelete={g.packId ? () => onDeletePack(g.packId as string) : undefined}
            onExport={g.packId && onExportPack ? () => onExportPack(g.packId as string) : undefined}
          />
        ))}
      </div>
      <div className="mx-2 my-1.5 h-px bg-edge-soft/70" />
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={onImport}
          className="flex items-center gap-2 whitespace-nowrap rounded-[9px] px-3 py-2 text-[13px] font-medium text-ink-muted transition-colors hover:bg-elevated hover:text-ink active:scale-[0.98] motion-reduce:active:scale-100"
        >
          <FolderPlus size={15} strokeWidth={2.2} />
          {t("Import images")}
        </button>
        <button
          type="button"
          onClick={onImportFolder}
          className="flex items-center gap-2 whitespace-nowrap rounded-[9px] px-3 py-2 text-[13px] font-medium text-ink-muted transition-colors hover:bg-elevated hover:text-ink active:scale-[0.98] motion-reduce:active:scale-100"
        >
          <FolderInput size={15} strokeWidth={2.2} />
          {t("Import folder")}
        </button>
        <button
          type="button"
          onClick={onImportPack}
          className="flex items-center gap-2 whitespace-nowrap rounded-[9px] px-3 py-2 text-[13px] font-medium text-ink-muted transition-colors hover:bg-elevated hover:text-ink active:scale-[0.98] motion-reduce:active:scale-100"
        >
          <FileJson size={15} strokeWidth={2.2} />
          {t("Import pack (.json)")}
        </button>
        <button
          type="button"
          onClick={onHelp}
          className="flex items-center gap-2 whitespace-nowrap rounded-[9px] px-3 py-1.5 text-[11.5px] font-medium text-ink-subtle transition-colors hover:bg-elevated hover:text-ink-muted"
        >
          <HelpCircle size={13} strokeWidth={2} />
          {t("How packs work")}
        </button>
      </div>
    </div>
  );
}

function RailItem({
  label,
  count,
  badge,
  active,
  flash,
  onClick,
  onDelete,
  onExport,
}: {
  label: string;
  count: number;
  badge?: number;
  active: boolean;
  flash?: boolean;
  onClick: () => void;
  onDelete?: () => void;
  onExport?: () => void;
}) {
  const t = useT();
  return (
    <div
      className={`group/row relative flex items-center rounded-[9px] transition-colors ${
        active ? "bg-elevated" : "hover:bg-elevated/55"
      } ${flash ? "avatar-row-flash" : ""}`}
    >
      {active && <span className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-accent" />}
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-start outline-none"
      >
        <span
          className={`truncate text-[13px] ${active ? "font-semibold text-ink" : "text-ink-muted"}`}
        >
          {label}
        </span>
        {badge ? (
          <span className="ms-auto grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1.5 text-[10.5px] font-bold tabular-nums leading-none text-white shadow-sm motion-safe:animate-in motion-safe:zoom-in-75">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : (
          <span
            className={`ms-auto text-[11px] tabular-nums transition-opacity ${
              onDelete ? "text-ink-subtle group-hover/row:opacity-0" : "text-ink-subtle"
            }`}
          >
            {count}
          </span>
        )}
      </button>
      {onExport && (
        <button
          type="button"
          onClick={onExport}
          aria-label={t("Export pack")}
          className="absolute end-8 flex h-6 w-6 items-center justify-center rounded-md text-ink-subtle opacity-0 transition-all hover:bg-elevated hover:text-ink group-hover/row:opacity-100"
        >
          <Download size={13} strokeWidth={2.2} />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={t("Remove pack")}
          className="absolute end-1.5 flex h-6 w-6 items-center justify-center rounded-md text-ink-subtle opacity-0 transition-all hover:bg-danger/15 hover:text-danger group-hover/row:opacity-100"
        >
          <Trash2 size={13} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}
