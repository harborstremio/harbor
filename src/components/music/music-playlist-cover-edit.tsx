import { useEffect, useRef, useState, type ReactNode } from "react";
import { LoaderCircle, Plus, Trash2 } from "@/components/icons/music-icons";
import { useT } from "@/lib/i18n";
import {
  clearPlaylistCover,
  musicPlaylistCoverEvent,
  readPlaylistCover,
  savePlaylistCover,
} from "@/lib/music/playlist-cover";
import "./music-playlist-cover-edit.css";

export function useMusicPlaylistCover(playlistId: string): string {
  const [cover, setCover] = useState("");
  useEffect(() => {
    let alive = true;
    const pull = () => {
      void readPlaylistCover(playlistId).then((url) => {
        if (alive) setCover(url);
      });
    };
    pull();
    const onChange = (event: Event) => {
      if ((event as CustomEvent<string>).detail === playlistId) pull();
    };
    window.addEventListener(musicPlaylistCoverEvent(), onChange);
    return () => {
      alive = false;
      window.removeEventListener(musicPlaylistCoverEvent(), onChange);
    };
  }, [playlistId]);
  return cover;
}

export function MusicPlaylistCoverEdit({
  playlistId,
  hasCustom,
  children,
}: {
  playlistId: string;
  hasCustom: boolean;
  children: ReactNode;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState("");

  const pick = (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setFailed("");
    void savePlaylistCover(playlistId, file)
      .catch((cause: unknown) => setFailed(cause instanceof Error ? cause.message : "error"))
      .finally(() => setBusy(false));
  };

  return (
    <div className="music-playlist-cover-edit">
      {children}
      <div className="music-playlist-cover-actions">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-label={t("music.playlist.coverUpload")}
          title={t("music.playlist.coverUpload")}
        >
          {busy ? (
            <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" />
          ) : (
            <Plus size={16} aria-hidden="true" />
          )}
        </button>
        {hasCustom && (
          <button
            type="button"
            onClick={() => void clearPlaylistCover(playlistId)}
            disabled={busy}
            aria-label={t("music.playlist.coverRemove")}
            title={t("music.playlist.coverRemove")}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      {failed && (
        <p role="alert" className="music-playlist-cover-error">
          {t(failed)}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        hidden
        onChange={(event) => {
          pick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
