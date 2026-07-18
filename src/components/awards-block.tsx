import { Fragment, useState } from "react";
import { useT } from "@/lib/i18n";
import { tmdbPersonIdByName, tmdbPersonIdCached } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { type AwardEntry, type AwardType } from "@/lib/providers/wikidata";
import { AwardLogo, laurelColorFor } from "./icons/award-logo";
import { Laurel } from "./icons/laurel";

const TYPE_ORDER: Record<AwardType, number> = {
  oscar: 0,
  emmy: 1,
  bafta: 2,
  golden_globe: 3,
  sag: 4,
  critics_choice: 5,
  cannes: 6,
  venice: 7,
  berlin: 8,
  other: 9,
};

const TYPE_TITLE: Record<AwardType, string> = {
  oscar: "Academy Awards",
  emmy: "Primetime Emmys",
  bafta: "BAFTA Awards",
  golden_globe: "Golden Globes",
  sag: "Screen Actors Guild Awards",
  critics_choice: "Critics' Choice Awards",
  cannes: "Cannes Film Festival",
  venice: "Venice Film Festival",
  berlin: "Berlin Film Festival",
  other: "Other Awards",
};

export function AwardsBlock({ awards }: { awards: AwardEntry[] }) {
  const t = useT();
  if (awards.length === 0) return null;

  const groups = new Map<AwardType, AwardEntry[]>();
  for (const a of awards) {
    if (a.type === "other") continue;
    const arr = groups.get(a.type) ?? [];
    arr.push(a);
    groups.set(a.type, arr);
  }
  if (groups.size === 0) return null;
  const sorted = [...groups.entries()].sort((a, b) => TYPE_ORDER[a[0]] - TYPE_ORDER[b[0]]);

  return (
    <div id="awards-section" className="scroll-mt-24 border-t border-edge-soft pt-14">
      <h3 className="mb-10 text-[24px] font-medium tracking-tight text-ink">
        {t("Awards & Recognition")}
      </h3>
      <div className="flex flex-col gap-14">
        {sorted.map(([type, entries]) => (
          <AwardGroup key={type} type={type} entries={entries} />
        ))}
      </div>
    </div>
  );
}

function AwardGroup({ type, entries }: { type: AwardType; entries: AwardEntry[] }) {
  const t = useT();
  const { openAward } = useView();
  const wins = entries.filter((e) => e.result === "won" && e.category);
  const noms = entries.filter((e) => e.result === "nominated" && e.category);
  const totalWins = entries.filter((e) => e.result === "won").length;
  const totalNoms = entries.filter((e) => e.result === "nominated").length;
  wins.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  noms.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

  const tint = laurelColorFor(type);
  const hasDetail = wins.length > 0 || noms.length > 0;
  const recentYears = uniqueYears(entries);
  return (
    <section className="grid gap-7 lg:grid-cols-[240px_1fr] lg:gap-14">
      <header className="flex flex-row items-center gap-5 lg:flex-col lg:items-start lg:gap-5">
        <span className="shrink-0 text-accent" style={tint ? { color: tint } : undefined}>
          {totalWins > 0 ? (
            <Laurel size={88}>
              <AwardLogo type={type} size={32} />
            </Laurel>
          ) : (
            <span className="flex h-20 w-20 items-center justify-center opacity-80">
              <AwardLogo type={type} size={40} />
            </span>
          )}
        </span>
        <div className="flex flex-col gap-1.5">
          <h4 className="text-[18px] font-medium tracking-tight text-ink">
            {type === "other" ? (
              t(TYPE_TITLE[type])
            ) : (
              <button
                type="button"
                onClick={() => openAward(type)}
                className="rounded-sm text-start transition-colors hover:text-accent"
              >
                {t(TYPE_TITLE[type])}
              </button>
            )}
          </h4>
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            {totalWins > 0 && (
              <>
                <span className="text-accent">{totalWins}</span>{" "}
                {totalWins === 1 ? t("Win") : t("Wins")}
              </>
            )}
            {totalWins > 0 && totalNoms > 0 && <span className="mx-2.5 opacity-40">·</span>}
            {totalNoms > 0 && (
              <>
                {totalNoms} {totalNoms === 1 ? t("Nomination") : t("Nominations")}
              </>
            )}
          </p>
          {recentYears.length > 0 && (
            <p className="mt-1 text-[11px] font-medium tabular-nums text-ink-subtle/80">
              {formatYearSpan(recentYears)}
            </p>
          )}
        </div>
      </header>

      <div className="flex min-w-0 flex-col gap-5">
        {wins.length > 0 && (
          <ul className="grid grid-cols-1 gap-x-10 gap-y-0 xl:grid-cols-2">
            {wins.map((e, i) => (
              <EntryRow
                key={`w-${e.year ?? ""}-${e.category}-${e.recipient ?? ""}-${i}`}
                entry={e}
                won
              />
            ))}
          </ul>
        )}

        {noms.length > 0 && (
          <div className="flex flex-col gap-2">
            {wins.length > 0 && (
              <h5 className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
                {t("Also Nominated")}
              </h5>
            )}
            <ul className="grid grid-cols-1 gap-x-10 gap-y-0 xl:grid-cols-2">
              {noms.map((e, i) => (
                <EntryRow
                  key={`n-${e.year ?? ""}-${e.category}-${e.recipient ?? ""}-${i}`}
                  entry={e}
                  won={false}
                />
              ))}
            </ul>
          </div>
        )}

        {!hasDetail && (
          <p className="text-[13px] leading-relaxed text-ink-subtle">
            {t("Recognized at the {award}.", { award: t(TYPE_TITLE[type]) })}
          </p>
        )}
      </div>
    </section>
  );
}

