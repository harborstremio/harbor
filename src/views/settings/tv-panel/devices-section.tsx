import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useT } from "@/lib/i18n";
import { forgetPairing } from "@/lib/lan-trust";
import { useSettings } from "@/lib/settings";
import { openPairFlow } from "@/components/play-on-pair";
import {
  HarborDeviceCard,
  ListeningPulse,
  TrustAction,
  lanTrustOf,
  useDeviceRoster,
  usePairedIds,
} from "@/components/play-on-device-card";
import {
  deviceStateOf,
  describeInstance,
  harborIdentity,
  isTauri,
  platformLabel,
  probeInstance,
  sweepHarborInstances,
  themeLabel,
  type HarborIdentity,
  type HarborInstance,
  type HarborReach,
  type SweepHandle,
} from "@/components/play-on-lan";
import { Section } from "../shared";
import { SButton } from "../ui";

export const TV_DEVICES_TITLE = "Harbors on your network";

export function TvDevicesSection() {
  const t = useT();
  const { settings } = useSettings();
  const commandable = settings.serveWebUi || settings.remoteControlEnabled;
  const themeId = settings.theme.preset;

  const [me, setMe] = useState<HarborIdentity | null>(null);
  const [peers, setPeers] = useState<HarborInstance[]>([]);
  const [settled, setSettled] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [reach, setReach] = useState<Record<string, HarborReach>>({});

  const alive = useRef(true);
  const probed = useRef(new Set<string>());
  const sweep = useRef<SweepHandle | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      sweep.current?.cancel();
    };
  }, []);

  const scan = useCallback(() => {
    sweep.current?.cancel();
    probed.current.clear();
    setReach({});
    setSettled(false);
    setScanning(true);
    sweep.current = sweepHarborInstances((found, done) => {
      if (!alive.current) return;
      setPeers(found);
      setSettled(done);
      if (done) setScanning(false);
    });
  }, []);

  useEffect(() => {
    void harborIdentity().then((who) => {
      if (alive.current) setMe(who);
    });
    scan();
  }, [scan]);

  useEffect(() => {
    for (const peer of peers) {
      if (!peer.commandable || probed.current.has(peer.id)) continue;
      probed.current.add(peer.id);
      setReach((prev) => ({ ...prev, [peer.id]: "checking" }));
      void probeInstance(peer).then((ok) => {
        if (!alive.current) return;
        setReach((prev) => ({ ...prev, [peer.id]: ok ? "reachable" : "unreachable" }));
      });
    }
  }, [peers]);

  const roster = useDeviceRoster(peers, settled);
  const pairedIds = usePairedIds();

  const selfName = me?.name?.trim() || t("This computer");
  const selfDetail = me
    ? [platformLabel(me.platform), `Harbor ${me.version}`, themeLabel(themeId)]
        .filter(Boolean)
        .join(" / ")
    : t("Reading this device");

  const count = peers.length;
  const tally = scanning
    ? t("Listening for Harbors")
    : count === 0
      ? t("No other Harbor answered")
      : count === 1
        ? t("1 other Harbor")
        : t("{n} other Harbors", { n: count });

  return (
    <Section
      title={TV_DEVICES_TITLE}
      subtitle={t(
        "Every Harbor that announces itself on this network appears here as it answers, with the theme it is wearing.",
      )}
    >
      <div className="flex flex-col gap-2.5">
        <HarborDeviceCard
          name={selfName}
          platform={me?.platform ?? "windows"}
          detail={selfDetail}
          theme={themeId}
          state="self"
          note={
            commandable
              ? t("Remote control is on, so other Harbors on this network can drive this one.")
              : t("Remote control is off, so other Harbors can see this one but cannot drive it.")
          }
        />

        {roster.map((entry) => {
          const peer = entry.instance;
          const label = peer.name?.trim() || t("Harbor");
          const paired = pairedIds.has(peer.id);
          const state = deviceStateOf(
            peer,
            lanTrustOf(peer.id, pairedIds),
            reach[peer.id] ?? "unknown",
          );
          const drivable = state !== "remote-off" && state !== "unreachable";
          return (
            <HarborDeviceCard
              key={peer.id}
              name={label}
              platform={peer.platform}
              detail={`${describeInstance(peer)} / ${peer.host}`}
              theme={peer.theme}
              state={state}
              note={
                paired
                  ? t("This Harbor takes commands from this computer. Forget it to take that back.")
                  : undefined
              }
              stagger={entry.stagger}
              leaving={entry.leaving}
              actions={
                drivable ? (
                  <TrustAction
                    label={paired ? t("Forget") : t("Pair")}
                    hint={`${paired ? t("Forget") : t("Pair")}: ${label}`}
                    loud={!paired}
                    onClick={() => (paired ? forgetPairing(peer.id) : openPairFlow(peer))}
                  />
                ) : null
              }
            />
          );
        })}

        {isTauri && settled && count === 0 ? (
          <p className="max-w-[70ch] px-1 py-1 text-[15.5px] font-normal leading-[22px] text-ink-subtle">
            {t("Nothing else answered. A Harbor shows up here a moment after it starts on this network.")}
          </p>
        ) : null}

        {!isTauri ? (
          <p className="max-w-[70ch] px-1 py-1 text-[15.5px] font-normal leading-[22px] text-ink-subtle">
            {t("Network discovery needs the desktop app.")}
          </p>
        ) : null}

        <div className="flex items-center gap-3 pt-0.5">
          <SButton onClick={scan} disabled={!isTauri}>
            <RefreshCw size={16} strokeWidth={2.2} />
            {t("Scan again")}
          </SButton>
          <span className="flex items-center gap-2 text-[15.5px] font-normal leading-[22px] text-ink-subtle">
            <ListeningPulse active={scanning} />
            {tally}
          </span>
        </div>
      </div>
    </Section>
  );
}
