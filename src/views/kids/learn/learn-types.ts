export type LearnCard = {
  title: string;
  text: string;
  funFact: string;
  img: string | null;
};

export type LearnQuizQ = {
  q: string;
  options: string[];
  answerIndex: number;
};

export type LearnTopic = {
  id: string;
  title: string;
  emoji: string;
  color: string;
  cards: LearnCard[];
  quiz: LearnQuizQ[];
};

const STORE_KEY = "harbor.kids.learn.v1";

type Progress = Record<string, number>;

export function loadStars(): Progress {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Progress) : {};
  } catch {
    return {};
  }
}

export function saveStars(topicId: string, stars: number): Progress {
  const cur = loadStars();
  const next = { ...cur, [topicId]: Math.max(cur[topicId] ?? 0, stars) };
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
  return next;
}
