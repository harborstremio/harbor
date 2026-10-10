import { setItemWithRecovery } from "@/lib/storage-recovery";

export const UPDATE_CHANNEL_KEY = "harbor.update.channel.v1";
export type NormalUpdateChannel = "stable" | "beta";
export type UpdateChannel = NormalUpdateChannel | "experimental";
export type ChannelPreference = {
  channel: UpdateChannel;
  normal: NormalUpdateChannel;
};

export function parseChannelPreference(raw: string | null): ChannelPreference | null {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object") return null;
    const p = value as Partial<ChannelPreference>;
    if (p.normal !== "stable" && p.normal !== "beta") return null;
    if (p.channel !== "stable" && p.channel !== "beta" && p.channel !== "experimental") {
      return null;
    }
    if (p.channel !== "experimental" && p.channel !== p.normal) return null;
    return { channel: p.channel, normal: p.normal };
  } catch {
    return null;
  }
}

export function readChannelPreference(): ChannelPreference | null {
  try {
    return parseChannelPreference(localStorage.getItem(UPDATE_CHANNEL_KEY));
  } catch {
    return null;
  }
}

export function legacyUpdateChannel(): NormalUpdateChannel {
  try {
    const value = JSON.parse(localStorage.getItem("harbor.settings") ?? "null");
    return value?.betaUpdates === true ? "beta" : "stable";
  } catch {
    return "stable";
  }
}

export function selectedUpdateChannel(): UpdateChannel {
  return readChannelPreference()?.channel ?? legacyUpdateChannel();
}

export function normalUpdateChannel(): NormalUpdateChannel {
  return readChannelPreference()?.normal ?? legacyUpdateChannel();
}

export function writeUpdateChannel(channel: UpdateChannel): boolean {
  const preference: ChannelPreference = {
    channel,
    normal: channel === "experimental" ? normalUpdateChannel() : channel,
  };
  try {
    return setItemWithRecovery(UPDATE_CHANNEL_KEY, JSON.stringify(preference));
  } catch {
    return false;
  }
}

export function updateHeaders(channel: UpdateChannel): { headers: Record<string, string> } {
  return { headers: { "x-harbor-channel": channel } };
}
