import { GENRE } from "@/lib/providers/jikan";
import action from "@/assets/genre-icons/action.svg";
import adventure from "@/assets/genre-icons/adventure.svg";
import comedy from "@/assets/genre-icons/comedy.svg";
import drama from "@/assets/genre-icons/drama.svg";
import fantasy from "@/assets/genre-icons/fantasy.svg";
import sciFi from "@/assets/genre-icons/sci-fi.svg";
import romance from "@/assets/genre-icons/romance.svg";
import sliceOfLife from "@/assets/genre-icons/slice-of-life.svg";
import supernatural from "@/assets/genre-icons/supernatural.svg";
import mystery from "@/assets/genre-icons/mystery.svg";
import psychological from "@/assets/genre-icons/psychological.svg";
import horror from "@/assets/genre-icons/horror.svg";
import thriller from "@/assets/genre-icons/thriller.svg";
import mecha from "@/assets/genre-icons/mecha.svg";
import sports from "@/assets/genre-icons/sports.svg";
import music from "@/assets/genre-icons/music.svg";

export const GENRE_ICON: Record<number, string> = {
  [GENRE.Action]: action,
  [GENRE.Adventure]: adventure,
  [GENRE.Comedy]: comedy,
  [GENRE.Drama]: drama,
  [GENRE.Fantasy]: fantasy,
  [GENRE.SciFi]: sciFi,
  [GENRE.Romance]: romance,
  [GENRE.SliceOfLife]: sliceOfLife,
  [GENRE.Supernatural]: supernatural,
  [GENRE.Mystery]: mystery,
  [GENRE.Psychological]: psychological,
  [GENRE.Horror]: horror,
  [GENRE.Thriller]: thriller,
  [GENRE.Mecha]: mecha,
  [GENRE.Sports]: sports,
  [GENRE.Music]: music,
};
