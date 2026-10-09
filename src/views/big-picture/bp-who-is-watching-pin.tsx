import { ChevronLeft, Delete } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { verifyProfilePassword } from "@/lib/profile-password";
import { profileInitials, type Profile } from "@/lib/profiles";
import { useBpT } from "./bp-i18n";
import { setBpFocus } from "./use-bp-focus";
import { bpWhoPrefersReducedMotion } from "./bp-who-is-watching-logic";

const PIN_LENGTH = 4;
const MAX_TRIES = 3;
const COOLDOWN_MS = 30000;

/**
 * Module scope on purpose. A child with a D-pad and an evening can walk all
 * 10,000 combinations, and a cool-down held in component state would reset every
 * time they backed out to the roster and came straight back in.
 *
 * THE ATTEMPT COUNT LIVES HERE TOO, not just the deadline. It used to be a useRef
 * inside BpWhoPin, and the Back chevron unmounts this component: two wrong guesses,
 * back out, return, and the counter was zero again. The map was only ever written
 * once three consecutive in-view tries had failed, which never happened, so the
 * throttle it documents did not exist.
 */
type BpPinAttempt = { tries: number; until: number };
const attempts = new Map<string, BpPinAttempt>();

function attemptOf(profileId: string): BpPinAttempt {
  return attempts.get(profileId) ?? { tries: 0, until: 0 };
}

function coolingUntil(profileId: string): number {
  const until = attemptOf(profileId).until;
  return until <= Date.now() ? 0 : until;
}

/** Returns the cool-down deadline, or 0 when there are tries left. */
function noteWrongPin(profileId: string): number {
  const tries = attemptOf(profileId).tries + 1;
  if (tries < MAX_TRIES) {
    attempts.set(profileId, { tries, until: 0 });
    return 0;
  }
  const until = Date.now() + COOLDOWN_MS;
  attempts.set(profileId, { tries: 0, until });
  return until;
}

const KEY_CLASS =
  "grid place-items-center rounded-[var(--bp-r-md)] border border-[var(--bp-edge)] bg-[var(--bp-panel)] font-semibold text-ink outline-none";

