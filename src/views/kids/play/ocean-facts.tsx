import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";

const WM = "https://upload.wikimedia.org/wikipedia/commons/thumb";

const FACTS: Array<{ fact: string; art: string; img: string }> = [
  { fact: "Octopuses have three hearts and blue blood!", art: "liloctored", img: `${WM}/5/57/Octopus2.jpg/960px-Octopus2.jpg` },
  { fact: "A blue whale's heart is as big as a small car.", art: "lilbluewhale", img: `${WM}/1/1c/Anim1754_-_Flickr_-_NOAA_Photo_Library.jpg/960px-Anim1754_-_Flickr_-_NOAA_Photo_Library.jpg` },
  { fact: "Starfish can regrow a whole arm if they lose one.", art: "lilorangestar2", img: `${WM}/c/c7/Starfish_montage.png/960px-Starfish_montage.png` },
  { fact: "Whales sing songs that travel for miles under the sea.", art: "lilwhale1", img: `${WM}/6/61/Humpback_Whale_underwater_shot.jpg/960px-Humpback_Whale_underwater_shot.jpg` },
  { fact: "Sea otters hold hands while they sleep so they don't float apart.", art: "lilwhitestar", img: `${WM}/0/02/Sea_Otter_%28Enhydra_lutris%29_%2825169790524%29_crop.jpg/960px-Sea_Otter_%28Enhydra_lutris%29_%2825169790524%29_crop.jpg` },
  { fact: "Seahorse dads are the ones who carry the babies.", art: "lilpurplestar", img: `${WM}/2/25/Hippocampus_hippocampus_%28on_Ascophyllum_nodosum%29.jpg/960px-Hippocampus_hippocampus_%28on_Ascophyllum_nodosum%29.jpg` },
  { fact: "Crabs walk sideways, and they're really fast at it!", art: "lilpurpocto", img: `${WM}/7/71/Cancer_pagurus.jpg/960px-Cancer_pagurus.jpg` },
  { fact: "Sharks grow new teeth their whole lives, row after row.", art: "lilbluewhale", img: `${WM}/5/56/White_shark.jpg/960px-White_shark.jpg` },
  { fact: "The ocean covers more than half of our whole planet.", art: "lilwhale1", img: `${WM}/d/db/Pacific_Ocean_as_viewed_from_GOES-18_on_September_23%2C_2023.jpg/960px-Pacific_Ocean_as_viewed_from_GOES-18_on_September_23%2C_2023.jpg` },
  { fact: "Some jellyfish can glow in the dark like little lanterns.", art: "lilpurplestar", img: `${WM}/4/44/Jelly_cc11.jpg/960px-Jelly_cc11.jpg` },
  { fact: "An octopus can squeeze through a hole the size of a coin.", art: "lilpurpocto", img: `${WM}/0/0b/Enteroctopus_dolfeini.jpg/960px-Enteroctopus_dolfeini.jpg` },
  { fact: "Dolphins sleep with one eye open to stay safe.", art: "lilwhitestar2", img: `${WM}/b/bc/Tursiops_truncatus_01-cropped.jpg/960px-Tursiops_truncatus_01-cropped.jpg` },
  { fact: "A group of fish swimming together is called a school.", art: "lilorangestar2", img: `${WM}/b/b1/Sardines_-_%E9%B0%AF%28%E3%81%84%E3%82%8F%E3%81%97%29.jpg/960px-Sardines_-_%E9%B0%AF%28%E3%81%84%E3%82%8F%E3%81%97%29.jpg` },
  { fact: "Sea turtles can live to be more than 100 years old.", art: "lilwhitestar", img: `${WM}/a/a3/Green_sea_turtle_%28Chelonia_mydas%29_Moorea.jpg/960px-Green_sea_turtle_%28Chelonia_mydas%29_Moorea.jpg` },
  { fact: "Penguins can't fly in the air, but they fly underwater.", art: "liloctored", img: `${WM}/a/a3/Aptenodytes_forsteri_-Snow_Hill_Island%2C_Antarctica_-adults_and_juvenile-8.jpg/960px-Aptenodytes_forsteri_-Snow_Hill_Island%2C_Antarctica_-adults_and_juvenile-8.jpg` },
  { fact: "Coral reefs are built by tiny animals smaller than your fingernail.", art: "lilpurplestar", img: `${WM}/7/76/Blue_Linckia_Starfish.JPG/960px-Blue_Linckia_Starfish.JPG` },
  { fact: "Clownfish live safely inside stinging anemones. The stings don't hurt them!", art: "lilorangestar2", img: `${WM}/f/f6/Clown_fish_in_the_Andaman_Coral_Reef.jpg/960px-Clown_fish_in_the_Andaman_Coral_Reef.jpg` },
  { fact: "Electric eels can make their own electricity to light up their hunt.", art: "lilwhale1", img: `${WM}/8/8f/Electric-eel.jpg/960px-Electric-eel.jpg` },
];

function shuffled(seed: number): number[] {
  const order = FACTS.map((_, i) => i);
  let s = seed;
  for (let i = order.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function OceanFacts() {
  const [seed] = useState(() => Math.floor(Math.random() * 233280));
  const order = useMemo(() => shuffled(seed), [seed]);
  const [idx, setIdx] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);
  const fact = FACTS[order[idx % order.length]];

  useEffect(() => {
    setImgFailed(false);
  }, [idx]);

  useEffect(() => {
    const next = FACTS[order[(idx + 1) % order.length]];
    const pre = new Image();
    pre.src = next.img;
  }, [idx, order]);

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-6 px-6">
      <div
        key={idx}
        className="kids-card flex w-full max-w-[640px] flex-col overflow-hidden rounded-[32px] border-4 border-white/25 bg-white/95 text-center shadow-[0_30px_80px_-20px_rgba(0,20,40,0.6)]"
      >
        {!imgFailed ? (
          <div className="relative h-[250px] w-full shrink-0 bg-[#dceef5]">
            <img
              src={fact.img}
              alt=""
              draggable={false}
              onError={() => setImgFailed(true)}
              className="h-full w-full object-cover"
            />
            <span className="absolute bottom-2 end-3 rounded-full bg-black/45 px-2.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-white/85">
              Wikimedia Commons
            </span>
          </div>
        ) : (
          <div className="flex h-[180px] items-center justify-center bg-[#dceef5]">
            <img
              src={`/kids/doodles/${fact.art}.png`}
              alt=""
              draggable={false}
              className="h-24 w-auto"
              style={{ animation: "curfew-bob 3.4s ease-in-out infinite" }}
            />
          </div>
        )}
        <p className="px-10 py-8 font-display text-[24px] font-medium leading-snug text-[#123a52] sm:text-[27px]">
          {fact.fact}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setIdx((i) => i + 1)}
        className="flex h-16 items-center gap-3 rounded-full bg-[#ffd166] px-9 text-[20px] font-bold text-[#4a3200] shadow-[0_12px_30px_-8px_rgba(0,20,40,0.5)] transition-transform duration-150 hover:scale-[1.04] active:scale-95"
      >
        <Sparkles size={22} strokeWidth={2.4} />
        Another one!
      </button>
    </div>
  );
}
