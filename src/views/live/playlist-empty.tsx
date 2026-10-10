import { MediaStartPage } from "@/components/media-start-page";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  Globe2,
  Tv,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import {
  EMPTY_FORM,
  type PlaylistFormValue,
  type PlaylistKind,
} from "./source-picker/playlist-form";

export function PlaylistEmpty({
  onSave,
}: {
  onSave: (entry: PlaylistFormValue) => void;
}) {
  const [stage, setStage] = useState<"intro" | "form">("intro");
  const actionRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (stage === "intro" && restoreFocus.current) {
      actionRef.current?.focus();
      restoreFocus.current = false;
    }
  }, [stage]);
  return stage === "intro" ? (
    <MediaStartPage kind="live" actionRef={actionRef} onSetup={() => setStage("form")} />
  ) : (
    <Form onBack={() => {
      restoreFocus.current = true;
      setStage("intro");
    }} onSave={onSave} />
  );
}

type KindMeta = {
  id: PlaylistKind;
  label: string;
  blurb: string;
  icon: React.ReactNode;
};

const KIND_META: KindMeta[] = [
  {
    id: "m3u",
    label: "M3U playlist",
    blurb: "Direct .m3u or get.php URL with credentials baked in.",
    icon: <Tv size={16} strokeWidth={1.9} />,
  },
  {
    id: "xtream",
    label: "Xtream codes",
    blurb: "Server URL plus username and password.",
    icon: <Globe2 size={16} strokeWidth={1.9} />,
  },
  {
    id: "epg",
    label: "EPG / XMLTV only",
    blurb: "Standalone guide source to attach to existing playlists.",
    icon: <CalendarRange size={16} strokeWidth={1.9} />,
  },
];

