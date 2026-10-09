import { safeFetch } from "@/lib/safe-fetch";
import {
  labelProfile,
  labelReleases,
  type MusicLabelProfile,
  type MusicLabelRelease,
} from "./label-metadata";

const COMMONS = "https://commons.wikimedia.org";
const QID = /\/(Q\d+)(?:$|[?#/])/;

export type MusicLabelPage = {
  profile: MusicLabelProfile | null;
  logo: string;
  description: string;
  releases: MusicLabelRelease[];
};

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : {};
const rows = (value: unknown): Obj[] => (Array.isArray(value) ? value.map(obj) : []);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

function commonsFile(name: string): string {
  return `${COMMONS}/wiki/Special:FilePath/${encodeURIComponent(name.replace(/^File:/, ""))}?width=480`;
}

/** A label's mark is its logo (P154); a record company has no portrait to fall back on. */
async function wikidataBrand(
  url: string,
  signal?: AbortSignal,
): Promise<{ logo: string; description: string }> {
  const qid = QID.exec(url)?.[1];
  if (!qid) return { logo: "", description: "" };
  const response = await safeFetch(
    `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`,
    { signal, headers: { Accept: "application/json" } },
  );
  if (!response.ok) return { logo: "", description: "" };
  const entity = obj(obj(obj(await response.json()).entities)[qid]);
  const claims = obj(entity.claims);
  const named = (property: string) =>
    rows(claims[property])
      .map((claim) => text(obj(obj(claim.mainsnak).datavalue).value))
      .filter(Boolean);
  const file = named("P154")[0] ?? named("P8972")[0] ?? "";
  const descriptions = obj(entity.descriptions);
  return {
    logo: file ? commonsFile(file) : "",
    description: text(obj(descriptions.en).value),
  };
}

export async function loadMusicLabelPage(
  labelId: string,
  signal?: AbortSignal,
): Promise<MusicLabelPage> {
  const [profile, releases] = await Promise.all([
    labelProfile(labelId, signal).catch(() => null),
    labelReleases(labelId, signal).catch(() => [] as MusicLabelRelease[]),
  ]);
  const brand = profile?.wikidata
    ? await wikidataBrand(profile.wikidata, signal).catch(() => ({ logo: "", description: "" }))
    : { logo: "", description: "" };
  return { profile, logo: brand.logo, description: brand.description, releases };
}
