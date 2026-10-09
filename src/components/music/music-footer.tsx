import { type ReactNode } from "react";
import { useMusicConnections } from "@/components/music/music-connections";
import { SECONDARY_BUTTON } from "@/components/music/music-connections/connection-row";
import { APP_VERSION, BUILD_LABEL } from "@/lib/build-info";
import { useT } from "@/lib/i18n";
import type { MusicConnection, MusicConnectionStatus } from "@/lib/music/types";
import { useView } from "@/lib/view";
import { openUrl } from "@/lib/window";

const LEGAL_TERMS = [
  { name: "Spotify", href: "https://www.spotify.com/legal/end-user-agreement/" },
  { name: "YouTube", href: "https://www.youtube.com/t/terms" },
  { name: "Deezer", href: "https://www.deezer.com/legal/cgu" },
  { name: "Apple", href: "https://www.apple.com/legal/internet-services/itunes/" },
];

const PANEL = "border-t border-edge-soft pt-5 pb-6";

const MATRIX =
  "grid grid-cols-1 gap-x-[46px] gap-y-9 sm:grid-cols-2 xl:grid-cols-[minmax(0,185px)_minmax(0,185px)_minmax(0,320px)_minmax(0,185px)]";

const HEADING = "text-[13px] font-semibold text-ink-subtle";

const LINK =
  "flex min-h-11 w-full items-center text-start text-[13px] font-medium text-ink-muted transition-colors duration-200 ease-out hover:text-ink";

const STATUS_DOT: Record<MusicConnectionStatus, string> = {
  connected: "bg-accent",
  disconnected: "bg-ink-subtle",
  error: "bg-danger",
  unavailable: "border border-edge",
};

const STATUS_LABEL: Record<MusicConnectionStatus, string> = {
  connected: "music.connections.statusConnected",
  disconnected: "music.connections.statusDisconnected",
  error: "music.connections.statusError",
  unavailable: "music.connections.statusUnavailable",
};

type FooterLink = { key: string; run: () => void };

function Column({
  heading,
  extra,
  children,
}: {
  heading: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <h3 className={HEADING}>{heading}</h3>
      {extra}
      <div className="mt-2 flex flex-col">{children}</div>
    </div>
  );
}

function LinkColumn({ heading, links }: { heading: string; links: FooterLink[] }) {
  const t = useT();
  if (links.length === 0) return null;
  return (
    <Column heading={t(heading)}>
      {links.map((link) => (
        <button key={link.key} type="button" onClick={link.run} className={LINK}>
          {t(link.key)}
        </button>
      ))}
    </Column>
  );
}

function ConnectionLink({
  connection,
  onOpen,
}: {
  connection: MusicConnection;
  onOpen: () => void;
}) {
  const t = useT();
  const account = connection.account ?? t(STATUS_LABEL[connection.status]);
  return (
    <button type="button" onClick={onOpen} className={`${LINK} gap-2.5`}>
      <span
        aria-hidden="true"
        className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT[connection.status]}`}
      />
      <span className="min-w-0 flex-1 truncate" title={connection.name}>
        {connection.name}
      </span>
      <span
        className="max-w-[52%] shrink-0 truncate text-[12px] font-normal text-ink-subtle"
        title={account}
      >
        {account}
      </span>
    </button>
  );
}

function ConnectionsColumn() {
  const t = useT();
  const { openConnections, connections, status, error, connected, reload } = useMusicConnections();

  let body: ReactNode;
  if (status === "loading") {
    body = (
      <div className="flex flex-col gap-2 pt-2" aria-label={t("music.loading")}>
        {[0, 1, 2, 3].map((slot) => (
          <span key={slot} className="h-7 animate-pulse rounded-md bg-elevated/45" />
        ))}
      </div>
    );
  } else if (status === "error") {
    body = (
      <div className="flex flex-col items-start gap-3 pt-2">
        <p className="text-[13px] leading-5 text-ink-subtle">{error || t("music.error.load")}</p>
        <button type="button" onClick={reload} className={SECONDARY_BUTTON}>
          {t("music.offline.retry")}
        </button>
      </div>
    );
  } else if (connections.length === 0) {
    body = <p className="pt-2 text-[13px] text-ink-subtle">{t("music.row.emptyRow")}</p>;
  } else {
    body = connections.map((row) => (
      <ConnectionLink key={row.id} connection={row} onOpen={() => openConnections(row.id)} />
    ));
  }

  return (
    <Column
      heading={t("music.footer.connections")}
      extra={
        status === "ready" && connections.length > 0 ? (
          <p className="mt-1 text-[12px] text-ink-subtle">
            {t("music.footer.sourceCount", { connected, total: connections.length })}
          </p>
        ) : undefined
      }
    >
      {body}
    </Column>
  );
}

export function MusicFooter({ className = "" }: { className?: string }) {
  const t = useT();
  const { openSettings, openFeed, openGroups } = useView();
  const { openConnections } = useMusicConnections();

  const setup: FooterLink[] = [
    { key: "music.footer.sources", run: () => openConnections() },
    { key: "music.audio.title", run: () => openConnections("__audio") },
    { key: "music.cast.title", run: () => openConnections("__speakers") },
    { key: "music.footer.languages", run: () => openSettings("language") },
  ];

  const harbor: FooterLink[] = [
    { key: "music.footer.about", run: () => openSettings("advanced") },
    { key: "music.footer.account", run: () => openSettings("account") },
  ];

  const community: FooterLink[] = [
    { key: "music.footer.feed", run: openFeed },
    { key: "music.footer.groups", run: openGroups },
  ];

  return (
    <footer className={`${PANEL} ${className}`} aria-label={t("music.footer.harbor")}>
      <p className="mb-4 max-w-[90ch] text-xs leading-relaxed text-ink-muted">
        {t("music.legal.summary")}
      </p>
      <details className="mb-5 text-xs leading-relaxed text-ink-muted">
        <summary className="w-fit cursor-pointer">{t("music.legal.title")}</summary>
        <p className="mt-3 max-w-[90ch]">{t("music.legal.services")}</p>
        <p className="mt-3 max-w-[90ch]">{t("music.legal.saving")}</p>
        <p className="mt-3 max-w-[90ch]">{t("music.legal.data")}</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <button type="button" onClick={() => openSettings("licenses")} className="underline">
            {t("music.legal.readFull")}
          </button>
          {LEGAL_TERMS.map((term) => (
            <a
              key={term.href}
              href={term.href}
              target="_blank"
              rel="noreferrer"
              className="underline"
              onClick={(event) => {
                event.preventDefault();
                openUrl(term.href);
              }}
            >
              {term.name}
            </a>
          ))}
        </div>
      </details>
      <details>
        <summary className="w-fit cursor-pointer text-[13px] text-ink-muted">
          {t("music.footer.setup")} · {t("music.footer.connections")}
        </summary>
        <div className={`${MATRIX} mt-5`}>
          <LinkColumn heading="music.footer.setup" links={setup} />
          <LinkColumn heading="music.footer.harbor" links={harbor} />
          <ConnectionsColumn />
          <LinkColumn heading="music.footer.community" links={community} />
        </div>
      </details>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 py-2">
        <span className="text-[11px] text-ink-subtle" title={BUILD_LABEL}>
          {t("update.harborVersion", { version: APP_VERSION })}
        </span>
      </div>
    </footer>
  );
}
