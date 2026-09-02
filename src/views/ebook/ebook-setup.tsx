import { FolderOpen, Globe2, PackagePlus } from "lucide-react";
import { useT } from "@/lib/i18n";
import "./ebook-setup.css";

export function EBookSetup({ onSetup }: { onSetup: () => void }) {
  const t = useT();

  const routes = [
    {
      icon: <FolderOpen size={17} strokeWidth={1.9} />,
      title: t("Open a folder"),
      text: t("Read EPUB, text, Markdown, and HTML books already on this device."),
    },
    {
      icon: <PackagePlus size={17} strokeWidth={1.9} />,
      title: t("Install an extension"),
      text: t("Add eBook sources from a repository you trust."),
    },
    {
      icon: <Globe2 size={17} strokeWidth={1.9} />,
      title: t("Connect a source"),
      text: t("Bring your own server-rendered library aboard."),
    },
  ];

  return (
    <main
      data-ebook-page
      className="bg-canvas mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-5 overflow-y-auto overflow-x-hidden px-12 pb-20 pt-24 text-center"
    >
      <div className="ebook-shelf" aria-hidden="true">
        <span className="ebook-shelf-slot" />
        <span className="ebook-shelf-books">
          <i /><i /><i /><i />
        </span>
        <span className="ebook-shelf-edge" />
      </div>

      <h1 className="font-display text-[34px] font-medium leading-tight text-ink">
        {t("Read eBooks in Harbor")}
      </h1>

      <p className="max-w-md text-[14px] leading-relaxed text-ink-muted">
        {t("Harbor does not host any books. Open a folder on this device, install a source extension, or connect your own server. Metadata can describe a book, but a source is what lets Harbor open it.")}
      </p>

      <button
        type="button"
        onClick={onSetup}
        className="mt-1 flex h-11 items-center gap-2 rounded-xl bg-ink px-6 text-[14px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97]"
      >
        {t("Set up eBooks")}
      </button>

      <ul className="mt-6 flex w-full flex-col gap-1.5 text-start">
        {routes.map((route) => (
          <li key={route.title}>
            <button
              type="button"
              onClick={onSetup}
              className="flex w-full items-center gap-3.5 rounded-lg bg-elevated px-4 py-3 text-start transition-colors hover:bg-raised active:scale-[0.99]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink-muted">
                {route.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-ink">{route.title}</span>
                <span className="block text-[12.5px] leading-snug text-ink-subtle">{route.text}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-[12px] text-ink-subtle">
        {t("Harbor never hosts your books or source files.")}
      </p>
    </main>
  );
}