export function BpWhoPin({
  profile,
  onCancel,
  onSuccess,
}: {
  profile: Profile;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const t = useBpT();
  const hash = profile.passwordHash ?? "";
  const ref = useRef<HTMLDivElement | null>(null);
  const [reduce] = useState(bpWhoPrefersReducedMotion);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [blink, setBlink] = useState(false);
  const [until, setUntil] = useState(() => coolingUntil(profile.id));
  const [now, setNow] = useState(() => Date.now());

  const cooling = until > now;
  const secondsLeft = cooling ? Math.max(1, Math.ceil((until - now) / 1000)) : 0;

  useEffect(() => {
    if (!cooling) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [cooling]);

  // The route-level seed pass is keyed on the shell's routeKey and this view
  // opens inside the layer that is already up, so it has to seed itself.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const first = ref.current?.querySelector<HTMLElement>(
        "[data-bp-focusable]:not([data-bp-disabled='true'])",
      );
      if (first) setBpFocus(first, { silent: true });
    }, 30);
    return () => window.clearTimeout(id);
  }, [cooling]);

  const reject = useCallback(() => {
    if (reduce) {
      setBlink(true);
      window.setTimeout(() => setBlink(false), 140);
      return;
    }
    setShake(true);
    window.setTimeout(() => setShake(false), 400);
  }, [reduce]);

  const check = useCallback(
    async (candidate: string) => {
      setBusy(true);
      const ok = await verifyProfilePassword(candidate, hash);
      setBusy(false);
      if (ok) {
        attempts.delete(profile.id);
        onSuccess();
        return;
      }
      setPin("");
      const next = noteWrongPin(profile.id);
      if (next > 0) {
        setNow(Date.now());
        setUntil(next);
        return;
      }
      reject();
    },
    [hash, onSuccess, profile.id, reject],
  );

  const press = useCallback(
    (digit: string) => {
      if (busy || cooling) return;
      const next = `${pin}${digit}`.slice(0, PIN_LENGTH);
      setPin(next);
      if (next.length === PIN_LENGTH) void check(next);
    },
    [busy, check, cooling, pin],
  );

  if (!profile.passwordHash) return null;

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div
      ref={ref}
      data-bp-who-shake={shake ? "true" : undefined}
      style={{ opacity: blink ? 0.35 : 1 }}
      className="flex flex-col items-center gap-[clamp(16px,2.2vh,34px)]"
    >
      <span
        className="grid place-items-center overflow-hidden rounded-full"
        style={{
          height: "clamp(74px, 8vh, 124px)",
          width: "clamp(74px, 8vh, 124px)",
          background: profile.color,
          boxShadow: `0 0 0 2px color-mix(in oklab, ${profile.color} 62%, transparent)`,
        }}
      >
        {profile.avatar ? (
          <img src={profile.avatar} alt="" draggable={false} className="h-full w-full object-cover" />
        ) : (
          <span
            aria-hidden
            className="font-display font-semibold text-[var(--color-canvas)]"
            style={{ fontSize: "clamp(26px, 3vh, 44px)", lineHeight: 1 }}
          >
            {profileInitials(profile.name)}
          </span>
        )}
      </span>

      <div className="flex flex-col items-center gap-[clamp(6px,0.9vh,13px)]">
        <h2
          className="font-display text-ink"
          style={{ fontSize: "clamp(19px, 2.6vh, 38px)", fontWeight: 500, lineHeight: 1.1 }}
        >
          {t("Enter {name}'s PIN", { name: profile.name })}
        </h2>
        <p className="text-ink-muted" style={{ fontSize: "clamp(13px, 1.7vh, 22px)" }}>
          {cooling
            ? t("Too many tries. Try again in {seconds}s.", { seconds: secondsLeft })
            : t("Profile is locked. Enter the 4-digit PIN to continue.")}
        </p>
      </div>

      <div dir="ltr" className="flex items-center gap-[clamp(10px,1.2vh,18px)]" aria-hidden>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className="rounded-full"
            style={{
              height: "clamp(13px, 1.5vh, 21px)",
              width: "clamp(13px, 1.5vh, 21px)",
              background: i < pin.length ? "var(--bp-touch)" : "var(--bp-edge-2)",
            }}
          />
        ))}
      </div>

      <div
        dir="ltr"
        data-bp-grid
        className="grid grid-cols-3 gap-[clamp(10px,1.3vh,20px)]"
        style={{ gridAutoRows: "clamp(56px, 6vh, 84px)" }}
      >
        {digits.map((d) => (
          <button
            key={d}
            type="button"
            data-bp-focusable
            data-bp-key
            data-bp-disabled={cooling ? "true" : undefined}
            disabled={cooling}
            onClick={() => press(d)}
            className={KEY_CLASS}
            style={{ width: "clamp(56px, 6vh, 84px)", fontSize: "clamp(20px, 2.6vh, 36px)" }}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          data-bp-focusable
          data-bp-key
          data-bp-disabled={cooling ? "true" : undefined}
          disabled={cooling}
          aria-label={t("Delete")}
          onClick={() => setPin((p) => p.slice(0, -1))}
          className={KEY_CLASS}
          style={{ width: "clamp(56px, 6vh, 84px)" }}
        >
          <Delete size="42%" strokeWidth={2.2} />
        </button>
        <button
          type="button"
          data-bp-focusable
          data-bp-key
          data-bp-disabled={cooling ? "true" : undefined}
          disabled={cooling}
          onClick={() => press("0")}
          className={KEY_CLASS}
          style={{ width: "clamp(56px, 6vh, 84px)", fontSize: "clamp(20px, 2.6vh, 36px)" }}
        >
          0
        </button>
        <button
          type="button"
          data-bp-focusable
          data-bp-key
          aria-label={t("common.back")}
          onClick={onCancel}
          className={KEY_CLASS}
          style={{ width: "clamp(56px, 6vh, 84px)" }}
        >
          <ChevronLeft size="46%" strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
