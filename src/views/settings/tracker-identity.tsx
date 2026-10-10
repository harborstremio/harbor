import { ExternalLink, LogOut } from "./icons";
import { useEffect, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";

export function TrackerIdentity({
  logo,
  service,
  handle,
  avatar,
  meta,
  profileUrl,
  onDisconnect,
  extra,
}: {
  logo: string;
  service: string;
  handle?: string;
  avatar?: string | null;
  meta?: string;
  profileUrl?: string;
  onDisconnect: () => void;
  extra?: ReactNode;
}) {
  const t = useT();
  const [broken, setBroken] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setBroken(false);
    setReady(false);
  }, [avatar]);
  const showAvatar = !!avatar && !broken;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-4 border-b border-edge-soft pb-6 pt-2">
      <span className="relative block h-14 w-14 shrink-0">
        <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-canvas">
          {showAvatar ? (
            <>
              <img
                src={avatar}
                alt=""
                draggable={false}
                decoding="async"
                onLoad={() => setReady(true)}
                onError={() => setBroken(true)}
                className={`col-start-1 row-start-1 h-14 w-14 object-cover transition-opacity duration-300 ease-out ${
                  ready ? "opacity-100" : "opacity-0"
                }`}
              />
              {!ready && (
                <img
                  src={logo}
                  alt=""
                  aria-hidden
                  draggable={false}
                  className="col-start-1 row-start-1 h-7 w-7 self-center justify-self-center object-contain opacity-35"
                />
              )}
            </>
          ) : (
            <img src={logo} alt="" draggable={false} className="h-7 w-7 object-contain" />
          )}
        </span>
        {showAvatar && (
          <span className="absolute -bottom-0.5 -end-0.5 grid h-6 w-6 place-items-center rounded-full bg-elevated">
            <img src={logo} alt="" draggable={false} className="h-4 w-4 object-contain" />
          </span>
        )}
      </span>

      <span className="flex min-w-[160px] flex-1 flex-col gap-1">
        <span className="truncate text-[19px] font-semibold leading-tight tracking-tight text-ink">
          {handle ? `@${handle}` : t("Connected")}
        </span>
        <span className="flex items-center gap-1.5 text-[15.5px] leading-[22px] text-ink-subtle">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
          {meta ? `${service} · ${meta}` : service}
        </span>
      </span>

      <span className="flex shrink-0 flex-wrap items-center gap-1.5">
        {extra}
        {profileUrl && (
          <button
            type="button"
            onClick={() => openUrl(profileUrl)}
            className="harbor-press-pop flex h-11 items-center gap-2 rounded-[8px] bg-canvas px-4 text-[15px] font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            {t("Open profile")}
            <ExternalLink size={16} strokeWidth={2.2} />
          </button>
        )}
        <button
          type="button"
          onClick={onDisconnect}
          className="harbor-press-pop flex h-11 items-center gap-2 rounded-[8px] bg-canvas px-4 text-[15px] font-semibold text-ink-muted transition-colors hover:text-danger"
        >
          <LogOut size={16} strokeWidth={2.2} />
          {t("Disconnect")}
        </button>
      </span>
    </div>
  );
}
