import flagUa from "@/assets/flags/flag-ukr.svg";
import flagAe from "@/assets/regions/ae.svg";
import flagAr from "@/assets/regions/ar.svg";
import flagAu from "@/assets/regions/au.svg";
import flagBh from "@/assets/regions/bh.svg";
import flagBr from "@/assets/regions/br.svg";
import flagCa from "@/assets/regions/ca.svg";
import flagCl from "@/assets/regions/cl.svg";
import flagCn from "@/assets/regions/cn.svg";
import flagCo from "@/assets/regions/co.svg";
import flagDe from "@/assets/regions/de.svg";
import flagDk from "@/assets/regions/dk.svg";
import flagDz from "@/assets/regions/dz.svg";
import flagEg from "@/assets/regions/eg.svg";
import flagEs from "@/assets/regions/es.svg";
import flagFi from "@/assets/regions/fi.svg";
import flagFr from "@/assets/regions/fr.svg";
import flagGb from "@/assets/regions/gb.svg";
import flagHk from "@/assets/regions/hk.svg";
import flagId from "@/assets/regions/id.svg";
import flagIe from "@/assets/regions/ie.svg";
import flagIn from "@/assets/regions/in.svg";
import flagIq from "@/assets/regions/iq.svg";
import flagIt from "@/assets/regions/it.svg";
import flagJo from "@/assets/regions/jo.svg";
import flagJp from "@/assets/regions/jp.svg";
import flagKr from "@/assets/regions/kr.svg";
import flagKw from "@/assets/regions/kw.svg";
import flagLb from "@/assets/regions/lb.svg";
import flagLy from "@/assets/regions/ly.svg";
import flagMa from "@/assets/regions/ma.svg";
import flagMx from "@/assets/regions/mx.svg";
import flagMy from "@/assets/regions/my.svg";
import flagNl from "@/assets/regions/nl.svg";
import flagNo from "@/assets/regions/no.svg";
import flagNz from "@/assets/regions/nz.svg";
import flagOm from "@/assets/regions/om.svg";
import flagPh from "@/assets/regions/ph.svg";
import flagPl from "@/assets/regions/pl.svg";
import flagPs from "@/assets/regions/ps.svg";
import flagPt from "@/assets/regions/pt.svg";
import flagQa from "@/assets/regions/qa.svg";
import flagRu from "@/assets/regions/ru.svg";
import flagSa from "@/assets/regions/sa.svg";
import flagSd from "@/assets/regions/sd.svg";
import flagSe from "@/assets/regions/se.svg";
import flagSg from "@/assets/regions/sg.svg";
import flagSy from "@/assets/regions/sy.svg";
import flagTh from "@/assets/regions/th.svg";
import flagTn from "@/assets/regions/tn.svg";
import flagTr from "@/assets/regions/tr.svg";
import flagTw from "@/assets/regions/tw.svg";
import flagUs from "@/assets/regions/us.svg";
import flagYe from "@/assets/regions/ye.svg";
import flagZa from "@/assets/regions/za.svg";

export const REGION_FLAGS: Record<string, string> = {
  AE: flagAe,
  AR: flagAr,
  AU: flagAu,
  BH: flagBh,
  BR: flagBr,
  CA: flagCa,
  CL: flagCl,
  CN: flagCn,
  CO: flagCo,
  DE: flagDe,
  DK: flagDk,
  DZ: flagDz,
  EG: flagEg,
  ES: flagEs,
  FI: flagFi,
  FR: flagFr,
  GB: flagGb,
  HK: flagHk,
  ID: flagId,
  IE: flagIe,
  IN: flagIn,
  IQ: flagIq,
  IT: flagIt,
  JO: flagJo,
  JP: flagJp,
  KR: flagKr,
  KW: flagKw,
  LB: flagLb,
  LY: flagLy,
  MA: flagMa,
  MX: flagMx,
  MY: flagMy,
  NL: flagNl,
  NO: flagNo,
  NZ: flagNz,
  OM: flagOm,
  PH: flagPh,
  PL: flagPl,
  PS: flagPs,
  PT: flagPt,
  QA: flagQa,
  RU: flagRu,
  SA: flagSa,
  SD: flagSd,
  SE: flagSe,
  SG: flagSg,
  SY: flagSy,
  TH: flagTh,
  TN: flagTn,
  TR: flagTr,
  TW: flagTw,
  UA: flagUa,
  US: flagUs,
  YE: flagYe,
  ZA: flagZa,
};

export function regionFlagSrc(code: string): string | null {
  return REGION_FLAGS[(code || "").toUpperCase()] ?? null;
}
