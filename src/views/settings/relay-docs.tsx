import { useEffect, useRef, useState } from "react";
import { DownloadMenu, SavePill } from "./relay-docs-export";
import { useT } from "@/lib/i18n";

export function RelayDocs({ onBack }: { onBack: () => void }) {
  const t = useT();
  const docsRef = useRef<HTMLDivElement>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  useEffect(() => {
    if (!savedPath) return;
    const to = window.setTimeout(() => setSavedPath(null), 7000);
    return () => window.clearTimeout(to);
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
            {t("Self-host")}
          </p>
          <h2 className="font-display text-[32px] font-medium leading-tight tracking-tight text-ink">
            {t("Run your own Harbor Relay")}
          </h2>
          <p className="text-[14px] leading-relaxed text-ink-muted">
            {t(
              "Two paths: Harbor handles the deploy for you, or you do it yourself with wrangler.",
            )}
          </p>
        </header>

        <DocsBlock>
          <DocsH2>{t("Overview")}</DocsH2>
          <DocsP>
            {t(
              "The Harbor relay is a Cloudflare Worker that hosts WebSocket rooms for Watch Together. Each user runs their own. There is no central Harbor server.",
            )}
          </DocsP>
          <DocsP>
            {t("Source:")} <DocsCode>src-tauri/relay/worker.js</DocsCode>.{" "}
            {t(
              "About 200 lines of JavaScript, no dependencies. Read it before deploying if you want to know what runs.",
            )}
          </DocsP>
        </DocsBlock>

        <DocsBlock>
          <DocsH2>{t("Requirements")}</DocsH2>
          <DocsList>
            <li>{t("A free Cloudflare account.")}</li>
            <li>{t("About two minutes for the auto-deploy path.")}</li>
            <li>
              {t("For the manual path:")} <DocsCode>node</DocsCode> {t("20+ and")}{" "}
              <DocsCode>wrangler</DocsCode> {t("CLI.")}
            </li>
          </DocsList>
        </DocsBlock>

        <DocsBlock>
          <DocsH2>{t("Auto-deploy from Harbor")}</DocsH2>
          <DocsP>
            {t(
              "Easiest path. Harbor uploads the worker, creates the Durable Object namespace, and stores the resulting URL.",
            )}
          </DocsP>
          <DocsOl>
            <li>{t("Open Settings, then Harbor Relay.")}</li>
            <li>
              {t("Click")} <DocsKbd>{t("Deploy a relay")}</DocsKbd>.
            </li>
            <li>
              {t("Generate a Cloudflare API token with")} <DocsCode>Workers Scripts: Edit</DocsCode>{" "}
              {t("and")} <DocsCode>Account: Read</DocsCode> {t("permissions at")}{" "}
              <DocsCode>dash.cloudflare.com/profile/api-tokens</DocsCode>.{" "}
              {t("Paste it into Harbor.")}
            </li>
            <li>{t("Pick the Cloudflare account to deploy under.")}</li>
            <li>
              {t("Wait for the upload to finish. The relay URL gets written to")}{" "}
              <DocsCode>togetherRelayUrl</DocsCode> {t("in Harbor settings.")}
            </li>
          </DocsOl>
        </DocsBlock>

        <DocsBlock>
          <DocsH2>{t("Manual deploy with wrangler")}</DocsH2>
          <DocsP>
            {t("For users who want to deploy themselves or already have a wrangler workflow.")}
          </DocsP>
          <DocsOl>
            <li>
              {t("Install wrangler and authenticate:")}
              <DocsPre>{`npm install -g wrangler\nwrangler login`}</DocsPre>
            </li>
            <li>
              {t("Save the worker source. Copy")} <DocsCode>src-tauri/relay/worker.js</DocsCode>{" "}
              {t("from the Harbor repo into a new directory as")} <DocsCode>worker.js</DocsCode>.
            </li>
            <li>
              {t("Save this")} <DocsCode>wrangler.toml</DocsCode> {t("next to it:")}
              <DocsPre>{`name = "harbor-together-relay"\nmain = "worker.js"\ncompatibility_date = "2026-05-01"\n\n[[durable_objects.bindings]]\nname = "ROOM"\nclass_name = "Room"\n\n[[migrations]]\ntag = "v1"\nnew_sqlite_classes = ["Room"]`}</DocsPre>
            </li>
            <li>
              {t("Deploy:")}
              <DocsPre>wrangler deploy</DocsPre>
            </li>
            <li>
              {t("Note the URL Cloudflare returns. It looks like")}{" "}
              <DocsCode>https://harbor-together-relay.&lt;subdomain&gt;.workers.dev</DocsCode>.
            </li>
            <li>
              {t("In Harbor: Settings, Harbor Relay, then")}{" "}
              <DocsKbd>{t("Use a different URL")}</DocsKbd>. {t("Paste the URL with")}{" "}
              <DocsCode>wss://</DocsCode> {t("as the scheme instead of")}{" "}
              <DocsCode>https://</DocsCode>.
            </li>
          </DocsOl>
        </DocsBlock>

        <DocsBlock>
          <DocsH2>{t("Verify it works")}</DocsH2>
          <DocsP>
            {t("Settings, Harbor Relay, then")} <DocsKbd>{t("Run test")}</DocsKbd>.
          </DocsP>
          <DocsP>
            {t("The test calls")} <DocsCode>/health</DocsCode>{" "}
            {t(
              "and confirms the worker is reachable and running a current version. A passing test means Watch Together rooms will connect.",
            )}
          </DocsP>
          <DocsP>
            {t(
              "If the Watch Together popover shows an outdated-relay banner, redeploying with the steps above is the fix. The banner clears automatically the next time you connect once the relay reports the current version.",
            )}
          </DocsP>
        </DocsBlock>

        <DocsBlock>
          <DocsH2>{t("Sharing your relay")}</DocsH2>
          <DocsP>
            {t(
              "A relay URL is shareable. Anyone with the URL can join Watch Together rooms hosted on your relay. The unique",
            )}{" "}
            <DocsCode>workers.dev</DocsCode>{" "}
            {t("subdomain acts as the access token. There is no login.")}
          </DocsP>
          <DocsP>
            {t("To run a public relay, post the")} <DocsCode>wss://</DocsCode>{" "}
            {t(
              "URL on r/Stremio or wherever your community lives. Other Harbor users paste it into Settings, Harbor Relay,",
            )}{" "}
            <DocsKbd>{t("Use a different URL")}</DocsKbd>.
          </DocsP>
        </DocsBlock>

        <DocsBlock>
          <DocsH2>{t("Costs")}</DocsH2>
          <DocsP>{t("Cloudflare Workers free tier:")}</DocsP>
          <DocsList>
            <li>{t("100,000 requests per day.")}</li>
            <li>{t("10ms CPU time per request.")}</li>
            <li>{t("Unlimited Durable Object storage at $0.20 per million reads.")}</li>
          </DocsList>
          <DocsP>
            {t(
              "A typical Watch Together session uses a few hundred messages per hour. Solo and small-group use stays well under free tier limits.",
            )}
          </DocsP>
          <DocsP>
            {t(
              "If you exceed free tier, the Workers Paid plan is $5 per month and bumps the request allowance to 10 million per day.",
            )}
          </DocsP>
        </DocsBlock>

        <DocsBlock>
          <DocsH2>{t("Troubleshooting")}</DocsH2>
          <DocsTable
            rows={[
              {
                symptom: t("Health check returns 5xx"),
                cause: t("Worker crashed or hit memory limits"),
                fix: t("Check logs in Cloudflare dashboard, then redeploy"),
              },
              {
                symptom: t("Connection refused / DNS does not resolve"),
                cause: t("Worker deleted or URL wrong"),
                fix: t("Re-run deploy or paste the correct URL"),
              },
              {
                symptom: t("Watch Together rooms drop after 6 hours"),
                cause: t("Durable Object idle eviction"),
                fix: t("Expected. Rooms recreate on next join."),
              },
            ]}
          />
        </DocsBlock>

        <DocsBlock>
          <DocsH2>{t("What the worker does")}</DocsH2>
          <DocsList>
            <li>
              <DocsCode>GET /health</DocsCode>:{" "}
              {t("returns JSON with the worker version. Used by the test button.")}
            </li>
            <li>
              <DocsCode>GET /r/&lt;code&gt;</DocsCode>{" "}
              {t(
                "with a WebSocket upgrade: opens a Watch Together room. State is held in a Durable Object, no persistence beyond the active session.",
              )}
            </li>
          </DocsList>
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

function DocsList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="ms-5 flex list-disc flex-col gap-1.5 text-[13.5px] leading-relaxed text-ink-muted marker:text-ink-subtle">
      {children}
    </ul>
  );
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

function DocsPre({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-xl border border-edge-soft bg-canvas/70 p-3 font-mono text-[12px] leading-relaxed text-ink">
      {children}
    </pre>
  );
}

function DocsTable({ rows }: { rows: Array<{ symptom: string; cause: string; fix: string }> }) {
  const t = useT();
  return (
    <div className="overflow-hidden rounded-xl border border-edge-soft">
      <table className="w-full text-start text-[12.5px] text-ink-muted">
        <thead className="bg-canvas/60 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          <tr>
            <th className="px-3 py-2.5">{t("Symptom")}</th>
            <th className="px-3 py-2.5">{t("Cause")}</th>
            <th className="px-3 py-2.5">{t("Fix")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-edge-soft align-top">
              <td className="px-3 py-2.5 text-ink">{r.symptom}</td>
              <td className="px-3 py-2.5">{r.cause}</td>
              <td className="px-3 py-2.5">{r.fix}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
