import { useEffect, useState } from "react";
import { AlertTriangle, Award, BookOpen, ImagePlus, Medal, Plus, Trash2, Upload, Wand2, X } from "lucide-react";
import { unzip } from "@/lib/unzip";
import { cleanPng } from "./clean-png";
import { NamingGuideModal } from "./naming-guide-modal";
import {
  autoMatchKey,
  defaultArtFor,
  iconGroupsFor,
  labelForKey,
  MAX_ICONS,
  normalizeCustomKey,
  type BundleKind,
} from "./icon-keys";

export type AssignedIcon = { id: string; file: File; preview: string; key: string | null; filename: string };

type FileError = { name: string; reason: string };

function uid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function pickFiles(multiple: boolean, accept: string, cb: (files: File[]) => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.multiple = multiple;
  input.onchange = () => cb(Array.from(input.files || []));
  input.click();
}

async function expandZips(files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const f of files) {
    if (!/\.zip$/i.test(f.name)) {
      out.push(f);
      continue;
    }
    try {
      const entries = await unzip(await f.arrayBuffer());
      for (const [name, bytes] of entries) {
        if (name.startsWith("__MACOSX") || name.includes("/.") || !/\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(name)) continue;
        const base = name.split("/").pop() ?? name;
        const ext = (base.split(".").pop() ?? "").toLowerCase();
        const mime =
          ext === "jpg" || ext === "jpeg"
            ? "image/jpeg"
            : ext === "svg"
              ? "image/svg+xml"
              : `image/${ext}`;
        out.push(new File([bytes], base, { type: mime }));
      }
    } catch {
      /* skip unreadable zip */
    }
  }
  return out;
}

