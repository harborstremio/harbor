import { AlertCircle, Loader2, PackageOpen, RefreshCw, ServerCog, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { browseRepo, installedPluginsSync, type PluginRepo } from "@/lib/manga/plugins";
import type { ForeignRepoKind } from "@/lib/manga/plugins/types";
import { CARD } from "../shared";
import { PluginRow } from "./plugin-row";
import { MangayomiImport } from "./mangayomi-import";
import { useT } from "@/lib/i18n";

function foreignMessage(kind: ForeignRepoKind, count: number, t: (s: string) => string): string {
  switch (kind) {
    case "tachiyomi":
      return (
        t(
          "This is a Tachiyomi / Mihon repo. Those are Android (APK) extensions, so Harbor can't run them directly. To use these sources on desktop, run a Suwayomi server and connect Harbor to it from the Servers section.",
        ) + ` (${count})`
      );
    case "mangayomi":
      return (
        t(
          "This is a Mangayomi repo. Native import isn't supported yet. For the largest catalog today, run a Suwayomi server and connect Harbor to it from the Servers section.",
        ) + ` (${count})`
      );
    case "paperback":
      return (
        t(
          "This is a Paperback (iOS) repo, which Harbor can't use. For desktop sources, connect a Suwayomi server from the Servers section.",
        ) + ` (${count})`
      );
    default:
      return t(
        "This doesn't look like a Harbor plugin repo. Harbor expects a JSON file shaped { name, plugins: [ ... ] }.",
      );
  }
}

function repoHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function RepoCard({ url, onRemove }: { url: string; onRemove: () => void }) {
  const t = useT();
  const [repo, setRepo] = useState<PluginRepo | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    browseRepo(url)
      .then((r) => {
        if (cancelled) return;
        setRepo(r);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [url, attempt]);

  const installed = installedPluginsSync();
  const byId = new Map(installed.map((p) => [p.id, p]));

  const remove = () => {
    setRemoving(true);
    window.setTimeout(onRemove, 220);
  };

  return (
    <div
      className={`overflow-hidden transition-all duration-300 ${removing ? "max-h-0 scale-[0.98] opacity-0" : "max-h-[900px]"} ${CARD}`}
    >
      <div className="flex items-center gap-3.5 px-5 py-3.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-canvas text-ink-muted ring-1 ring-edge-soft">
          <PackageOpen size={18} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[15.5px] font-semibold text-ink">
            {repo?.name ?? repoHost(url)}
          </span>
          <span className="truncate text-[12.5px] text-ink-subtle">{repoHost(url)}</span>
        </div>
        {state === "error" && (
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            aria-label={t("Retry loading repository")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-raised text-ink-subtle ring-1 ring-edge-soft transition-all hover:text-ink active:scale-95"
          >
            <RefreshCw size={16} />
          </button>
        )}
        <button
          type="button"
          onClick={remove}
          aria-label={t("Remove repository")}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-raised text-ink-subtle ring-1 ring-edge-soft transition-all hover:text-danger active:scale-95"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {state === "loading" && (
        <div className="flex items-center justify-center gap-2.5 border-t border-edge-soft py-8 text-ink-subtle">
          <Loader2 size={17} className="animate-spin" />
          <span className="text-[13.5px]">{t("Loading plugins...")}</span>
        </div>
      )}

      {state === "error" && (
        <div className="flex items-center justify-center gap-2 border-t border-edge-soft py-8 text-ink-muted">
          <AlertCircle size={16} className="text-danger" />
          <span className="text-[13.5px]">{t("Could not reach this repository.")}</span>
        </div>
      )}

      {state === "ready" &&
        (repo && repo.plugins.length > 0 ? (
          <div className="divide-y divide-edge-soft border-t border-edge-soft">
            {repo.plugins.map((m) => (
              <PluginRow key={m.id} manifest={m} repoUrl={url} installed={byId.get(m.id)} />
            ))}
          </div>
        ) : repo?.foreign ? (
          repo.foreign.kind === "mangayomi" ? (
            <MangayomiImport url={url} count={repo.foreign.count} />
          ) : (
            <div className="flex items-start gap-3 border-t border-edge-soft px-5 py-5">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-canvas text-accent ring-1 ring-edge-soft">
                <ServerCog size={16} />
              </span>
              <p className="text-[13px] leading-relaxed text-ink-muted">
                {foreignMessage(repo.foreign.kind, repo.foreign.count, t)}
              </p>
            </div>
          )
        ) : (
          <div className="border-t border-edge-soft py-8 text-center text-[13.5px] text-ink-muted">
            {t("This repository lists no plugins.")}
          </div>
        ))}
    </div>
  );
}
