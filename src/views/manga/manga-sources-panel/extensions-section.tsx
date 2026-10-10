import { Blocks, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { addRepo, removeRepo, repoUrlsSync, subscribePlugins, subscribeRepos } from "@/lib/manga/plugins";
import { removeAllMangayomiRecords } from "@/lib/manga/sources/mangayomi";
import { mangayomiSourcesSync, subscribeMangayomiSources } from "@/lib/manga/sources/mangayomi/store";
import { CARD, INPUT } from "./shared";
import { RepoCard } from "./extensions/repo-card";
import { useT } from "@/lib/i18n";

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 px-1 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-subtle">
      {children}
    </p>
  );
}

function Explainer() {
  const t = useT();
  return (
    <div className={`flex flex-col gap-3 px-5 py-4 ${CARD}`}>
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-canvas text-ink-muted ring-1 ring-edge-soft">
          <ShieldCheck size={18} />
        </span>
        <span className="text-[15.5px] font-semibold text-ink">{t("Bring your own extensions")}</span>
      </div>
      <p className="text-[13.5px] leading-relaxed text-ink-muted">
        {t(
          "Harbor ships no manga sources and hosts nothing. Extensions come from repositories other people maintain. Paste a repository URL below to browse its plugins, then install the ones you want. Every plugin runs sandboxed in an isolated worker with no access to your files, accounts, or the rest of the app.",
        )}
      </p>
      <p className="text-[13px] leading-relaxed text-ink-subtle">
        {t("Only add repositories you trust. Harbor cannot vouch for third-party plugins.")}
      </p>
    </div>
  );
}

export function ExtensionsSection() {
  const t = useT();
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    const u1 = subscribeRepos(bump);
    const u2 = subscribePlugins(bump);
    const u3 = subscribeMangayomiSources(bump);
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const urls = repoUrlsSync();
  const extCount = mangayomiSourcesSync().length;

  const clearAll = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      window.setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    setConfirmClear(false);
    void removeAllMangayomiRecords();
  };

  const add = async () => {
    const value = url.trim();
    if (!/^https?:\/\/.+/i.test(value)) {
      setError(t("Enter a valid http(s):// URL"));
      return;
    }
    setAdding(true);
    setError(null);
    try {
      await addRepo(value);
      setUrl("");
    } catch {
      setError(t("Could not load that repository"));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>{t("Extensions")}</SectionLabel>
      <Explainer />

      <div className={`flex flex-col gap-2.5 px-5 py-4 ${CARD}`}>
        <div className="flex items-center gap-2 text-ink-muted">
          <Blocks size={16} />
          <span className="text-[13.5px] font-semibold text-ink">{t("Add a repository")}</span>
        </div>
        <div className="flex gap-2.5">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !adding) void add();
            }}
            placeholder="https://example.com/repo.json"
            inputMode="url"
            autoCapitalize="off"
            spellCheck={false}
            className={`${INPUT} min-w-0 flex-1`}
          />
          <button
            type="button"
            onClick={add}
            disabled={adding}
            className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-[14.5px] font-semibold text-canvas transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
          >
            {adding ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} strokeWidth={2.4} />}
            {t("Add")}
          </button>
        </div>
        {error && <p className="text-[13px] font-medium text-danger">{error}</p>}
      </div>

      {urls.length === 0 ? (
        <p className="px-1 pb-1 text-[13.5px] text-ink-subtle">
          {t("No repositories yet. Add one above to start browsing plugins.")}
        </p>
      ) : (
        urls.map((u) => <RepoCard key={u} url={u} onRemove={() => void removeRepo(u)} />)
      )}

      {extCount > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className={`mt-1 flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold ring-1 transition-all active:scale-[0.98] ${
            confirmClear
              ? "bg-danger/15 text-danger ring-danger/40"
              : "bg-raised text-ink-subtle ring-edge-soft hover:text-danger"
          }`}
        >
          <Trash2 size={16} strokeWidth={2.2} />
          {confirmClear
            ? t("Tap again to remove all {n} extensions", { n: extCount })
            : t("Remove all extensions ({n})", { n: extCount })}
        </button>
      )}
    </div>
  );
}
