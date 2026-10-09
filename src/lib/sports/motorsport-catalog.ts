import type { LeagueDef } from "./espn-types";

/** Verified public schedule IDs. These feeds do not promise live timing or complete results. */
export const MOTORSPORT_COVERAGE = [
  ["WRC", "World Rally Championship", "4409", "xj0p1n1534589660", "https://www.wrc.com/"],
  ["MXGP", "MXGP", "4587", "owkct71575231129", "https://www.mxgp.com/"],
  [
    "SMX",
    "SuperMotocross World Championship",
    "5412",
    "iydtkv1768578271",
    "https://www.supermotocross.com/",
  ],
  ["F2", "Formula 2", "4486", "6pfj0e1768918080", "https://www.fiaformula2.com/"],
  ["F3", "Formula 3", "4487", "lg5c6e1565708517", "https://www.fiaformula3.com/"],
  ["FORMULAE", "Formula E", "4371", "v91pho1674317051", "https://www.fiaformulae.com/"],
  ["F1ACADEMY", "F1 Academy", "5382", "d8g49u1685990479", "https://www.f1academy.com/"],
  ["MOTOGP", "MotoGP", "4407", "gg3c201768486075", "https://www.motogp.com/"],
  ["MOTO2", "Moto2", "4436", "py0ez81768486001", "https://www.motogp.com/"],
  ["MOTO3", "Moto3", "4437", "jkm5v11768487097", "https://www.motogp.com/"],
  ["WORLDSBK", "World Superbike", "4454", "g2j9rc1649703609", "https://www.worldsbk.com/"],
  ["WEC", "World Endurance Championship", "4413", "2fjrko1705526433", "https://www.fiawec.com/"],
  ["IMSA", "IMSA SportsCar Championship", "4488", "t3fpd41536244390", "https://www.imsa.com/"],
  ["ARCA", "ARCA Menards Series", "5094", "7i5n5t1654415802", "https://www.arcaracing.com/"],
  ["DTM", "DTM", "4438", "3bdoi31699300645", "https://www.dtm.com/"],
  ["DAKAR", "Dakar Rally", "4447", "xpqywq1453892151", "https://www.dakar.com/"],
  [
    "WORLDRX",
    "World Rallycross Championship",
    "4730",
    "zzj1ut1768754454",
    "https://www.fiaworldrallycross.com/",
  ],
  ["NHRA", "NHRA Drag Racing", "5309", "sfeylr1768576520", "https://www.nhra.com/"],
  ["SUPERGT", "Super GT", "4412", "n0gprm1566287993", "https://supergt.net/"],
] as const;

export const MOTORSPORT_LEAGUES: LeagueDef[] = MOTORSPORT_COVERAGE.map(
  ([key, label, path, badge]) => ({
    key,
    tag: key,
    label,
    labelEn: label,
    path,
    group: "motorsport",
    logo: `https://r2.thesportsdb.com/images/media/league/badge/${badge}.png`,
  }),
);

export function motorsportOfficialWebsite(tag: string): string | undefined {
  return MOTORSPORT_COVERAGE.find(([key]) => key === tag)?.[4];
}
