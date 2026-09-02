import { BookOpen, Download, RotateCcw, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { defaultAwardIcon } from "@/components/icons/award-logo";
import { isNativePick } from "@/components/avatar-picker/avatar-import";
import { useT } from "@/lib/i18n";
import {
  AWARD_ICON_REGISTRY,
  clearCustomIcon,
  installPackFromFiles,
  installPackFromUrl,
  installPackFromZip,
  removePack,
  resolveAwardIcon,
  setCustomIcon,
  useAwardPacks,
} from "@/lib/award-icons";
import { Section } from "./shared";
import { ModalButton, SettingGroup, SettingRow, SettingsModal } from "./kit";

const GHOST_BTN =
  "inline-flex h-10 items-center gap-2 rounded-md bg-raised px-4 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-40";

const PICK_EXT = ["png", "webp", "jpg", "jpeg", "svg"];
type AwardError =
  | { kind: "remote"; message: string }
  | { kind: "install-failed" }
  | { kind: "import-failed" };

type ImportSummary = { matched: number; skipped: number };

function mimeFor(name: string): string {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (ext === "jpg" || ext === "jfif") return "image/jpeg";
  if (ext === "svg") return "image/svg+xml";
  return `image/${ext || "png"}`;
}

async function pickImageFile(): Promise<File | null> {
  if (isNativePick()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const picked = await open({
      multiple: false,
      filters: [{ name: "Images", extensions: PICK_EXT }],
    });
    if (typeof picked !== "string") return null;
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const bytes = await readFile(picked);
    const name = picked.replace(/^.*[\/]/, "");
    return new File([bytes as BlobPart], name, { type: mimeFor(name) });
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = PICK_EXT.map((e) => `.${e}`).join(",");
    input.style.display = "none";
    input.onchange = () => {
      resolve(input.files?.[0] ?? null);
      input.remove();
    };
    document.body.appendChild(input);
    input.click();
  });
}

function storeIcon(key: string, file: File) {
  const reader = new FileReader();
  reader.onload = () => {
    const src = reader.result as string;
    if (file.type === "image/svg+xml") {
      setCustomIcon(key, src);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const max = 128;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
      setCustomIcon(key, canvas.toDataURL("image/png"));
    };
    img.onerror = () => setCustomIcon(key, src);
    img.src = src;
  };
  reader.readAsDataURL(file);
}

async function pickAndUpload(key: string) {
  const file = await pickImageFile();
  if (file) storeIcon(key, file);
}

