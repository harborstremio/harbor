import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

const EPISODE_EXAMPLES = [
  "The one where they go to the beach.",
  "The courtroom episode.",
  "When everyone gets snowed in.",
  "The one with the talent show.",
  "Where the new kid shows up.",
  "The musical episode.",
  "The one that ends on a cliffhanger.",
];

export const SEARCH_EXAMPLES = [
  "the movie where a hitman spares a kid",
  "a show like Severance but funnier",
  "the south park episode with kanye west",
  "underrated 90s sci-fi thrillers",
  "feel-good anime for a rainy day",
  "movies with a twist you never see coming",
  "the one where they rob a casino",
  "slow-burn mysteries set in small towns",
];

export function AiExampleHint({
  hidden,
  examples = EPISODE_EXAMPLES,
  prefix = "Describe the episode.",
  sizeClass = "text-[14.5px]",
}: {
  hidden: boolean;
  examples?: string[];
  prefix?: string;
  sizeClass?: string;
}) {
  const t = useT();
  const [i, setI] = useState(() => Math.floor(Math.random() * examples.length));
  const [cycled, setCycled] = useState(false);
  useEffect(() => {
    if (hidden) return;
    const id = window.setInterval(() => {
      setCycled(true);
      setI((v) => (v + 1) % examples.length);
    }, 6000);
    return () => window.clearInterval(id);
  }, [hidden, examples.length]);
  if (hidden) return null;
  return (
    <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center overflow-hidden">
      <span key={i} className={`${cycled ? "animate-ai-status" : ""} flex whitespace-nowrap ${sizeClass}`}>
        {prefix && <span className="text-ink-subtle">{t(prefix)}&nbsp;</span>}
        <span className="ai-text-shimmer">{t(examples[i % examples.length])}</span>
      </span>
    </div>
  );
}
