import type { useT } from "./index";

export function translateRailText(t: ReturnType<typeof useT>, text: string): string {
  if (!text) return text;
  const direct = t(text);
  if (direct !== text) return direct;

  if (text.startsWith("On ")) return t("On {network}", { network: text.slice(3) });
  if (text.startsWith("From ")) return t("From {name}", { name: text.slice(5) });
  if (text.startsWith("Biggest hits from ")) {
    return t("Biggest hits from {name}", { name: text.slice("Biggest hits from ".length) });
  }
  if (text.startsWith("Trending in ")) {
    return t("Trending in {name}", { name: text.slice("Trending in ".length) });
  }
  if (text.startsWith("Top Rated ") && text.endsWith(" Series")) {
    return t("Top Rated {name} Series", {
      name: text.slice("Top Rated ".length, -" Series".length),
    });
  }
  if (text.startsWith("Recent ") && text.endsWith(" Series")) {
    return t("Recent {name} Series", { name: text.slice("Recent ".length, -" Series".length) });
  }
  if (text.startsWith("Trending ") && text.endsWith(" Series")) {
    return t("Trending {name} Series", {
      name: text.slice("Trending ".length, -" Series".length),
    });
  }
  if (text.startsWith("Top Rated ") && text.endsWith(" Movies")) {
    return t("Top Rated {name} Movies", {
      name: text.slice("Top Rated ".length, -" Movies".length),
    });
  }
  if (text.startsWith("Recent ") && text.endsWith(" Movies")) {
    return t("Recent {name} Movies", { name: text.slice("Recent ".length, -" Movies".length) });
  }
  if (text.startsWith("Trending ") && text.endsWith(" Movies")) {
    return t("Trending {name} Movies", {
      name: text.slice("Trending ".length, -" Movies".length),
    });
  }
  if (text.startsWith("Top Rated ")) {
    return t("Top Rated {name}", { name: text.slice("Top Rated ".length) });
  }
  if (text.startsWith("Recent ")) {
    return t("Recent {name}", { name: text.slice("Recent ".length) });
  }
  if (text.endsWith(" Documentaries")) {
    return t("{name} Documentaries", { name: text.slice(0, -" Documentaries".length) });
  }
  if (text.startsWith("The 2010s in ")) {
    return t("The 2010s in {name}", { name: text.slice("The 2010s in ".length) });
  }
  if (text.startsWith("2000s ")) {
    return t("2000s {name}", { name: text.slice("2000s ".length) });
  }
  if (text.startsWith("90s ")) {
    return t("90s {name}", { name: text.slice("90s ".length) });
  }
  if (text.startsWith("80s ")) {
    return t("80s {name}", { name: text.slice("80s ".length) });
  }
  if (text.startsWith("70s ")) {
    return t("70s {name}", { name: text.slice("70s ".length) });
  }
  if (text.startsWith("60s ")) {
    return t("60s {name}", { name: text.slice("60s ".length) });
  }
  if (text.startsWith("Best of the 50s ")) {
    return t("Best of the 50s {name}", { name: text.slice("Best of the 50s ".length) });
  }
  if (text.startsWith("Pre-1950 ")) {
    return t("Pre-1950 {name}", { name: text.slice("Pre-1950 ".length) });
  }
  if (text.startsWith("Hidden ") && text.endsWith(" Gems")) {
    return t("Hidden {name} Gems", { name: text.slice("Hidden ".length, -" Gems".length) });
  }
  if (text.startsWith("International ")) {
    return t("International {name}", { name: text.slice("International ".length) });
  }
  if (text.startsWith("Japanese ")) {
    return t("Japanese {name}", { name: text.slice("Japanese ".length) });
  }
  if (text.startsWith("Korean ")) {
    return t("Korean {name}", { name: text.slice("Korean ".length) });
  }

  return direct;
}
