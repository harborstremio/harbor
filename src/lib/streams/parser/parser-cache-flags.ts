import type { DebridSlug } from "../types";

const RD_CACHE_RX = /\[RD[+⚡]\]/i;
const TB_CACHE_RX = /\[TB[+⚡]\]/i;
const AD_CACHE_RX = /\[AD[+⚡]\]/i;
const PM_CACHE_RX = /\[PM[+⚡]\]/i;
const DL_CACHE_RX = /\[DL[+⚡]\]/i;
const RD_UNCACHED_RX = /\[RD(?:[\s\-]?download|⬇️?|⏳)\]/i;
const TB_UNCACHED_RX = /\[TB(?:[\s\-]?download|⬇️?|⏳)\]/i;
const AD_UNCACHED_RX = /\[AD(?:[\s\-]?download|⬇️?|⏳)\]/i;
const PM_UNCACHED_RX = /\[PM(?:[\s\-]?download|⬇️?|⏳)\]/i;
const DL_UNCACHED_RX = /\[DL(?:[\s\-]?download|⬇️?|⏳)\]/i;
const JACKETTIO_BARE_UNCACHED_RX = /\[(RD|TB|AD|PM|DL|OC|ED|Putio)\]\s+(?:Jackettio|jackettio)\b/i;
const STREAMFUSION_CACHED_RX = /^⚡instant/im;
const STREAMFUSION_SERVICE_RX = /^⚡instant\s*\n([^\n]+)/im;
const STREAMFUSION_UNCACHED_SERVICE_RX = /^⬇️?download\s*\n([^\n]+)/im;
const AIOSTREAMS_TORBOX_CACHED_RX = /\(Instant\b/i;
const AIOSTREAMS_PRISM_CACHED_RX = /⚡\s*Ready\b/i;
const AIOSTREAMS_PRISM_UNCACHED_RX = /❌\s*Not\s+Ready\b/i;
const AIOSTREAMS_GDRIVE_CACHED_RX = /🎫/u;
const AIOSTREAMS_GDRIVE_UNCACHED_RX = /🎟️?/u;
const AIOSTREAMS_GENERIC_CACHED_RX = /[🚀🌩📫]|\bcached\b/iu;
const AIOSTREAMS_GENERIC_UNCACHED_RX = /☁️?|\bUNCACHED\b/iu;
const MEDIAFUSION_SERVICE =
  "RD|TB|TRB|AD|PM|DL|OC|ED|ST|DBD|DB|PKP|PP|SDR|SAB|NZB|DAV|EN|NNTP|QB-WD|Putio|Offcloud|EasyDebrid";
const MEDIAFUSION_CACHED_RX = new RegExp(`\\b(?:${MEDIAFUSION_SERVICE})\\s*[+⚡✅]`, "iu");
const MEDIAFUSION_UNCACHED_RX = new RegExp(`\\b(?:${MEDIAFUSION_SERVICE})\\s*[⏳⬇🔻❌]`, "iu");
const SERVICE_CACHED_RX =
  /(?:⚡️?|✅)\s*(?:cached(?:\s+on)?|instant(?:\s+on)?|ready(?:\s+on)?)?\s*(real[\s\-_]?debrid|realdebrid|rd|torbox|tb|all[\s\-_]?debrid|alldebrid|ad|premiumize|pm|debrid[\s\-_]?link|debridlink|dl)/i;
const SERVICE_UNCACHED_RX =
  /(?:⏳|⬇️?|🔻|❌)\s*(?:need[\s_-]?cache|need[\s_-]?to[\s_-]?cache|download(?:\s+via)?|not\s+ready|uncached(?:\s+on)?)?\s*(real[\s\-_]?debrid|realdebrid|rd|torbox|tb|all[\s\-_]?debrid|alldebrid|ad|premiumize|pm|debrid[\s\-_]?link|debridlink|dl)/i;

const COMET_BINGE_RX = /^comet\|([a-z\-]+)\|/i;
const ELFHOSTED_CACHE_RX = /\belf[\s\-_]?cache\b|cached\s+on\s+elfhosted/i;
const COMET_SERVICE_TO_SLUG: Record<string, DebridSlug> = {
  realdebrid: "rd",
  "real-debrid": "rd",
  rd: "rd",
  torbox: "tb",
  tb: "tb",
  alldebrid: "ad",
  ad: "ad",
  premiumize: "pm",
  pm: "pm",
  debridlink: "dl",
  "debrid-link": "dl",
  dl: "dl",
};

function stripInvisibles(text: string): string {
  return text.replace(/[​-‍⁠﻿]/g, "").replace(/️/g, "");
}

export function parseCacheFlags(
  rawText: string,
  bingeGroup?: string,
  addonName?: string,
  url?: string,
): Partial<Record<DebridSlug, boolean>> {
  const text = stripInvisibles(rawText);
  const out: Partial<Record<DebridSlug, boolean>> = {};
  const denied: Partial<Record<DebridSlug, true>> = {};
  const markUncached = (slug: DebridSlug) => {
    denied[slug] = true;
    out[slug] = false;
  };

  if (RD_UNCACHED_RX.test(text)) markUncached("rd");
  if (TB_UNCACHED_RX.test(text)) markUncached("tb");
  if (AD_UNCACHED_RX.test(text)) markUncached("ad");
  if (PM_UNCACHED_RX.test(text)) markUncached("pm");
  if (DL_UNCACHED_RX.test(text)) markUncached("dl");
  const jackettioBare = text.match(JACKETTIO_BARE_UNCACHED_RX);
  if (jackettioBare) {
    const slug = serviceNameToSlug(jackettioBare[1]);
    if (slug) markUncached(slug);
  }
  const sfUncachedSvc = text.match(STREAMFUSION_UNCACHED_SERVICE_RX);
  if (sfUncachedSvc) {
    const slug = serviceNameToSlug(sfUncachedSvc[1].trim());
    if (slug) markUncached(slug);
  }
  const uncachedMatch = text.match(SERVICE_UNCACHED_RX);
  if (uncachedMatch) {
    const slug = serviceNameToSlug(uncachedMatch[1]);
    if (slug) markUncached(slug);
  }
  const isAioStreams = !!addonName && /aiostreams/i.test(addonName);
  if (
    AIOSTREAMS_PRISM_UNCACHED_RX.test(text) ||
    AIOSTREAMS_GDRIVE_UNCACHED_RX.test(text) ||
    MEDIAFUSION_UNCACHED_RX.test(text) ||
    (isAioStreams && AIOSTREAMS_GENERIC_UNCACHED_RX.test(text))
  ) {
    const slug =
      (bingeGroup ? cometServiceFrom(bingeGroup) : null) ??
      mediafusionAbbrevSlug(text) ??
      addonNameSlug(addonName);
    if (slug) markUncached(slug);
  }

  if (RD_CACHE_RX.test(text) && !denied.rd) out.rd = true;
  if (TB_CACHE_RX.test(text) && !denied.tb) out.tb = true;
  if (AD_CACHE_RX.test(text) && !denied.ad) out.ad = true;
  if (PM_CACHE_RX.test(text) && !denied.pm) out.pm = true;
  if (DL_CACHE_RX.test(text) && !denied.dl) out.dl = true;

  const sfCachedSvc = text.match(STREAMFUSION_SERVICE_RX);
  if (sfCachedSvc) {
    const slug = serviceNameToSlug(sfCachedSvc[1].trim());
    if (slug && !denied[slug]) out[slug] = true;
  }

  const serviceCached = text.match(SERVICE_CACHED_RX);
  if (serviceCached) {
    const slug = serviceNameToSlug(serviceCached[1]);
    if (slug && !denied[slug]) out[slug] = true;
  }

  const templateCached =
    AIOSTREAMS_PRISM_CACHED_RX.test(text) ||
    AIOSTREAMS_TORBOX_CACHED_RX.test(text) ||
    AIOSTREAMS_GDRIVE_CACHED_RX.test(text) ||
    STREAMFUSION_CACHED_RX.test(text) ||
    MEDIAFUSION_CACHED_RX.test(text) ||
    (isAioStreams && AIOSTREAMS_GENERIC_CACHED_RX.test(text));
  if (templateCached) {
    const slug =
      (bingeGroup ? cometServiceFrom(bingeGroup) : null) ??
      mediafusionAbbrevSlug(text) ??
      addonNameSlug(addonName);
    if (slug && !denied[slug] && !out[slug]) out[slug] = true;
  }

  if (url && addonName) {
    const slug = addonNameSlug(addonName) ?? urlDebridSlug(url);
    if (slug && !denied[slug] && !out[slug]) {
      const isHttp = /^https?:\/\//i.test(url);
      const looksDebrid =
        /(?:realdebrid|real-debrid|torbox|alldebrid|premiumize|debridlink|debrid-link|elfhosted)/i.test(
          url,
        );
      if (isHttp && (looksDebrid || isDebridAwareAddon(addonName))) {
        out[slug] = true;
      }
    }
  }

  const isElfHosted =
    (url ? /elfhosted/i.test(url) : false) || (addonName ? /elfhosted/i.test(addonName) : false);
  if (isElfHosted && ELFHOSTED_CACHE_RX.test(text)) {
    const slugFromBinge = bingeGroup ? cometServiceFrom(bingeGroup) : null;
    const targets: DebridSlug[] = slugFromBinge ? [slugFromBinge] : ["rd", "tb", "ad", "pm", "dl"];
    for (const slug of targets) {
      out[slug] = true;
    }
  }

  return out;
}

function mediafusionAbbrevSlug(text: string): DebridSlug | null {
  if (/\bTRB\b/i.test(text) || /\bTorBox\b/i.test(text)) return "tb";
  if (/\bTB\b(?!\w)/i.test(text)) return "tb";
  if (/\bReal[\s\-]?Debrid\b/i.test(text)) return "rd";
  if (/\bRD\b(?!\w)/i.test(text)) return "rd";
  if (/\bAllDebrid\b/i.test(text)) return "ad";
  if (/\bAD\b(?!\w)/i.test(text)) return "ad";
  if (/\bPremiumize\b/i.test(text)) return "pm";
  if (/\bPM\b(?!\w)/i.test(text)) return "pm";
  if (/\bDebrid[\s\-]?Link\b/i.test(text)) return "dl";
  if (/\bDL\b(?!\w)/i.test(text)) return "dl";
  return null;
}

function addonNameSlug(name: string | undefined): DebridSlug | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (/torbox|trb/.test(lower)) return "tb";
  if (/real[\s\-]?debrid|\brd\b/.test(lower)) return "rd";
  if (/all[\s\-]?debrid|\bad\b/.test(lower)) return "ad";
  if (/premiumize|\bpm\b/.test(lower)) return "pm";
  if (/debrid[\s\-]?link|\bdl\b/.test(lower)) return "dl";
  return null;
}

