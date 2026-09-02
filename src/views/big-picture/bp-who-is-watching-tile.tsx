import { Lock } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { profileInitials, type Profile } from "@/lib/profiles";
import { useBpT } from "./bp-i18n";

export type BpWhoTileState = "idle" | "chosen" | "dimmed";

export function BpWhoTile({
  profile,
  active,
  state,
  faceSize,
  nameSize,
  delayMs,
  unavailable,
  onChoose,
}: {
  profile: Profile;
  active: boolean;
  state: BpWhoTileState;
  faceSize: string;
  nameSize: string;
  delayMs: number;
  unavailable: boolean;
  onChoose: () => void;
}) {
  const t = useBpT();
  const locked = Boolean(profile.passwordHash);
  const [artBroken, setArtBroken] = useState(false);

  // A profile can be re-pointed at a different avatar while the chooser is up,
  // and a stale broken flag would strand it on initials for the rest of the
  // session.
  useEffect(() => setArtBroken(false), [profile.avatar]);

  const showArt = Boolean(profile.avatar) && !artBroken;

  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-who-tile
      // Its own attribute rather than data-bp-restore-key, so returning from the PIN
      // pad can find this tile without the shell's position memory also latching onto
      // it and overriding data-bp-autofocus on the next open.
      data-bp-who-id={profile.id}
      data-bp-who-state={state}
      data-bp-who-active={active ? "true" : undefined}
      data-bp-who-unavailable={unavailable ? "true" : undefined}
      data-bp-autofocus={active ? "true" : undefined}
      // No data-bp-restore-key. The seed pass tries readBpPosition(routeKey) BEFORE it
      // looks for data-bp-autofocus and returns early on a landed restore, so a restore
      // key meant the second open of a session put the ring wherever the last one left
      // it. This surface must always open on who you are, not on who you last looked at.
      aria-label={t("Switch to {name}", { name: profile.name })}
      aria-disabled={unavailable || undefined}
      onClick={onChoose}
      style={
        {
          "--bp-who-face": faceSize,
          "--bp-who-color": profile.color,
          width: "calc(var(--bp-who-face) * 1.42)",
          animationDelay: `${delayMs}ms`,
        } as CSSProperties
      }
      className="relative flex shrink-0 flex-col items-center gap-[clamp(10px,1.4vh,20px)] outline-none [animation:bp-stagger_var(--bp-dur-slow)_var(--bp-ease)_both] motion-reduce:[animation:none]"
    >
      <span className="relative block">
        <span
          data-bp-who-face
          className="grid place-items-center overflow-hidden rounded-full"
          style={{
            height: "var(--bp-who-face)",
            width: "var(--bp-who-face)",
            background: profile.color,
          }}
        >
          {showArt ? (
            <img
              src={profile.avatar ?? ""}
              alt=""
              draggable={false}
              onError={() => setArtBroken(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="font-display font-semibold text-[var(--color-canvas)]"
              style={{ fontSize: "calc(var(--bp-who-face) * 0.34)", lineHeight: 1 }}
            >
              {profileInitials(profile.name)}
            </span>
          )}
        </span>
        {locked && (
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-[2%] -end-[2%] grid place-items-center rounded-full border border-[var(--bp-edge-2)] bg-[var(--bp-panel-2)] text-ink"
            style={{
              height: "calc(var(--bp-who-face) * 0.28)",
              width: "calc(var(--bp-who-face) * 0.28)",
            }}
          >
            <Lock size="52%" strokeWidth={2.6} />
          </span>
        )}
      </span>

      <span
        data-bp-who-name
        className="max-w-full truncate text-center font-semibold"
        style={{ fontSize: nameSize }}
      >
        {profile.name}
      </span>
    </button>
  );
}
