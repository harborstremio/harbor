import { useMemo, useState } from "react";
import { CalendarClock, ChevronLeft, KeyRound, Tv } from "lucide-react";
import {
  EMPTY_PLAYLIST_FORM,
  materializePlaylistEntry,
  newPlaylistId,
  type PlaylistFormValue,
  type PlaylistKind,
} from "@/lib/iptv/playlist-entry";
import { useSettings } from "@/lib/settings";
import { SFX } from "@/lib/sfx";
import { useBpT } from "./bp-i18n";
import { BpOnboardField } from "./onboarding/bp-onboard-field";

type Field = { key: string; label: string; placeholder: string; secret?: boolean };

const KINDS: Array<{ id: PlaylistKind; label: string; sub: string; icon: React.ReactNode }> = [
  {
    id: "m3u",
    label: "M3U link",
    sub: "A direct .m3u or .m3u8 address from your provider",
    icon: <Tv size={30} strokeWidth={1.7} />,
  },
  {
    id: "xtream",
    label: "Xtream Codes",
    sub: "Sign in with a server, username and password",
    icon: <KeyRound size={30} strokeWidth={1.7} />,
  },
  {
    id: "epg",
    label: "Guide data only",
    sub: "An XMLTV address to add listings to channels you already have",
    icon: <CalendarClock size={30} strokeWidth={1.7} />,
  },
];

// t is threaded in rather than called at the top level: the prose placeholders
// are user facing and the url ones deliberately are not.
function fieldsFor(kind: PlaylistKind, t: (k: string) => string): Field[] {
  const name = { key: "name", label: "Name", placeholder: t("My provider") };
  if (kind === "xtream") {
    return [
      name,
      { key: "server", label: "Server", placeholder: "http://example.com:8080" },
      { key: "username", label: "Username", placeholder: "" },
      { key: "password", label: "Password", placeholder: "", secret: true },
    ];
  }
  if (kind === "epg") {
    return [name, { key: "epgUrl", label: "XMLTV address", placeholder: "https://.../guide.xml" }];
  }
  return [
    name,
    { key: "url", label: "Playlist address", placeholder: "https://.../playlist.m3u" },
    { key: "epgUrl", label: "Guide address", placeholder: t("Optional") },
  ];
}

function read(form: PlaylistFormValue, key: string): string {
  if (key === "server" || key === "username" || key === "password") {
    return form.xtream[key];
  }
  return (form as unknown as Record<string, string>)[key] ?? "";
}

function write(form: PlaylistFormValue, key: string, value: string): PlaylistFormValue {
  if (key === "server" || key === "username" || key === "password") {
    return { ...form, xtream: { ...form.xtream, [key]: value } };
  }
  return { ...form, [key]: value };
}

function complete(form: PlaylistFormValue): boolean {
  if (form.kind === "xtream") {
    const { server, username, password } = form.xtream;
    return !!server.trim() && !!username.trim() && !!password;
  }
  if (form.kind === "epg") return !!form.epgUrl.trim();
  return !!form.url.trim();
}

/**
 * Adding a playlist without ever having opened Harbor on a desktop. Rows are
 * numbered from 0 with no gaps because bpRailStep treats a missing index as the
 * end of the rail, so the kind picker, every field and the save button are one
 * contiguous run whatever kind is selected.
 */
