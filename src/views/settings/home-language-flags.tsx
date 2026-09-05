import flagBr from "@/assets/regions/br.svg";
import flagCn from "@/assets/regions/cn.svg";
import flagDe from "@/assets/regions/de.svg";
import flagEs from "@/assets/regions/es.svg";
import flagFr from "@/assets/regions/fr.svg";
import flagIn from "@/assets/regions/in.svg";
import flagIt from "@/assets/regions/it.svg";
import flagJp from "@/assets/regions/jp.svg";
import flagKr from "@/assets/regions/kr.svg";
import flagMx from "@/assets/regions/mx.svg";
import flagPt from "@/assets/regions/pt.svg";
import flagRu from "@/assets/regions/ru.svg";
import flagSa from "@/assets/regions/sa.svg";
import flagSe from "@/assets/regions/se.svg";
import flagTr from "@/assets/regions/tr.svg";
import flagUs from "@/assets/regions/us.svg";

const FLAG_SRC: Record<string, string> = {
  br: flagBr,
  cn: flagCn,
  de: flagDe,
  es: flagEs,
  fr: flagFr,
  in: flagIn,
  it: flagIt,
  jp: flagJp,
  kr: flagKr,
  mx: flagMx,
  pt: flagPt,
  ru: flagRu,
  sa: flagSa,
  se: flagSe,
  tr: flagTr,
  us: flagUs,
};

function Flag({ code }: { code: string }) {
  const src = FLAG_SRC[code];
  if (!src) return null;
  return (
    <span className="inline-block h-3 w-[18px] shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/25">
      <img src={src} alt="" draggable={false} className="h-full w-full object-cover" />
    </span>
  );
}

export function LangFlags({ codes }: { codes: string[] }) {
  return (
    <span className="flex items-center gap-1">
      {codes.map((c, i) => (
        <span key={c} className="flex items-center gap-1">
          {i > 0 && <span className="text-[13px] font-light leading-none text-ink-subtle">/</span>}
          <Flag code={c} />
        </span>
      ))}
    </span>
  );
}
