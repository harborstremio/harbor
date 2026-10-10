import type { MatchEvent } from "./espn-types";
export function playIcon(event: Pick<MatchEvent, "type" | "text">): string {
  if (event.type !== "other") return event.type;
  const text = event.text.toLowerCase();
  if (/timeout|time out/.test(text)) return "timeout";
  if (/intercept/.test(text)) return "interception";
  if (/fumble/.test(text)) return "fumble";
  if (/touchdown/.test(text)) return "touchdown";
  if (/field goal|extra point|pat good/.test(text)) return "kick";
  if (/sacked|sack /.test(text)) return "sack";
  if (/incomplete/.test(text)) return "incomplete";
  if (/pass |passes|assist/.test(text)) return "pass";
  if (/punt|kickoff/.test(text)) return "kick";
  if (/penalty|foul|offside/.test(text)) return "penalty";
  if (/home run|homer/.test(text)) return "homerun";
  if (/struck out|strikeout/.test(text)) return "strikeout";
  if (/three point|three-point|3-point/.test(text)) return "three";
  if (/dunk|layup|jump shot|basket|shot|goal/.test(text)) return "score";
  if (/rebound|save/.test(text)) return "save";
  if (
    /rush|run |scramble|left tackle|right tackle|up the middle|left end|right end|left guard|right guard/.test(
      text,
    )
  )
    return "run";
  if (/knockout|submission/.test(text)) return "finish";
  if (/end of|start of|quarter|halftime/.test(text)) return "period";
  return "play";
}