function Form({
  onBack,
  onSave,
}: {
  onBack: () => void;
  onSave: (entry: PlaylistFormValue) => void;
}) {
  const t = useT();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<PlaylistKind>("m3u");
  const [url, setUrl] = useState("");
  const [epgUrl, setEpgUrl] = useState("");
  const [server, setServer] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, [kind]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  const canSave = (() => {
    if (kind === "m3u") return /^https?:\/\//i.test(url.trim());
    if (kind === "xtream") {
      return (
        /^https?:\/\//i.test(server.trim()) &&
        username.trim().length > 0 &&
        password.trim().length > 0
      );
    }
    return /^https?:\/\//i.test(epgUrl.trim());
  })();

  const submit = () => {
    if (!canSave) return;
    const value: PlaylistFormValue = {
      ...EMPTY_FORM,
      name: name.trim() || t(defaultName(kind)),
      kind,
      url: url.trim(),
      epgUrl: epgUrl.trim(),
      xtream: {
        server: server.trim().replace(/\/+$/, ""),
        username: username.trim(),
        password: password.trim(),
      },
    };
    onSave(value);
  };

  return (
    <div className="media-start-page">
      <div className="media-start-inner flex flex-col gap-8">
        <button
          onClick={onBack}
          className="group inline-flex h-11 items-center gap-2 self-start rounded-lg border border-edge-soft bg-elevated/60 ps-3.5 pe-5 text-[14px] font-semibold text-ink-muted transition-all duration-150 ease-out hover:border-edge hover:bg-elevated hover:text-ink active:scale-[0.97]"
        >
          <ArrowLeft
            size={16}
            strokeWidth={2.4}
            className="dir-icon transition-transform group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5"
          />
          {t("Back")}
        </button>
        <header className="flex flex-col gap-3">
          <h2
            className="font-display text-[32px] font-semibold leading-tight tracking-tight text-ink"
          >
            {t("Connect your provider.")}
          </h2>
          <p className="text-[14.5px] leading-relaxed text-ink-muted">
            {t("Pick how you authenticate. Everything is stored locally.")}
          </p>
        </header>

        <div className="flex flex-col gap-2.5">
          {KIND_META.map((k) => {
            const selected = kind === k.id;
            return (
              <button
                key={k.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setKind(k.id)}
                className={`group flex items-center gap-4 rounded-lg border px-5 py-4 text-start transition-all duration-150 ${
                  selected
                    ? "border-ink/40 bg-elevated"
                    : "border-edge-soft/60 bg-elevated/30 hover:border-edge hover:bg-elevated/55"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    selected ? "bg-ink text-canvas" : "bg-canvas/60 text-ink-muted"
                  }`}
                >
                  {k.icon}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[14.5px] font-semibold text-ink">{t(k.label)}</span>
                  <span className="text-[12.5px] text-ink-muted">{t(k.blurb)}</span>
                </div>
                <span
                  className={`h-4 w-4 shrink-0 rounded-full border transition-colors ${
                    selected ? "border-ink bg-ink" : "border-edge"
                  }`}
                  aria-hidden
                >
                  {selected && (
                    <span className="block h-full w-full rounded-full border-2 border-canvas" />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-5 border-t border-edge-soft/40 pt-7">
          <Field label={t("Display name")} hint={t("Optional")}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(defaultName(kind))}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="h-12 w-full rounded-xl border border-edge-soft/70 bg-canvas/70 px-4 text-[14.5px] text-ink placeholder:text-ink-subtle/70 transition-colors focus:border-edge focus:outline-none"
            />
          </Field>

          {kind === "m3u" && (
            <>
              <Field label={t("Playlist URL")}>
                <input
                  ref={firstFieldRef}
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/get.php?username=…&password=…&type=m3u_plus"
                  spellCheck={false}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  className="h-12 w-full rounded-xl border border-edge-soft/70 bg-canvas/70 px-4 font-mono text-[13px] text-ink placeholder:text-ink-subtle/70 transition-colors focus:border-edge focus:outline-none"
                />
              </Field>
              <Field label={t("EPG URL")} hint={t("Optional")}>
                <input
                  type="url"
                  value={epgUrl}
                  onChange={(e) => setEpgUrl(e.target.value)}
                  placeholder="https://example.com/xmltv.php?username=…&password=…"
                  spellCheck={false}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  className="h-12 w-full rounded-xl border border-edge-soft/70 bg-canvas/70 px-4 font-mono text-[13px] text-ink placeholder:text-ink-subtle/70 transition-colors focus:border-edge focus:outline-none"
                />
              </Field>
            </>
          )}

          {kind === "xtream" && (
            <>
              <Field label={t("Server URL")}>
                <input
                  ref={firstFieldRef}
                  type="url"
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                  placeholder="https://example-iptv.com:8080"
                  spellCheck={false}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  className="h-12 w-full rounded-xl border border-edge-soft/70 bg-canvas/70 px-4 font-mono text-[13px] text-ink placeholder:text-ink-subtle/70 transition-colors focus:border-edge focus:outline-none"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label={t("Username")}>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="user12345"
                    autoComplete="off"
                    spellCheck={false}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    className="h-12 w-full rounded-xl border border-edge-soft/70 bg-canvas/70 px-4 font-mono text-[13px] text-ink placeholder:text-ink-subtle/70 transition-colors focus:border-edge focus:outline-none"
                  />
                </Field>
                <Field label={t("Password")}>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    spellCheck={false}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    className="h-12 w-full rounded-xl border border-edge-soft/70 bg-canvas/70 px-4 font-mono text-[13px] text-ink placeholder:text-ink-subtle/70 transition-colors focus:border-edge focus:outline-none"
                  />
                </Field>
              </div>
            </>
          )}

          {kind === "epg" && (
            <Field label={t("EPG / XMLTV URL")}>
              <input
                ref={firstFieldRef}
                type="url"
                value={epgUrl}
                onChange={(e) => setEpgUrl(e.target.value)}
                placeholder="https://example.com/epg.xml"
                spellCheck={false}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                className="h-12 w-full rounded-xl border border-edge-soft/70 bg-canvas/70 px-4 font-mono text-[13px] text-ink placeholder:text-ink-subtle/70 transition-colors focus:border-edge focus:outline-none"
              />
            </Field>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={onBack}
              className="h-12 rounded-lg px-5 text-[13.5px] font-medium text-ink-muted transition-colors hover:text-ink"
            >
              {t("Cancel")}
            </button>
            <button
              disabled={!canSave}
              onClick={submit}
              className="flex h-12 items-center gap-2 rounded-lg bg-ink px-6 text-[14px] font-semibold text-canvas transition-all duration-150 ease-out hover:opacity-90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-30"
            >
              {t("Save and continue")}
              <ArrowRight size={15} strokeWidth={2.4} className="dir-icon" />
            </button>
          </div>
        </div>

        <p className="text-[11.5px] leading-relaxed text-ink-subtle">
          {t(
            "Stored locally on this device. Credentials never leave your machine. If a channel fails to play, your provider may rate-limit shared accounts: refresh the playlist or check with them.",
          )}
        </p>
      </div>
    </div>
  );
}

function defaultName(kind: PlaylistKind): string {
  if (kind === "xtream") return "Xtream provider";
  if (kind === "epg") return "EPG source";
  return "My playlist";
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-baseline gap-2 text-[11.5px] font-bold uppercase tracking-[0.2em] text-ink-subtle">
        {label}
        {hint && (
          <span className="font-normal normal-case tracking-normal text-ink-subtle/60">{hint}</span>
        )}
      </span>
      {children}
    </label>
  );
}