export function IconAssignStep({
  kind,
  onKind,
  icons,
  onChange,
}: {
  kind: BundleKind;
  onKind: (k: BundleKind) => void;
  icons: AssignedIcon[];
  onChange: (icons: AssignedIcon[]) => void;
}) {
  const [errors, setErrors] = useState<FileError[]>([]);
  const [optimized, setOptimized] = useState(0);
  const [flattened, setFlattened] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [customKeys, setCustomKeys] = useState<string[]>([]);
  const [customName, setCustomName] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);

  useEffect(() => {
    setErrors([]);
    setOptimized(0);
    setFlattened(0);
    setCustomKeys([]);
    setAddingCustom(false);
  }, [kind]);

  const byKey = new Map(icons.filter((i) => i.key).map((i) => [i.key as string, i] as const));
  const groups = iconGroupsFor(kind);

  const assignOne = async (key: string, file: File) => {
    const res = await cleanPng(file);
    if (!res.ok) {
      setErrors([{ name: file.name, reason: res.error }]);
      return;
    }
    const map = new Map(byKey);
    map.set(key, { id: uid(), file: res.icon.file, preview: res.icon.preview, key, filename: file.name });
    onChange([...map.values()]);
    setErrors([]);
    setOptimized(res.icon.optimized && !res.icon.flattened ? 1 : 0);
    setFlattened(res.icon.flattened ? 1 : 0);
  };

  const pickForSlot = (key: string) => pickFiles(false, "image/*", (files) => files[0] && void assignOne(key, files[0]));

  const clearSlot = (key: string) => onChange(icons.filter((i) => i.key !== key));

  const runImport = (raw: File[]) => {
    setBusy(true);
    void (async () => {
      const files = await expandZips(raw);
      const map = new Map(byKey);
      const nextErrors: FileError[] = [];
      let optimizedCount = 0;
      let flattenedCount = 0;
      for (const f of files) {
        if (map.size >= MAX_ICONS) {
          nextErrors.push({ name: f.name, reason: `exceeds the ${MAX_ICONS} slot limit` });
          continue;
        }
        const res = await cleanPng(f);
        if (!res.ok) {
          nextErrors.push({ name: f.name, reason: res.error });
          continue;
        }
        const key = autoMatchKey(kind, f.name);
        if (!key) {
          nextErrors.push({ name: f.name, reason: "did not match a slot (rename it after the slot)" });
          continue;
        }
        if (res.icon.flattened) flattenedCount++;
        else if (res.icon.optimized) optimizedCount++;
        map.set(key, { id: uid(), file: res.icon.file, preview: res.icon.preview, key, filename: f.name });
      }
      onChange([...map.values()]);
      setErrors(nextErrors);
      setOptimized(optimizedCount);
      setFlattened(flattenedCount);
      setBusy(false);
    })();
  };

  const addCustom = () => {
    const key = normalizeCustomKey(customName);
    if (!key) return;
    if (!customKeys.includes(key)) setCustomKeys([...customKeys, key]);
    setCustomName("");
    setAddingCustom(false);
    pickForSlot(key);
  };

  const allGroups =
    kind === "award" && customKeys.length > 0
      ? [...groups, { title: "Custom types", items: customKeys.map((k) => ({ key: k, label: labelForKey(kind, k) })) }]
      : groups;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <span className="text-[12.5px] font-semibold text-ink">What are you sharing?</span>
        <div className="inline-flex w-fit rounded-full border border-edge-soft bg-elevated/40 p-1">
          <KindTab active={kind === "badge"} onClick={() => onKind("badge")} icon={Medal} label="Badge pack" />
          <KindTab active={kind === "award"} onClick={() => onKind("award")} icon={Award} label="Award pack" />
        </div>
        <p className="text-[12.5px] leading-relaxed text-ink-subtle">
          {kind === "badge"
            ? "Reskin the quality chips (4K, HDR, Dolby Vision, Atmos and more) that ride each stream in the play picker. Click any slot to drop in your own PNG or animated GIF, or import a whole set at once. You do not have to fill every slot."
            : "Reskin the award trophies shown across Harbor. Click any award to add a PNG or animated GIF, add your own custom award types, or import a whole set at once."}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-edge-soft bg-surface/40 p-4">
        <div className="flex min-w-0 flex-col">
          <span className="text-[13px] font-semibold text-ink">Import a set</span>
          <span className="text-[12px] leading-snug text-ink-subtle">
            Drop many images, GIFs, or a .zip at once. Name each file after its slot ({kind === "badge" ? "4k.png, hdr.png, atmos.png" : "oscar.png, emmy.png"}) and we match them. Any size is fine, we resize big images and keep animated GIFs light.
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setGuideOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-edge-soft px-3.5 text-[13px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
          >
            <BookOpen size={15} strokeWidth={2.2} /> Naming guide
          </button>
          <button
            onClick={() => pickFiles(true, "image/*,.zip,application/zip", runImport)}
            disabled={busy}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-[13px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50"
          >
            <Upload size={15} strokeWidth={2.2} /> {busy ? "Reading…" : "Import images or .zip"}
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-danger/25 bg-danger/8 px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-danger">
              <AlertTriangle size={14} strokeWidth={2.2} /> {errors.length} {errors.length === 1 ? "file was" : "files were"} skipped
            </span>
            <button onClick={() => setErrors([])} aria-label="Dismiss" className="text-ink-subtle transition-colors hover:text-ink">
              <X size={14} />
            </button>
          </div>
          <ul className="flex max-h-28 flex-col gap-0.5 overflow-y-auto">
            {errors.map((e, i) => (
              <li key={i} className="text-[12px] text-ink-muted">
                <span className="font-medium text-ink">{e.name}</span> {e.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {optimized > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-accent/25 bg-accent/8 px-3.5 py-2.5">
          <Wand2 size={14} strokeWidth={2.2} className="shrink-0 text-accent" />
          <span className="text-[12.5px] text-ink-muted">
            Resized {optimized} {optimized === 1 ? "image" : "images"} to fit. Nothing was skipped for size.
          </span>
        </div>
      )}

      {flattened > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-accent-soft px-3.5 py-2.5 ring-1 ring-accent/25">
          <AlertTriangle size={14} strokeWidth={2.2} className="shrink-0 text-accent" />
          <span className="text-[12.5px] text-ink-muted">
            {flattened} {flattened === 1 ? "GIF was" : "GIFs were"} over 2 MB, so we kept the first frame. Export it smaller to keep the animation.
          </span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          {kind === "badge" ? "Quality badges" : "Award icons"}
        </span>
        <span className="text-[12px] tabular-nums text-ink-subtle">
          {byKey.size} {byKey.size === 1 ? "slot" : "slots"} reskinned
        </span>
      </div>

      <div className="flex flex-col gap-5">
        {allGroups.map((g) => (
          <div key={g.title} className="flex flex-col gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">{g.title}</span>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {g.items.map((it) => (
                <Slot
                  key={it.key}
                  label={it.label}
                  art={byKey.get(it.key)?.preview}
                  fallback={defaultArtFor(kind, it.key)}
                  onPick={() => pickForSlot(it.key)}
                  onClear={byKey.has(it.key) ? () => clearSlot(it.key) : undefined}
                />
              ))}
            </div>
          </div>
        ))}

        {kind === "award" &&
          (addingCustom ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-edge-soft bg-surface/40 p-3">
              <input
                autoFocus
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustom()}
                placeholder="Custom award name (e.g. My Festival)"
                className="h-10 min-w-0 flex-1 rounded-xl border border-edge-soft bg-elevated/40 px-3.5 text-[13px] text-ink placeholder:text-ink-subtle focus:border-edge focus:outline-none"
              />
              <button
                onClick={addCustom}
                disabled={!normalizeCustomKey(customName)}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-ink px-4 text-[13px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97] disabled:opacity-40"
              >
                <ImagePlus size={14} /> Pick art
              </button>
              <button
                onClick={() => {
                  setAddingCustom(false);
                  setCustomName("");
                }}
                className="h-10 rounded-xl px-3 text-[13px] font-medium text-ink-subtle transition-colors hover:text-ink"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingCustom(true)}
              className="inline-flex h-10 w-fit items-center gap-1.5 rounded-xl border border-dashed border-edge px-4 text-[13px] font-medium text-ink-muted transition-colors hover:border-accent hover:text-ink"
            >
              <Plus size={15} strokeWidth={2.2} /> Add a custom award type
            </button>
          ))}
      </div>

      {byKey.size === 0 && <p className="text-[12px] text-accent">Add art to at least one slot to continue.</p>}

      <NamingGuideModal kind={kind} open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}

function Slot({
  label,
  art,
  fallback,
  onPick,
  onClear,
}: {
  label: string;
  art?: string;
  fallback?: string;
  onPick: () => void;
  onClear?: () => void;
}) {
  const done = !!art;
  return (
    <div className="group flex flex-col items-center gap-1">
      <div
        role="button"
        tabIndex={0}
        onClick={onPick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPick();
          }
        }}
        title={label}
        className={`relative grid aspect-square w-full cursor-pointer place-items-center overflow-hidden rounded-xl border p-2 transition-colors ${
          done ? "border-accent bg-accent/10" : "border-edge-soft bg-elevated/40 hover:border-edge hover:bg-elevated/60"
        }`}
      >
        {art ? (
          <img src={art} alt={label} className="h-full w-full object-contain" />
        ) : fallback ? (
          <img src={fallback} alt={label} className="h-full w-full object-contain opacity-35 transition-opacity group-hover:opacity-60" />
        ) : (
          <ImagePlus size={18} strokeWidth={1.7} className="text-ink-subtle transition-colors group-hover:text-ink" />
        )}
        {onClear && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            aria-label="Remove"
            className="absolute end-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/75 group-hover:opacity-100"
          >
            <Trash2 size={10} />
          </button>
        )}
      </div>
      <span className="w-full truncate text-center text-[10px] leading-tight text-ink-subtle">{label}</span>
    </div>
  );
}

function KindTab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Medal; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-colors ${
        active ? "bg-ink text-canvas" : "text-ink-muted hover:text-ink"
      }`}
    >
      <Icon size={15} strokeWidth={2.2} className={active ? "" : "text-accent"} /> {label}
    </button>
  );
}
