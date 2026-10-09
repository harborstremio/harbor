import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { SFX } from "@/lib/sfx";
import { useProfiles, type Profile } from "@/lib/profiles";
import { useBpT } from "./bp-i18n";
import { pushBpBack } from "./bp-back";
import { setBpFocus } from "./use-bp-focus";
import { BpWhoPin } from "./bp-who-is-watching-pin";
import { BpWhoTile, type BpWhoTileState } from "./bp-who-is-watching-tile";
import {
  bpWhoFaceSize,
  bpWhoKidSelectable,
  bpWhoNameSize,
  bpWhoPrefersReducedMotion,
  bpWhoRows,
} from "./bp-who-is-watching-logic";
import { BP_WHO_CSS } from "./bp-who-is-watching-style";
import {
  runBpWhoRetry,
  useBpWhoSyncCanRetry,
  useBpWhoSyncPhase,
} from "./bp-who-is-watching-sync";

// Timings lifted from mobile-whos-watching, which is the proven version of this
// choreography. The component is not imported: that one is a phone surface with
// no focus model.
const CHOOSE_MS = 360;
const COMMIT_MS = 560;
const UNLOCK_MS = 220;
const BLOCKED_NOTICE_MS = 6000;

type View = { kind: "list" } | { kind: "pin"; profileId: string };

