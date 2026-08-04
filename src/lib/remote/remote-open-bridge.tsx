import { useEffect } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useProfiles } from "@/lib/profiles";
import { useView } from "@/lib/view";

type RemoteOpen =
  | { action: "openMeta"; metaId: string; metaType: string; name?: string; poster?: string }
  | { action: "openService"; service: string }
  | { action: "goView"; view: string }
  | {
      action: "playMeta";
      metaId: string;
      metaType: string;
      name?: string;
      poster?: string;
      season?: number;
      episode?: number;
      resume?: boolean;
    };

type MetaOpen = Extract<RemoteOpen, { metaId: string }>;

function toMeta(d: MetaOpen): Meta {
  return {
    id: d.metaId,
    type: (d.metaType === "series"
      ? "series"
      : d.metaType === "anime"
        ? "anime"
        : "movie") as Meta["type"],
    name: d.name ?? "",
    poster: d.poster,
  };
}

/**
 * Host-side bridge: when a connected phone remote sends openMeta/playMeta, the
 * session dispatches a `harbor:remote-open` event; this drives the host's own
 * ViewProvider so the desktop opens the detail page or starts playback.
 */
export function RemoteOpenBridge() {
  const { openMeta, openPerson, openPicker, openService, setView } = useView();
  const { profiles, selectProfile } = useProfiles();
  useEffect(() => {
    const onSetProfile = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const profile = profiles.find((candidate) => candidate.id === id);
      if (profile && !profile.passwordHash) selectProfile(id);
    };
    window.addEventListener("harbor:remote-set-profile", onSetProfile);
    return () => window.removeEventListener("harbor:remote-set-profile", onSetProfile);
  }, [profiles, selectProfile]);
  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<RemoteOpen>).detail;
      if (!d) return;
      if (d.action === "goView") {
        setView(d.view as Parameters<typeof setView>[0]);
        return;
      }
      if (d.action === "openService") {
        openService(d.service as Parameters<typeof openService>[0]);
        return;
      }
      if (d.action === "openMeta" && d.metaId.startsWith("person:")) {
        const pid = Number(d.metaId.slice(7));
        if (Number.isFinite(pid)) openPerson(pid);
        return;
      }
      const meta = toMeta(d);
      if (d.action === "openMeta") {
        openMeta(meta);
        return;
      }
      const episode =
        d.season != null && d.episode != null
          ? { season: d.season, episode: d.episode }
          : undefined;
      openPicker(meta, episode, { autoPlay: true, resume: d.resume ?? true });
    };
    window.addEventListener("harbor:remote-open", onOpen);
    return () => window.removeEventListener("harbor:remote-open", onOpen);
  }, [openMeta, openPerson, openPicker, openService, setView]);
  return null;
}
