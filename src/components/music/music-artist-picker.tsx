import { useEffect, useId, useRef, useState } from "react";
import { LoaderCircle, X } from "@/components/icons/music-icons";
import { ModalShell } from "@/components/modal-shell";
import { MusicArtistCard } from "./music-artist-card";
import { searchTyped } from "@/lib/music/catalog";
import { useT } from "@/lib/i18n";
import type { MusicArtistRef } from "@/lib/music/types";

export function MusicArtistPicker({
  name,
  connector,
  onSelect,
  onClose,
}: {
  name: string;
  connector: string;
  onSelect: (artist: MusicArtistRef) => void;
  onClose: () => void;
}) {
  const t = useT();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const selected = useRef(false);
  const [artists, setArtists] = useState<MusicArtistRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setArtists([]);
    searchTyped(name, 24, connector)
      .then((result) => {
        if (!cancelled) setArtists(result.artists);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [name, connector, attempt]);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const dialog = closeRef.current?.closest<HTMLElement>('[role="dialog"]');
    closeRef.current?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog) return;
      const controls = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input, [tabindex="0"]',
        ),
      ].filter((item) => item.getClientRects().length);
      const first = controls[0],
        last = controls.at(-1);
      if (
        !dialog.contains(document.activeElement) ||
        document.activeElement === (event.shiftKey ? first : last)
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    };
    dialog?.addEventListener("keydown", trap);
    return () => {
      dialog?.removeEventListener("keydown", trap);
      if (!selected.current && trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  return (
    <ModalShell
      closing={false}
      onDismiss={onClose}
      width={600}
      labelledBy={titleId}
      backdropClassName="bg-black/45"
    >
      <header className="flex items-center justify-between gap-4 border-b border-edge-soft p-6">
        <div className="min-w-0">
          <p className="text-sm text-ink-muted">{t("music.library.artists")}</p>
          <h2 id={titleId} className="mt-1 break-words text-xl font-bold text-ink">
            {name}
          </h2>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="grid size-10 shrink-0 place-items-center rounded-md bg-elevated text-ink"
        >
          <X size={20} />
        </button>
      </header>
      <div className="overflow-y-auto p-6">
        {loading ? (
          <p role="status" className="flex items-center gap-3 py-8 text-sm text-ink-muted">
            <LoaderCircle size={20} className="animate-spin motion-reduce:animate-none" />
            {t("music.loading")}
          </p>
        ) : error ? (
          <div role="alert" className="text-sm text-ink-muted">
            <p>{error}</p>
            <button
              type="button"
              className="mt-4 rounded-md bg-elevated px-4 py-2 text-ink"
              onClick={() => setAttempt((value) => value + 1)}
            >
              {t("music.offline.retry")}
            </button>
          </div>
        ) : artists.length ? (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            {artists.map((artist) => (
              <MusicArtistCard
                key={`${artist.connectorId}:${artist.id}`}
                artist={artist}
                onOpen={() => {
                  selected.current = true;
                  onSelect(artist);
                }}
              />
            ))}
          </div>
        ) : (
          <p className="py-8 text-sm text-ink-muted">{t("music.row.emptyRow")}</p>
        )}
      </div>
    </ModalShell>
  );
}
