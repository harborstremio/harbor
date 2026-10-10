export const SPORTS_USAGE_SUMMARY =
  "Harbor is an open-source client. Sports displays third-party metadata; it does not host event broadcasts or operate a central index of sports streams.";

export const SPORTS_USAGE_SECTIONS = [
  {
    title: "Metadata and local matching",
    text: "Schedules, scores, statistics and artwork come from third-party services. Channel suggestions compare this information with sources you configured in Live TV. A match does not verify availability or your right to watch.",
  },
  {
    title: "Your sources, your permission",
    text: "Use only sources and content you have permission to access. Follow the provider's terms and applicable law. Harbor does not supply subscriptions or grant viewing, copying or redistribution rights. Do not use it to bypass paywalls, DRM or access restrictions.",
  },
  {
    title: "External services and local storage",
    text: "Opening Sports requests metadata and artwork from external services and caches information on this device. Providers, embedded players and any web proxy used by the app may receive connection data. Their terms and privacy policies apply to their services.",
  },
] as const;

export const SPORTS_USAGE_DETAILS = [
  "Official links and videos remain subject to the originating service's availability, regional restrictions and terms. Names and logos identify third parties and do not imply endorsement or affiliation.",
  "Market data is optional and off by default. It is informational and does not enable trading in Harbor. Reminders send event details to Discord or Telegram only when you configure a destination and request a reminder.",
  "ElfHosted provides separately hosted services. Its policies apply to those services; they do not grant rights to third-party broadcasts, metadata or artwork.",
] as const;

export const SPORTS_POLICY_LINKS = [
  { service: "espn", label: "ESPN service terms", url: "https://disneytermsofuse.com/english/" },
  {
    service: "sportsdb",
    label: "TheSportsDB terms",
    url: "https://www.thesportsdb.com/docs_terms_of_use.php",
  },
  { service: "youtube", label: "YouTube terms", url: "https://www.youtube.com/t/terms" },
  {
    service: "elfhosted",
    label: "ElfHosted service terms",
    url: "https://docs.elfhosted.com/legal/terms-of-service/",
  },
  {
    service: "elfhosted",
    label: "ElfHosted privacy policy",
    url: "https://docs.elfhosted.com/legal/privacy-policy/",
  },
] as const;
