import {
  blockAfter,
  callAt,
  drift,
  ktSource,
  literal,
  regionAfter,
  splitArgs,
  stripStrings,
} from "./_tv-panel-kt-lex.ts";

export type KotlinOption = { value: string; label: string; on: boolean };

export type KotlinKind = "Toggle" | "Choice" | "Action" | "Info";

export type KotlinItem = {
  key: string;
  title: string;
  subtitle: string | null;
  kind: KotlinKind;
  multi: boolean;
  selected: string | null;
  toggleOn: boolean | null;
  options: KotlinOption[] | null;
};

export type TvContract = {
  items: KotlinItem[];
  settingsWire: Map<string, string>;
  layoutWire: Map<string, string>;
  numbers: Map<string, number>;
  enums: Map<string, KotlinOption[]>;
};

const KT_FILES = [
  "SettingsPage.kt",
  "SyncTvAdapters.kt",
  "ServiceRow.kt",
  "PlayerSubs.kt",
  "PlayerSubStyle.kt",
  "PlayerSkip.kt",
  "PlayerClock.kt",
  "PlayerBinge.kt",
  "PlayerAudio.kt",
  "PlayerAudioTracks.kt",
  "PlayerStats.kt",
  "PlayerExitConfirm.kt",
  "HeroTrailer.kt",
  "CwDismiss.kt",
  "AddonsPage.kt",
  "HandoffQr.kt",
  "TogetherRoute.kt",
  "ThemePickerModel.kt",
];

const WANTED_ENUMS = ["SubtitleScale", "SubTint", "SubEdge", "SubAlign", "SubFamily"];

const OPTION_FN_BODIES: Record<string, string> = {
  bsSubLangOptions:
    'private fun bsSubLangOptions(): List<SettingOption> = BS_SUB_LANGS.take(BS_SUB_LANG_COMMON).map { (code, name) -> SettingOption(code, name, on = code == "en", rank = if (code == "en") 1 else 0) }',
  bsAudioLangOptions:
    "private fun bsAudioLangOptions(): List<SettingOption> = BS_SUB_LANGS.take(BS_SUB_LANG_COMMON).map { (code, name) -> SettingOption(code, name) }",
  bsServiceOptions:
    "private fun bsServiceOptions(): List<SettingOption> = SERVICES.map { SettingOption(it.key, it.name, on = it in DEFAULT_SERVICES) }",
};

const ENUM_OPTION_EXPR = "SubtitleScale.entries.map { SettingOption(it.name, it.label) }";

const FACTORIES = ["bsChoice", "bsMulti", "bsToggle", "bsPush", "bsAction", "SettingItem"];

type OptionCtx = {
  subLangs: KotlinOption[];
  audioLangs: KotlinOption[];
  services: KotlinOption[];
  enums: Map<string, KotlinOption[]>;
};

function pairsOf(body: string): KotlinOption[] {
  return splitArgs(body).map((arg) => {
    const halves = arg.split(" to ");
    const value = halves.length === 2 ? literal(halves[0]) : null;
    const label = halves.length === 2 ? literal(halves[1]) : null;
    if (value === null || label === null) drift(`option pair ${arg}`);
    return { value, label, on: false };
  });
}

function numbersOf(sources: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const src of sources) {
    for (const hit of src.matchAll(/const val ([A-Z][A-Z0-9_]*) = (-?\d+)\b/g)) {
      out.set(hit[1], Number(hit[2]));
    }
  }
  return out;
}

function textConstsOf(sources: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const src of sources) {
    for (const hit of src.matchAll(/const val ([A-Z][A-Z0-9_]*) = "([^"]*)"/g)) {
      const held = out.get(hit[1]);
      if (held !== undefined && held !== hit[2]) drift(`${hit[1]} has two values`);
      out.set(hit[1], hit[2]);
    }
  }
  return out;
}

