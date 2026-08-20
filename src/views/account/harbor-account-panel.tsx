import { useEffect, useState } from "react";
import { fetchMe } from "@/lib/account/identity";
import { currentAuthor, subscribeAuthor } from "@/lib/theme-auth";
import { useT } from "@/lib/i18n";
import { Section } from "@/views/settings/shared";
import { RecoveryReveal } from "@/views/settings/theme-panel/custom-themes-section/author-account-panel/recovery-reveal";
import { AccountAuthForm } from "./account-auth-form";
import { AccountSignedInBar } from "./account-signed-in-bar";
import { DiscordLinkCard } from "./discord-link-card";
import { HandleClaimCard } from "./handle-claim-card";

export function HarborAccountPanel() {
  const t = useT();
  const [author, setAuthor] = useState(currentAuthor);
  const [reveal, setReveal] = useState<string | null>(null);

  useEffect(() => subscribeAuthor(() => setAuthor(currentAuthor())), []);

  useEffect(() => {
    if (author) void fetchMe();
  }, [author?.id]);

  return (
    <Section
      title={t("Harbor account")}
      subtitle={t("Your handle across Harbor.")}
    >
      {!author ? (
        <div className="rounded-2xl border border-edge-soft bg-canvas/40 p-5">
          <AccountAuthForm onRecovery={setReveal} />
        </div>
      ) : (
        <div className="divide-y divide-edge-soft/60 overflow-hidden rounded-2xl border border-edge-soft bg-canvas/40">
          <div className="p-5">
            <AccountSignedInBar author={author} />
          </div>
          <div className="p-5">
            <HandleClaimCard author={author} />
          </div>
          <div className="p-5">
            <DiscordLinkCard author={author} />
          </div>
        </div>
      )}
      {reveal && <RecoveryReveal code={reveal} onDone={() => setReveal(null)} />}
    </Section>
  );
}
