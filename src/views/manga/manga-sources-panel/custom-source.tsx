import { useState, type ComponentType } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  FileJson,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  Loader2,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Tag,
} from "lucide-react";
import { addHtmlSource } from "@/lib/manga/sources";
import { parseHtmlConfig, resolveFavicon } from "@/lib/manga/sources/html";
import { downloadText } from "@/lib/download-text";
import { CARD } from "./shared";

const FIELD =
  "h-12 w-full rounded-xl border border-edge bg-canvas pe-4 text-[14.5px] text-ink outline-none transition-all duration-200 placeholder:text-ink-subtle hover:border-edge focus:border-accent/55 focus:ring-2 focus:ring-accent/15";
import { CustomSourceHelp } from "./custom-source-help";
import { EXAMPLE, GUIDE_TXT, AI_PROMPT } from "./custom-source-content";
import { useT } from "@/lib/i18n";

type ChipIcon = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

function ResourceChip({
  icon: Icon,
  label,
  sub,
  onClick,
  done,
}: {
  icon: ChipIcon;
  label: string;
  sub: string;
  onClick: () => void;
  done?: boolean;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/chip flex items-center gap-2.5 rounded-xl border border-edge-soft bg-elevated/30 px-3 py-2.5 text-start transition-all duration-200 hover:border-edge hover:bg-elevated/60 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-raised text-ink-muted ring-1 ring-edge-soft transition-colors group-hover/chip:text-ink">
        {done ? (
          <Check size={15} strokeWidth={2.6} className="text-accent" />
        ) : (
          <Icon size={15} strokeWidth={2} />
        )}
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-[12.5px] font-semibold text-ink">
          {done ? t("Copied") : label}
        </span>
        <span className="truncate text-[11px] text-ink-subtle">{sub}</span>
      </span>
    </button>
  );
}

export function CustomSource() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [value, setValue] = useState("");
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const add = async () => {
    setError(null);
    const config = parseHtmlConfig(value);
    if (!config) {
      setError(
        t(
          "That config is not valid. It needs baseUrl, popularPath, list (item + link), chapters (item + link), and pages (image).",
        ),
      );
      return;
    }
    if (name.trim()) config.name = name.trim();
    setAdding(true);
    if (logo.trim()) config.iconUrl = logo.trim();
    else if (!config.iconUrl) config.iconUrl = await resolveFavicon(config.baseUrl);
    const ok = addHtmlSource(config);
    setAdding(false);
    if (!ok) {
      setError(t("Could not add that source."));
      return;
    }
    setValue("");
    setName("");
    setLogo("");
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  const copyExample = () => {
    void navigator.clipboard?.writeText(EXAMPLE);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className={`group/byos transition-all ${open ? "ring-edge" : "hover:ring-edge"} ${CARD}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-start transition-transform active:scale-[0.99] motion-reduce:active:scale-100"
      >
        <div className="flex items-center gap-4 px-5 py-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-canvas text-ink-muted ring-1 ring-edge-soft">
            <SlidersHorizontal size={20} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[16px] font-semibold text-ink">{t("Custom source")}</span>
            <span className="truncate text-[13px] text-ink-muted">
              {t("Point Harbor's built-in scraper at any HTML site with a config")}
            </span>
          </div>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-raised text-ink-muted ring-1 ring-edge-soft transition-colors group-hover/byos:text-ink">
            <Plus
              size={18}
              strokeWidth={2.4}
              className={`transition-transform duration-200 ${open ? "rotate-45" : ""}`}
            />
          </span>
        </div>
      </button>
      {open && (
        <div className="harbor-rise flex flex-col gap-5 border-t border-edge-soft p-5">
          <div className="flex gap-3 rounded-xl bg-danger/10 p-4 text-[12.5px] leading-relaxed text-ink-muted ring-1 ring-danger/25">
            <AlertTriangle size={18} strokeWidth={2.2} className="mt-0.5 shrink-0 text-danger" />
            <p>
              <b className="text-ink">{t("Publicly accessible pages only.")}</b>{" "}
              {t(
                "Harbor logs into nothing and bypasses no password, paywall, or access control, and must not be used to attempt it. Point it only at content you are legally allowed to read, and never at official or licensed publisher sites. You alone are responsible for what you connect and for following copyright and each site's terms. Harbor bundles and endorses no sites.",
              )}
            </p>
          </div>

          <section className="flex flex-col gap-2.5">
            <span className="px-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
              {t("Start with a template")}
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <ResourceChip
                icon={Copy}
                label={t("Copy example")}
                sub={t("To clipboard")}
                onClick={copyExample}
                done={copied}
              />
              <ResourceChip
                icon={FileJson}
                label={t("Template")}
                sub={t("Editable .json")}
                onClick={() =>
                  void downloadText("harbor-manga-source-template.json", EXAMPLE, ["json"])
                }
              />
              <ResourceChip
                icon={FileText}
                label={t("Guide")}
                sub={t("Setup .txt")}
                onClick={() =>
                  void downloadText("harbor-manga-source-guide.txt", GUIDE_TXT, ["txt"])
                }
              />
              <ResourceChip
                icon={Sparkles}
                label={t("AI prompt")}
                sub={t("For an AI agent")}
                onClick={() =>
                  void downloadText("harbor-manga-source-ai-prompt.txt", AI_PROMPT, ["txt"])
                }
              />
            </div>
          </section>

          <section className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                {t("Your config")}
              </span>
              <button
                type="button"
                onClick={() => setHelp((v) => !v)}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-ink"
              >
                <HelpCircle size={14} strokeWidth={2} />
                {help ? t("Hide help") : t("How it works")}
              </button>
            </div>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t(
                "Paste your scraping config as JSON here, or grab the template above to start.",
              )}
              spellCheck={false}
              autoCapitalize="off"
              className="h-60 w-full resize-y rounded-xl border border-edge bg-canvas px-4 pb-3.5 pt-3.5 font-mono text-[12.5px] leading-[1.7] text-ink shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] outline-none transition-all duration-200 placeholder:text-ink-subtle/80 focus:border-accent/55 focus:ring-2 focus:ring-accent/15"
            />
            {help && <CustomSourceHelp />}
          </section>

          <section className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <label className="relative min-w-0 flex-1">
                <Tag
                  size={16}
                  strokeWidth={2}
                  className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-subtle"
                />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("Source name")}
                  spellCheck={false}
                  className={`${FIELD} ps-11`}
                />
              </label>
              <label className="relative min-w-0 flex-1">
                <ImageIcon
                  size={16}
                  strokeWidth={2}
                  className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-subtle"
                />
                <input
                  value={logo}
                  onChange={(e) => setLogo(e.target.value)}
                  placeholder={t("Logo URL (optional, auto-detected if blank)")}
                  inputMode="url"
                  autoCapitalize="off"
                  spellCheck={false}
                  className={`${FIELD} ps-11`}
                />
              </label>
            </div>
            {error && <p className="text-[13px] font-medium text-danger">{error}</p>}
            <button
              type="button"
              onClick={add}
              disabled={adding}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-[15px] font-semibold text-canvas transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-70 motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              {adding ? (
                <Loader2 size={18} className="animate-spin motion-reduce:animate-none" />
              ) : added ? (
                <Check size={18} strokeWidth={2.6} />
              ) : (
                <Plus size={18} strokeWidth={2.4} />
              )}
              {adding ? t("Adding") : added ? t("Source added") : t("Add source")}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