function enumsOf(sources: string[]): Map<string, KotlinOption[]> {
  const out = new Map<string, KotlinOption[]>();
  for (const src of sources) {
    for (const hit of src.matchAll(/enum class ([A-Za-z0-9_]+)\([^)]*\) \{([\s\S]*?)\n\}/g)) {
      if (!WANTED_ENUMS.includes(hit[1])) continue;
      const rows: KotlinOption[] = [];
      for (const entry of hit[2].matchAll(/^ {4}([A-Z][A-Za-z0-9_]*)\("([^"]*)"/gm)) {
        rows.push({ value: entry[1], label: entry[2], on: false });
      }
      if (rows.length === 0) drift(`enum ${hit[1]} has no entries`);
      out.set(hit[1], rows);
    }
  }
  for (const want of WANTED_ENUMS) if (!out.has(want)) drift(`enum ${want} is gone`);
  return out;
}

function wireOf(src: string, name: string): Map<string, string> {
  const region = regionAfter(src, `private const val ${name} =`);
  const words = [...region.matchAll(/"([^"]*)"/g)]
    .map((m) => m[1])
    .join("")
    .split(/\s+/);
  const out = new Map<string, string>();
  for (const word of words) {
    if (word.length === 0) continue;
    if (!/^[bsm]:[A-Za-z][A-Za-z0-9]*$/.test(word)) drift(`${name} token ${word}`);
    out.set(word.slice(2), word[0]);
  }
  if (out.size === 0) drift(`${name} is empty`);
  return out;
}

function fingerprint(src: string, fn: string): void {
  const seen = regionAfter(src, `private fun ${fn}`).replace(/\s+/g, " ").trim();
  if (seen !== OPTION_FN_BODIES[fn]) drift(`${fn} was rewritten to: ${seen}`);
}

function servicesOf(src: string): KotlinOption[] {
  const list = blockAfter(src, "val SERVICES: List<Service> = listOf");
  const defaults = new Set(
    [...blockAfter(src, "private val DEFAULT_ON = setOf").matchAll(/"([^"]*)"/g)].map((m) => m[1]),
  );
  const out: KotlinOption[] = [];
  let i = 0;
  while (i < list.length) {
    const at = list.indexOf("Service(", i);
    if (at < 0) break;
    const call = callAt(list, at + "Service".length);
    const args = splitArgs(call.body);
    const value = literal(args[0]);
    const label = literal(args[1]);
    if (value === null || label === null) drift(`Service entry ${args[0]}`);
    out.push({ value, label, on: defaults.has(value) });
    i = call.end;
  }
  if (out.length === 0) drift("SERVICES is empty");
  return out;
}

function langsOf(src: string, numbers: Map<string, number>, markEnglish: boolean): KotlinOption[] {
  const body = blockAfter(src, "private val BS_SUB_LANGS: List<Pair<String, String>> = listOf");
  const take = numbers.get("BS_SUB_LANG_COMMON");
  if (take === undefined) drift("BS_SUB_LANG_COMMON is gone");
  return pairsOf(body)
    .slice(0, take)
    .map((row) => ({ ...row, on: markEnglish && row.value === "en" }));
}

function namedOptions(src: string, ident: string): KotlinOption[] {
  const at = src.indexOf(`val ${ident} = bsOpts(`);
  if (at < 0) drift(`options list ${ident}`);
  return pairsOf(callAt(src, src.indexOf("(", at)).body);
}

function optionsOf(src: string, expr: string, ctx: OptionCtx): KotlinOption[] {
  const text = expr.replace(/\s+/g, " ").trim();
  if (text.startsWith("bsOpts(")) return pairsOf(callAt(text, "bsOpts".length).body);
  if (text === "bsSubLangOptions()") return ctx.subLangs;
  if (text === "bsAudioLangOptions()") return ctx.audioLangs;
  if (text === "bsServiceOptions()") return ctx.services;
  if (text === ENUM_OPTION_EXPR) return ctx.enums.get("SubtitleScale") ?? drift("SubtitleScale");
  if (/^[A-Z][A-Z0-9_]*$/.test(text)) return namedOptions(src, text);
  return drift(`options expression ${text}`);
}

function keyOf(arg: string, consts: Map<string, string>): string {
  const direct = literal(arg);
  if (direct !== null) return direct;
  const held = consts.get(arg.trim());
  if (held === undefined) drift(`key expression ${arg}`);
  return held;
}