function urlDebridSlug(url: string | undefined): DebridSlug | null {
  if (!url) return null;
  if (/torbox/i.test(url)) return "tb";
  if (/realdebrid|real-debrid/i.test(url)) return "rd";
  if (/alldebrid/i.test(url)) return "ad";
  if (/premiumize/i.test(url)) return "pm";
  if (/debridlink|debrid-link/i.test(url)) return "dl";
  return null;
}

function isDebridAwareAddon(name: string): boolean {
  return /(?:mediafusion|comet|torrentio|aiostreams|knightcrawler|jackettio|streamfusion|easynews)/i.test(
    name,
  );
}

function cometServiceFrom(bingeGroup: string): DebridSlug | null {
  const m = bingeGroup.match(COMET_BINGE_RX);
  if (!m) return null;
  return COMET_SERVICE_TO_SLUG[m[1].toLowerCase()] ?? null;
}

function serviceNameToSlug(s: string): DebridSlug | null {
  const n = s.toLowerCase().replace(/[\s\-]+/g, "");
  if (n === "realdebrid" || n === "rd") return "rd";
  if (n === "torbox" || n === "tb") return "tb";
  if (n === "alldebrid" || n === "ad") return "ad";
  if (n === "premiumize" || n === "pm") return "pm";
  if (n === "debridlink" || n === "dl") return "dl";
  return null;
}
