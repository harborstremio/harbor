import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { ToggleRow, settingsAnchor } from "./shared";
import { AddressRow } from "./player-panel/server-address-section";
import { isTauri } from "./player-panel/internals";

const WEB_PORT = 11471;

function Section({
  anchor,
  title,
  sub,
  children,
}: {
  anchor: string;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={settingsAnchor(anchor)}
      className="scroll-mt-28 flex flex-col gap-4 rounded-2xl border border-edge-soft bg-elevated/40 p-7"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-[19px] font-medium tracking-tight text-ink">{title}</h2>
        <p className="text-[13.5px] leading-relaxed text-ink-muted">{sub}</p>
      </div>
      {children}
    </section>
  );
}

export function RemotesPanel() {
  const t = useT();
  const { settings, update } = useSettings();
  const [lanIp, setLanIp] = useState<string | null>(null);
  const [webError, setWebError] = useState(false);
  const aliveRef = useRef(true);

  const enabled = settings.serveWebUi || settings.remoteControlEnabled;

  useEffect(() => {
    if (!isTauri) return;
    aliveRef.current = true;
    void invoke<string | null>("lan_ip")
      .then((ip) => {
        if (aliveRef.current) setLanIp(ip);
      })
      .catch(() => {});
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isTauri || !enabled) {
      setWebError(false);
      return;
    }
    const timer = window.setTimeout(() => {
      void invoke<boolean>("web_serve_status")
        .then((ok) => {
          if (aliveRef.current) setWebError(!ok);
        })
        .catch(() => {});
    }, 800);
    return () => window.clearTimeout(timer);
  }, [enabled]);

  if (!isTauri) {
    return (
      <div className="flex flex-col gap-5">
        <p className="text-[13.5px] leading-relaxed text-ink-muted">
          {t(
            "Remotes are served by the desktop app. Open these settings on your computer's Harbor to get the links.",
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Section
        anchor="Harbor on other devices"
        title={t("Harbor on other devices")}
        sub={t(
          "Serves this exact install of Harbor as a web app on your network. Open it on a phone, laptop, or TV browser, sign in there, and it streams through this computer.",
        )}
      >
        <ToggleRow
          label={t("Serve Harbor on your network")}
          sub={t(
            "One switch powers everything on this page: the web app, the phone remote, and the manga reader remote.",
          )}
          value={enabled}
          onChange={(v) => update({ serveWebUi: v, remoteControlEnabled: v })}
        />
        {enabled && (
          <>
            <AddressRow
              label={t("Harbor in your browser (this computer)")}
              url={`http://127.0.0.1:${WEB_PORT}`}
              openable
            />
            {lanIp && (
              <AddressRow
                label={t("Harbor in your browser (Wi-Fi)")}
                url={`http://${lanIp}:${WEB_PORT}`}
              />
            )}
            {webError && (
              <span className="text-[12px] text-danger">
                {t(
                  "Couldn't start on port {WEB_PORT}. Another app may be using it; toggle off and on to retry.",
                  { WEB_PORT: String(WEB_PORT) },
                )}
              </span>
            )}
          </>
        )}
      </Section>

      {enabled && (
        <>
          <Section
            anchor="Phone remote"
            title={t("Phone remote")}
            sub={t(
              "Turns your phone into a remote for this computer: play, pause, seek, volume, and casting, all from the couch. Open the Wi-Fi address on your phone's browser.",
            )}
          >
            <AddressRow
              label={t("Phone remote (this computer)")}
              url={`http://127.0.0.1:${WEB_PORT}/remote`}
              openable
            />
            {lanIp && (
              <AddressRow
                label={t("Phone remote (Wi-Fi)")}
                url={`http://${lanIp}:${WEB_PORT}/remote`}
              />
            )}
          </Section>

          <Section
            anchor="Manga reader remote"
            title={t("Manga reader remote")}
            sub={t(
              "Control the manga flipbook from your phone while reading on the big screen: turn pages, zoom, and switch modes. The reader also shows this link while you read.",
            )}
          >
            <AddressRow
              label={t("Manga remote (this computer)")}
              url={`http://127.0.0.1:${WEB_PORT}/reader`}
              openable
            />
            {lanIp && (
              <AddressRow
                label={t("Manga remote (Wi-Fi)")}
                url={`http://${lanIp}:${WEB_PORT}/reader`}
              />
            )}
          </Section>
        </>
      )}

      {!enabled && (
        <p className="px-1 text-[12.5px] leading-relaxed text-ink-subtle">
          {t(
            "Flip the switch above and the phone remote and manga reader remote addresses appear here.",
          )}
        </p>
      )}
    </div>
  );
}
