export type RegistryCredit = readonly [string, readonly string[]];

export type RegistryEssay = { by?: string; url: string };

export type RegistryEntry = {
  years?: string;
  note?: string;
  essay?: RegistryEssay;
  crew?: readonly RegistryCredit[];
};

export type RegistryEntryFile = {
  builtAt: string;
  entries: Record<string, RegistryEntry>;
};

export type InductionFile = {
  builtAt: string;
  latestClass: number;
  count: number;
  inductions: Record<string, number>;
};
