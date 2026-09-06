import { ArrowUpRight, Check, Mail } from "./icons";
import type { ReactNode } from "react";
import elfLogo from "@/assets/elfhosted.svg";
import stremioLogo from "@/assets/stremio.png";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { badgeIconUrl } from "@/views/profile/badge-catalog";
import { SettingRow } from "./kit";
import { ROW_DESC, Section } from "./shared";
import { SButton, SRow } from "./ui";

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

const LEAD_IMG = "h-[22px] w-[22px] shrink-0 object-contain";

function OutArrow() {
  return (
    <ArrowUpRight size={18} strokeWidth={2.2} className="shrink-0 text-ink-subtle rtl:-scale-x-100" />
  );
}

function OpenButton({
  label,
  url,
  primary,
}: {
  label: string;
  url: string;
  primary?: boolean;
}) {
  return (
    <SButton variant={primary ? "primary" : "secondary"} onClick={() => openUrl(url)}>
      {label}
      <ArrowUpRight size={17} strokeWidth={2.2} className="shrink-0 rtl:-scale-x-100" />
    </SButton>
  );
}

function Prose({ children }: { children: ReactNode }) {
  return <p className={`max-w-[70ch] ${ROW_DESC}`}>{children}</p>;
}

function Callout({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[10px] bg-elevated px-4 py-3">
      {icon}
      <p className={`max-w-[66ch] ${ROW_DESC}`}>{children}</p>
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
        <Prose>
          {t("Keeping Harbor's backend online costs real money, and ElfHosted covers it so the community does not have to. Becoming a subscriber is the best way to keep that going, and it is not a donation. You get proper infrastructure for your own setup, and Harbor stays funded at the same time.")}
        </Prose>
        <ul className="flex max-w-[70ch] flex-col gap-2.5">
          {ELF_PERKS.map((perk) => (
            <li key={perk} className={`flex items-start gap-2.5 ${ROW_DESC}`}>
              <Check size={18} strokeWidth={2.6} className="mt-[2px] shrink-0 text-success" />
              <span className="min-w-0">{t(perk)}</span>
            </li>
          ))}
        </ul>
        <SettingRow
          wide
          label={t("ElfHosted plans")}
          desc={t("Month to month, cancel anytime, and you can try the whole thing for $1 for a week.")}
        >
          <div className="flex w-full flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <OpenButton label={t("See what you get")} url={ELF_STORE} primary />
              <OpenButton label={t("One-off donation")} url={ELF_DONATE} />
            </div>
            <img
              src={elfLogo}
              alt="ElfHosted"
              draggable={false}
              className="h-[84px] w-auto shrink-0 object-contain"
            />
          </div>
        </SettingRow>
      </Section>

      <Section
        title={t("Built on Stremio")}
        subtitle={t("Harbor would not be possible without Stremio. It is the foundation everything here is built on.")}
      >
        <Prose>
          {t("Harbor speaks Stremio's addon protocol, and the whole ecosystem of addons grows out of their work. Stremio is funded by its community, and supporters who chip in get early access to experimental features. If you have it to spare, send some their way too.")}
        </Prose>
        <Callout
          icon={
            <img
              src={badgeIconUrl("stremio_supporter")}
              alt=""
              draggable={false}
              className="mt-[1px] h-5 w-5 shrink-0 object-contain"
            />
          }
        >
          {t("Stremio Supporters get a special badge on their Harbor profile.")}
        </Callout>
        <SettingRow
          icon={<img src={stremioLogo} alt="" draggable={false} className={LEAD_IMG} />}
          label={t("Support Stremio")}
          desc={t("Opens Stremio's donation page in your browser.")}
        >
          <OpenButton label={t("Donate")} url={STREMIO_DONATE} primary />
        </SettingRow>
      </Section>

      <Section
        title={t("Donating to Harbor")}
        subtitle={t("Short version: don't. Harbor takes no donations.")}
      >
        <Prose>
          {t("If you were going to send something, send it to ElfHosted or Stremio above, or to one of the charities below. They all do more good with it.")}
        </Prose>
      </Section>

      <Section
        title={t("Badges for giving")}
        subtitle={t("Support ElfHosted or Stremio, or give to any charity below, and the badge lands on your profile.")}
      >
        <SRow
          leading={<img src={badgeIconUrl("donator")} alt="" draggable={false} className={LEAD_IMG} />}
          title={t("Charity")}
          description={t("For donating to a charity.")}
        />
        <SRow
          leading={<img src={badgeIconUrl("top_donator")} alt="" draggable={false} className={LEAD_IMG} />}
          title={t("Charity $100+")}
          description={t("For giving more than $100 to charity.")}
        />
        <SRow
          leading={<img src={elfLogo} alt="" draggable={false} className={LEAD_IMG} />}
          title={t("ElfHosted")}
          description={t("For an active ElfHosted subscription.")}
        />
        <Callout icon={<Mail size={18} strokeWidth={2.2} className="mt-[2px] shrink-0 text-ink-subtle" />}>
          {t("To get a Charity badge, forward your donation receipt or invoice to")}{" "}
          <span className="font-semibold text-ink">bugs@harbor.site</span>{" "}
          {t("with your @handle in the body so we can match it to your account.")}
        </Callout>
      </Section>

      <Section
        title={t("If you would rather give it away")}
        subtitle={t("No affiliation, no referral links, and Harbor gets nothing from these. They are just places where money goes further than it does here.")}
      >
        {CHARITIES.map((c) => (
          <SRow
            key={c.url}
            title={c.name}
            description={t(c.blurb)}
            onClick={() => openUrl(c.url)}
            trailing={<OutArrow />}
          />
        ))}
        <SRow
          title={t("Charity Navigator")}
          description={t("Look any of them up before you give, or find a cause of your own.")}
          onClick={() => openUrl(CHARITY_NAVIGATOR)}
          trailing={<OutArrow />}
        />
      </Section>
    </>
  );
}
