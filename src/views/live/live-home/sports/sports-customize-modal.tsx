import { useState } from "react";
import { X, Check, Settings2 } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import {
  LEAGUES,
  LEAGUE_GROUPS,
  getLeagueLabel,
  getGroupLabel,
  type LeagueDef,
} from "@/lib/sports/espn";

interface SportsCustomizeModalProps {
  selected: string[];
  onSave: (keys: string[]) => void;
  onClose: () => void;
}

export function SportsCustomizeModal({ selected, onSave, onClose }: SportsCustomizeModalProps) {
  const t = useT();
  useUiLanguage();
  const [draft, setDraft] = useState<Set<string>>(new Set(selected));
  const [activeGroup, setActiveGroup] = useState<string>("all");

  const toggle = (key: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGroup = (group: string) => {
    const keys = LEAGUES.filter((l) => l.group === group).map((l) => l.key);
    const allSelected = keys.every((k) => draft.has(k));
    setDraft((prev) => {
      const next = new Set(prev);
      if (allSelected) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  };

  const selectAll = () => setDraft(new Set(LEAGUES.map((l) => l.key)));
  const clearAll = () => setDraft(new Set());

  const filteredLeagues =
    activeGroup === "all" ? LEAGUES : LEAGUES.filter((l) => l.group === activeGroup);

  const groupLeaguesMap = new Map<string, LeagueDef[]>();
  for (const g of LEAGUE_GROUPS) {
    groupLeaguesMap.set(
      g.key,
      LEAGUES.filter((l) => l.group === g.key),
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: "blur(12px)", backgroundColor: "rgba(0,0,0,0.65)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-edge-soft/40 bg-canvas shadow-2xl">
        <div className="flex items-center justify-between border-b border-edge-soft/30 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink/10">
              <Settings2 size={18} className="text-ink" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-ink">{t("sports.customize.title")}</h2>
              <p className="text-[12px] text-ink-subtle">
                {t("sports.customize.selected", { n: draft.size })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto border-b border-edge-soft/30 px-4 py-2.5 [scrollbar-width:none]">
          <GroupTab
            active={activeGroup === "all"}
            label={t("sports.customize.all")}
            icon="🌐"
            onClick={() => setActiveGroup("all")}
          />
          {LEAGUE_GROUPS.map((g) => {
            const groupLeagues = groupLeaguesMap.get(g.key) ?? [];
            const selectedCount = groupLeagues.filter((l) => draft.has(l.key)).length;
            return (
              <GroupTab
                key={g.key}
                active={activeGroup === g.key}
                label={getGroupLabel(g)}
                icon={g.icon}
                badge={selectedCount > 0 ? selectedCount : undefined}
                onClick={() => setActiveGroup(g.key)}
              />
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: "420px" }}>
          {activeGroup !== "all" ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {filteredLeagues.map((league) => (
                <LeagueCard
                  key={league.key}
                  league={league}
                  selected={draft.has(league.key)}
                  onToggle={() => toggle(league.key)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {LEAGUE_GROUPS.map((g) => {
                const leagues = groupLeaguesMap.get(g.key) ?? [];
                const allSel = leagues.every((l) => draft.has(l.key));
                const someSel = leagues.some((l) => draft.has(l.key));
                return (
                  <div key={g.key}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-widest text-ink-subtle">
                        <span>{g.icon}</span>
                        {getGroupLabel(g)}
                      </span>
                      <button
                        onClick={() => toggleGroup(g.key)}
                        className={`text-[11px] font-medium transition-colors ${allSel ? "text-danger hover:text-danger/80" : someSel ? "text-amber-400 hover:text-amber-300" : "text-ink-subtle hover:text-ink"}`}
                      >
                        {allSel
                          ? t("sports.customize.deselectGroupAll")
                          : t("sports.customize.selectGroupAll")}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {leagues.map((league) => (
                        <LeagueCard
                          key={league.key}
                          league={league}
                          selected={draft.has(league.key)}
                          onToggle={() => toggle(league.key)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-edge-soft/30 px-6 py-3.5">
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
            >
              {t("sports.customize.selectAll")}
            </button>
            <button
              onClick={clearAll}
              className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
            >
              {t("sports.customize.clearAll")}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-edge-soft/50 px-4 py-2 text-[13px] font-medium text-ink-muted transition-colors hover:bg-elevated"
            >
              {t("sports.customize.cancel")}
            </button>
            <button
              onClick={() => {
                onSave([...draft]);
                onClose();
              }}
              className="rounded-xl bg-ink px-5 py-2 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-80"
            >
              {t("sports.customize.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GroupTab({
  active,
  label,
  icon,
  badge,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all ${
        active
          ? "border-transparent bg-ink text-canvas"
          : "border-edge-soft/50 bg-elevated text-ink-muted hover:border-edge hover:text-ink"
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
      {badge !== undefined && (
        <span
          className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
            active ? "bg-white/20 text-white" : "bg-ink/15 text-ink"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function LeagueCard({
  league,
  selected,
  onToggle,
}: {
  league: LeagueDef;
  selected: boolean;
  onToggle: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <button
      onClick={onToggle}
      className={`relative flex items-center gap-2.5 rounded-xl border p-2.5 text-start transition-all ${
        selected
          ? "border-ink/40 bg-ink/8 ring-1 ring-ink/20"
          : "border-edge-soft/40 bg-elevated/50 hover:border-edge hover:bg-elevated"
      }`}
    >
      {!imgErr ? (
        <img
          src={league.logo}
          alt={getLeagueLabel(league)}
          draggable={false}
          onError={() => setImgErr(true)}
          className="h-8 w-8 shrink-0 object-contain"
        />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-elevated text-[16px]">
          {LEAGUE_GROUPS.find((g) => g.key === league.group)?.icon ?? "🏆"}
        </div>
      )}
      <span className="min-w-0 flex-1 truncate text-[12px] font-medium leading-tight text-ink">
        {getLeagueLabel(league)}
      </span>
      {selected && (
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink">
          <Check size={11} strokeWidth={3} className="text-canvas" />
        </div>
      )}
    </button>
  );
}
