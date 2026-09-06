import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "./icons";
import { invoke } from "@tauri-apps/api/core";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { ROW_DESC } from "./kit";
import { Section, ToggleRow } from "./shared";
import { isTauri } from "./player-panel/internals";
import { RemoteCard } from "./remotes-panel/remote-card";
import type { DeviceKind } from "./remotes-panel/device-art";

const WEB_PORT = 11471;

export function RemotesPanel() {
  const t = useT();
  const { settings, update } = useSettings();
  const [lanIp, setLanIp] = useState<string | null | undefined>(undefined);
  const [webError, setWebError] = useState(false);
  const aliveRef = useRef(true);

  const enabled = settings.serveWebUi || settings.remoteControlEnabled;

  useEffect(() => {
    if (!isTauri) return;
    aliveRef.current = true;
    void invoke<string | null>("lan_ip")
      .then((ip) => {
        if (aliveRef.current) setLanIp(ip ?? null);
      })
      .catch(() => {
        if (aliveRef.current) setLanIp(null);
      });
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
      <Section title={t("Harbor on other devices")}>
        <p className={`max-w-[70ch] ${ROW_DESC}`}>
          {t(
            "Remotes are served by the desktop app. Open these settings on your computer's Harbor to get the links.",
          )}
        </p>
      </Section>
    );
  }

  const lan = (path: string) => (lanIp ? `http://${lanIp}:${WEB_PORT}${path}` : null);
  const local = (path: string) => `http://127.0.0.1:${WEB_PORT}${path}`;
  const probed = lanIp !== undefined;

  const cards: Array<{ kind: DeviceKind; title: string; blurb: string; path: string }> = [
    {
      kind: "web",
      title: t("Harbor in a browser"),
      blurb: t(
        "This exact install, served as a web app. Open it on a phone, laptop or TV browser and it streams through this computer.",
      ),
      path: "",
    },
    {
      kind: "remote",
      title: t("Phone remote"),
      blurb: t("Play, pause, seek, volume and casting from the couch."),
      path: "/remote",
    },
    {
      kind: "reader",
      title: t("Manga reader remote"),
      blurb: t("Turn pages, zoom and switch modes while you read on the big screen."),
      path: "/reader",
    },
  ];

  return (
    <>
      <Section
        title={t("Harbor on other devices")}
        subtitle={t(
          "One switch serves Harbor on your network. Scan a code below with your phone, or open an address on any device on the same Wi-Fi.",
        )}
      >
        <ToggleRow
          label={t("Serve Harbor on your network")}
          sub={t(
            "Powers everything on this page: the web app, the phone remote, and the manga reader remote.",
          )}
          value={enabled}
          onChange={(v) => update({ serveWebUi: v, remoteControlEnabled: v })}
        />

        {webError && (
          <div className="flex items-start gap-2.5 rounded-[10px] bg-elevated px-4 py-3">
            <AlertTriangle
              size={18}
              strokeWidth={2.2}
              className="mt-[2px] shrink-0 text-danger"
            />
            <p className="max-w-[66ch] text-[15.5px] font-normal leading-[22px] text-danger">
              {t(
                "Couldn't start on port {WEB_PORT}. Another app may be using it; toggle off and on to retry.",
                { WEB_PORT: String(WEB_PORT) },
              )}
            </p>
          </div>
        )}

        {!enabled && (
          <p className={`max-w-[70ch] ${ROW_DESC}`}>
            {t("Flip the switch above and the addresses and scan codes appear here.")}
          </p>
        )}
      </Section>

      {enabled &&
        cards.map((c) => (
          <RemoteCard
            key={c.path}
            kind={c.kind}
            title={c.title}
            blurb={c.blurb}
            lanUrl={lan(c.path)}
            localUrl={local(c.path)}
            probed={probed}
          />
        ))}
    </>
  );
}
