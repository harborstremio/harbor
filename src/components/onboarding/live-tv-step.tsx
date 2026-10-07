import { Check, ClipboardPaste, Loader2, Trash2, Tv } from "lucide-react";
import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { useFavorites } from "@/lib/iptv/favorites";
import { purgePlaylistState } from "@/lib/iptv/source-cleanup";
import { fetchM3uText } from "@/lib/iptv/store";
import { credsFromServer, fetchXtreamUserInfo } from "@/lib/iptv/xtream";
import { parseProviderMessage, type ProviderLogin } from "@/lib/jl/provider-message";
import { useSettings } from "@/lib/settings";
import { materializePlaylistEntry } from "@/views/live/hooks/use-playlist-mutations";
import { EMPTY_FORM, PlaylistForm, type PlaylistFormValue } from "@/views/live/source-picker/playlist-form";

type TestState = { kind: "idle" } | { kind: "testing" } | { kind: "error"; message: string };

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function loginLabel(l: ProviderLogin): string {
  const host = hostOf(l.kind === "xtream" ? l.server : l.url);
  return l.note ? `${host} (${l.note})` : host;
}

// Turns the raw failure into something a first-time IPTV customer can act on.
function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/expired/i.test(msg)) return "Your provider says this account has expired. Renew it with your provider, then try again.";
  if (/banned|disabled/i.test(msg)) return "Your provider has turned this account off. Contact your provider.";
  if (/auth|credential|401|403|rejected/i.test(msg))
    return "The provider didn't accept this username and password. Check them against your provider's message.";
  if (/404|not found/i.test(msg))
    return "That link isn't on your provider's server. Paste the whole message again so the full link is included.";
  return "Couldn't reach your provider's server. Check your internet, or try the other server link if your provider gave one (some need a VPN).";
}

