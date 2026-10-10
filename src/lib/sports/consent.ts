export const SPORTS_CONSENT_VERSION = 1;
export const SPORTS_CONSENT_KEY = "harbor-sports-consent";

export type SportsConsentStatus = "unknown" | "accepted" | "declined";
export type SportsConsentSnapshot = Readonly<{
  version: number;
  status: SportsConsentStatus;
  acceptedAt?: string;
  declinedAt?: string;
  persisted: boolean;
}>;

type Receipt = Omit<SportsConsentSnapshot, "persisted">;
type LocalStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const UNKNOWN: SportsConsentSnapshot = Object.freeze({
  version: SPORTS_CONSENT_VERSION,
  status: "unknown",
  persisted: false,
});

function timestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function parseReceipt(raw: string | null): SportsConsentSnapshot {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object") return UNKNOWN;
    const receipt = value as Record<string, unknown>;
    if (receipt.version !== SPORTS_CONSENT_VERSION) return UNKNOWN;
    const base = { version: SPORTS_CONSENT_VERSION, persisted: true };
    if (receipt.status === "accepted" && timestamp(receipt.acceptedAt)) {
      return Object.freeze({
        ...base,
        status: "accepted",
        acceptedAt: receipt.acceptedAt,
      });
    }
    if (receipt.status === "declined" && timestamp(receipt.declinedAt)) {
      return Object.freeze({
        ...base,
        status: "declined",
        declinedAt: receipt.declinedAt,
      });
    }
    if (receipt.status === "unknown") return Object.freeze({ ...base, status: "unknown" });
  } catch {}
  return UNKNOWN;
}

/** Device-local acknowledgement, separate from account settings and provider permission. */
export function createSportsConsentStore({
  storage = () => globalThis.localStorage,
  now = () => new Date(),
}: { storage?: () => LocalStorage; now?: () => Date } = {}) {
  const listeners = new Set<() => void>();
  let snapshot = UNKNOWN;
  try {
    snapshot = parseReceipt(storage().getItem(SPORTS_CONSENT_KEY));
  } catch {}

  function publish(next: SportsConsentSnapshot) {
    if (
      snapshot.status === next.status &&
      snapshot.version === next.version &&
      snapshot.acceptedAt === next.acceptedAt &&
      snapshot.declinedAt === next.declinedAt &&
      snapshot.persisted === next.persisted
    )
      return;
    snapshot = Object.freeze(next);
    for (const listener of listeners) listener();
  }

  function change(status: SportsConsentStatus) {
    const receipt: Receipt = {
      version: SPORTS_CONSENT_VERSION,
      status,
      ...(status === "accepted" ? { acceptedAt: now().toISOString() } : {}),
      ...(status === "declined" ? { declinedAt: now().toISOString() } : {}),
    };
    let persisted = false;
    try {
      storage().setItem(SPORTS_CONSENT_KEY, JSON.stringify(receipt));
      persisted = true;
    } catch {
      // Avoid restoring stale acceptance next launch when overwriting fails.
      try {
        storage().removeItem(SPORTS_CONSENT_KEY);
      } catch {}
    }
    publish({ ...receipt, persisted });
    return snapshot;
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => UNKNOWN,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    accept: () => change("accepted"),
    decline: () => change("declined"),
    reset: () => change("unknown"),
    receiveStorage(raw: string | null) {
      publish(parseReceipt(raw));
    },
  };
}

const consent = createSportsConsentStore();
export const getSportsConsentSnapshot = consent.getSnapshot;
export const getSportsConsentServerSnapshot = consent.getServerSnapshot;
export const acceptSportsConsent = consent.accept;
export const declineSportsConsent = consent.decline;
export const resetSportsConsent = consent.reset;

export function subscribeSportsConsent(listener: () => void) {
  const unsubscribe = consent.subscribe(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === SPORTS_CONSENT_KEY || event.key === null) {
      consent.receiveStorage(event.key === null ? null : event.newValue);
    }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    unsubscribe();
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}
