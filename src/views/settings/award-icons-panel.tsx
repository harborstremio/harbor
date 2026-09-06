import { BookOpen, Check, Copy, Download, RotateCcw, Trash2, Upload } from "./icons";
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
import { ROW_DESC, Section } from "./shared";
import { ModalButton, SettingGroup, SettingRow, SettingsModal } from "./kit";
import { SButton, SRow, SSection } from "./ui";

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const ICON_BTN = `grid h-11 w-11 shrink-0 place-items-center rounded-[8px] text-ink-muted transition-colors hover:bg-raised hover:text-ink ${FOCUS_RING}`;

const ICON_BTN_DANGER = `grid h-11 w-11 shrink-0 place-items-center rounded-[8px] text-ink-muted transition-colors hover:bg-raised hover:text-danger ${FOCUS_RING}`;

const FIELD = `h-11 w-full min-w-0 max-w-[520px] rounded-[10px] border border-edge-soft bg-elevated px-4 text-[16.5px] text-ink outline-none placeholder:text-ink-subtle focus-visible:border-edge ${FOCUS_RING}`;

const CODE_BLOCK =
  "overflow-x-auto rounded-[10px] bg-elevated p-4 font-mono text-[15.5px] leading-[22px] text-ink";

const MODAL_LABEL = "harbor-settings-label";

