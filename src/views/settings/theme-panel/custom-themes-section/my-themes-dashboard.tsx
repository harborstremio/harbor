import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, RefreshCw, UploadCloud } from "../../icons";
import { currentAuthor, subscribeAuthor } from "@/lib/theme-auth";
import { myThemes, type StoreTheme } from "@/lib/theme-store";
import { useT } from "@/lib/i18n";
import { ROW_TITLE } from "../../shared";
import { CheatSheet } from "../theme-studio/cheat-sheet";
import { AuthorAccountPanel } from "./author-account-panel";
import { SignedInBar, type AuthorStats } from "./author-account-panel/signed-in-bar";
import { ClaimPanel } from "./my-themes-dashboard/claim-panel";
import { MyThemeRow } from "./my-themes-dashboard/my-theme-row";
import { ThemeUpdateFlow } from "./theme-update-flow";

export function ApiCheatCard({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        className={`flex flex-col gap-3 rounded-md bg-surface ring-1 ring-edge-soft ${compact ? "p-4" : "p-5"}`}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-elevated text-ink-muted">
            <BookOpen size={20} strokeWidth={2} />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className={ROW_TITLE}>{t("Theme API cheat sheet")}</span>
            <span className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">
              {t(
                "Every color token, stable selector, {api} call, live hook (bell, account menu, avatar, status dot, unread badge), and copy-paste recipe.",
                { api: "window.harbor" },
              )}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-11 items-center justify-center gap-2 rounded-md bg-ink text-[15.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
        >
          <BookOpen size={18} strokeWidth={2.2} />
          {t("Open the cheat sheet")}
        </button>
      </div>
      {open && <CheatSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function computeStats(themes: StoreTheme[]): AuthorStats {
  const published = themes.length;
  const downloads = themes.reduce((s, t) => s + (t.downloads || 0), 0);
  const rated = themes.filter((t) => t.ratingCount > 0);
  const weight = rated.reduce((s, t) => s + t.ratingCount, 0);
  const rating =
    weight > 0 ? rated.reduce((s, t) => s + t.ratingAvg * t.ratingCount, 0) / weight : null;
  const inReview = themes.filter((t) => t.status === "pending").length;
  return { published, downloads, rating, inReview };
}

export function MyThemesDashboard() {
  const t = useT();
  const [author, setAuthor] = useState(currentAuthor);
  const [themes, setThemes] = useState<StoreTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<StoreTheme | null>(null);

  useEffect(() => subscribeAuthor(() => setAuthor(currentAuthor())), []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    myThemes()
      .then(setThemes)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (author) load();
    else {
      setThemes([]);
      setLoading(false);
    }
  }, [author, load]);

  const stats = useMemo(() => computeStats(themes), [themes]);

  if (!author) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 pt-2">
        <AuthorAccountPanel />
        <ApiCheatCard />
      </div>
    );
  }

  const existingIds = new Set(themes.map((t) => t.id));

  return (
    <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-8">
      <SignedInBar author={author} stats={stats} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <h3 className="text-[18px] font-semibold tracking-tight text-ink">
                {t("Published themes")}
              </h3>
              <p className="max-w-[70ch] text-[15.5px] leading-[22px] text-ink-subtle">
                {t("Push updates, flip visibility, and track where each one is in review.")}
              </p>
            </div>
            <button
              onClick={load}
              aria-label={t("Refresh")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted ring-1 ring-edge-soft transition-colors hover:text-ink hover:ring-edge"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="harbor-skel h-[176px] rounded-md bg-surface ring-1 ring-edge-soft"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-md bg-danger/15 px-4 py-6 text-center text-[15.5px] leading-[22px] text-danger ring-1 ring-danger">
              {error}
            </div>
          ) : themes.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {themes.map((t) => (
                <MyThemeRow key={t.id} theme={t} onUpdate={setUpdating} onChanged={load} />
              ))}
            </div>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          <ApiCheatCard />
          <ClaimPanel existingIds={existingIds} onClaimed={load} />
        </aside>
      </div>

      {updating && (
        <ThemeUpdateFlow
          target={updating}
          onClose={() => setUpdating(null)}
          onUpdated={() => {
            setUpdating(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function EmptyState() {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-edge-soft bg-surface px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-md bg-elevated text-ink-muted">
        <UploadCloud size={24} strokeWidth={1.9} />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <span className={ROW_TITLE}>{t("No published themes yet")}</span>
        <span className="max-w-[70ch] text-[15.5px] leading-[22px] text-ink-subtle">
          {t(
            "Open the library, hit Share a theme, and your first publication shows up here with its review status, downloads, and version history.",
          )}
        </span>
      </div>
    </div>
  );
}
