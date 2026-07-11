import { useT } from "@/lib/i18n";
import { CalendarRange, Globe2, Tv } from "lucide-react";
import { useState } from "react";

export type PlaylistKind = "m3u" | "xtream" | "epg";

export type PlaylistFormValue = {
  name: string;
  kind: PlaylistKind;
  url: string;
  epgUrl: string;
  xtream: { server: string; username: string; password: string };
};

const EMPTY_XTREAM = { server: "", username: "", password: "" };

export const EMPTY_FORM: PlaylistFormValue = {
  name: "",
  kind: "m3u",
  url: "",
  epgUrl: "",
  xtream: { ...EMPTY_XTREAM },
};

const KINDS: Array<{ id: PlaylistKind; label: string; icon: React.ReactNode; sub: string }> = [
  { id: "m3u", label: "M3U URL", icon: <Tv size={14} strokeWidth={1.9} />, sub: "Direct .m3u link" },
  {
    id: "xtream",
    label: "Xtream",
    icon: <Globe2 size={14} strokeWidth={1.9} />,
    sub: "Server + login",
  },
  {
    id: "epg",
    label: "EPG",
    icon: <CalendarRange size={14} strokeWidth={1.9} />,
    sub: "XMLTV only",
  },
];

export function PlaylistForm({
  initial,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  initial: PlaylistFormValue;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (v: PlaylistFormValue) => void;
}) {
  const t = useT();
  const [name, setName] = useState(initial.name);
  const [kind, setKind] = useState<PlaylistKind>(initial.kind);
  const [url, setUrl] = useState(initial.url);
  const [epgUrl, setEpgUrl] = useState(initial.epgUrl);
  const [xtream, setXtream] = useState(initial.xtream);

  const canSave = (() => {
    if (kind === "m3u") return /^https?:\/\//i.test(url.trim());
    if (kind === "xtream") {
      return (
        /^https?:\/\//i.test(xtream.server.trim()) &&
        xtream.username.trim().length > 0 &&
        xtream.password.trim().length > 0
      );
    }
    return /^https?:\/\//i.test(epgUrl.trim());
  })();

  const submit = () => {
    if (!canSave) return;
    onSubmit({
      name: name.trim() || t("Playlist"),
      kind,
      url: url.trim(),
      epgUrl: epgUrl.trim(),
      xtream: {
        server: xtream.server.trim().replace(/\/+$/, ""),
        username: xtream.username.trim(),
        password: xtream.password.trim(),
      },
    });
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <Field label={t("Type")}>
        <div className="grid grid-cols-3 gap-1.5">
          {KINDS.map((k) => {
            const selected = kind === k.id;
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={`flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-start transition-colors ${
                  selected
                    ? "border-ink bg-elevated text-ink"
                    : "border-edge-soft/60 bg-canvas/40 text-ink-muted hover:border-edge hover:text-ink"
                }`}
              >
                <span className="flex items-center gap-1.5 text-[11.5px] font-semibold">
                  {k.icon}
                  {t(k.label)}
                </span>
                <span className="text-[10px] text-ink-subtle">{t(k.sub)}</span>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label={t("Name")}>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("My provider")}
          className="h-10 rounded-lg border border-edge-soft/70 bg-canvas px-3 text-[13px] text-ink placeholder:text-ink-subtle focus:border-edge focus:outline-none"
        />
      </Field>

      {kind === "m3u" && (
        <>
          <Field label={t("Playlist URL")}>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://...get.php?username=...&password=..."
              spellCheck={false}
              className="h-10 rounded-lg border border-edge-soft/70 bg-canvas px-3 font-mono text-[11.5px] text-ink placeholder:text-ink-subtle focus:border-edge focus:outline-none"
            />
          </Field>
          <Field label={t("EPG URL (optional)")}>
            <input
              type="url"
              value={epgUrl}
              onChange={(e) => setEpgUrl(e.target.value)}
              placeholder="https://...xmltv.php?username=...&password=..."
              spellCheck={false}
              className="h-10 rounded-lg border border-edge-soft/70 bg-canvas px-3 font-mono text-[11.5px] text-ink placeholder:text-ink-subtle focus:border-edge focus:outline-none"
            />
          </Field>
        </>
      )}

      {kind === "xtream" && (
        <>
          <Field label={t("Server URL")}>
            <input
              type="url"
              value={xtream.server}
              onChange={(e) => setXtream((x) => ({ ...x, server: e.target.value }))}
              placeholder="https://example-iptv.com:8080"
              spellCheck={false}
              className="h-10 rounded-lg border border-edge-soft/70 bg-canvas px-3 font-mono text-[11.5px] text-ink placeholder:text-ink-subtle focus:border-edge focus:outline-none"
            />
          </Field>
          <Field label={t("Username")}>
            <input
              type="text"
              value={xtream.username}
              onChange={(e) => setXtream((x) => ({ ...x, username: e.target.value }))}
              placeholder="user12345"
              autoComplete="off"
              spellCheck={false}
              className="h-10 rounded-lg border border-edge-soft/70 bg-canvas px-3 font-mono text-[11.5px] text-ink placeholder:text-ink-subtle focus:border-edge focus:outline-none"
            />
          </Field>
          <Field label={t("Password")}>
            <input
              type="password"
              value={xtream.password}
              onChange={(e) => setXtream((x) => ({ ...x, password: e.target.value }))}
              placeholder="••••••••"
              autoComplete="new-password"
              spellCheck={false}
              className="h-10 rounded-lg border border-edge-soft/70 bg-canvas px-3 font-mono text-[11.5px] text-ink placeholder:text-ink-subtle focus:border-edge focus:outline-none"
            />
          </Field>
          <Field label={t("EPG URL (optional)")}>
            <input
              type="url"
              value={epgUrl}
              onChange={(e) => setEpgUrl(e.target.value)}
              placeholder="https://...xmltv.php?username=...&password=..."
              spellCheck={false}
              className="h-10 rounded-lg border border-edge-soft/70 bg-canvas px-3 font-mono text-[11.5px] text-ink placeholder:text-ink-subtle focus:border-edge focus:outline-none"
            />
          </Field>
        </>
      )}

      {kind === "epg" && (
        <>
          <Field label={t("EPG / XMLTV URL")}>
            <input
              type="url"
              value={epgUrl}
              onChange={(e) => setEpgUrl(e.target.value)}
              placeholder="https://example.com/epg.xml"
              spellCheck={false}
              className="h-10 rounded-lg border border-edge-soft/70 bg-canvas px-3 font-mono text-[11.5px] text-ink placeholder:text-ink-subtle focus:border-edge focus:outline-none"
            />
          </Field>
          <p className="text-[11px] leading-snug text-ink-subtle">
            {t(
              "Stored as a standalone EPG source. No channels are loaded for EPG-only entries; they're kept here for future attachment to existing playlists.",
            )}
          </p>
        </>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="h-9 rounded-lg px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          {t("Cancel")}
        </button>
        <button
          disabled={!canSave}
          onClick={submit}
          className="h-9 rounded-lg bg-ink px-3 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">{label}</span>
      {children}
    </label>
  );
}

export function buildXtreamUrls(server: string, username: string, password: string) {
  const base = server.replace(/\/+$/, "");
  const u = encodeURIComponent(username);
  const p = encodeURIComponent(password);
  return {
    m3u: `${base}/get.php?username=${u}&password=${p}&type=m3u_plus&output=ts`,
    epg: `${base}/xmltv.php?username=${u}&password=${p}`,
  };
}