function uniqueYears(entries: AwardEntry[]): number[] {
  const set = new Set<number>();
  for (const e of entries) {
    if (typeof e.year === "number") set.add(e.year);
  }
  return [...set].sort((a, b) => a - b);
}

function formatYearSpan(years: number[]): string {
  if (years.length === 0) return "";
  if (years.length === 1) return String(years[0]);
  const first = years[0];
  const last = years[years.length - 1];
  if (first === last) return String(first);
  return `${first}–${last}`;
}

function EntryRow({ entry, won }: { entry: AwardEntry; won: boolean }) {
  const recipients = entry.recipients ?? (entry.recipient ? [entry.recipient] : []);
  return (
    <li className="flex items-baseline gap-4 border-b border-edge-soft/30 py-2.5 text-[13px]">
      <span
        className={`w-11 shrink-0 font-semibold tabular-nums ${
          won ? "text-accent" : "text-ink-subtle"
        }`}
      >
        {entry.year ?? "–"}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium leading-tight text-ink">{entry.category}</span>
        {recipients.length > 0 && (
          <span className="text-[12px] leading-tight text-ink-subtle">
            {recipients.map((name, i) => (
              <Fragment key={`${name}-${i}`}>
                <PersonLink name={name} />
                {i < recipients.length - 1 && <span>, </span>}
              </Fragment>
            ))}
          </span>
        )}
      </div>
    </li>
  );
}

function PersonLink({ name }: { name: string }) {
  const { settings } = useSettings();
  const { openPerson } = useView();
  const [busy, setBusy] = useState(false);
  const cached = settings.tmdbKey ? tmdbPersonIdCached(name) : null;
  const known = cached !== undefined && cached !== null;

  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!settings.tmdbKey || busy) return;
    setBusy(true);
    const id = await tmdbPersonIdByName(settings.tmdbKey, name);
    setBusy(false);
    if (id) openPerson(id);
  };

  if (cached === null) {
    return <span>{name}</span>;
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`inline rounded-sm transition-colors hover:text-ink ${
        known ? "underline-offset-2 hover:underline" : ""
      } ${busy ? "opacity-60" : ""}`}
    >
      {name}
    </button>
  );
}
