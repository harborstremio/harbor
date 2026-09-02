import { ArrowUpRight, Check, Heart, Mail } from "lucide-react";
import elfLogo from "@/assets/elfhosted.svg";
import stremioLogo from "@/assets/stremio.png";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { badgeIconUrl } from "@/views/profile/badge-catalog";
import { Section } from "./shared";

const ELF_STORE = "https://store.elfhosted.com/";
const ELF_DONATE = "https://store.elfhosted.com/product/donation/";
const STREMIO_DONATE = "https://www.stremio.com/donate";

const ELF_PERKS = [
  "Private Stremio add-ons with 10x the rate limits and built-in stream proxying, from $9 a month.",
  "Managed Plex, Emby, or Jellyfin, running in minutes with no hardware and no Docker.",
  "Over 100 self-hosted apps: the *arr stack, debrid tools, books and audiobooks, and more.",
  "Daily backups, automatic updates, and monitoring, all handled for you.",
];

const CHARITY_NAVIGATOR = "https://www.charitynavigator.org/";

const CHARITIES = [
  { name: "St. Jude Children's Research Hospital", url: "https://www.stjude.org", blurb: "Childhood cancer research and treatment. Families are never billed for care, travel, housing, or food." },
  { name: "National Pediatric Cancer Foundation", url: "https://nationalpcf.org", blurb: "Funds research into less toxic, more targeted treatments for childhood cancer." },
  { name: "Electronic Frontier Foundation", url: "https://www.eff.org", blurb: "Defends privacy, free expression, and the open internet, in the courts and in the code." },
  { name: "Internet Archive", url: "https://archive.org/donate", blurb: "Keeps the web's memory alive. Harbor would be poorer without it." },
  { name: "Doctors Without Borders", url: "https://www.doctorswithoutborders.org/", blurb: "Emergency medical care in crisis zones, independent of politics." },
  { name: "Against Malaria Foundation", url: "https://www.againstmalaria.com/", blurb: "Insecticide-treated nets. One of the most cost-effective interventions measured." },
];

