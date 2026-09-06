import { ChevronLeft } from "../../icons";
import { useEffect, useState } from "react";
import { BETA_THEMES } from "@/lib/theme";
import { getActiveModal, isBackKey } from "@/lib/keyboard-navigation/geometry";
import { useT } from "@/lib/i18n";
import { BetaThemesCard, BetaThemesModal } from "./beta-themes-modal";
import { clearUnseenDownloads, getUnseenDownloads, subscribeUnseen } from "@/lib/theme-store";
import { CommunityStore } from "./community-store/community-store";
import type { StoreTab } from "./community-store/store-tabs";
import { MarketSegmented } from "./community-store/market/market-segmented";
import { MyThemesDashboard } from "./my-themes-dashboard";
import type { LibraryEntry } from "./library-grid";
import { BrowserCard } from "./library-browser-card";
import { MyLibraryFilters, type LibCat } from "./my-library-filters";
import { ThemeUpdatesBanner } from "./theme-updates-banner";

export function LibraryBrowser({
  entries,
  activeId,
  onActivate,
  onExport,
  onDownload,
  onRemove,
  onClose,
  initialTab = "library",
  initialStoreTab,
}: {
  entries: LibraryEntry[];
  activeId: string;
  onActivate: (id: string) => void;
  onExport: (id: string) => void;
  onDownload: (id: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
  initialTab?: "library" | "community" | "mine";
  initialStoreTab?: StoreTab;
}) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isBackKey(e)) return;
      if (getActiveModal(e.target instanceof HTMLElement ? e.target : null)) return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const [tab, setTab] = useState<"library" | "community" | "mine">(initialTab);
  const [betaOpen, setBetaOpen] = useState(false);
  const [libQuery, setLibQuery] = useState("");
  const [libCat, setLibCat] = useState<LibCat>("all");
  const [unseen, setUnseen] = useState(() => getUnseenDownloads().length);

  useEffect(() => subscribeUnseen(() => setUnseen(getUnseenDownloads().length)), []);
  useEffect(() => {
    if (tab === "library") clearUnseenDownloads();
  }, [tab]);

  const builtIn = entries.filter((e) => e.category === "Built-in");
  const featured = entries.filter((e) => e.category === "Featured");
  const templates = entries.filter((e) => e.category === "Template");
  const yours = entries.filter((e) => e.category === "Yours");

  const libAll = [...featured, ...builtIn, ...templates, ...yours];
  const libQ = libQuery.trim().toLowerCase();
  const libFiltering = libQ !== "" || libCat !== "all";
  const libShown = libAll.filter((e) => {
    const blurb =
      e.category === "Yours" || !e.theme.blurb ? (e.theme.blurb ?? "") : t(e.theme.blurb);
    if (libCat !== "all" && e.category !== libCat) return false;
    if (libQ && !`${e.theme.name} ${blurb}`.toLowerCase().includes(libQ)) return false;
    return true;
  });
  const libCounts: Record<string, number> = {
    Featured: featured.length,
    "Built-in": builtIn.length,
    Template: templates.length,
    Yours: yours.length,
  };

  return (
    <div className="flex w-full flex-col gap-7">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <button
          type="button"
          onClick={onClose}
          className="group inline-flex min-h-11 items-center gap-1.5 text-[15.5px] font-semibold text-ink-subtle transition-colors hover:text-ink"
        >
          <ChevronLeft
            size={18}
            strokeWidth={2.4}
            className="dir-icon transition-transform group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5"
          />
          {t("Your themes")}
        </button>
        <MarketSegmented
          items={[
            { id: "library", label: "My library", badge: unseen > 0 ? unseen : undefined },
            { id: "community", label: "Community" },
            { id: "mine", label: "My themes" },
          ]}
          active={tab}
          onSelect={(id) => setTab(id as "library" | "community" | "mine")}
        />
      </div>

      <div className="flex flex-col gap-8">
        {tab === "community" ? (
          <CommunityStore initialTab={initialStoreTab} />
        ) : tab === "mine" ? (
          <MyThemesDashboard />
        ) : (
          <>
            <ThemeUpdatesBanner />
            <MyLibraryFilters
              query={libQuery}
              onQuery={setLibQuery}
              cat={libCat}
              onCat={setLibCat}
              counts={libCounts}
              shown={libShown.length}
              total={libAll.length}
            />
            {libFiltering ? (
              libShown.length > 0 ? (
                <BrowserGrid
                  entries={libShown}
                  activeId={activeId}
                  onActivate={onActivate}
                  onExport={onExport}
                  onDownload={onDownload}
                  onRemove={onRemove}
                />
              ) : (
                <p className="mx-auto max-w-[70ch] rounded-md border border-dashed border-edge px-4 py-14 text-center text-[15.5px] leading-[22px] text-ink-subtle">
                  {t("No themes match your filter.")}
                </p>
              )
            ) : (
              <>
                {featured.length > 0 && (
                  <BrowserSection
                    title="Featured"
                    subtitle="Hand-picked reskins from the Harbor crew."
                  >
                    <BrowserGrid
                      entries={featured}
                      activeId={activeId}
                      onActivate={onActivate}
                      onExport={onExport}
                      onDownload={onDownload}
                      onRemove={onRemove}
                    />
                  </BrowserSection>
                )}
                {BETA_THEMES.length > 0 && (
                  <BrowserSection title="Beta" subtitle="Experimental 1:1 ports of other apps.">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      <BetaThemesCard
                        count={BETA_THEMES.length}
                        onClick={() => setBetaOpen(true)}
                      />
                    </div>
                  </BrowserSection>
                )}
                {builtIn.length > 0 && (
                  <BrowserSection title="Built-in" subtitle="Ships with Harbor. Always available.">
                    <BrowserGrid
                      entries={builtIn}
                      activeId={activeId}
                      onActivate={onActivate}
                      onExport={onExport}
                      onDownload={onDownload}
                      onRemove={onRemove}
                    />
                  </BrowserSection>
                )}
                {templates.length > 0 && (
                  <BrowserSection
                    title="Templates"
                    subtitle="Starting points to remix and save your own."
                  >
                    <BrowserGrid
                      entries={templates}
                      activeId={activeId}
                      onActivate={onActivate}
                      onExport={onExport}
                      onDownload={onDownload}
                      onRemove={onRemove}
                    />
                  </BrowserSection>
                )}
                {yours.length > 0 && (
                  <BrowserSection title="Your themes" subtitle="Themes you imported or built.">
                    <BrowserGrid
                      entries={yours}
                      activeId={activeId}
                      onActivate={onActivate}
                      onExport={onExport}
                      onDownload={onDownload}
                      onRemove={onRemove}
                    />
                  </BrowserSection>
                )}
              </>
            )}
          </>
        )}
      </div>
      <BetaThemesModal
        open={betaOpen}
        activeId={activeId}
        onActivate={onActivate}
        onClose={() => setBetaOpen(false)}
      />
    </div>
  );
}

function BrowserSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col">
        <h3 className="text-[17px] font-semibold tracking-tight text-ink">{t(title)}</h3>
        <p className="max-w-[70ch] text-[15.5px] leading-[22px] text-ink-subtle">{t(subtitle)}</p>
      </div>
      {children}
    </section>
  );
}

function BrowserGrid({
  entries,
  activeId,
  onActivate,
  onExport,
  onDownload,
  onRemove,
}: {
  entries: LibraryEntry[];
  activeId: string;
  onActivate: (id: string) => void;
  onExport: (id: string) => void;
  onDownload: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {entries.map((e) => (
        <BrowserCard
          key={e.theme.id}
          theme={e.theme}
          removable={e.removable}
          active={activeId === e.theme.id}
          onActivate={() => onActivate(e.theme.id)}
          onExport={() => onExport(e.theme.id)}
          onDownload={() => onDownload(e.theme.id)}
          onRemove={() => onRemove(e.theme.id)}
        />
      ))}
    </div>
  );
}
