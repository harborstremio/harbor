import type { SubResult } from "../../lib/subtitles/types";

export type EmbeddedSubtitleTrack = {
  ffIndex: number;
  subIndex: number;
  lang?: string;
  title?: string;
  codec: string;
  isDefault: boolean;
  isForced: boolean;
  isHearingImpaired: boolean;
};

export type SubtitleChoice =
  | { kind: "external"; key: string; result: SubResult }
  | { kind: "embedded"; key: string; track: EmbeddedSubtitleTrack };

export type PlayerSubtitlePreselect = {
  off: boolean;
  url?: string;
  lang?: string;
  title?: string;
  embedded?: { ffIndex: number; subIndex: number };
};

function externalChoice(result: SubResult): SubtitleChoice {
  return { kind: "external", key: `external:${result.id}`, result };
}

function embeddedChoice(track: EmbeddedSubtitleTrack): SubtitleChoice {
  return {
    kind: "embedded",
    key: `embedded:${track.ffIndex}:${track.subIndex}`,
    track,
  };
}

export function mergeSubtitleChoices(
  external: SubResult[],
  embedded: EmbeddedSubtitleTrack[],
): SubtitleChoice[] {
  return [...embedded.map(embeddedChoice), ...external.map(externalChoice)];
}

type SubtitleChoiceLoadResult = {
  choices: SubtitleChoice[];
  externalError: boolean;
  embeddedError: boolean;
};

function loadResult(
  external: PromiseSettledResult<SubResult[]>,
  embedded?: PromiseSettledResult<EmbeddedSubtitleTrack[]>,
): SubtitleChoiceLoadResult {
  return {
    choices: mergeSubtitleChoices(
      external.status === "fulfilled" ? external.value : [],
      embedded?.status === "fulfilled" ? embedded.value : [],
    ),
    externalError: external.status === "rejected",
    embeddedError: embedded?.status === "rejected",
  };
}

function settle<T>(task: Promise<T>): Promise<PromiseSettledResult<T>> {
  return task.then(
    (value) => ({ status: "fulfilled", value }),
    (reason) => ({ status: "rejected", reason }),
  );
}

export async function loadSubtitleChoices(
  loadExternal: () => Promise<SubResult[]>,
  loadEmbedded: () => Promise<EmbeddedSubtitleTrack[]>,
  onExternalReady?: (result: SubtitleChoiceLoadResult) => void,
): Promise<SubtitleChoiceLoadResult> {
  // Defer both calls to microtasks so a slow provider cannot delay the local probe.
  const externalTask = settle(Promise.resolve().then(loadExternal));
  let embeddedResult: PromiseSettledResult<EmbeddedSubtitleTrack[]> | undefined;
  const embeddedTask = settle(Promise.resolve().then(loadEmbedded)).then((result) => {
    embeddedResult = result;
    return result;
  });
  const external = await externalTask;
  onExternalReady?.(loadResult(external, embeddedResult));
  const embedded = await embeddedTask;

  return loadResult(external, embedded);
}

export async function loadEmbeddedTracksWhenMpvAvailable(
  checkMpv: () => Promise<{ available: boolean }>,
  loadEmbedded: () => Promise<EmbeddedSubtitleTrack[]>,
): Promise<EmbeddedSubtitleTrack[]> {
  if (!(await checkMpv()).available) return [];
  return loadEmbedded();
}

export function buildPlayerSubtitleSelection<T extends object>(
  src: T,
  selected: string | "off" | "skip" | null,
  choices: SubtitleChoice[],
  languageTitle: (lang: string) => string = (lang) => lang,
): T & { subtitlePreselect?: PlayerSubtitlePreselect } {
  if (selected === null || selected === "skip") {
    return src;
  }
  if (selected === "off") {
    return { ...src, subtitlePreselect: { off: true } };
  }

  const choice = choices.find((candidate) => candidate.key === selected);
  if (!choice) return src;
  if (choice.kind === "external") {
    const result = choice.result;
    return {
      ...src,
      subtitlePreselect: {
        off: false,
        url: result.url,
        lang: result.lang,
        title: result.title || result.langName || languageTitle(result.lang),
      },
    };
  }

  return {
    ...src,
    subtitlePreselect: {
      off: false,
      embedded: { ffIndex: choice.track.ffIndex, subIndex: choice.track.subIndex },
    },
  };
}