const AWARD_GRID = "grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-3";

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
      <Section title={t("Award Icons")} bare>
        <SSection>
          <SettingRow
            icon={<Download size={18} strokeWidth={2.2} />}
            label={t("Install a pack")}
            desc={t(
              "Point Harbor at a hosted pack link, upload your own images, or import a .zip. Harbor stores the link, so the artwork stays with whoever made it.",
            )}
            warn={errorMessage ?? undefined}
          >
            <ModalButton onClick={() => setShowInstall(true)}>{t("Install")}</ModalButton>
          </SettingRow>

          <SettingRow
            icon={<BookOpen size={18} strokeWidth={2.2} />}
            label={t("How to make an award pack")}
            desc={t(
              "An award pack is a single JSON file plus the images it points to. Host both anywhere public (your own server, a GitHub repo, etc.) and share the JSON URL. Harbor only stores the URLs you install, never the images.",
            )}
          >
            <ModalButton ghost onClick={() => setShowHelp(true)}>
              {t("Show instructions")}
            </ModalButton>
          </SettingRow>
        </SSection>

        {packs.length > 0 && (
          <Section title={t("Installed packs")}>
            {packs.map((p) => (
              <SRow
                key={p.name}
                title={p.name}
                description={[p.author, `${Object.keys(p.icons).length} ${t("icons")}`]
                  .filter(Boolean)
                  .join(" · ")}
                trailing={
                  <SButton variant="danger" onClick={() => removePack(p.name)}>
                    <Trash2 size={18} />
                    {t("Remove")}
                  </SButton>
                }
              />
            ))}
          </Section>
        )}

        <Section
          title={t("Customize each award")}
          subtitle={t(
            "Upload an image per award, or name your zip files after the ID shown under each one (tap to copy). Natural names work too, so best_soundtrack, movie_of_the_year, etc. still match.",
          )}
        >
          {AWARD_ICON_REGISTRY.map((group) => (
            <SettingGroup key={group.title} label={t(group.title)}>
              <div className={AWARD_GRID}>
                {group.items.map((item) => {
                  const icon = resolveAwardIcon(item.key) ?? defaultAwardIcon(item.key);
                  const isCustom = item.key in custom;
                  return (
                    <div
                      key={item.key}
                      className={`flex items-center gap-3 rounded-[10px] border p-3 ${
                        isCustom ? "border-accent" : "border-edge-soft"
                      }`}
                    >
                      <span className="relative grid h-11 w-11 shrink-0 place-items-center">
                        <img
                          src={icon}
                          alt=""
                          className="h-11 w-11 rounded-[8px] object-contain"
                          draggable={false}
                        />
                        {isCustom && (
                          <span className="absolute -bottom-1 -end-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-canvas">
                            <Check size={13} strokeWidth={3} />
                          </span>
                        )}
                      </span>

                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[16.5px] font-medium leading-[24px] tracking-[-0.1px] text-ink">
                          {t(item.label)}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyFilename(item.key)}
                          title={t("Copy filename")}
                          className={`-mx-1 flex min-h-11 min-w-0 items-center gap-2 rounded-[8px] px-1 text-start font-mono text-[15.5px] leading-[22px] text-ink-subtle transition-colors hover:text-ink ${FOCUS_RING}`}
                        >
                          <span className="min-w-0 break-all">
                            {copied === item.key ? t("copied!") : `${item.key}.png`}
                          </span>
                          {copied === item.key ? (
                            <Check size={16} className="shrink-0 text-accent" />
                          ) : (
                            <Copy size={16} className="shrink-0" />
                          )}
                        </button>
                      </span>

                      <button
                        type="button"
                        onClick={() => void pickAndUpload(item.key)}
                        title={t("Upload")}
                        aria-label={t("Upload")}
                        className={ICON_BTN}
                      >
                        <Upload size={18} />
                      </button>

                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => clearCustomIcon(item.key)}
                          title={t("Reset")}
                          aria-label={t("Reset")}
                          className={ICON_BTN_DANGER}
                        >
                          <RotateCcw size={18} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </SettingGroup>
          ))}
        </Section>
      </Section>

      <SettingsModal
        open={showInstall}
        onClose={() => setShowInstall(false)}
        title={t("Install a pack")}
        sub={t("Packs stay hosted by their maker. Harbor keeps the link, not the artwork.")}
      >
        <section className="flex flex-col gap-[11px]">
          <h3 className={MODAL_LABEL}>{t("From a link")}</h3>
          <input
            ref={packUrlRef}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && install()}
            placeholder="https://example.com/my-award-pack.json"
            className={FIELD}
          />
          <div className="flex flex-wrap items-center gap-2.5">
            <SButton variant="primary" onClick={install} disabled={busy || !url.trim()}>
              {busy ? t("Installing...") : t("Install")}
            </SButton>
          </div>
        </section>

        <section className="flex flex-col gap-[11px]">
          <h3 className={MODAL_LABEL}>{t("From your own files")}</h3>
          <div className="flex flex-wrap items-center gap-2.5">
            <SButton onClick={uploadMultiple} disabled={busy}>
              <Upload size={18} />
              {t("Upload multiple images")}
            </SButton>
            <SButton onClick={importZip} disabled={busy}>
              <Upload size={18} />
              {t("Import a .zip pack")}
            </SButton>
          </div>
          <p className={`max-w-[66ch] ${ROW_DESC}`}>
            {t(
              "Name each file after its award ID. Harbor resizes them and skips anything it cannot match.",
            )}
          </p>
        </section>

        {importMessage && <p className={`max-w-[66ch] ${ROW_DESC}`}>{importMessage}</p>}
        {errorMessage && (
          <p className="max-w-[66ch] text-[15.5px] font-normal leading-[22px] text-danger">
            {errorMessage}
          </p>
        )}
      </SettingsModal>

      <SettingsModal
        open={showHelp}
        onClose={() => setShowHelp(false)}
        title={t("How to make an award pack")}
      >
        <pre className={CODE_BLOCK}>{`{
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
        <p className={`max-w-[70ch] ${ROW_DESC}`}>
          {t(
            "Each key above is an award ID. Any key you omit falls back to the default trophy (or a lower-priority pack). The full list of IDs is every award shown in the grid above.",
          )}
        </p>

        <h3 className={MODAL_LABEL}>{t("Or just zip up images")}</h3>
        <p className={`max-w-[70ch] ${ROW_DESC}`}>
          {t(
            'Name each image file after its award ID and put them in a .zip, then use "Import a .zip pack" above. No JSON, no hosting needed. Harbor matches each file to its award, stores it locally, resizes it, and skips anything it doesn\'t recognize.',
          )}
        </p>
        <pre className={CODE_BLOCK}>{`my-pack.zip
├─ oscar.png
├─ emmy.png
├─ crunchyroll.png
└─ best_romance.png`}</pre>
      </SettingsModal>
    </>
  );
}
