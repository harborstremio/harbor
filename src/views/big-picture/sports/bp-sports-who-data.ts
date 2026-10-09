import { useEffect, useState } from "react";
import { safeFetch } from "@/lib/safe-fetch";
import {
  fetchSportsDbAthleteBio,
  parseEspnAthleteBio,
  type AthleteBio,
} from "@/lib/sports/athlete-identity";
import {
  fetchTeamProfile,
  type TeamIdentity,
  type TeamProfileData,
} from "@/lib/sports/team-profile";
import type { BpSportsWhoPerson } from "./bp-sports-who-subject";

const TIMEOUT_MS = 9000;

const FIGURES = 4;

export type BpSportsWhoStat = { name: string; value: string };

export type BpSportsWhoBio = AthleteBio & {
  summaryTitle: string;
  summary: BpSportsWhoStat[];
};

export type BpSportsWhoState<T> = { data: T | null; loading: boolean; failed: boolean };

type Json = Record<string, unknown>;

function object(value: unknown): Json {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim().slice(0, 120);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function summaryOf(raw: unknown): { title: string; stats: BpSportsWhoStat[] } {
  const block = object(object(object(raw).athlete).statsSummary);
  const stats = list(block.statistics)
    .map(object)
    .map((stat) => ({
      name: text(stat.displayName) || text(stat.name),
      value: text(stat.displayValue) || text(stat.value),
    }))
    .filter((stat) => stat.name !== "" && stat.value !== "")
    .slice(0, FIGURES);
  return { title: text(block.displayName), stats };
}

export function useBpSportsWhoBio(
  person: BpSportsWhoPerson | null,
): BpSportsWhoState<BpSportsWhoBio> {
  const [state, setState] = useState<BpSportsWhoState<BpSportsWhoBio>>({
    data: null,
    loading: person !== null,
    failed: false,
  });
  const id = person?.id ?? "";
  const path = person?.path ?? "";
  const group = person?.group ?? "";
  const source = person?.source ?? "none";

  useEffect(() => {
    const espn = source === "espn" && /^\d+$/.test(id) && path.includes("/");
    const db = source === "thesportsdb" && /^\d{1,15}$/.test(id);
    if (!espn && !db) {
      setState({ data: null, loading: false, failed: false });
      return;
    }
    const controller = new AbortController();
    setState({ data: null, loading: true, failed: false });
    const settle = (next: BpSportsWhoState<BpSportsWhoBio>) => {
      if (!controller.signal.aborted) setState(next);
    };
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(TIMEOUT_MS)]);

    if (db) {
      void fetchSportsDbAthleteBio(id, group, controller.signal)
        .then((bio) =>
          settle({
            data: bio === null ? null : { ...bio, summaryTitle: "", summary: [] },
            loading: false,
            failed: false,
          }),
        )
        .catch(() => settle({ data: null, loading: false, failed: true }));
      return () => controller.abort();
    }

    void safeFetch(`https://site.web.api.espn.com/apis/common/v3/sports/${path}/athletes/${id}`, {
      signal,
    })
      .then(async (response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error("Athlete profile unavailable");
        return (await response.json()) as unknown;
      })
      .then((raw) => {
        const bio = raw === null ? null : parseEspnAthleteBio(raw, id);
        if (bio === null) {
          settle({ data: null, loading: false, failed: false });
          return;
        }
        const summary = summaryOf(raw);
        settle({
          data: { ...bio, summaryTitle: summary.title, summary: summary.stats },
          loading: false,
          failed: false,
        });
      })
      .catch(() => settle({ data: null, loading: false, failed: true }));
    return () => controller.abort();
  }, [id, path, group, source]);

  return state;
}

export function useBpSportsWhoTeam(
  identity: TeamIdentity | null,
): BpSportsWhoState<TeamProfileData> {
  const [state, setState] = useState<BpSportsWhoState<TeamProfileData>>({
    data: null,
    loading: identity !== null,
    failed: false,
  });
  const id = identity?.id ?? "";
  const name = identity?.name ?? "";
  const logo = identity?.logo ?? "";
  const league = identity?.league ?? "";
  const source = identity?.source ?? "";

  useEffect(() => {
    if (name === "" || league === "") {
      setState({ data: null, loading: false, failed: false });
      return;
    }
    const controller = new AbortController();
    setState({ data: null, loading: true, failed: false });
    void fetchTeamProfile(
      { id, name, logo, league, source: source === "" ? undefined : source },
      controller.signal,
    )
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, loading: false, failed: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ data: null, loading: false, failed: true });
      });
    return () => controller.abort();
  }, [id, name, logo, league, source]);

  return state;
}
