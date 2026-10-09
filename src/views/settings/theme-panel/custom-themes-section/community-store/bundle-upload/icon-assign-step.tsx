import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Award,
  BookOpen,
  ImagePlus,
  Medal,
  Plus,
  Trash2,
  Upload,
  Wand2,
  X,
} from "../../../../icons";
import { useT } from "@/lib/i18n";
import { tvFocus } from "@/lib/keyboard-navigation";
import { isBackKey, navOwnsFocus } from "@/lib/keyboard-navigation/geometry";
import { unzip } from "@/lib/unzip";
import { ROW_TITLE, stripArrowKeys } from "../../../../shared";
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

export type AssignedIcon = {
  id: string;
  file: File;
  preview: string;
  key: string | null;
  filename: string;
};

type FileError = { name: string; reason: string };

function uid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
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
        if (
          name.startsWith("__MACOSX") ||
          name.includes("/.") ||
          !/\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(name)
        )
          continue;
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
  const t = useT();
  const [errors, setErrors] = useState<FileError[]>([]);
  const [optimized, setOptimized] = useState(0);
  const [flattened, setFlattened] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [customKeys, setCustomKeys] = useState<string[]>([]);
  const [customName, setCustomName] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);
  const kindRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const customInputRef = useRef<HTMLInputElement>(null);
  const addCustomRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = customInputRef.current;
    if (!addingCustom || !el) return;
    if (document.documentElement.dataset.inputModality === "keys") tvFocus(el);
    else el.focus();
  }, [addingCustom]);

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
      setErrors([{ name: file.name, reason: t(res.error) }]);
      return;
    }
    const map = new Map(byKey);
    map.set(key, {
      id: uid(),
      file: res.icon.file,
      preview: res.icon.preview,
      key,
      filename: file.name,
    });
    onChange([...map.values()]);
    setErrors([]);
    setOptimized(res.icon.optimized && !res.icon.flattened ? 1 : 0);
    setFlattened(res.icon.flattened ? 1 : 0);
  };

  const pickForSlot = (key: string) =>
    pickFiles(false, "image/*", (files) => files[0] && void assignOne(key, files[0]));

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
          nextErrors.push({
            name: f.name,
            reason: t("exceeds the {count} slot limit", { count: MAX_ICONS }),
          });
          continue;
        }
        const res = await cleanPng(f);
        if (!res.ok) {
          nextErrors.push({ name: f.name, reason: t(res.error) });
          continue;
        }
        const key = autoMatchKey(kind, f.name);
        if (!key) {
          nextErrors.push({
            name: f.name,
            reason: t("did not match a slot (rename it after the slot)"),
          });
          continue;
        }
        if (res.icon.flattened) flattenedCount++;
        else if (res.icon.optimized) optimizedCount++;
        map.set(key, {
          id: uid(),
          file: res.icon.file,
          preview: res.icon.preview,
          key,
          filename: f.name,
        });
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

  const cancelCustom = (viaNav: boolean) => {
    setAddingCustom(false);
    setCustomName("");
    if (!viaNav) return;
    requestAnimationFrame(() => {
      const el = addCustomRef.current;
      if (el) tvFocus(el);
    });
  };

  const allGroups =
    kind === "award" && customKeys.length > 0
      ? [
          ...groups,
          {
            title: "Custom types",
            items: customKeys.map((k) => ({ key: k, label: labelForKey(kind, k) })),
          },
        ]
      : groups;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <span className="harbor-settings-label">{t("What are you sharing?")}</span>
        <div
          onKeyDown={stripArrowKeys(kindRefs, (i) => onKind(i === 0 ? "badge" : "award"))}
          className="inline-flex w-fit rounded-full bg-elevated p-1"
        >
          <KindTab
            btnRef={(el) => {
              kindRefs.current[0] = el;
            }}
            active={kind === "badge"}
            onClick={() => onKind("badge")}
            icon={Medal}
            label={t("Badge pack")}
          />
          <KindTab
            btnRef={(el) => {
              kindRefs.current[1] = el;
            }}
            active={kind === "award"}
            onClick={() => onKind("award")}
            icon={Award}
            label={t("Award pack")}
          />
        </div>
        <p className="max-w-[70ch] text-[15.5px] leading-[22px] text-ink-subtle">
          {kind === "badge"
            ? t(
                "Reskin the quality chips (4K, HDR, Dolby Vision, Atmos and more) that ride each stream in the play picker. Click any slot to drop in your own PNG or animated GIF, or import a whole set at once. You do not have to fill every slot.",
              )
            : t(
                "Reskin the award trophies shown across Harbor. Click any award to add a PNG or animated GIF, add your own custom award types, or import a whole set at once.",
              )}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-md bg-surface p-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className={ROW_TITLE}>{t("Import a set")}</span>
          <span className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-subtle">
            {t(
              "Drop many images, GIFs, or a .zip at once. Name each file after its slot ({example}) and we match them. Any size is fine, we resize big images and keep animated GIFs light.",
              { example: kind === "badge" ? "4k.png, hdr.png, atmos.png" : "oscar.png, emmy.png" },
            )}
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            onClick={() => setGuideOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-md px-4 text-[15.5px] font-semibold leading-[22px] text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
          >
            <BookOpen size={18} strokeWidth={2.2} /> {t("Naming guide")}
          </button>
          <button
            onClick={() => pickFiles(true, "image/*,.zip,application/zip", runImport)}
            disabled={busy}
            className="inline-flex h-11 items-center gap-2 rounded-md bg-ink px-5 text-[15.5px] font-semibold leading-[22px] text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50"
          >
            <Upload size={18} strokeWidth={2.2} />{" "}
            {busy ? t("Reading…") : t("Import images or .zip")}
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md bg-danger/15 px-4 py-3 ring-1 ring-danger">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[15.5px] font-semibold leading-[22px] text-danger">
              <AlertTriangle size={17} strokeWidth={2.2} className="shrink-0" />
              {errors.length === 1
                ? t("{count} file was skipped", { count: errors.length })
                : t("{count} files were skipped", { count: errors.length })}
            </span>
            <button
              onClick={() => setErrors([])}
              aria-label={t("Dismiss")}
              className="-me-2 grid h-11 w-11 shrink-0 place-items-center rounded-md text-ink-subtle transition-colors hover:text-ink"
            >
              <X size={18} />
            </button>
          </div>
          <ul className="flex max-h-[176px] flex-col gap-1 overflow-y-auto">
            {errors.map((e, i) => (
              <li key={i} className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">
                <span className="font-medium text-ink">{e.name}</span> {e.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {optimized > 0 && (
        <div className="flex items-start gap-2.5 rounded-md bg-accent-soft px-4 py-3 ring-1 ring-accent">
          <Wand2 size={17} strokeWidth={2.2} className="mt-[3px] shrink-0 text-accent" />
          <span className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">
            {optimized === 1
              ? t("Resized {count} image to fit. Nothing was skipped for size.", {
                  count: optimized,
                })
              : t("Resized {count} images to fit. Nothing was skipped for size.", {
                  count: optimized,
                })}
          </span>
        </div>
      )}

      {flattened > 0 && (
        <div className="flex items-start gap-2.5 rounded-md bg-accent-soft px-4 py-3 ring-1 ring-accent">
          <AlertTriangle size={17} strokeWidth={2.2} className="mt-[3px] shrink-0 text-accent" />
          <span className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">
            {flattened === 1
              ? t(
                  "{count} GIF was over 2 MB, so we kept the first frame. Export it smaller to keep the animation.",
                  { count: flattened },
                )
              : t(
                  "{count} GIFs were over 2 MB, so we kept the first frame. Export it smaller to keep the animation.",
                  { count: flattened },
                )}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className={ROW_TITLE}>
          {kind === "badge" ? t("Quality badges") : t("Award icons")}
        </span>
        <span className="text-[15.5px] leading-[22px] tabular-nums text-ink-subtle">
          {byKey.size === 1
            ? t("{count} slot reskinned", { count: byKey.size })
            : t("{count} slots reskinned", { count: byKey.size })}
        </span>
      </div>

      <div className="flex flex-col gap-6">
        {allGroups.map((g) => (
          <div key={g.title} className="flex flex-col gap-2.5">
            <span className="harbor-settings-label">{t(g.title)}</span>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
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
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface p-3">
              <input
                ref={customInputRef}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") return addCustom();
                  if (!isBackKey(e.nativeEvent)) return;
                  if (e.currentTarget.hasAttribute("data-search-editing")) return;
                  e.preventDefault();
                  e.stopPropagation();
                  cancelCustom(navOwnsFocus(e.currentTarget));
                }}
                placeholder={t("Custom award name (e.g. My Festival)")}
                className="h-11 min-w-0 flex-1 rounded-md bg-canvas px-3.5 text-[15.5px] leading-[22px] text-ink transition-colors placeholder:text-ink-subtle focus:bg-elevated focus:outline-none"
              />
              <button
                onClick={addCustom}
                disabled={!normalizeCustomKey(customName)}
                className="inline-flex h-11 items-center gap-2 rounded-md bg-ink px-5 text-[15.5px] font-semibold leading-[22px] text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97] disabled:opacity-40"
              >
                <ImagePlus size={17} /> {t("Pick art")}
              </button>
              <button
                onClick={(e) => cancelCustom(navOwnsFocus(e.currentTarget))}
                className="h-11 rounded-md px-4 text-[15.5px] font-medium leading-[22px] text-ink-subtle transition-colors hover:text-ink"
              >
                {t("Cancel")}
              </button>
            </div>
          ) : (
            <button
              ref={addCustomRef}
              onClick={() => setAddingCustom(true)}
              className="inline-flex h-11 w-fit items-center gap-2 rounded-md border border-dashed border-edge px-5 text-[15.5px] font-medium leading-[22px] text-ink-muted transition-colors hover:border-accent hover:text-ink"
            >
              <Plus size={18} strokeWidth={2.2} /> {t("Add a custom award type")}
            </button>
          ))}
      </div>

      {byKey.size === 0 && (
        <p className="max-w-[70ch] text-[15.5px] leading-[22px] text-accent">
          {t("Add art to at least one slot to continue.")}
        </p>
      )}

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
  const t = useT();
  const done = !!art;
  return (
    <div className="group relative flex flex-col items-center gap-1.5">
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
        className={`relative grid aspect-square min-h-11 w-full cursor-pointer place-items-center overflow-hidden rounded-md border p-2.5 transition-colors ${
          done
            ? "border-accent bg-accent-soft"
            : "border-edge-soft bg-elevated hover:border-edge hover:bg-raised"
        }`}
      >
        {art ? (
          <img src={art} alt={label} className="h-full w-full object-contain" />
        ) : fallback ? (
          <img
            src={fallback}
            alt={label}
            className="h-full w-full object-contain opacity-35 transition-opacity group-hover:opacity-60"
          />
        ) : (
          <ImagePlus
            size={22}
            strokeWidth={1.7}
            className="text-ink-subtle transition-colors group-hover:text-ink"
          />
        )}
      </div>
      {onClear && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          aria-label={t("Remove")}
          className="absolute end-0 top-0 grid h-11 w-11 place-items-center opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 [[data-input-modality=keys]_&]:opacity-100"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors group-hover:bg-black/75">
            <Trash2 size={15} />
          </span>
        </button>
      )}
      <span className="w-full truncate text-center text-[15.5px] leading-[22px] text-ink-subtle">
        {label}
      </span>
    </div>
  );
}

function KindTab({
  active,
  onClick,
  icon: Icon,
  label,
  btnRef,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Medal;
  label: string;
  btnRef?: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      ref={btnRef}
      onClick={onClick}
      className={`flex h-11 items-center gap-2 rounded-full px-5 text-[15.5px] font-semibold leading-[22px] transition-colors ${
        active ? "bg-ink text-canvas" : "text-ink-muted hover:text-ink"
      }`}
    >
      <Icon size={18} strokeWidth={2.2} className={active ? "" : "text-accent"} /> {label}
    </button>
  );
}
