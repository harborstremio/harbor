import { ArrowUpRight, ChevronDown, FlaskConical, RotateCcw } from "lucide-react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import type { SimsWorkspace } from "@/lib/games/sims";
import type { SimsSelection } from "./game-sims-review";

export function GameSimsTroubleshoot({ data, disabled, choose }: { data: SimsWorkspace; disabled: boolean; choose: (selection: SimsSelection) => void }) {
  const t = useT(), label = (key: string) => t(`games.sims.${key}`), test = data.troubleshooting;
  const coreRequired = data.state.groups.some(g => g.enabled && g.source?.requiredCore);
  const enabled = data.state.groups.filter(g => g.enabled && !(coreRequired && g.source?.provider === "lot51" && g.source.project === "core-library"));
  const answer = (present: boolean) => test && choose({ action: { kind: "answerTest", id: test.id, round: test.round, present }, title: label("answerTest"), sources: [] });
  return <section className={`games-sims-test${test ? " is-active" : ""}`} aria-label={label("testTitle")}>
    <header><div><h3 tabIndex={-1}><FlaskConical size={18}/>{label("testTitle")}</h3><p>{label(test ? "testPlayNote" : "testIntro")}</p></div>{!test && <button className="games-button" disabled={disabled || !enabled.length} onClick={() => choose({ action: { kind: "startTest", groups: enabled.map(g => g.id), backupFolder: "" }, title: label("startTest"), sources: [], choices: enabled })}>{label("startTest")}</button>}</header>
    {test && <>
      <div className="games-sims-test-step"><small>{t("games.sims.testRound", { count: test.round + 1 })}</small><h4>{label(test.phase === "baseline" ? "testBaseline" : test.phase === "suspect" ? "testSuspect" : test.phase === "inconclusive" ? "testInconclusive" : "testBatch")}</h4>
        <p>{label(test.phase === "baseline" ? "testBaselineNote" : test.phase === "suspect" ? "testSuspectNote" : test.phase === "inconclusive" ? test.round === 1 ? "testBaselineFailed" : "testInconclusiveNote" : "testBatchNote")}</p>
        {!!test.testing.length && <ul>{test.selected.filter(g => test.testing.includes(g.id)).map(g => <li key={g.id} dir="auto">{g.title}</li>)}</ul>}
        <small>{label("testOutside")}</small>
        {test.versionChanged && <p role="status">{label("testPatch")}</p>}
        {(test.phase === "baseline" || test.phase === "test") && <div className="games-sims-actions"><button className="games-button" disabled={disabled || test.versionChanged} onClick={() => answer(true)}>{label("testPresent")}</button><button className="games-button" disabled={disabled || test.versionChanged} onClick={() => answer(false)}>{label("testGone")}</button></div>}
      </div>
      <div className="games-sims-test-footer"><details><summary>{label("testIncluded")}<ChevronDown size={15}/></summary><ul>{test.selected.map(g => <li key={g.id} dir="auto">{g.title}</li>)}</ul></details><button className="games-button" disabled={disabled} onClick={() => choose({ action: { kind: "restoreTest", id: test.id }, title: label("restoreTest"), sources: [] })}><RotateCcw size={16}/>{label("restoreTest")}</button></div>
    </>}
    <button className="games-detail-text-button games-sims-test-help" onClick={() => void openUrl("https://help.ea.com/en/articles/the-sims/the-sims-4/mods-and-the-sims-4-game-updates/")}>{label("testHelp")}<ArrowUpRight size={14}/></button>
  </section>;
}
