import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { boatBuilt } from "./setup-boat";
import { SetupHarbor, type HarborSession } from "./setup-harbor";
import { SetupRecovery } from "./setup-recovery";
import {
  SetupConnecting,
  SetupDone,
  SetupExpired,
  SetupIdleHost,
  SetupNoToken,
  SetupUnreachable,
} from "./setup-states";
import { SetupStremio } from "./setup-stremio";
import { SetupTmdb } from "./setup-tmdb";
import { STEP_ORDER, clearSetupToken, setupToken, type SetupStepId } from "./setup-wire";
import type { SetupChrome } from "./setup-shell";
import { useSetupLink } from "./use-setup-link";

type Pending = { code: string; session: HarborSession };

export function MobileOnboard({ onExit }: { onExit: () => void }) {
  const token = useMemo(() => setupToken(), []);

  // Strips ?setup= as well as closing the page. Without it a reload re-enters
  // setup against a code the TV has already retired, with nothing on screen
  // that can get the user to the remote they were promised.
  const leave = useCallback(() => {
    clearSetupToken();
    onExit();
  }, [onExit]);

  if (!token) {
    return (
      <SetupNoToken
        chrome={{ status: "unreachable", stepIndex: 0, stepCount: 0, built: 0 }}
        onExit={leave}
      />
    );
  }
  return <OnboardFlow token={token} onExit={leave} />;
}

function OnboardFlow({ token, onExit }: { token: string; onExit: () => void }) {
  const link = useSetupLink(token);
  const [passed, setPassed] = useState<SetupStepId[]>([]);
  const [recovery, setRecovery] = useState<Pending | null>(null);

  // Releases the binding so a second phone, or this one after a reload, is not
  // refused with boundElsewhere for the rest of the offer's life. Not done in an
  // unmount cleanup: the client's own effect was registered first, so by the
  // time this component tears down the socket is already closed.
  const abandonRef = useRef(link.abandon);
  abandonRef.current = link.abandon;
  useEffect(() => {
    const bye = () => abandonRef.current();
    window.addEventListener("pagehide", bye);
    return () => window.removeEventListener("pagehide", bye);
  }, []);

  const leave = useCallback(() => {
    abandonRef.current();
    onExit();
  }, [onExit]);

  // The TV drops a step out of `pending` the moment it lands. Recomputing the
  // queue from every offer would advance the phone off the success screen the
  // user is still reading, so the queue is taken once and held.
  const lockedQueue = useRef<SetupStepId[] | null>(null);
  const pending = link.offer?.pending;
  if (!lockedQueue.current && pending) {
    lockedQueue.current = STEP_ORDER.filter((s) => pending.includes(s));
  }
  const queue = lockedQueue.current ?? [];

  const active = queue.find((s) => !passed.includes(s)) ?? null;
  const stepCount = queue.length;
  const stepIndex = active ? queue.indexOf(active) : Math.max(stepCount - 1, 0);

  // Taken from this run's own confirmations, not from `passed`. A skipped step
  // must never build a piece of the boat, or the finish screen hands back a
  // whole one to somebody who set nothing up.
  const landed = queue.filter((s) => link.deliveryOf(s) === "confirmed").length;
  const chrome: SetupChrome = {
    status: link.status,
    idleHost: link.idleHost,
    stepIndex,
    stepCount,
    built: boatBuilt(landed, stepCount),
  };

  const pass = (step: SetupStepId) =>
    setPassed((prev) => (prev.includes(step) ? prev : [...prev, step]));

  const finished = queue.length > 0 && active === null;

  if (link.status === "unreachable" && !link.armed) {
    return <SetupUnreachable chrome={chrome} onRetry={link.reconnect} onExit={leave} />;
  }
  // Checked after the finish screen on purpose. A user who completed every step
  // and then sat still used to watch success flip to "that code has expired".
  if (link.expired && !finished) return <SetupExpired chrome={chrome} onExit={leave} />;
  if (!link.armed) {
    return link.idleHost ? (
      <SetupIdleHost chrome={chrome} onRetry={link.reconnect} onExit={leave} />
    ) : (
      <SetupConnecting chrome={chrome} />
    );
  }

  if (recovery) {
    return (
      <SetupRecovery
        chrome={chrome}
        code={recovery.code}
        onContinue={() => {
          link.deliver({
            step: "harbor",
            session: recovery.session.session,
            handle: recovery.session.handle,
            refresh: recovery.session.refresh,
          });
          setRecovery(null);
        }}
      />
    );
  }

  if (active === "tmdb") {
    return (
      <SetupTmdb
        chrome={chrome}
        delivery={link.deliveryOf("tmdb")}
        reject={link.rejectOf("tmdb")}
        onDeliver={(key) => link.deliver({ step: "tmdb", key })}
        onRetry={() => link.resetDelivery("tmdb")}
        onSkip={() => pass("tmdb")}
        onContinue={() => pass("tmdb")}
      />
    );
  }

  if (active === "stremio") {
    return (
      <SetupStremio
        chrome={chrome}
        delivery={link.deliveryOf("stremio")}
        reject={link.rejectOf("stremio")}
        onDeliver={(authKey) => link.deliver({ step: "stremio", authKey })}
        onRetry={() => link.resetDelivery("stremio")}
        onSkip={() => pass("stremio")}
        onContinue={() => pass("stremio")}
      />
    );
  }

  if (active === "harbor") {
    return (
      <SetupHarbor
        chrome={chrome}
        delivery={link.deliveryOf("harbor")}
        reject={link.rejectOf("harbor")}
        onDeliver={(s) =>
          link.deliver({
            step: "harbor",
            session: s.session,
            handle: s.handle,
            refresh: s.refresh,
          })
        }
        onRecovery={(code, session) => setRecovery({ code, session })}
        onRetry={() => link.resetDelivery("harbor")}
        onSkip={() => pass("harbor")}
        onContinue={() => pass("harbor")}
      />
    );
  }

  return <SetupDone chrome={chrome} done={link.offer?.done ?? []} onExit={leave} />;
}