function LinkButton({ label, onClick, primary }: { label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 items-center gap-2 rounded-md px-5 text-[13.5px] font-semibold transition-colors ${
        primary
          ? "bg-ink text-canvas hover:opacity-90"
          : "bg-raised text-ink-muted hover:text-ink"
      }`}
    >
      {label}
      <ArrowUpRight size={14} strokeWidth={2.2} />
    </button>
  );
}

function GivingBadge({ icon, label, desc }: { icon?: string; label: string; desc: string }) {
  return (
    <div className="flex items-center gap-3.5 rounded-md bg-elevated px-5 py-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-canvas">
        {icon ? (
          <img src={icon} alt="" draggable={false} className="h-7 w-7 object-contain" />
        ) : (
          <Heart size={18} strokeWidth={2.2} className="text-ink-subtle" />
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13.5px] font-semibold text-ink">{label}</span>
        <span className="text-[12.5px] leading-relaxed text-ink-muted">{desc}</span>
      </span>
    </div>
  );
}

export function SupportPanel() {
  const t = useT();
  return (
    <>
      <Section
        title={t("Who keeps this running")}
        subtitle={t("Harbor's backend runs on ElfHosted. They run our servers at no cost to the community.")}
      >
        <div className="flex items-start gap-4 rounded-md bg-elevated p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-canvas">
            <img src={elfLogo} alt="" draggable={false} className="h-7 w-7 object-contain" />
          </span>
          <div className="flex min-w-0 flex-col gap-3">
            <p className="text-[13.5px] leading-relaxed text-ink-muted">
              {t("Keeping Harbor's backend online costs real money, and ElfHosted covers it so the community does not have to. Becoming a subscriber is the best way to keep that going, and it is not a donation. You get proper infrastructure for your own setup, and Harbor stays funded at the same time.")}
            </p>
            <ul className="flex flex-col gap-1.5">
              {ELF_PERKS.map((perk) => (
                <li key={perk} className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-muted">
                  <Check size={16} strokeWidth={2.6} className="mt-0.5 shrink-0 text-success" />
                  {t(perk)}
                </li>
              ))}
            </ul>
            <p className="text-[12.5px] leading-relaxed text-ink-subtle">
              {t("Month to month, cancel anytime, and you can try the whole thing for $1 for a week.")}
            </p>
            <div className="mt-1 flex flex-wrap gap-2.5">
              <LinkButton label={t("See what you get")} onClick={() => openUrl(ELF_STORE)} primary />
              <LinkButton label={t("One-off donation")} onClick={() => openUrl(ELF_DONATE)} />
            </div>
          </div>
        </div>
      </Section>

      <Section
        title={t("Built on Stremio")}
        subtitle={t("Harbor would not be possible without Stremio. It is the foundation everything here is built on.")}
      >
        <div className="flex items-start gap-4 rounded-md bg-elevated p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-canvas">
            <img src={stremioLogo} alt="" draggable={false} className="h-8 w-8 object-contain" />
          </span>
          <div className="flex min-w-0 flex-col gap-3">
            <p className="text-[13.5px] leading-relaxed text-ink-muted">
              {t("Harbor speaks Stremio's addon protocol, and the whole ecosystem of addons grows out of their work. Stremio is funded by its community, and supporters who chip in get early access to experimental features. If you have it to spare, send some their way too.")}
            </p>
            <div className="flex items-center gap-2.5 rounded-md bg-canvas px-3.5 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-elevated">
                <img src={badgeIconUrl("stremio_supporter")} alt="" draggable={false} className="h-6 w-6 object-contain" />
              </span>
              <p className="text-[12.5px] leading-relaxed text-ink-muted">
                {t("Stremio Supporters get a special badge on their Harbor profile.")}
              </p>
            </div>
            <div className="mt-1 flex flex-wrap gap-2.5">
              <LinkButton label={t("Support Stremio")} onClick={() => openUrl(STREMIO_DONATE)} primary />
            </div>
          </div>
        </div>
      </Section>

      <Section
        title={t("Donating to Harbor")}
        subtitle={t("Short version: don't. Harbor takes no donations.")}
      >
        <p className="text-[13.5px] leading-relaxed text-ink-muted">
          {t("If you were going to send something, send it to ElfHosted or Stremio above, or to one of the charities below. They all do more good with it.")}
        </p>
      </Section>

      <Section
        title={t("Badges for giving")}
        subtitle={t("Support ElfHosted or Stremio, or give to any charity below, and the badge lands on your profile.")}
      >
        <div className="flex flex-col gap-2.5">
          <GivingBadge icon={badgeIconUrl("donator")} label={t("Charity")} desc={t("For donating to a charity.")} />
          <GivingBadge icon={badgeIconUrl("top_donator")} label={t("Charity $100+")} desc={t("For giving more than $100 to charity.")} />
          <GivingBadge icon={elfLogo} label={t("ElfHosted")} desc={t("For an active ElfHosted subscription.")} />
        </div>
        <div className="mt-3 flex items-start gap-2.5 rounded-md bg-elevated px-4 py-3">
          <Mail size={16} strokeWidth={2.2} className="mt-0.5 shrink-0 text-ink-subtle" />
          <p className="text-[12.5px] leading-relaxed text-ink-muted">
            {t("To get a Charity badge, forward your donation receipt or invoice to")}{" "}
            <span className="font-semibold text-ink">bugs@harbor.site</span>{" "}
            {t("with your @handle in the body so we can match it to your account.")}
          </p>
        </div>
      </Section>

      <Section
        title={t("If you would rather give it away")}
        subtitle={t("No affiliation, no referral links, and Harbor gets nothing from these. They are just places where money goes further than it does here.")}
      >
        <div className="flex flex-col gap-2.5">
          {CHARITIES.map((c) => (
            <button
              key={c.url}
              type="button"
              onClick={() => openUrl(c.url)}
              className="flex items-start gap-3.5 rounded-md bg-elevated px-5 py-4 text-start transition-colors hover:bg-raised"
            >
              <Heart size={16} strokeWidth={2.2} className="mt-0.5 shrink-0 text-ink-subtle" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
                  {c.name}
                  <ArrowUpRight size={14} strokeWidth={2.2} className="text-ink-subtle" />
                </span>
                <span className="text-[12.5px] leading-relaxed text-ink-muted">{t(c.blurb)}</span>
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => openUrl(CHARITY_NAVIGATOR)}
          className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-subtle transition-colors hover:text-ink"
        >
          {t("Look any of them up on Charity Navigator")}
          <ArrowUpRight size={14} strokeWidth={2.2} />
        </button>
      </Section>
    </>
  );
}