export function BpLiveSetup({
  onDone,
  onBack,
  onSaved,
  backLabel,
}: {
  onDone?: () => void;
  onBack?: () => void;
  onSaved?: (id: string) => void;
  backLabel?: string;
}) {
  const t = useBpT();
  const { settings, update } = useSettings();
  const [form, setForm] = useState<PlaylistFormValue>(EMPTY_PLAYLIST_FORM);
  const [reveal, setReveal] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const fields = useMemo(() => fieldsFor(form.kind, t), [form.kind, t]);
  const ready = complete(form);
  // Back is row 0 when present, so everything below shifts by one. The run has
  // to stay contiguous: bpRailStep treats a gap as the end of the rail.
  const order = [...(onBack ? ["back"] : []), "kind", ...fields.map((f) => f.key), "save"];
  const rowAt = (key: string) => String(order.indexOf(key));

  const save = () => {
    if (!ready) return;
    SFX.click();
    const name = form.name.trim() || t("My playlist");
    const id = newPlaylistId();
    const entry = materializePlaylistEntry(id, { ...form, name });
    const carriesVod = form.kind !== "epg";
    update({
      iptvPlaylists: [...settings.iptvPlaylists, entry],
      ...(carriesVod && !settings.showPlaylistsTab ? { showPlaylistsTab: true } : {}),
    });
    setForm(EMPTY_PLAYLIST_FORM);
    onSaved?.(id);
    onDone?.();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[clamp(8px,1.6vh,26px)]">
      {onBack && (
        <div data-bp-row data-bp-rail-row={rowAt("back")}>
          <button
            type="button"
            data-bp-focusable
            data-bp-chip
            data-bp-autofocus="true"
            data-bp-restore-key="bp-live-setup-back"
            onClick={() => {
              SFX.close();
              onBack();
            }}
            className="flex h-[clamp(48px,7vh,68px)] items-center gap-[clamp(7px,0.7vw,12px)] rounded-[var(--bp-r-md)] border border-[var(--bp-edge-2)] px-[clamp(16px,1.5vw,28px)] text-[clamp(17px,2.2vh,22px)] font-bold text-ink"
          >
            <ChevronLeft size={20} strokeWidth={2.4} />
            {backLabel ?? t("Settings")}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-[clamp(4px,0.6vh,9px)]">
        <h2 className="font-display text-[clamp(30px,3.9vh,40px)] font-semibold leading-tight text-ink">
          {t("Set up Live TV")}
        </h2>
        <p className="max-w-[70ch] text-[clamp(17px,2.3vh,22px)] font-medium leading-snug text-ink-subtle">
          {t("Harbor plays IPTV from your own provider. Add a playlist and the guide fills in.")}
        </p>
      </div>

      <div
        data-bp-row
        data-bp-rail-row={rowAt("kind")}
        className="flex gap-[clamp(9px,0.9vw,18px)]"
      >
        {KINDS.map((k) => {
          const on = k.id === form.kind;
          return (
            <button
              key={k.id}
              type="button"
              data-bp-focusable
              data-bp-tile="wide"
              data-bp-restore-key={`live-setup-kind:${k.id}`}
              onClick={() => {
                SFX.click();
                setForm((f) => ({ ...f, kind: k.id }));
              }}
              aria-pressed={on}
              className={`flex min-w-0 flex-1 flex-col items-start gap-[clamp(5px,0.7vh,11px)] rounded-[var(--bp-r-md)] border p-[clamp(14px,1.5vw,26px)] text-start ${
                on
                  ? "border-transparent bg-[var(--bp-on)]"
                  : "border-[var(--bp-edge-2)] bg-[var(--bp-panel)]"
              }`}
            >
              <span className={on ? "text-ink" : "text-ink-subtle"}>{k.icon}</span>
              <span className="text-[clamp(19px,2.5vh,24px)] font-semibold text-ink">
                {t(k.label)}
              </span>
              <span className="text-[clamp(15px,1.9vh,18px)] font-medium leading-snug text-ink-subtle">
                {t(k.sub)}
              </span>
            </button>
          );
        })}
      </div>

      {fields.map((f) => (
        <div key={`${form.kind}:${f.key}`} data-bp-rail-row={rowAt(f.key)}>
          <BpOnboardField
            label={t(f.label)}
            value={read(form, f.key)}
            placeholder={f.placeholder}
            secret={f.secret}
            revealed={reveal}
            onReveal={() => setReveal((r) => !r)}
            active={active === f.key}
            onFocus={() => setActive(f.key)}
            onChange={(next) => setForm((cur) => write(cur, f.key, next))}
            onSubmit={save}
          />
        </div>
      ))}

      <div
        data-bp-row
        data-bp-rail-row={rowAt("save")}
        className="flex items-center gap-[clamp(9px,0.9vw,16px)]"
      >
        <button
          type="button"
          data-bp-focusable
          data-bp-chip
          disabled={!ready}
          onClick={save}
          // Never a resting --bp-touch fill: bp-tokens gives the FOCUSED chip
          // exactly that fill, so a ready button and the D-pad cursor became the
          // same object.
          className={`flex h-[clamp(48px,6.8vh,80px)] items-center rounded-[var(--bp-r-md)] border px-[clamp(22px,2vw,40px)] text-[clamp(17px,2.2vh,24px)] font-semibold ${
            ready
              ? "border-transparent bg-[var(--bp-on)] text-ink"
              : "border-[var(--bp-edge-2)] bg-[var(--bp-panel)] text-ink-subtle"
          }`}
        >
          {t("Add playlist")}
        </button>
        <span className="text-[clamp(15px,1.9vh,18px)] font-medium text-ink-subtle">
          {t("Press OK on a field to type, or use the Harbor remote on your phone.")}
        </span>
      </div>
    </div>
  );
}
