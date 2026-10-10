import { useT } from "@/lib/i18n";
import { SetupShell, type SetupChrome } from "./setup-shell";
import { SetupButton, SetupHeading } from "./setup-ui";
import type { HandoffClientReject } from "@/lib/tv-handoff/handoff-client";
import type { DeliveryState } from "./use-setup-link";

export function SetupStremio({
  chrome,
  onSkip,
}: {
  chrome: SetupChrome;
  delivery: DeliveryState;
  reject: HandoffClientReject | null;
  onDeliver: (authKey: string) => void;
  onRetry: () => void;
  onSkip: () => void;
  onContinue: () => void;
}) {
  const t = useT();
  return (
    <SetupShell {...chrome} action={<SetupButton onClick={onSkip}>{t("Continue")}</SetupButton>}>
      <SetupHeading
        title={t("Your JL account stays with you")}
        body={t(
          "Sign in to JL Media Vision directly on your TV. This legacy phone setup step does not send account tokens. Your addons and library also work with a local profile.",
        )}
      />
    </SetupShell>
  );
}
