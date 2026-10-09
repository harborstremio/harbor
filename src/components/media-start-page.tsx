import { ArrowRight, CalendarRange, FolderOpen, Globe2, PackagePlus, Server, Tv } from "lucide-react";
import type { Ref } from "react";
import { NavGlyph } from "@/components/icons/nav-glyph";
import { useT } from "@/lib/i18n";
import "./media-start-page.css";

type MediaStartKind = "ebook" | "manga" | "live";

/** Shared first-run composition; each view retains its existing setup flow. */
export function MediaStartPage({ kind, onSetup, actionLabel, actionRef }: {
  kind: MediaStartKind;
  onSetup: () => void;
  actionLabel?: string;
  actionRef?: Ref<HTMLButtonElement>;
}) {
  const t = useT();
  const routes = kind === "live" ? [
    { Icon: Tv, title: t("M3U playlist"), text: t("start.live.playlist") },
    { Icon: Globe2, title: t("Xtream codes"), text: t("Server URL plus username and password.") },
    { Icon: CalendarRange, title: t("EPG / XMLTV only"), text: t("start.live.guide") },
  ] : [
    {
      Icon: FolderOpen,
      title: t("Open a folder"),
      text: t(kind === "ebook"
        ? "Read EPUB, text, Markdown, and HTML books already on this device."
        : "Read manga files you already have"),
    },
    {
      Icon: PackagePlus,
      title: t("Install an extension"),
      text: t(kind === "ebook"
        ? "Add eBook sources from a repository you trust."
        : "start.manga.extensions"),
    },
    { Icon: Server, title: t("Connect a source"), text: t("start.server") },
  ];

  return (
    <section className="media-start-page" data-media-start={kind} aria-labelledby={`media-start-${kind}-title`}>
      <div className="media-start-inner">
        <header className="media-start-copy">
          <h1 className="font-display" id={`media-start-${kind}-title`}>
            <NavGlyph name={kind === "live" ? "livetv" : kind} />
            {t(`nav.${kind}`)}
          </h1>
          <p>{t(`start.${kind}.description`)}</p>
          <button
            ref={actionRef}
            type="button"
            className="media-start-primary rounded-lg bg-ink text-canvas"
            onClick={onSetup}
          >
            {actionLabel ?? t(kind === "ebook" ? "Set up eBooks" : kind === "manga" ? "Set up a source" : "Connect a provider")}
            <ArrowRight size={19} className="dir-icon" aria-hidden="true" />
          </button>
        </header>
        <div className="media-start-paths">
          <h2>{t("start.ways")}</h2>
          <ul>
            {routes.map(({ Icon, title, text }) => (
              <li key={title}>
                <span className="media-start-route-icon">
                  <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <div><h3>{title}</h3><p>{text}</p></div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
