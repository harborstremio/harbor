import { useState } from "react";
import { ChevronLeft, Smartphone } from "lucide-react";
import { QR_DARK, QR_LIGHT } from "@/lib/tv-handoff/handoff-qr";
import { useSettings } from "@/lib/settings";
import { SFX } from "@/lib/sfx";
import { useBpT } from "./bp-i18n";
import { BpHandoffProvider, useBpHandoff } from "./onboarding/bp-handoff-context";
import { handoffNote } from "./onboarding/bp-handoff-panel";
import { BpOnboardField } from "./onboarding/bp-onboard-field";
import { useBpOnboardFacts } from "./onboarding/use-bp-onboard-facts";
import { BpConnectQr, BpConnectStatus, TITLE, BODY } from "./bp-connect-parts";

type CheckState = "idle" | "checking" | "rejected" | "unreachable";

function BpConnectBody({ onBack }: { onBack?: () => void }) {
  const t = useBpT();
  const facts = useBpOnboardFacts();
  const { update } = useSettings();
  const handoff = useBpHandoff();
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [check, setCheck] = useState<CheckState>("idle");

  const hasKey = facts.tmdbKey.trim().length > 0;
  const servingOff = handoff.phase === "servingOff";

  // Written only once TMDB has accepted it. Persisting each keystroke leaves a
  // rejected key saved and every rail dark, which is the desktop step's bug.
  const verify = async () => {
    const key = draft.trim();
    if (!key || check === "checking") return;
    setCheck("checking");
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/configuration?api_key=${encodeURIComponent(key)}`,
      );
      if (!res.ok) {
        setCheck("rejected");
        return;
      }
      update({ tmdbKey: key });
      setDraft("");
      setTyping(false);
      setCheck("idle");
    } catch {
      setCheck("unreachable");
    }
  };

  const checkNote =
    check === "checking"
      ? t("Checking with TMDB…")
      : check === "rejected"
        ? t("TMDB did not accept that key.")
        : check === "unreachable"
          ? t("Could not reach TMDB. Check the connection.")
          : null;

  // The card says what it is for while the code is genuinely up, and reports the
  // reason it is not otherwise. The page must never carry a second instruction
  // that only a laptop can act on.
  const qrNote =
    handoff.phase === "waiting"
      ? t("Scan with your phone to sign in without typing on the remote.")
      : handoffNote(t, handoff.phase);

  // Contiguous from 0 whatever is on screen: bpRailStep reads a missing index as
  // the end of the rail, so an optional row cannot leave a hole. Every one of
  // these has to stay a DIRECT child of the column below, because bpRailStep
  // resolves the rail as the row's parentElement.
  let row = 0;
  const next = () => String(row++);

  return (
    <div className="flex min-h-full flex-col gap-[clamp(14px,2.2vh,28px)]">
      {/* A standing layout. Both call sites wrap this in an overflow-y-auto, so
          any row that does not fit at 641px scrolls the heading up under the top
          bar's scrim the moment the ring moves: the sentence naming the screen
          cannot survive using the screen. Nothing here grows except the gap. */}
      <div className="grid flex-1 grid-cols-[minmax(0,1fr)_auto] items-start gap-[clamp(20px,2.4vw,52px)]">
        <div className="flex min-w-0 flex-col gap-[clamp(14px,2vh,26px)]">
          <div className="flex flex-col gap-[clamp(4px,0.7vh,9px)]">
            <h2 className={TITLE}>{t("Finish setting up Harbor")}</h2>
            {!hasKey && (
              <p className={`${BODY} max-w-[54ch] text-ink-subtle`}>
                {t("Harbor needs a TMDB key for artwork, rows and collections. It is free.")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-[clamp(10px,1.6vh,20px)]">
            <BpConnectStatus
              label={t("TMDB")}
              value={hasKey ? t("Connected") : t("Artwork, rows and collections")}
              on={hasKey}
            />
            <BpConnectStatus
              label={t("Stremio")}
              value={
                facts.stremioName
                  ? t("Signed in as {name}", { name: facts.stremioName })
                  : t("Your Stremio library")
              }
              on={!!facts.stremioName}
            />
            <BpConnectStatus
              label={t("Harbor account")}
              value={
                facts.harborName
                  ? t("Signed in as {name}", { name: facts.harborName })
                  : t("Sync, themes and friends")
              }
              on={!!facts.harborName}
            />
          </div>
        </div>

        <BpConnectQr
          qr={handoff.qr}
          codeDisplay={handoff.codeDisplay}
          note={qrNote}
          idleLabel={servingOff ? t("Phone setup is off") : t("Getting a code ready…")}
          icon={<Smartphone size={44} strokeWidth={1.6} className="text-ink-subtle" />}
          light={QR_LIGHT}
          dark={QR_DARK}
          qrLabel={t("Setup QR code")}
        />
      </div>

      {/* Typing REPLACES the rail rather than growing underneath it. Appending
          the field and its commit row to a rail that still held the actions was
          what pushed this page past 641px and started the scroll above. */}
      {typing ? (
        <>
          <div data-bp-rail-row={next()} className="max-w-[min(100%,760px)]">
            <BpOnboardField
              label={t("TMDB API key")}
              value={draft}
              placeholder={hasKey ? t("Replace the saved key") : "e2d78895…"}
              active={draft.length > 0}
              onChange={(v) => {
                setCheck("idle");
                setDraft(v);
              }}
              onSubmit={() => void verify()}
            />
          </div>
          <div
            data-bp-row
            data-bp-rail-row={next()}
            className="flex items-center gap-[clamp(10px,1vw,18px)]"
          >
            <BpConnectAction
              label={check === "checking" ? t("Checking…") : t("Save key")}
              primary
              disabled={!draft.trim() || check === "checking"}
              onPress={() => void verify()}
            />
            <BpConnectAction
              label={t("Cancel")}
              onPress={() => {
                setDraft("");
                setCheck("idle");
                setTyping(false);
              }}
            />
            {checkNote && <span className={`${BODY} text-ink-subtle`}>{checkNote}</span>}
          </div>
        </>
      ) : (
        <div
          data-bp-row
          data-bp-rail-row={next()}
          className="flex items-center gap-[clamp(10px,1vw,18px)]"
        >
          {onBack && <BpConnectAction label={t("Settings")} back onPress={onBack} />}
          {/* Exactly one of these two is the primary and carries the autofocus.
              With phone setup off, turning it on IS the way forward and the card
              beside it has already said so. */}
          {servingOff && (
            <BpConnectAction
              label={t("Turn on phone setup")}
              primary
              autofocus
              onPress={() => update({ serveWebUi: true, remoteControlEnabled: true })}
            />
          )}
          <BpConnectAction
            label={t("Type a key on this TV")}
            primary={!servingOff}
            autofocus={!servingOff}
            onPress={() => setTyping(true)}
          />
        </div>
      )}
    </div>
  );
}

function BpConnectAction({
  label,
  onPress,
  primary,
  disabled,
  back,
  autofocus,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  back?: boolean;
  autofocus?: boolean;
}) {
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-chip
      data-bp-autofocus={autofocus ? "true" : undefined}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        SFX.click();
        onPress();
      }}
      // Never a resting fill. bp-tokens fills the FOCUSED chip with --bp-touch,
      // so a filled primary beside it is a second solid pill and the cursor
      // stops being the loudest thing on the row.
      className={`flex h-[clamp(66px,8vh,72px)] shrink-0 items-center rounded-[var(--bp-r-md)] border px-[clamp(20px,2vw,38px)] text-[clamp(17px,2.3vh,22px)] font-semibold ${
        disabled
          ? "border-[var(--bp-edge-2)] bg-[var(--bp-panel)] text-ink-subtle"
          : primary
            ? "border-transparent bg-[var(--bp-on)] text-ink"
            : "border-[var(--bp-edge-2)] bg-[var(--bp-glass)] text-ink"
      }`}
    >
      {back && <ChevronLeft size={20} strokeWidth={2.4} className="me-[clamp(5px,0.5vw,9px)]" />}
      {label}
    </button>
  );
}

/**
 * Everything onboarding sets, reachable after onboarding. Someone who skipped a
 * step, or who only ever saw the TV, had no route back to it: the tabs that need
 * a TMDB key simply vanished, which reads as Harbor being broken rather than
 * unconfigured. Owns its own handoff host, so the QR is live only while this is
 * on screen.
 */
export function BpConnect({ onBack }: { onBack?: () => void } = {}) {
  return (
    <BpHandoffProvider active>
      <BpConnectBody onBack={onBack} />
    </BpHandoffProvider>
  );
}