export function AwardIconsPanel() {
  const t = useT();
  const { packs, custom } = useAwardPacks();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<AwardError | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const packUrlRef = useRef<HTMLInputElement>(null);

  const copyFilename = (key: string) => {
    navigator.clipboard?.writeText(`${key}.png`).catch(() => {});
    setCopied(key);
    window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1200);
  };

  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const errorMessage =
    err?.kind === "remote"
      ? err.message
      : err?.kind === "install-failed"
        ? t("Install failed")
        : err?.kind === "import-failed"
          ? t("Import failed")
          : null;
  const importMessage = importSummary
    ? `${t("Imported")} ${importSummary.matched}${
        importSummary.skipped ? ` · ${t("skipped")} ${importSummary.skipped}` : ""
      }`
    : null;

  const install = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setErr(null);
    setImportSummary(null);
    try {
      await installPackFromUrl(url.trim());
      setUrl("");
    } catch (e) {
      setErr(
        e instanceof Error ? { kind: "remote", message: e.message } : { kind: "install-failed" },
      );
    } finally {
      setBusy(false);
    }
  };

  const importZip = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip,application/zip";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setBusy(true);
      setErr(null);
      setImportSummary(null);
      try {
        const r = await installPackFromZip(file);
        setImportSummary({ matched: r.matched, skipped: r.unmatched.length });
      } catch (e) {
        setErr(
          e instanceof Error ? { kind: "remote", message: e.message } : { kind: "import-failed" },
        );
      } finally {
        setBusy(false);
      }
    };
    input.click();
  };

  const uploadMultiple = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/webp,image/jpeg,image/svg+xml";
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      if (files.length === 0) return;
      setBusy(true);
      setErr(null);
      setImportSummary(null);
      try {
        const r = await installPackFromFiles(files);
        setImportSummary({ matched: r.matched, skipped: r.unmatched.length });
      } catch (e) {
        setErr(
          e instanceof Error ? { kind: "remote", message: e.message } : { kind: "import-failed" },
        );
      } finally {
        setBusy(false);
      }
    };
    input.click();
  };

  return (
    <>
      <Section
        title={t("Award Icons")}
        subtitle={t(
          "Harbor ships a neutral trophy for every award. Install an icon pack or upload your own image per award to make them yours. Packs are hosted by whoever makes them, so the artwork is theirs, not bundled with Harbor.",
        )}
      >
        <SettingRow
          icon={<Download size={16} strokeWidth={2.2} />}
          label={t("Install a pack")}
          desc={t("From a hosted link, your own images, or a .zip.")}
          warn={errorMessage ?? undefined}
        >
          <ModalButton onClick={() => setShowInstall(true)}>{t("Install")}</ModalButton>
        </SettingRow>

        {packs.length > 0 && (
          <SettingGroup label={t("Installed packs")}>
            {packs.map((p) => (
              <div
                key={p.name}
                className="flex items-center justify-between gap-3 rounded-md bg-elevated px-4 py-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[13.5px] font-medium text-ink">{p.name}</span>
                  <span className="truncate text-[11.5px] text-ink-subtle">
                    {[p.author, `${Object.keys(p.icons).length} icons`].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removePack(p.name)}
                  aria-label={t("Remove")}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-raised hover:text-danger"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </SettingGroup>
        )}

        <SettingRow
          icon={<BookOpen size={16} strokeWidth={2.2} />}
          label={t("How to make an award pack")}
          desc={t(
            "An award pack is a single JSON file plus the images it points to. Host both anywhere public (your own server, a GitHub repo, etc.) and share the JSON URL. Harbor only stores the URLs you install, never the images.",
          )}
        >
          <ModalButton ghost onClick={() => setShowHelp((v) => !v)}>
            {showHelp ? t("Hide pack instructions") : t("Show instructions")}
          </ModalButton>
        </SettingRow>
      </Section>

      <Section
        title={t("Customize each award")}
        subtitle={t(
          "Upload an image per award, or name your zip files after the ID shown under each one (tap to copy). Natural names work too, so best_soundtrack, movie_of_the_year, etc. still match.",
        )}
      >
        {AWARD_ICON_REGISTRY.map((group) => (
          <SettingGroup key={group.title} label={t(group.title)}>
            <div className="grid grid-cols-2 gap-1.5">
              {group.items.map((item) => {
                const icon = resolveAwardIcon(item.key) ?? defaultAwardIcon(item.key);
                const isCustom = item.key in custom;
                return (
                  <div
                    key={item.key}
                    className="flex items-center gap-2.5 rounded-md bg-elevated px-3 py-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => void pickAndUpload(item.key)}
                      title={t("Upload")}
                      aria-label={t("Upload")}
                      className="group relative shrink-0 rounded-md outline-none"
                    >
                      <img
                        src={icon}
                        alt=""
                        className="h-8 w-8 rounded-md object-contain transition-opacity group-hover:opacity-25"
                        draggable={false}
                      />
                      <span className="absolute inset-0 grid place-items-center text-ink opacity-0 transition-opacity group-hover:opacity-100">
                        <Upload size={14} strokeWidth={2.2} />
                      </span>
                      {isCustom && (
                        <span className="absolute -end-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent" />
                      )}
                    </button>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[12.5px] leading-tight text-ink">
                        {t(item.label)}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyFilename(item.key)}
                        title={t("Copy filename")}
                        className="truncate text-start font-mono text-[10.5px] text-ink-subtle transition-colors hover:text-ink"
                      >
                        {copied === item.key ? t("copied!") : `${item.key}.png`}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => void pickAndUpload(item.key)}
                      aria-label={t("Upload")}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-raised hover:text-ink"
                    >
                      <Upload size={13.5} />
                    </button>
                    {isCustom && (
                      <button
                        type="button"
                        onClick={() => clearCustomIcon(item.key)}
                        aria-label={t("Reset")}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-raised hover:text-ink"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </SettingGroup>
        ))}
      </Section>

      <SettingsModal
        open={showInstall}
        onClose={() => setShowInstall(false)}
        title={t("Install a pack")}
        sub={t("Packs stay hosted by their maker. Harbor keeps the link, not the artwork.")}
      >
        <div className="flex flex-col gap-2.5 rounded-md bg-elevated p-4">
          <span className="text-[12.5px] font-semibold text-ink">{t("From a link")}</span>
          <div className="flex gap-2">
            <input
              ref={packUrlRef}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && install()}
              placeholder="https://example.com/my-award-pack.json"
              className="h-11 min-w-0 flex-1 rounded-md bg-canvas px-3.5 text-[13.5px] text-ink outline-none placeholder:text-ink-subtle"
            />
            <button
              type="button"
              onClick={install}
              disabled={busy || !url.trim()}
              className="h-11 shrink-0 rounded-md bg-ink px-5 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy ? t("Installing...") : t("Install")}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 rounded-md bg-elevated p-4">
          <span className="text-[12.5px] font-semibold text-ink">{t("From your own files")}</span>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={uploadMultiple} disabled={busy} className={GHOST_BTN}>
              <Upload size={14} />
              {t("Upload multiple images")}
            </button>
            <button type="button" onClick={importZip} disabled={busy} className={GHOST_BTN}>
              <Upload size={14} />
              {t("Import a .zip pack")}
            </button>
          </div>
          <span className="text-[12.5px] leading-relaxed text-ink-subtle">
            {t(
              "Name each file after its award ID. Harbor resizes them and skips anything it cannot match.",
            )}
          </span>
        </div>

        {importMessage && <p className="px-1 text-[12.5px] text-ink-muted">{importMessage}</p>}
        {errorMessage && <p className="px-1 text-[12.5px] text-danger">{errorMessage}</p>}
      </SettingsModal>

      <SettingsModal
        open={showHelp}
        onClose={() => setShowHelp(false)}
        title={t("How to make an award pack")}
      >
        <div className="flex flex-col gap-3 text-[13.5px] leading-relaxed text-ink-muted">
          <pre className="overflow-x-auto rounded-md bg-canvas p-3 text-[12.5px] text-ink">{`{
  "name": "My Award Pack",
  "author": "you",
  "version": "1.0",
  "icons": {
    "oscar": "https://your-host.com/oscar.png",
    "emmy": "https://your-host.com/emmy.png",
    "crunchyroll": "https://your-host.com/cr.png",
    "best_romance": "https://your-host.com/romance.png"
  }
}`}</pre>
          <p>
            {t(
              "Each key above is an award ID. Any key you omit falls back to the default trophy (or a lower-priority pack). The full list of IDs is every award shown in the grid above.",
            )}
          </p>
          <p className="font-semibold text-ink">{t("Or just zip up images")}</p>
          <p>
            {t(
              'Name each image file after its award ID and put them in a .zip, then use "Import a .zip pack" above. No JSON, no hosting needed. Harbor matches each file to its award, stores it locally, resizes it, and skips anything it doesn\'t recognize.',
            )}
          </p>
          <pre className="overflow-x-auto rounded-md bg-canvas p-3 text-[12.5px] text-ink">{`my-pack.zip
├─ oscar.png
├─ emmy.png
├─ crunchyroll.png
└─ best_romance.png`}</pre>
        </div>
      </SettingsModal>
    </>
  );
}
