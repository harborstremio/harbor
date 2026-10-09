import { CalendarDays, Globe2, MapPin, Users, Landmark } from "lucide-react";
import { SocialIcon } from "@/lib/social/socials";
import { REGION_FLAGS } from "@/lib/region-flags";
import { useUiLanguage } from "@/lib/i18n";
import england from "flag-icons/flags/4x3/gb-eng.svg";
import scotland from "flag-icons/flags/4x3/gb-sct.svg";
import wales from "flag-icons/flags/4x3/gb-wls.svg";

const names = new Intl.DisplayNames(["en"], { type: "region" });
const flags = new Map(
  Object.entries(REGION_FLAGS).flatMap(([code, src]) => [
    [code.toLowerCase(), src],
    [(names.of(code) || code).toLowerCase(), src],
  ]),
);
flags.set("usa", REGION_FLAGS.US);
flags.set("united states of america", REGION_FLAGS.US);
flags.set("uk", REGION_FLAGS.GB);
flags.set("england", england);
flags.set("scotland", scotland);
flags.set("wales", wales);

export function TeamLinkIcon({ label }: { label: string }) {
  if (label === "X") return <SocialIcon service="twitter" size={16} />;
  if (label === "Instagram") return <SocialIcon service="instagram" size={17} />;
  if (label === "YouTube") return <SocialIcon service="youtube" size={18} />;
  if (label === "Facebook")
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M24 12a12 12 0 1 0-13.875 11.855v-8.386H7.078V12h3.047V9.356c0-3.007 1.792-4.669 4.533-4.669 1.313 0 2.686.235 2.686.235v2.953h-1.513c-1.49 0-1.956.925-1.956 1.874V12h3.328l-.532 3.469h-2.796v8.386A12.002 12.002 0 0 0 24 12Z" />
      </svg>
    );
  return <Globe2 size={17} aria-hidden="true" />;
}

export function TeamFactValue({ label, value }: { label: string; value: string }) {
  const locale = useUiLanguage();
  const display =
    label === "Capacity" && /^\d+$/.test(value)
      ? new Intl.NumberFormat(locale).format(Number(value))
      : value;
  const flag = label === "Country" ? flags.get(value.trim().toLowerCase()) : undefined;
  const Icon = (
    { Location: MapPin, Venue: Landmark, Capacity: Users, Founded: CalendarDays } as Record<
      string,
      typeof MapPin
    >
  )[label];
  return (
    <span className="sh-team-fact-value">
      {flag ? (
        <img src={flag} width="23" height="16" alt="" />
      ) : Icon ? (
        <Icon size={16} aria-hidden="true" />
      ) : null}
      {display}
    </span>
  );
}
