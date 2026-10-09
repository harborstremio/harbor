import sightAndSound from "@/assets/curated/sight-and-sound.png";
import criterion from "@/assets/curated/criterion.svg";
import afi from "@/assets/curated/afi.png";
import libraryOfCongress from "@/assets/curated/library-of-congress.svg";
import nbr from "@/assets/curated/nbr.png";
import locarno from "@/assets/curated/locarno.svg";
import goldenHorse from "@/assets/curated/golden-horse.svg";
import sundance from "@/assets/curated/sundance.svg";
import annecy from "@/assets/curated/annecy.svg";
import karlovyVary from "@/assets/curated/karlovy-vary.svg";
import sanSebastian from "@/assets/curated/san-sebastian.svg";
import cannes from "@/assets/curated/cannes.svg";
import tiff from "@/assets/curated/tiff.svg";

/** Local publisher marks; provenance is recorded beside the assets. */
export const curatedListLogos: Readonly<Record<string, string>> = {
  "sight-and-sound-2022": sightAndSound,
  "criterion-collection": criterion,
  "afi-100-1998": afi,
  "national-film-registry": libraryOfCongress,
  "nbr-top-ten": nbr,
  "locarno-golden-leopard": locarno,
  "golden-horse-best-feature": goldenHorse,
  "sundance-documentary-jury": sundance,
  "annecy-cristal-feature": annecy,
  "karlovy-vary-crystal-globe": karlovyVary,
  "san-sebastian-golden-shell": sanSebastian,
  "cannes-camera-dor": cannes,
  "tiff-peoples-choice": tiff,
};
