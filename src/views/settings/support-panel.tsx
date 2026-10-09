import { ArrowUpRight, Check } from "./icons";
import type { ReactNode } from "react";
import elfLogo from "@/assets/elfhosted.svg";
import amfIcon from "@/assets/support/amf.png";
import charityNavigatorIcon from "@/assets/support/charity-navigator.png";
import effIcon from "@/assets/support/eff.png";
import internetArchiveIcon from "@/assets/support/internet-archive.png";
import msfIcon from "@/assets/support/msf.png";
import nationalPcfIcon from "@/assets/support/nationalpcf.png";
import stJudeIcon from "@/assets/support/stjude.png";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { badgeIconUrl } from "@/views/profile/badge-catalog";
import { SettingRow } from "./kit";
import { ROW_DESC, Section } from "./shared";
import { SButton, SRow } from "./ui";

const ELF_STORE = "https://store.elfhosted.com/";
const ELF_DONATE = "https://store.elfhosted.com/product/donation/";

const ELF_PERKS = [
  "Private compatible addons with 10x the rate limits and built-in stream proxying, from $9 a month.",
  "Managed Plex, Emby, or Jellyfin, running in minutes with no hardware and no Docker.",
  "Over 100 self-hosted apps: the *arr stack, debrid tools, books and audiobooks, and more.",
  "Daily backups, automatic updates, and monitoring, all handled for you.",
];

const CHARITY_NAVIGATOR = "https://www.charitynavigator.org/";

const CHARITIES = [
  {
    name: "St. Jude Children's Research Hospital",
    url: "https://www.stjude.org",
    icon: stJudeIcon,
    blurb:
      "Childhood cancer research and treatment. Families are never billed for care, travel, housing, or food.",
  },
  {
    name: "National Pediatric Cancer Foundation",
    url: "https://nationalpcf.org",
    icon: nationalPcfIcon,
    blurb: "Funds research into less toxic, more targeted treatments for childhood cancer.",
  },
  {
    name: "Electronic Frontier Foundation",
    url: "https://www.eff.org",
    icon: effIcon,
    blurb:
      "Defends privacy, free expression, and the open internet, in the courts and in the code.",
  },
  {
    name: "Internet Archive",
    url: "https://archive.org/donate",
    icon: internetArchiveIcon,
    blurb: "Keeps the web's memory alive. Harbor would be poorer without it.",
  },
  {
    name: "Doctors Without Borders",
    url: "https://www.doctorswithoutborders.org/",
    icon: msfIcon,
    blurb: "Emergency medical care in crisis zones, independent of politics.",
  },
  {
    name: "Against Malaria Foundation",
    url: "https://www.againstmalaria.com/",
    icon: amfIcon,
    blurb: "Insecticide-treated nets. One of the most cost-effective interventions measured.",
  },
];

const LEAD_IMG = "h-[22px] w-[22px] shrink-0 object-contain";
const CHARITY_IMG = "h-9 w-9 shrink-0 rounded-[9px] object-cover";

function OutArrow() {
  return (
    <ArrowUpRight
      size={18}
      strokeWidth={2.2}
      className="shrink-0 text-ink-subtle rtl:-scale-x-100"
    />
  );
}

function OpenButton({ label, url, primary }: { label: string; url: string; primary?: boolean }) {
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

export function SupportPanel() {
  const t = useT();
  return (
    <>
      <Section
        title={t("Who keeps this running")}
        subtitle={t(
          "Harbor's backend runs on ElfHosted. They run our servers at no cost to the community.",
        )}
      >
        <Prose>
          {t(
            "Keeping Harbor's backend online costs real money, and ElfHosted covers it so the community does not have to. Becoming a subscriber is the best way to keep that going, and it is not a donation. You get proper infrastructure for your own setup, and Harbor stays funded at the same time.",
          )}
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
          desc={t(
            "A third party runs these plans. Harbor is not affiliated with them and receives nothing from a signup. Current pricing and terms are on their site.",
          )}
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

      <Section title={t("Addon compatibility")}>
        <Prose>{t("JL Media Vision uses the open addon protocol. Compatible manifests and configured addon links work without an external media account. Third-party notices are listed in Licenses.")}</Prose>
      </Section>

      <Section
        title={t("Donating to Harbor")}
        subtitle={t("Short version: don't. Harbor takes no donations.")}
      >
        <Prose>
          {t(
            "If you were going to send something, send it to ElfHosted above, or to one of the charities below. They all do more good with it.",
          )}
        </Prose>
      </Section>

      <Section
        title={t("Badges for giving")}
        subtitle={t(
          "Support ElfHosted, or give to any charity below, and the badge lands on your profile.",
        )}
      >
        <SRow
          leading={
            <img src={badgeIconUrl("donator")} alt="" draggable={false} className={LEAD_IMG} />
          }
          title={t("Charity")}
          description={t("For donating to a charity.")}
        />
        <SRow
          leading={
            <img src={badgeIconUrl("top_donator")} alt="" draggable={false} className={LEAD_IMG} />
          }
          title={t("Charity $100+")}
          description={t("For giving more than $100 to charity.")}
        />
        <SRow
          leading={<img src={elfLogo} alt="" draggable={false} className={LEAD_IMG} />}
          title={t("ElfHosted")}
          description={t("For an active ElfHosted subscription.")}
        />
      </Section>

      <Section
        title={t("If you would rather give it away")}
        subtitle={t(
          "No affiliation, no referral links, and Harbor gets nothing from these. They are just places where money goes further than it does here.",
        )}
      >
        {CHARITIES.map((c) => (
          <SRow
            key={c.url}
            leading={<img src={c.icon} alt="" draggable={false} className={CHARITY_IMG} />}
            leadSize="lg"
            title={c.name}
            description={t(c.blurb)}
            onClick={() => openUrl(c.url)}
            trailing={<OutArrow />}
          />
        ))}
        <SRow
          leading={
            <img src={charityNavigatorIcon} alt="" draggable={false} className={CHARITY_IMG} />
          }
          leadSize="lg"
          title={t("Charity Navigator")}
          description={t("Look any of them up before you give, or find a cause of your own.")}
          onClick={() => openUrl(CHARITY_NAVIGATOR)}
          trailing={<OutArrow />}
        />
      </Section>
    </>
  );
}
