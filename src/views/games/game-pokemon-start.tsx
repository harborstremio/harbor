import { BookOpen, FileDown, FolderOpen, Pencil } from "lucide-react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";

export function PokemonSaveStart() {
  const t = useT();
  return <div className="pokemon-save-start"><section><h4>{t("games.pokemon.saveStart")}</h4>
    <p>{t("games.pokemon.emulatorSave")}</p>
    <ol><li>{t("games.pokemon.saveStep1")}</li><li>{t("games.pokemon.saveStep2")}</li><li>{t("games.pokemon.saveStep3")}</li></ol>
    <details><summary><FolderOpen size={19}/>{t("games.pokemon.findSave")}</summary><p>{t("games.pokemon.saveLocations")}</p></details>
  </section><section className="pokemon-save-resources"><h4>{t("games.pokemon.noSave")}</h4>
    <a href="https://projectpokemon.org/home/files/category/195-user-contributed-saves/" onClick={event => { event.preventDefault(); void openUrl(event.currentTarget.href); }}><FileDown size={23}/><span><strong>{t("games.pokemon.communitySaves")}</strong><small>{t("games.pokemon.communitySavesNote")}</small></span></a>
    <a href="https://github.com/kwsch/PKHeX" onClick={event => { event.preventDefault(); void openUrl(event.currentTarget.href); }}><Pencil size={23}/><span><strong>PKHeX</strong><small>{t("games.pokemon.pkhexNote")}</small></span></a>
    <p><BookOpen size={18}/>{t("games.pokemon.noSaveNeeded")}</p>
  </section></div>;
}
