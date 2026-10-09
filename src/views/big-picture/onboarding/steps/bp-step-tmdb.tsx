import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/settings";
import type { BpOnboardStepProps } from "../../bp-onboarding-frame";
import { useBpT } from "../../bp-i18n";
import { BpOnboardField } from "../bp-onboard-field";
import { BpOnboardKeyboard } from "../bp-onboard-keyboard";
import { BpTmdbShowcase } from "../bp-tmdb-showcase";
import {
  BpDecisionAction,
  BpDecisionNote,
  BpDecisionRow,
  BpDecisionScroll,
  BpStepConfirmed,
} from "../bp-step-parts";

type Check = "idle" | "checking" | "rejected" | "unreachable";

const MAX = 64;
const KEY_LEN = 32;

export function BpStepTmdb({ setSatisfied, setPrimaryGuard }: BpOnboardStepProps) {
  const t = useBpT();
  const { settings, update } = useSettings();
  const [draft, setDraft] = useState("");
  const [check, setCheck] = useState<Check>("idle");
  const [editing, setEditing] = useState(false);
  const saved = settings.tmdbKey.trim();
  const entering = !saved || editing;

  useEffect(() => {
    setSatisfied(!entering);
  }, [entering, setSatisfied]);

  const verify = async (): Promise<boolean> => {
    const key = draft.trim();
    if (!key || check === "checking") return false;
    setCheck("checking");
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/configuration?api_key=${encodeURIComponent(key)}`,
      );
      if (!res.ok) {
        setCheck("rejected");
        return false;
      }
      // Written only once TMDB has accepted it. The desktop step persists every
      // keystroke, so a rejected key stays saved and every rail stays dark.
      update({ tmdbKey: key });
      setCheck("idle");
      setEditing(false);
      return true;
    } catch {
      setCheck("unreachable");
      return false;
    }
  };

  const keepUnverified = () => {
    const key = draft.trim();
    if (!key) return;
    update({ tmdbKey: key });
    setCheck("idle");
    setEditing(false);
  };

  // Continue commits what is in the box. Forty presses on a grid keyboard
  // discarded by the obvious button is the worst thing this screen could do.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(() => {
    if (!entering) {
      setPrimaryGuard(null);
      return;
    }
    setPrimaryGuard(async () => (draftRef.current.trim() ? verify() : true));
    return () => setPrimaryGuard(null);
  });

  if (!entering) {
    return (
      <BpDecisionScroll>
        <BpStepConfirmed
          title={t("TMDB connected")}
          detail={t("The key is saved on this device only.")}
        />
        <BpDecisionRow>
          <BpDecisionAction
            label={t("Use a different key")}
            tone="quiet"
            // The saved key is not cleared on entry to the edit. A key wiped for
            // an edit the user then backs out of takes every rail down with it.
            onSelect={() => {
              setDraft("");
              setCheck("idle");
              setEditing(true);
            }}
          />
        </BpDecisionRow>
      </BpDecisionScroll>
    );
  }

  return (
    <BpDecisionScroll>
      <BpOnboardField
        label={t("TMDB API key, v3 auth")}
        value={draft}
        placeholder={t("32 characters")}
        onChange={(next) => {
          setCheck("idle");
          setDraft(next.slice(0, MAX));
        }}
        onSubmit={() => void verify()}
        active={check !== "rejected" && check !== "unreachable"}
      />
      <BpDecisionRow>
        <BpDecisionAction
          label={check === "checking" ? t("Checking…") : t("Verify key")}
          onSelect={() => void verify()}
          disabled={!draft.trim() || check === "checking"}
        />
        {/* A TV behind a captive portal, or in a region that blocks TMDB, still
            holds a valid key. Refusing to save it is stricter than the desktop
            step on the surface with the worst text entry. */}
        {check === "unreachable" && draft.trim() !== "" && (
          <BpDecisionAction label={t("Save it anyway")} tone="quiet" onSelect={keepUnverified} />
        )}
        {saved && (
          <BpDecisionAction
            label={t("Keep the key I have")}
            tone="quiet"
            onSelect={() => setEditing(false)}
          />
        )}
      </BpDecisionRow>
      <BpDecisionNote text={note(t, check, draft)} alert={check === "rejected" || check === "unreachable"} />
      <BpOnboardKeyboard
        onChar={(c) => {
          setCheck("idle");
          setDraft((d) => (d.length >= MAX ? d : d + c));
        }}
        onBackspace={() => setDraft((d) => d.slice(0, -1))}
        onClear={() => setDraft("")}
      />
      <BpTmdbShowcase />
    </BpDecisionScroll>
  );
}

function note(
  t: (k: string, v?: Record<string, string | number>) => string,
  check: Check,
  draft: string,
): string {
  if (check === "rejected") {
    return t("TMDB did not accept that key. Check you copied the v3 key, not the read access token.");
  }
  if (check === "unreachable") {
    return t("Could not reach TMDB from this TV. You can save the key without checking it.");
  }
  // Never counts past the expected length. "40 of 32 characters" reads as the
  // field being broken on the one screen where the user is counting presses.
  if (draft.length > KEY_LEN) return t("{n} characters", { n: draft.length });
  if (draft.length > 0) return t("{n} of {len} characters", { n: draft.length, len: KEY_LEN });
  return t("Skip this and Harbor runs on Cinemeta. You just see fewer rows.");
}
