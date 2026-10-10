import { Library, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  addExtensionRepo,
  listExtensionRepos,
  removeExtensionRepo,
  reposSupported,
  type ExtensionRepo,
  type ServerConfig,
} from "@/lib/manga/sources/suwayomi/provider";
import { useT } from "@/lib/i18n";
import { CARD, INPUT } from "../shared";

const SUGGESTIONS: Array<{ label: string; sub: string; url: string }> = [
  {
    label: "Keiyoushi",
    sub: "The largest community catalog",
    url: "https://github.com/keiyoushi/extensions",
  },
  {
    label: "Suwayomi",
    sub: "Official Suwayomi extensions",
    url: "https://github.com/Suwayomi/tachiyomi-extension",
  },
];

function repoHost(indexUrl: string): string {
  try {
    const u = new URL(indexUrl);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : u.host;
  } catch {
    return indexUrl;
  }
}

export function ExtensionRepos({
  config,
  onChanged,
}: {
  config: ServerConfig;
  onChanged: () => void;
}) {
  const t = useT();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [repos, setRepos] = useState<ExtensionRepo[]>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = `${config.baseUrl}|${config.auth?.username ?? ""}`;

  const refresh = () => {
    listExtensionRepos(config)
      .then(setRepos)
      .catch(() => setRepos([]));
  };

  useEffect(() => {
    let cancelled = false;
    setSupported(null);
    reposSupported(config)
      .then((ok) => {
        if (cancelled) return;
        setSupported(ok);
        if (ok) refresh();
      })
      .catch(() => !cancelled && setSupported(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const add = async (value: string) => {
    const v = value.trim();
    if (!v || busy) return;
    setBusy(true);
    setError(null);
    try {
      await addExtensionRepo(config, v);
      setUrl("");
      refresh();
      onChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        msg === "invalid_url"
          ? t("That does not look like a repository URL")
          : msg === "repos_unsupported"
            ? t("This server is too old to add repos from Harbor")
            : t("The server could not load that repository"),
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (indexUrl: string) => {
    setBusy(true);
    try {
      await removeExtensionRepo(config, indexUrl);
      refresh();
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  if (supported === false) return null;

  const have = new Set(repos.map((r) => r.indexUrl.toLowerCase()));

  return (
    <div className={`flex flex-col gap-3 px-5 py-4 ${CARD}`}>
      <div className="flex items-center gap-2 text-ink-muted">
        <Library size={16} />
        <span className="text-[13.5px] font-semibold text-ink">{t("Extension repositories")}</span>
      </div>

      {repos.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {repos.map((r) => (
            <div
              key={r.indexUrl}
              className="flex items-center gap-3 rounded-xl bg-canvas px-3.5 py-2.5 ring-1 ring-edge-soft"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[14px] font-semibold text-ink">{r.name}</span>
                <span className="truncate text-[12px] text-ink-subtle">{repoHost(r.indexUrl)}</span>
              </span>
              <button
                type="button"
                onClick={() => void remove(r.indexUrl)}
                disabled={busy}
                aria-label={t("Remove {name}", { name: r.name })}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-raised text-ink-subtle ring-1 ring-edge-soft transition-all hover:text-danger active:scale-95 disabled:opacity-50 motion-reduce:active:scale-100"
              >
                <Trash2 size={16} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2.5">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void add(url);
          }}
          placeholder="https://github.com/keiyoushi/extensions"
          inputMode="url"
          autoCapitalize="off"
          spellCheck={false}
          className={`${INPUT} min-w-0 flex-1`}
        />
        <button
          type="button"
          onClick={() => void add(url)}
          disabled={busy || !url.trim()}
          className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-[14.5px] font-semibold text-canvas transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? (
            <Loader2 size={17} className="animate-spin" />
          ) : (
            <Plus size={17} strokeWidth={2.4} />
          )}
          {t("Add")}
        </button>
      </div>

      {error && <p className="text-[13px] font-medium text-danger">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.filter(
          (s) =>
            !have.has(
              `https://raw.githubusercontent.com/${s.url.split("github.com/")[1]}/repo/index.min.json`.toLowerCase(),
            ),
        ).map((s) => (
          <button
            key={s.url}
            type="button"
            onClick={() => void add(s.url)}
            disabled={busy}
            className="flex flex-col items-start rounded-xl bg-raised px-3.5 py-2 text-start ring-1 ring-edge-soft transition-all hover:ring-edge active:scale-[0.98] disabled:opacity-50"
          >
            <span className="text-[13px] font-semibold text-ink">{s.label}</span>
            <span className="text-[11.5px] text-ink-subtle">{t(s.sub)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
