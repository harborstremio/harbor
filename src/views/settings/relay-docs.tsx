import { Cloud, ExternalLink, KeyRound, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { DownloadMenu, SavePill } from "./relay-docs-export";

const RELAY_DEPLOY_URL =
  "https://deploy.workers.cloudflare.com/?url=https://github.com/harborstremio/together-relay";

export function RelayDocs({ onBack }: { onBack: () => void }) {
  const t = useT();
  const docsRef = useRef<HTMLDivElement>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);

  useEffect(() => {
    if (!savedPath) return;
    const timeout = window.setTimeout(() => setSavedPath(null), 7000);
    return () => window.clearTimeout(timeout);
  }, [savedPath]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-edge-soft bg-canvas/40 p-3">
        <button
          onClick={onBack}
          className="flex h-12 items-center gap-2.5 rounded-xl bg-elevated px-5 text-[14px] font-semibold text-ink shadow-[inset_0_0_0_1px_var(--color-edge-soft)] transition-all hover:bg-raised hover:shadow-[inset_0_0_0_1px_var(--color-edge)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 6l-6 6 6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {t("Back to relay")}
        </button>
        <div className="flex items-center gap-3">
          <DownloadMenu docsRef={docsRef} onSaved={setSavedPath} />
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            {t("Documentation")}
          </span>
        </div>
      </div>

      <div ref={docsRef} className="flex flex-col gap-8">
        <header className="flex flex-col gap-2 border-b border-edge-soft pb-6">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-accent">
            {t("Watch Together host setup")}
          </p>
          <h2 className="font-display text-[32px] font-medium leading-tight tracking-tight text-ink">
            {t("Run your own Harbor Relay")}
          </h2>
          <p className="max-w-2xl text-[14px] leading-relaxed text-ink-muted">
            {t(
              "Only the host sets up a relay. Everyone else joins with the host's Harbor invite link—no Cloudflare account or setup required.",
            )}
          </p>
        </header>

        <DocsBlock>
          <div className="flex items-start gap-3">
            <Cloud size={19} strokeWidth={1.9} className="mt-1 shrink-0 text-accent" />
            <div>
              <DocsH2>{t("Fastest: Deploy to Cloudflare")}</DocsH2>
              <DocsP>
                {t("Cloudflare sets up and deploys the open-source relay in your account.")}
              </DocsP>
            </div>
          </div>
          <DocsOl>
            <li>{t("Open Cloudflare with the button below and sign in.")}</li>
            <li>{t("Choose your Cloudflare account, keep the suggested settings, and deploy.")}</li>
            <li>
              {t("Copy the resulting")} <DocsCode>workers.dev</DocsCode> {t("URL.")}
            </li>
            <li>
              {t("Return to Harbor Relay, paste the URL, and select")}{" "}
              <DocsKbd>{t("Save")}</DocsKbd>.
            </li>
          </DocsOl>
          <button
            type="button"
            onClick={() => openUrl(RELAY_DEPLOY_URL)}
            className="flex h-12 w-fit items-center justify-center gap-2 rounded-xl bg-ink px-5 text-[14px] font-medium text-canvas transition-transform hover:scale-[1.01]"
          >
            <ExternalLink size={15} strokeWidth={1.9} />
            {t("Deploy to Cloudflare")}
          </button>
        </DocsBlock>

        <DocsBlock>
          <div className="flex items-start gap-3">
            <KeyRound size={19} strokeWidth={1.9} className="mt-1 shrink-0 text-accent" />
            <div>
              <DocsH2>{t("Alternative: deploy from Harbor")}</DocsH2>
              <DocsP>
                {t(
                  "Harbor can deploy directly with a limited Cloudflare API token. The token stays on this device and is used to manage your relay.",
                )}
              </DocsP>
            </div>
          </div>
          <DocsOl>
            <li>
              {t("Go back to Harbor Relay and select")} <DocsKbd>{t("Deploy a relay")}</DocsKbd>.
            </li>
            <li>{t("Follow the short token guide shown by Harbor.")}</li>
            <li>
              {t(
                "Choose your Cloudflare account. Harbor deploys the relay and saves its URL automatically.",
              )}
            </li>
          </DocsOl>
        </DocsBlock>

        <DocsBlock>
          <DocsH2>{t("Verify and invite")}</DocsH2>
          <DocsOl>
            <li>
              {t("In Harbor Relay, select")} <DocsKbd>{t("Run test")}</DocsKbd>{" "}
              {t("to verify the Worker.")}
            </li>
            <li>{t("Open Watch Together, create a room, and share its invite link.")}</li>
            <li>
              {t(
                "Participants open the invite link. It already contains the relay URL and room code.",
              )}
            </li>
          </DocsOl>
          <div className="flex items-start gap-3 rounded-xl border border-edge-soft bg-canvas/50 p-4">
            <Users size={17} strokeWidth={1.9} className="mt-0.5 shrink-0 text-ink-subtle" />
            <DocsP>
              {t(
                "Participants never need your Cloudflare login or API token. The invite only shares the public relay URL and room code.",
              )}
            </DocsP>
          </div>
        </DocsBlock>

        <DocsBlock>
          <DocsH2>{t("If something fails")}</DocsH2>
          <DocsP>
            {t(
              "Check that the saved URL ends in workers.dev, then run the connection test again. For deployment errors, open the Worker in Cloudflare and check its deployment logs before redeploying.",
            )}
          </DocsP>
        </DocsBlock>
      </div>

      {savedPath && <SavePill path={savedPath} onDismiss={() => setSavedPath(null)} />}
    </div>
  );
}

function DocsBlock({ children }: { children: React.ReactNode }) {
  return <section className="flex flex-col gap-3">{children}</section>;
}

function DocsH2({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display text-[20px] font-medium tracking-tight text-ink">{children}</h3>
  );
}

function DocsP({ children }: { children: React.ReactNode }) {
  return <p className="text-[13.5px] leading-relaxed text-ink-muted">{children}</p>;
}

function DocsOl({ children }: { children: React.ReactNode }) {
  return (
    <ol className="ms-5 flex list-decimal flex-col gap-2.5 text-[13.5px] leading-relaxed text-ink-muted marker:font-semibold marker:text-ink-subtle">
      {children}
    </ol>
  );
}

export function DocsCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-canvas/70 px-1.5 py-0.5 font-mono text-[12px] text-ink ring-1 ring-edge-soft">
      {children}
    </code>
  );
}

function DocsKbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-edge-soft bg-elevated px-1.5 py-0.5 font-mono text-[11.5px] font-medium text-ink shadow-[0_1px_0_var(--color-edge)]">
      {children}
    </kbd>
  );
}
