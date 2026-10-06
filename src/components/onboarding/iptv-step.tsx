import { Globe2, Plus, Trash2, Tv } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { useFavorites } from "@/lib/iptv/favorites";
import { purgePlaylistState } from "@/lib/iptv/source-cleanup";
import { useSettings } from "@/lib/settings";
import { materializePlaylistEntry } from "@/views/live/hooks/use-playlist-mutations";
import { EMPTY_FORM, PlaylistForm } from "@/views/live/source-picker/playlist-form";

export function IptvStep() {
  const { settings, update } = useSettings();
  const t = useT();
  const favorites = useFavorites();
  const playlists = settings.iptvPlaylists.filter((p) => (p.kind ?? "m3u") !== "epg");
  const [adding, setAdding] = useState(playlists.length === 0);
  const [formKey, setFormKey] = useState(0);

  return (
    <div className="flex flex-col gap-5">
      <span className="text-[12.5px] font-medium uppercase tracking-[0.16em] text-ink-subtle">
        {t("Live TV · Provider")}
      </span>
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-[36px] font-medium leading-[1.08] tracking-tight text-ink">
          {t("Add your IPTV provider")}
        </h1>
        <p className="text-[15px] leading-relaxed text-ink-muted">
          {t(
            "Paste the M3U link or Xtream login from your provider. It powers the Live Hub and Sports Hub. Your login stays on this device.",
          )}
        </p>
      </div>

      {playlists.length > 0 && (
        <ul className="flex flex-col gap-2">
          {playlists.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-xl border border-edge-soft bg-canvas/60 px-4 py-3"
            >
              {p.kind === "xtream" ? (
                <Globe2 size={15} className="shrink-0 text-ink-subtle" />
              ) : (
                <Tv size={15} className="shrink-0 text-ink-subtle" />
              )}
              <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{p.name}</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                {p.kind === "xtream" ? "Xtream" : "M3U"}
              </span>
              <button
                onClick={() => {
                  update({ iptvPlaylists: settings.iptvPlaylists.filter((s) => s.id !== p.id) });
                  purgePlaylistState(p.id, favorites.removeForSource);
                }}
                aria-label={t("Remove")}
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="max-h-[46vh] overflow-y-auto rounded-xl border border-edge-soft bg-canvas/40">
          <PlaylistForm
            key={formKey}
            initial={EMPTY_FORM}
            submitLabel={t("Add provider")}
            autoFocusName={false}
            onCancel={() => {
              setFormKey((k) => k + 1);
              if (playlists.length > 0) setAdding(false);
            }}
            onSubmit={(entry) => {
              const id = `pl-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
              update({ iptvPlaylists: [...settings.iptvPlaylists, materializePlaylistEntry(id, entry)] });
              setFormKey((k) => k + 1);
              setAdding(false);
            }}
          />
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-edge px-4 py-2 text-[13.5px] font-medium text-ink transition-colors hover:bg-raised"
        >
          <Plus size={14} />
          {t("Add another provider")}
        </button>
      )}
    </div>
  );
}
