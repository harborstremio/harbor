import { ActionRow } from "./action-row";
import { useOnboarding } from "@/lib/onboarding";
import { Check, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";
import { IS_BETA_BUILD } from "@/lib/build-info";
import { useT } from "@/lib/i18n";
import { Section } from "../shared";
import { SettingGroup, SettingRow } from "../kit";
import { Signature } from "../signature";
import { isTauri } from "../player-panel/internals";

export function AboutTab() {
  const t = useT();
  return (
    <>
      <Section
        title={t("Onboarding")}
        subtitle={t("Replay the walkthrough or unhide every dismissed tip in the app.")}
      >
        <OnboardingRow />
      </Section>

      <Section
        title={t("About")}
        subtitle={t("Build identity. Useful when filing a bug report at bugs@harbor.site.")}
      >
        <AboutRow />
      </Section>

      <LegalDisclaimer />

      <Signature />
    </>
  );
}

function AboutRow() {
  const t = useT();
  return (
    <SettingGroup>
      <InfoLine
        label={t("Version")}
        value={`${__APP_VERSION__}${IS_BETA_BUILD ? ` (${t("Beta")})` : ""}`}
      />
      <InfoLine label={t("Build")} value={isTauri ? t("Desktop (Tauri 2 / WebView2)") : t("Web")} />
      <InfoLine label={t("Bug reports")} value="bugs@harbor.site" />
    </SettingGroup>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <SettingRow label={label}>
      <span className="shrink-0 text-[13.5px] tabular-nums text-ink">{value}</span>
    </SettingRow>
  );
}

function LegalDisclaimer() {
  const t = useT();
  const trademarkNames =
    '"Stremio", "Cinemeta", "OpenSubtitles", "Real-Debrid", "Premiumize", "AllDebrid", "TorBox", "DebridLink", "TMDB", "Trakt", "IMDb", "Netflix", "Disney+"';
  return (
    <section className="rounded-md bg-elevated p-5">
      <span className="block text-[10.5px] font-bold uppercase tracking-[0.22em] text-ink-subtle">
        {t("Legal")}
      </span>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
        {t("{app} is an independent, open-source desktop and web client.", { app: "Harbor" })}{" "}
        <span className="font-semibold text-ink">
          {t(
            "It is not affiliated with, endorsed by, sponsored by, or in any way associated with {company}.",
            { company: "Stremio Ltd." },
          )}
        </span>{" "}
        {t(
          "It is not affiliated with the maker of {product}, or with any company, addon author, or trademark holder referenced inside the app.",
          { product: "Stremio" },
        )}{" "}
        {t(
          "{names}, and all other names, logos, and brand references are property of their respective owners and are used here only for compatibility and identification.",
          { names: trademarkNames },
        )}
      </p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
        {t(
          "{app} itself does not host, distribute, or index any media. All streams come from third-party addons, debrid services, or your own {service} account that you configure yourself. You are responsible for what you choose to play and for complying with the laws of your jurisdiction.",
          { app: "Harbor", service: "Stremio" },
        )}
      </p>
    </section>
  );
}

function OnboardingRow() {
  const tr = useT();
  const { resetOnboarding, resetNudges } = useOnboarding();
  const [phase, setPhase] = useState<"idle" | "walkthrough" | "hints">("idle");
  useEffect(() => {
    if (phase === "idle") return;
    const t = setTimeout(() => setPhase("idle"), 1400);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <SettingGroup>
      <ActionRow
        label={tr("Replay walkthrough")}
        sub={tr("Re-runs the welcome flow and clears every dismissed tip.")}
        cta={phase === "walkthrough" ? tr("Done") : tr("Replay")}
        icon={
          phase === "walkthrough" ? <Check size={14} strokeWidth={2.6} /> : <RotateCw size={14} />
        }
        tone={phase === "walkthrough" ? "success" : "neutral"}
        onClick={() => {
          resetOnboarding();
          setPhase("walkthrough");
        }}
      />
      <ActionRow
        label={tr("Restore dismissed hints")}
        sub={tr(
          "Brings back the small in-app tips you've dismissed without redoing the welcome flow.",
        )}
        cta={phase === "hints" ? tr("Restored") : tr("Restore")}
        icon={phase === "hints" ? <Check size={14} strokeWidth={2.6} /> : <RotateCw size={14} />}
        tone={phase === "hints" ? "success" : "neutral"}
        onClick={() => {
          resetNudges();
          setPhase("hints");
        }}
      />
    </SettingGroup>
  );
}
