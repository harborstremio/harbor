import { useEffect, useState } from "react";
import { fetchMe } from "@/lib/account/identity";
import { currentAuthor, subscribeAuthor } from "@/lib/theme-auth";
import { useT } from "@/lib/i18n";
import { Section } from "@/views/settings/shared";
import { RecoveryReveal } from "@/views/settings/theme-panel/custom-themes-section/author-account-panel/recovery-reveal";
import { AccountAuthForm } from "./account-auth-form";
import { AccountIdentityCard } from "./account-identity-card";
import { DiscordLinkCard } from "./discord-link-card";
import { SignedOutHero } from "./signed-out-hero";

export function HarborAccountPanel() {
  const t = useT();
  const [author, setAuthor] = useState(currentAuthor);
  const [reveal, setReveal] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => subscribeAuthor(() => setAuthor(currentAuthor())), []);

  useEffect(() => {
    if (author) void fetchMe();
  }, [author?.id]);

  useEffect(() => {
    if (author) setAuthOpen(false);
  }, [author]);

  if (!author) {
    return (
      <>
        <SignedOutHero onSignIn={() => setAuthOpen(true)} />
        {authOpen && <AccountAuthForm onRecovery={setReveal} onClose={() => setAuthOpen(false)} />}
        {reveal && <RecoveryReveal code={reveal} onDone={() => setReveal(null)} />}
      </>
    );
  }

  return (
    <Section title={t("Harbor account")} subtitle={t("Your handle across Harbor.")}>
      <AccountIdentityCard author={author} />
      <div className="rounded-md bg-elevated px-5 py-5">
        <DiscordLinkCard author={author} onRecovery={setReveal} />
      </div>
      {authOpen && <AccountAuthForm onRecovery={setReveal} onClose={() => setAuthOpen(false)} />}
      {reveal && <RecoveryReveal code={reveal} onDone={() => setReveal(null)} />}
    </Section>
  );
}