function selectedOf(arg: string): string {
  const direct = literal(arg);
  if (direct !== null) return direct;
  const named = /^[A-Za-z0-9_]+\.([A-Za-z0-9_]+)\.name$/.exec(arg.trim());
  if (named) return named[1];
  return drift(`selected expression ${arg}`);
}

function boolOf(arg: string): boolean {
  const text = arg.trim();
  if (text === "true") return true;
  if (text === "false") return false;
  return drift(`boolean expression ${arg}`);
}

function itemOf(
  fn: string,
  args: string[],
  src: string,
  consts: Map<string, string>,
  ctx: OptionCtx,
): KotlinItem {
  const key = keyOf(args[0], consts);
  const title = literal(args[1]);
  if (title === null) drift(`title expression ${args[1]} on ${key}`);
  const seed = { key, title, subtitle: null, multi: false, selected: null, toggleOn: null };
  if (fn === "bsToggle") {
    return { ...seed, kind: "Toggle", toggleOn: boolOf(args[2]), options: null };
  }
  if (fn === "bsChoice") {
    if (args.length > 4 && !args[4].startsWith("letter")) drift(`extra bsChoice argument on ${key}`);
    return {
      ...seed,
      kind: "Choice",
      selected: selectedOf(args[2]),
      options: optionsOf(src, args[3], ctx),
    };
  }
  if (fn === "bsMulti") {
    return {
      ...seed,
      kind: "Choice",
      multi: true,
      selected: "",
      options: optionsOf(src, args[2], ctx),
    };
  }
  if (fn === "bsPush") return { ...seed, kind: "Info", subtitle: literal(args[2]), options: null };
  if (fn === "bsAction") return { ...seed, kind: "Action", options: null };
  const kind = /^SettingKind\.(Toggle|Choice|Action|Info)$/.exec(args[3].trim());
  if (!kind) drift(`SettingItem kind ${args[3]} on ${key}`);
  if (args[2].trim() !== "null" || args[4].trim() !== "null") {
    drift(`raw SettingItem ${key} now carries a subtitle or a value`);
  }
  return { ...seed, kind: kind[1] as KotlinKind, options: null };
}

function itemsOf(src: string, consts: Map<string, string>, ctx: OptionCtx): KotlinItem[] {
  const block = blockAfter(
    src,
    "val SETTING_GROUPS: List<Pair<String, List<SettingItem>>> = listOf",
  );
  const chars = [...block];
  const out: KotlinItem[] = [];
  let i = 0;
  while (i < block.length) {
    const fn = FACTORIES.find((name) => block.startsWith(name + "(", i));
    if (!fn) {
      i += 1;
      continue;
    }
    const call = callAt(block, i + fn.length);
    out.push(itemOf(fn, splitArgs(call.body), src, consts, ctx));
    for (let k = i; k < call.end; k += 1) chars[k] = " ";
    i = call.end;
  }
  const residue = stripStrings(chars.join("")).replace(
    /listOf|to|THEME_GROUP_TITLE|[(),\s]/g,
    "",
  );
  if (residue.length > 0) drift(`SETTING_GROUPS holds unread text: ${residue.slice(0, 80)}`);
  if (out.length === 0) drift("SETTING_GROUPS is empty");
  return out;
}

export function readTvContract(): TvContract {
  const sources = KT_FILES.map(ktSource);
  const page = sources[0];
  const numbers = numbersOf(sources);
  const enums = enumsOf(sources);
  for (const fn of Object.keys(OPTION_FN_BODIES)) fingerprint(page, fn);
  const ctx: OptionCtx = {
    subLangs: langsOf(page, numbers, true),
    audioLangs: langsOf(page, numbers, false),
    services: servicesOf(sources[2]),
    enums,
  };
  return {
    items: itemsOf(page, textConstsOf(sources), ctx),
    settingsWire: wireOf(sources[1], "TV_SETTINGS_WIRE"),
    layoutWire: wireOf(sources[1], "TV_LAYOUT_WIRE"),
    numbers,
    enums,
  };
}