async function testLogin(l: ProviderLogin): Promise<void> {
  if (l.kind === "xtream") {
    const creds = credsFromServer(l.server, l.username, l.password);
    if (!creds) throw new Error("credentials");
    await fetchXtreamUserInfo(creds);
    return;
  }
  const text = await fetchM3uText(l.url);
  if (!/#EXTM3U|#EXTINF/i.test(text.slice(0, 4096))) throw new Error("not found");
}

function toForm(l: ProviderLogin): PlaylistFormValue {
  const name = hostOf(l.kind === "xtream" ? l.server : l.url);
  return l.kind === "xtream"
    ? { ...EMPTY_FORM, name, kind: "xtream", xtream: { server: l.server, username: l.username, password: l.password } }
    : { ...EMPTY_FORM, name, kind: "m3u", url: l.url };
}

function fromForm(v: PlaylistFormValue): ProviderLogin | null {
  if (v.kind === "xtream") {
    const { server, username, password } = v.xtream;
    return server && username && password ? { kind: "xtream", server, username, password, note: null } : null;
  }
  return v.kind === "m3u" && v.url.trim() ? { kind: "m3u", url: v.url.trim(), note: null } : null;
}

export function LiveTvStep({ onNoIptv }: { onNoIptv: () => void }) {
  const t = useT();
  const { settings, update } = useSettings();
  const favorites = useFavorites();
  const playlists = settings.iptvPlaylists.filter((p) => (p.kind ?? "m3u") !== "epg");
  const [message, setMessage] = useState("");
  const [manual, setManual] = useState(false);
  const [adding, setAdding] = useState(playlists.length === 0);
  const [test, setTest] = useState<TestState>({ kind: "idle" });
  const found = useMemo(() => parseProviderMessage(message), [message]);

  const save = (l: ProviderLogin) => {
    const id = `pl-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    update({ iptvPlaylists: [...settings.iptvPlaylists, materializePlaylistEntry(id, toForm(l))] });
    setMessage("");
    setManual(false);
    setAdding(false);
    setTest({ kind: "idle" });
  };

  // Providers often list a default and a VPN server; use the first one that answers.
  const testAndSave = async (logins: ProviderLogin[]) => {
    if (logins.length === 0) return;
    setTest({ kind: "testing" });
    let lastError: unknown = null;
    for (const l of logins) {
      try {
        await testLogin(l);
        save(l);
        return;
      } catch (e) {
        lastError = e;
      }
    }
    setTest({ kind: "error", message: friendlyError(lastError) });
  };

  const testing = test.kind === "testing";

  return (
    <div className="flex flex-col gap-4">
      <span className="text-[12.5px] font-medium uppercase tracking-[0.16em] text-ink-subtle">
        {t("Step 2 of 3 · Live TV")}
      </span>
      <h1 className="font-display text-[34px] font-medium leading-[1.08] tracking-tight text-ink">
        {t("Add your TV provider")}
      </h1>

      {playlists.length > 0 && (
        <ul className="flex flex-col gap-2">
          {playlists.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft px-4 py-3">
              <Check size={15} className="shrink-0 text-accent" />
              <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{p.name}</span>
              <span className="text-[12px] text-ink-muted">{t("Connected")}</span>
              <button
                onClick={() => {
                  update({ iptvPlaylists: settings.iptvPlaylists.filter((s) => s.id !== p.id) });
                  purgePlaylistState(p.id, favorites.removeForSource);
                }}
                aria-label={t("Remove")}
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-subtle hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!adding ? (
        <button
          onClick={() => setAdding(true)}
          className="w-fit text-[13.5px] font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          {t("Add another provider")}
        </button>
      ) : manual ? (
        <div className="max-h-[42vh] overflow-y-auto rounded-xl border border-edge-soft bg-canvas/40">
          <PlaylistForm
            initial={EMPTY_FORM}
            submitLabel={t("Test & save")}
            autoFocusName={false}
            onCancel={() => setManual(false)}
            onSubmit={(v) => {
              const l = fromForm(v);
              if (l) void testAndSave([l]);
            }}
          />
          {testing && (
            <p className="flex items-center gap-2 px-4 pb-3 text-[13px] text-ink-muted">
              <Loader2 size={14} className="animate-spin" />
              {t("Testing your provider")}
            </p>
          )}
          {test.kind === "error" && <p className="px-4 pb-3 text-[13px] leading-relaxed text-danger">{t(test.message)}</p>}
        </div>
      ) : (
        <>
          <p className="text-[14.5px] leading-relaxed text-ink-muted">
            {t(
              "Paste the whole message your provider sent you (WhatsApp, email or text). We'll find the username, password and links.",
            )}
          </p>
          <div className="relative">
            <ClipboardPaste size={16} className="pointer-events-none absolute start-3.5 top-3.5 text-ink-subtle" />
            <textarea
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setTest({ kind: "idle" });
              }}
              placeholder={t("Paste your provider's message here")}
              rows={5}
              spellCheck={false}
              className="w-full resize-none rounded-xl border border-edge bg-canvas py-3 pe-4 ps-10 text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-ink-subtle/60 focus:border-ink-subtle"
            />
          </div>

          {message.trim() && found.logins.length === 0 && (
            <p className="text-[13px] text-amber-300">
              {t("We couldn't find a link in that message. Make sure you copied all of it, or enter the details by hand.")}
            </p>
          )}

          {found.logins.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3 text-[13px]">
              {found.username && (
                <span className="text-ink-muted">
                  {t("Username")}: <span className="text-ink">{found.username}</span>
                </span>
              )}
              {found.password && (
                <span className="text-ink-muted">
                  {t("Password")}: <span className="text-ink">{"•".repeat(Math.min(found.password.length, 10))}</span>
                </span>
              )}
              {found.logins.map((l, i) => (
                <span key={i} className="flex items-center gap-2 text-ink-muted">
                  <Tv size={13} className="shrink-0" />
                  <span className="truncate text-ink">{loginLabel(l)}</span>
                </span>
              ))}
            </div>
          )}

          {test.kind === "error" && <p className="text-[13px] leading-relaxed text-danger">{t(test.message)}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => void testAndSave(found.logins)}
              disabled={testing || found.logins.length === 0}
              className="flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {testing && <Loader2 size={15} className="animate-spin" />}
              {testing ? t("Testing your provider") : t("Test & save")}
            </button>
            <button
              onClick={() => setManual(true)}
              className="text-[13px] text-ink-muted underline-offset-4 hover:text-ink hover:underline"
            >
              {t("Enter details by hand")}
            </button>
          </div>
        </>
      )}

      {playlists.length === 0 && (
        <button
          onClick={onNoIptv}
          className="w-fit text-[13px] text-ink-subtle underline-offset-4 hover:text-ink hover:underline"
        >
          {t("I don't have an IPTV provider")}
        </button>
      )}
    </div>
  );
}
