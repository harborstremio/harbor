import { useId, useState } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useT } from "@/lib/i18n";
import { SourceBrowserFiles } from "./game-source-browser";
import { sourceBrowserHost } from "@/lib/games/source-browser";
import type { GameTransfers } from "@/hooks/use-game-transfers";
import type { SourceLink } from "@/lib/games/source-links";
import type { DownloadGame } from "@/lib/games/transfers";

export function GameSiteDownload({
  downloads,
  game,
  onClose,
}: {
  downloads: GameTransfers;
  game?: DownloadGame;
  onClose: () => void;
}) {
  const t = useT(),
    titleId = useId(),
    { closing, close } = useModalExit(onClose);
  const [url, setUrl] = useState(""),
    [link, setLink] = useState<SourceLink | null>(null),
    [error, setError] = useState("");
  const begin = () => {
    const value = url.trim();
    if (!sourceBrowserHost(value)) {
      setError("games.sources.site.invalid");
      return;
    }
    setError("");
    setLink({ url: value, title: game?.name ?? new URL(value).hostname, game });
  };
  return (
    <ModalShell
      closing={closing}
      onDismiss={close}
      width={540}
      labelledBy={titleId}
      backdropClassName="games-match-backdrop"
    >
      <div className="games-download-form">
        <header>
          <h2 id={titleId}>{t("games.sources.site.title")}</h2>
          <button
            type="button"
            className="games-icon-button"
            onClick={close}
            aria-label={t("common.close")}
          >
            <X size={19} />
          </button>
        </header>
        {link ? (
          <SourceBrowserFiles
            link={link}
            downloads={downloads}
            onDone={close}
            closing={closing}
          />
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              begin();
            }}
          >
            <p>{t("games.sources.site.note")}</p>
            <label>
              {t("games.sources.site.url")}
              <input
                type="url"
                required
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value);
                  setError("");
                }}
                placeholder="https://"
              />
            </label>
            {error && <p role="alert">{t(error)}</p>}
            <footer>
              <button
                className="games-button games-button-primary"
                type="submit"
                disabled={!url.trim()}
              >
                <ArrowUpRight size={16} />
                {t("games.sources.site.open")}
              </button>
            </footer>
          </form>
        )}
      </div>
    </ModalShell>
  );
}
