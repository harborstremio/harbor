import { safeFetch as fetch } from "@/lib/safe-fetch";

const API = "https://api.trakt.tv";

export type DeviceCode = {
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  created_at: number;
};

export type TraktUser = {
  user: {
    username: string;
    name?: string;
    private?: boolean;
    vip?: boolean;
    ids: { slug: string };
  };
};

function headers(clientId: string, accessToken?: string): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    "trakt-api-version": "2",
    "trakt-api-key": clientId,
  };
  if (accessToken) h["Authorization"] = `Bearer ${accessToken}`;
  return h;
}

export async function requestDeviceCode(clientId: string): Promise<DeviceCode> {
  const res = await fetch(`${API}/oauth/device/code`, {
    method: "POST",
    headers: headers(clientId),
    body: JSON.stringify({ client_id: clientId }),
  });
  if (!res.ok) throw new Error(`Trakt device code request failed: ${res.status}`);
  return (await res.json()) as DeviceCode;
}

export type PollResult =
  | { status: "ok"; token: TokenResponse }
  | { status: "pending" }
  | { status: "slow_down" }
  | { status: "expired" }
  | { status: "denied" }
  | { status: "error"; message: string };

export async function pollDeviceToken(clientId: string, clientSecret: string, deviceCode: string): Promise<PollResult> {
  const res = await fetch(`${API}/oauth/device/token`, {
    method: "POST",
    headers: headers(clientId),
    body: JSON.stringify({
      code: deviceCode,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (res.status === 200) return { status: "ok", token: (await res.json()) as TokenResponse };
  if (res.status === 400) return { status: "pending" };
  if (res.status === 404) return { status: "expired" };
  if (res.status === 409) return { status: "denied" };
  if (res.status === 410) return { status: "expired" };
  if (res.status === 418) return { status: "denied" };
  if (res.status === 429) return { status: "slow_down" };
  return { status: "error", message: `HTTP ${res.status}` };
}

export async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<TokenResponse> {
  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: headers(clientId),
    body: JSON.stringify({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
    }),
  });
  if (!res.ok) throw new Error(`Trakt token refresh failed: ${res.status}`);
  return (await res.json()) as TokenResponse;
}

export async function fetchTraktUser(clientId: string, accessToken: string): Promise<TraktUser["user"] | null> {
  const res = await fetch(`${API}/users/settings`, {
    headers: headers(clientId, accessToken),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as TraktUser;
  return data.user;
}

export async function revokeToken(clientId: string, clientSecret: string, accessToken: string): Promise<void> {
  try {
    await fetch(`${API}/oauth/revoke`, {
      method: "POST",
      headers: headers(clientId),
      body: JSON.stringify({
        token: accessToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
  } catch {
    /* best effort */
  }
}
