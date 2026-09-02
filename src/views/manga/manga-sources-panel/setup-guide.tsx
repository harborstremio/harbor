import { useState, type ReactNode } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FolderOpen,
  Server,
} from "lucide-react";
import { openUrl } from "@/lib/window";
import { CARD } from "./shared";
import { useT } from "@/lib/i18n";

const SUWAYOMI_RELEASES = "https://github.com/Suwayomi/Suwayomi-Server/releases";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function buildCheatSheet(t: Translate): string {
  return `# ${t("Getting manga sources into Harbor")}

${t(
  "Harbor ships no manga and no scrapers. It is a reader. You bring the sources, and what those sources contain belongs to whoever runs them, not to Harbor. There are two ways to add sources.",
)}

## 1. ${t("Everything else, through your own server (Suwayomi)")}
${t("This is how you get hundreds of community sources.")}

  1. ${t("Download and run Suwayomi Server:")}
     ${SUWAYOMI_RELEASES}
     ${t("It serves a web UI at {url}", { url: "http://localhost:4567" })}

  2. ${t(
    "Open {url} in a browser. Go to the Extensions / Browse area, add a community source repository, then install the sources you want (hundreds are available). Suwayomi uses the same extension repos the Mihon / Tachiyomi ecosystem does.",
    { url: "http://localhost:4567" },
  )}

  3. ${t(
    "Back in Harbor: Manga > Set up a source > Your server, and paste your server address (for example {localUrl}, or your LAN IP if it runs on another machine, e.g. {lanUrl}).",
    { localUrl: "http://localhost:4567", lanUrl: "http://192.168.1.10:4567" },
  )}

  ${t(
    "Every source you enable in Suwayomi then shows up in Harbor. Suwayomi keeps its extensions updated when a site changes, so they keep working.",
  )}

## 2. ${t("A local folder")}
${t(
  "Manga > Set up a source > Local folder, and choose a folder of manga you already own (CBZ files or folders of images).",
)}

## ${t("Advanced: build a plugin")}
${t(
  "Harbor also has an experimental plugin runtime. If you want to write a source plugin, see {path} in the Harbor repository. Only install plugins from repositories you trust.",
  { path: "docs/manga-plugins.md" },
)}
`;
}

function StepList() {
  const t = useT();
  const steps: Array<{ icon: typeof Server; title: string; body: ReactNode }> = [
    {
      icon: Server,
      title: t("Everything else, via your own server"),
      body: (
        <>
          {t("Run")}{" "}
          <button
            type="button"
            onClick={() => openUrl(SUWAYOMI_RELEASES)}
            className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
          >
            Suwayomi <ExternalLink size={13} />
          </button>{" "}
          {t(
            "on your machine, install the sources you want inside it (hundreds are available), then add its address (like",
          )}{" "}
          <code className="rounded bg-canvas/60 px-1">http://localhost:4567</code>){" "}
          {t("under Your server above. Everything you enable there shows up here.")}
        </>
      ),
    },
    {
      icon: FolderOpen,
      title: t("A folder you already have"),
      body: <>{t("Point Local folder at CBZ files or folders of images you already own.")}</>,
    },
  ];
  return (
    <div className="flex flex-col gap-4 border-t border-edge-soft p-5">
      {steps.map((s, i) => {
        const Icon = s.icon;
        return (
          <div key={i} className="flex gap-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-raised text-ink-muted ring-1 ring-edge-soft">
              <Icon size={17} />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[14.5px] font-semibold text-ink">{s.title}</span>
              <span className="text-[13.5px] leading-relaxed text-ink-muted">{s.body}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SetupGuide() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const cheatSheet = buildCheatSheet(t);
  const download = () => {
    try {
      const blob = new Blob([cheatSheet], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "harbor-manga-sources-guide.md";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      void navigator.clipboard?.writeText(cheatSheet);
    }
  };

  const copy = () => {
    void navigator.clipboard?.writeText(cheatSheet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="mt-2 px-1 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-subtle">
        {t("Run your own server")}
      </p>
      <div className={`transition-all ${open ? "ring-edge" : "hover:ring-edge"} ${CARD}`}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-4 px-5 py-4 text-start active:scale-[0.99]"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-canvas text-ink-muted ring-1 ring-edge-soft">
            <BookOpen size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[16px] font-semibold text-ink">
              {t("Suwayomi / Tachidesk walkthrough")}
            </span>
            <span className="truncate text-[13px] text-ink-muted">
              {t(
                "Prefer a server? Run every source through your own Suwayomi and point Harbor at it",
              )}
            </span>
          </span>
          <ChevronDown
            size={20}
            className={`shrink-0 text-ink-subtle transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <>
            <StepList />
            <div className="flex flex-wrap gap-2.5 border-t border-edge-soft p-5">
              <button
                type="button"
                onClick={download}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-[14px] font-semibold text-canvas transition-all hover:opacity-90 active:scale-95"
              >
                <Download size={17} strokeWidth={2.2} />
                {t("Download cheat sheet")}
              </button>
              <button
                type="button"
                onClick={copy}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-raised px-5 text-[14px] font-semibold text-ink-muted ring-1 ring-edge-soft transition-all hover:text-ink active:scale-95"
              >
                {copied ? (
                  <Check size={17} strokeWidth={2.4} className="text-accent" />
                ) : (
                  <Copy size={16} />
                )}
                {copied ? t("Copied") : t("Copy")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