export function BpWhoIsWatching({ onClose }: { onClose: () => void }) {
  const t = useBpT();
  const titleId = useId();
  const { profiles, activeId, selectProfile } = useProfiles();
  const phase = useBpWhoSyncPhase();
  const canRetry = useBpWhoSyncCanRetry();

  const [reduce] = useState(bpWhoPrefersReducedMotion);
  const [view, setView] = useState<View>({ kind: "list" });
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [exiting, setExiting] = useState(false);
  const [blockedId, setBlockedId] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(
    () =>
      pushBpBack(() => {
        onClose();
        return true;
      }),
    [onClose],
  );

  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id);
    },
    [],
  );

  const after = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const rows = useMemo(() => bpWhoRows(profiles), [profiles]);
  const faceSize = bpWhoFaceSize(profiles.length);
  const nameSize = bpWhoNameSize(profiles.length);
  const kidsAllowed = bpWhoKidSelectable();
  const blocked = blockedId ? (profiles.find((p) => p.id === blockedId) ?? null) : null;

  const commit = useCallback(
    (id: string, unlocked: boolean) => {
      // The gate now lives in selectProfile. choose() already routes a locked profile
      // to the PIN pad, so a refusal here means the roster changed underneath us.
      // Falling back to the list beats closing onto a profile that was never selected.
      const ok = unlocked ? selectProfile(id, { unlocked: true }) : selectProfile(id);
      if (!ok) {
        setExiting(false);
        setChosenId(null);
        setView({ kind: "list" });
        return;
      }
      onClose();
    },
    [onClose, selectProfile],
  );

  const choose = useCallback(
    (profile: Profile) => {
      if (chosenId || exiting) return;
      if (profile.id === activeId) {
        onClose();
        return;
      }
      if (profile.kid && !kidsAllowed) {
        setBlockedId(profile.id);
        after(BLOCKED_NOTICE_MS, () => setBlockedId(null));
        return;
      }
      setBlockedId(null);
      if (profile.passwordHash) {
        setView({ kind: "pin", profileId: profile.id });
        return;
      }
      if (reduce) {
        commit(profile.id, false);
        return;
      }
      setChosenId(profile.id);
      after(CHOOSE_MS, () => setExiting(true));
      after(COMMIT_MS, () => commit(profile.id, false));
    },
    [activeId, after, chosenId, commit, exiting, kidsAllowed, onClose, reduce],
  );

  const unlocked = useCallback(
    (id: string) => {
      if (reduce) {
        commit(id, true);
        return;
      }
      setExiting(true);
      after(UNLOCK_MS, () => commit(id, true));
    },
    [after, commit, reduce],
  );

  // Coming back from the PIN pad has to put the ring on the tile it came from,
  // otherwise the seed pass drops it on the active profile and the user has to
  // find their way back across the roster.
  const returnTo = useRef<string | null>(null);
  useEffect(() => {
    if (view.kind === "pin") {
      returnTo.current = view.profileId;
      return;
    }
    const id = returnTo.current;
    returnTo.current = null;
    if (!id) return;
    const timer = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-bp-who-id="${CSS.escape(id)}"]`,
      );
      if (el) setBpFocus(el, { silent: true });
    }, 30);
    return () => window.clearTimeout(timer);
  }, [view]);

  const pinTarget =
    view.kind === "pin" ? (profiles.find((p) => p.id === view.profileId) ?? null) : null;

  return (
    <div
      data-bp-who
      data-bp-who-exiting={exiting ? "true" : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-bp-dialog
      // Doctrine: this band owns its background. The chooser is not about any
      // title, so nothing of the last-focused artwork comes with it.
      className="absolute inset-0 z-[80] flex flex-col items-center justify-center gap-[clamp(26px,3.6vh,64px)] bg-[var(--bp-void)] px-[var(--bp-gutter)] py-[calc(clamp(24px,3vh,56px)_+_var(--bp-safe-y,0px))] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_backwards] motion-reduce:[animation:none]"
    >
      <style>{BP_WHO_CSS}</style>

      {pinTarget ? (
        <BpWhoPin
          profile={pinTarget}
          onCancel={() => setView({ kind: "list" })}
          onSuccess={() => unlocked(pinTarget.id)}
        />
      ) : (
        <>
          <div className="flex flex-col items-center gap-[clamp(5px,0.8vh,12px)] text-center">
            <h1
              id={titleId}
              className="font-display text-ink"
              style={{
                fontSize: "clamp(28px, 4.2vh, 64px)",
                fontWeight: 500,
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
              }}
            >
              {t("Who's watching?")}
            </h1>
            <p className="text-ink-muted" style={{ fontSize: "clamp(13px, 1.8vh, 24px)" }}>
              {t("Pick a profile to continue.")}
            </p>
          </div>

          {/* A grid, not a rail. The wrapped rows are one visual group rather
              than independent catalogs, so Down must keep the column the eye is
              already on. gridStep does that; the rail's first-card rule does
              not. Rows stay contiguous and unwrapped either way. */}
          {/* data-bp-scroll-y, because the shrink has three tiers and the row count
              has none. Past roughly five rows the faces stop shrinking while rows keep
              being added, so tiles go below the fold with a real rect: focus lands on
              them, centerScroll finds no scroller to drive, and the ring vanishes with
              the surface reading as frozen. */}
          <div
            data-bp-grid
            data-bp-scroll-y
            className="flex max-h-full w-full flex-col items-center gap-[clamp(22px,3vh,48px)] overflow-y-auto overscroll-contain py-[18px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {rows.map((row, at) => (
              <div
                key={row[0]?.id ?? at}
                className="flex flex-wrap items-start justify-center gap-[clamp(20px,2.4vw,56px)]"
              >
                {row.map((profile, seat) => (
                  <BpWhoTile
                    key={profile.id}
                    profile={profile}
                    active={profile.id === activeId}
                    state={tileState(chosenId, profile.id)}
                    faceSize={faceSize}
                    nameSize={nameSize}
                    delayMs={110 + Math.min(at * 6 + seat, 11) * 46}
                    unavailable={Boolean(profile.kid) && !kidsAllowed}
                    onChoose={() => {
                      SFX.click();
                      choose(profile);
                    }}
                  />
                ))}
              </div>
            ))}
          </div>

          <BpWhoNotice
            line={
              blocked
                ? t("Kids profiles are not available in Big Picture yet.")
                : phase === "pending"
                  ? t("Signing in to your Harbor account. Your profiles will appear in a moment.")
                  : phase === "failed"
                    ? t("Couldn't reach Harbor. Showing this device only.")
                    : null
            }
            retry={phase === "failed" && canRetry ? runBpWhoRetry : null}
            retryLabel={t("Retry")}
          />
        </>
      )}
    </div>
  );
}

function tileState(chosenId: string | null, id: string): BpWhoTileState {
  if (chosenId == null) return "idle";
  return chosenId === id ? "chosen" : "dimmed";
}

function BpWhoNotice({
  line,
  retry,
  retryLabel,
}: {
  line: string | null;
  retry: (() => void) | null;
  retryLabel: string;
}) {
  if (!line) return null;
  return (
    <div className="flex flex-col items-center gap-[clamp(9px,1.2vh,18px)] text-center">
      <p
        className="text-ink-subtle"
        style={{ maxWidth: "46ch", fontSize: "clamp(12.5px, 1.65vh, 21px)", lineHeight: 1.45 }}
      >
        {line}
      </p>
      {retry && (
        <button
          type="button"
          data-bp-focusable
          data-bp-chip
          onClick={retry}
          className="flex items-center gap-2.5 rounded-[var(--bp-r-md)] border border-[var(--bp-edge-2)] font-semibold text-ink"
          style={{
            height: "clamp(46px, 5.2vh, 72px)",
            paddingInline: "clamp(18px, 1.9vh, 34px)",
            fontSize: "clamp(13.5px, 1.8vh, 22px)",
          }}
        >
          <RefreshCw size={17} strokeWidth={2.2} />
          {retryLabel}
        </button>
      )}
    </div>
  );
}
