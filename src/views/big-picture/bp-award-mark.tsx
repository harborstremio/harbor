import { useState } from "react";
import { laurelColorFor } from "@/components/icons/award-logo";
import { Laurel } from "@/components/icons/laurel";
import { useAwardIcon } from "@/lib/award-icons";
import type { AwardType } from "@/lib/providers/wikidata";

// defaultAwardIcon() only maps ten of the eighteen bodies and drops the rest on
// a generic trophy, even though every real mark ships in public/awards.
const MARKS: Record<AwardType, string> = {
  oscar: "/awards/oscar.png",
  emmy: "/awards/emmy.png",
  golden_globe: "/awards/golden-globe.png",
  bafta: "/awards/bafta.png",
  bafta_tv: "/awards/bafta.png",
  sag: "/awards/sag.png",
  critics_choice: "/awards/critics-choice.png",
  cannes: "/awards/cannestrophy.png",
  venice: "/awards/venice.webp",
  berlin: "/awards/berlin.png",
  annie: "/awards/annie.png",
  spirit: "/awards/spirit.png",
  saturn: "/awards/saturn.png",
  cesar: "/awards/cesar.png",
  goya: "/awards/goya.png",
  blue_dragon: "/awards/blue_dragon.png",
  baeksang: "/awards/baeksang.png",
  bifa: "/awards/bifa.png",
  other: "/awards/trophy.png",
};

// Twin of the NOUN map in components/card-award.tsx, which is not exported. The
// award-catalog shorthand cannot stand in: it is "The Oscars", so a three-time
// winner reads "3 The Oscarss". Body names are proper nouns and stay untranslated
// exactly as they are everywhere else in Harbor; only the count form goes through
// the catalog, and a missing key there interpolates to desktop's own string.
const NOUN: Record<AwardType, string> = {
  oscar: "Oscar",
  emmy: "Emmy",
  golden_globe: "Globe",
  bafta: "BAFTA",
  bafta_tv: "BAFTA",
  sag: "SAG",
  critics_choice: "Critics",
  cannes: "Cannes",
  venice: "Venice",
  berlin: "Berlin",
  annie: "Annie",
  spirit: "Spirit",
  saturn: "Saturn",
  cesar: "Cesar",
  goya: "Goya",
  blue_dragon: "Blue Dragon",
  baeksang: "Baeksang",
  bifa: "BIFA",
  other: "Award",
};

export function bpClassicAwardLabel(
  type: AwardType,
  wins: number,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const noun = NOUN[type] ?? NOUN.other;
  if (wins <= 1) return noun;
  return noun.endsWith("s")
    ? t("{n} {award}", { n: wins, award: noun })
    : t("{n} {award}s", { n: wins, award: noun });
}

export function bpAwardTint(type: AwardType): string {
  return laurelColorFor(type);
}

export function bpAwardMarkSrc(type: AwardType): string {
  return MARKS[type] ?? MARKS.other;
}

export function BpAwardMark({
  type,
  size,
  laurel = true,
}: {
  type: AwardType;
  size: string;
  laurel?: boolean;
}) {
  const pack = useAwardIcon(type);
  const [broken, setBroken] = useState(false);
  const src = pack ?? bpAwardMarkSrc(type);
  const mark = broken ? null : (
    <img
      src={src}
      alt=""
      draggable={false}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      className="max-h-full w-auto max-w-full object-contain drop-shadow-[0_4px_18px_rgba(0,0,0,0.55)]"
    />
  );

  if (!laurel) {
    return (
      <span className="flex items-center justify-center" style={{ height: size }}>
        {mark}
      </span>
    );
  }

  // Laurel is authored around a pixel number and every Big Picture size is a
  // clamp(), so its boxes are re-expressed as percentages of whatever it lands in.
  return (
    <span
      className={`flex items-center justify-center ${FLUID_LAUREL}`}
      style={{ color: bpAwardTint(type), width: size, height: `calc(${size} * 0.841)` }}
    >
      <Laurel size={100}>{mark}</Laurel>
    </span>
  );
}

const FLUID_LAUREL =
  "[&>span]:!h-full [&>span]:!w-full [&>span]:!pb-[9%] [&>span>span]:!h-[58%] [&>span>span]:!w-[46%]";
