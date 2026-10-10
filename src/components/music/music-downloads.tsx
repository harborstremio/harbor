import { useEffect, useState } from "react";
import "./music-library.css";
import { FolderOpen, Trash2, X, Plus, RotateCcw, Play } from "@/components/icons/music-icons";
import { Pause } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useT } from "@/lib/i18n";
import {
  deleteMusicDownload,
  downloadMusic,
  downloadedMusicTrack,
  musicDownloadDir,
  musicDownloadFolder,
  revealMusicDownload,
  setMusicDownloadDir,
  useMusicDownloads,
  pauseMusicDownload,
  type MusicDownload,
} from "@/lib/music/downloads";
import { playMusic, closeMusicPlayer, getMusicState } from "@/lib/music/player";
import { useMusicPlaylistPicker } from "./music-playlist-picker";
import { Poster } from "@/components/poster";
import { MusicTrackPlaybackMark } from "./music-now-playing-mark";
export function MusicDownloads({
  query = "",
  allowPlaylist = true,
}: {
  query?: string;
  allowPlaylist?: boolean;
}) {
  const t = useT(),
    entries = useMusicDownloads(),
    { openPlaylistPicker } = useMusicPlaylistPicker();
  const [error, setError] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [folder, setFolder] = useState("");
  const [folderTick, setFolderTick] = useState(0);
  const custom = musicDownloadDir() !== "";

  useEffect(() => {
    let alive = true;
    void musicDownloadFolder().then((path) => {
      if (alive) setFolder(path);
    });
    return () => {
      alive = false;
    };
  }, [folderTick]);

  const pickFolder = async () => {
    setError(false);
    try {
      const picked = await openDialog({ directory: true, multiple: false, defaultPath: folder });
      if (typeof picked === "string") {
        setMusicDownloadDir(picked);
        setFolderTick((n) => n + 1);
      }
    } catch {
      setError(true);
    }
  };
  const shown = entries
    .filter((entry) =>
      `${entry.track.title} ${entry.track.artist} ${entry.track.album ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        a.track.artist.localeCompare(b.track.artist) ||
        (a.track.album ?? "").localeCompare(b.track.album ?? "") ||
        a.track.title.localeCompare(b.track.title),
    );
  const run = async (id: string, action: () => Promise<unknown>) => {
    setError(false);
    setWorking(id);
    try {
      await action();
    } catch {
      setError(true);
    } finally {
      setWorking(null);
    }
  };
  const play = async (entry: MusicDownload) => {
    const track = await downloadedMusicTrack(entry);
    const rest = await Promise.all(
      shown
        .filter((item) => item.status === "done" && item.id !== entry.id)
        .map((item) => downloadedMusicTrack(item).catch(() => null)),
    );
    await playMusic(track, [track, ...rest.filter((item) => item !== null)]);
  };
  return (
    <section className="music-downloads">
      <div className="music-download-folder">
        <span className="music-download-folder-label">{t("music.download.folder")}</span>
        <span className="music-download-folder-path" title={folder}>
          {folder}
        </span>
        <button type="button" onClick={() => void pickFolder()}>
          {t("music.download.changeFolder")}
        </button>
        {custom && (
          <button
            type="button"
            onClick={() => {
              setMusicDownloadDir("");
              setFolderTick((n) => n + 1);
            }}
          >
            {t("music.download.defaultFolder")}
          </button>
        )}
      </div>
      {error && <p role="alert">{t("music.download.failed")}</p>}
      {!shown.length && <p className="music-library-empty">{t("music.download.empty")}</p>}
      {shown.map((entry) => (
        <div key={entry.id} className="music-download-row">
          <button
            type="button"
            disabled={entry.status !== "done" || !!working}
            onClick={() => void run(entry.id, () => play(entry))}
            aria-label={`${t("music.play")} · ${entry.track.title}`}
          >
            <Poster src={entry.track.artwork} seed={entry.id} ratio="square" className="size-12">
              <MusicTrackPlaybackMark
                track={{ ...entry.track, id: `download:${entry.id}`, connectorId: "local" }}
              />
            </Poster>
          </button>
          <div className="min-w-0 flex-1">
            <strong className="block truncate">{entry.track.title}</strong>
            <small>
              {entry.track.artist}
              {entry.track.album ? ` · ${entry.track.album}` : ""}
            </small>
            <small className="block">
              {t(
                entry.status === "done"
                  ? "music.download.done"
                  : entry.status === "paused"
                    ? "Paused"
                    : entry.status === "queued"
                      ? "Queued"
                      : entry.status === "interrupted"
                        ? "Interrupted. Retry to resume safely."
                        : entry.status === "error"
                          ? (entry.error ?? "music.download.failed")
                          : "music.download.busy",
              )}
              {entry.status === "downloading"
                ? ` ${Math.round(entry.progress * 100)}%`
                : entry.bytes
                  ? ` · ${(entry.bytes / 1048576).toFixed(1)} MB`
                  : ""}
            </small>
            {entry.status === "downloading" && <progress max={1} value={entry.progress} />}
          </div>
          {entry.status === "done" && (
            <>
              <button
                aria-label={t("music.play")}
                title={t("music.play")}
                onClick={() => void run(entry.id, () => play(entry))}
              >
                <Play size={17} />
              </button>
              {allowPlaylist && (
                <button
                  aria-label={t("music.card.addToPlaylist")}
                  title={t("music.card.addToPlaylist")}
                  onClick={() =>
                    void run(entry.id, async () =>
                      openPlaylistPicker(await downloadedMusicTrack(entry)),
                    )
                  }
                >
                  <Plus size={17} />
                </button>
              )}
              <button
                aria-label={t("music.download.folder")}
                title={t("music.download.folder")}
                onClick={() => void run(entry.id, () => revealMusicDownload(entry.id))}
              >
                <FolderOpen size={17} />
              </button>
            </>
          )}
          {["downloading", "queued"].includes(entry.status) && (
            <button
              aria-label={t("Pause download")}
              title={t("Pause download")}
              onClick={() => pauseMusicDownload(entry.id)}
            >
              <Pause size={17} />
            </button>
          )}
          {["error", "interrupted", "paused", "canceled"].includes(entry.status) && (
            <button
              aria-label={t("music.download.retry")}
              title={t("music.download.retry")}
              onClick={() => void run(entry.id, () => downloadMusic(entry.track))}
            >
              <RotateCcw size={17} />
            </button>
          )}
          <button
            disabled={!!working}
            aria-label={t(
              entry.status === "downloading" ? "common.cancel" : "music.download.delete",
            )}
            title={t(entry.status === "downloading" ? "common.cancel" : "music.download.delete")}
            onClick={() =>
              void run(entry.id, async () => {
                if (getMusicState().current?.id === `download:${entry.id}`)
                  await closeMusicPlayer();
                await deleteMusicDownload(entry.id);
              })
            }
          >
            {entry.status === "downloading" ? <X size={17} /> : <Trash2 size={17} />}
          </button>
        </div>
      ))}
    </section>
  );
}
