import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { resolveAddonLogo } from "@/components/addon-logo";
import { HoverTooltip } from "@/components/hover-tooltip";
import type { Addon } from "@/lib/addons";
import { hostOf, moveItem } from "@/lib/addons-store/reorder";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { useSettings, type StreamPriorityEntry } from "@/lib/settings";
import { addonKey, declaresStream } from "@/lib/streams/addon-priority";
import { OrganizeList, SectionCard, SkeletonRows, type OrganizeEntry } from "@/views/addons/organize/section-card";
import { useDragList } from "@/views/addons/organize/use-drag-list";
import { useAddons } from "@/views/play-picker/use-addons";

const MAX_ENTRIES = 64;

function entryOf(a: Addon): OrganizeEntry {
  return {
    key: addonKey(a),
    name: a.manifest.name,
    host: hostOf(a.transportUrl),
    addonId: a.manifest.id,
    logo: resolveAddonLogo(a.manifest.logo, a.transportUrl),
  };
}

export function StreamPriorityCard() {
  const t = useT();
  const { authKey } = useAuth();
  const { settings, update } = useSettings();
  const { addons } = useAddons(authKey);
  const [announce, setAnnounce] = useState("");
  const prefs = settings.streamPriority;

  const streamAddons = useMemo(() => (addons ?? []).filter(declaresStream), [addons]);
  const otherCount = (addons?.length ?? 0) - streamAddons.length;

  const entries = useMemo<OrganizeEntry[]>(() => {
    const byKey = new Map(streamAddons.map((a) => [addonKey(a), a] as const));
    const used = new Set<string>();
    const out: OrganizeEntry[] = [];
    for (const p of prefs) {
      if (used.has(p.key)) continue;
      used.add(p.key);
      const live = byKey.get(p.key);
      out.push(
        live
          ? entryOf(live)
          : { key: p.key, name: p.name, host: t("Not installed"), addonId: p.key, logo: null, muted: true },
      );
    }
    for (const a of streamAddons) {
      const k = addonKey(a);
      if (used.has(k)) continue;
      used.add(k);
      out.push(entryOf(a));
    }
    return out;
  }, [streamAddons, prefs, t]);

  const commit = (next: OrganizeEntry[], moved?: OrganizeEntry, to?: number) => {
    const value: StreamPriorityEntry[] = next
      .slice(0, MAX_ENTRIES)
      .map((e) => ({ key: e.key, name: e.name }));
    update({ streamPriority: value });
    if (moved && to != null) {
      setAnnounce(
        t("Moved {name} to position {n} of {total}", {
          name: moved.name,
          n: to + 1,
          total: next.length,
        }),
      );
    }
  };

  const move = (from: number, to: number) => {
    const clamped = Math.max(0, Math.min(entries.length - 1, to));
    if (clamped === from) return;
    commit(moveItem(entries, from, clamped), entries[from], clamped);
  };

  const drag = useDragList(entries.length, move);
  const custom = prefs.length > 0;
  const loading = addons == null;
  const tooFew = !loading && streamAddons.length < 2;

  return (
    <SectionCard
      title={t("Stream priority")}
      sub={t("Results from addons higher in this list come first. If one finds nothing, the next fills in.")}
      count={entries.length}
      action={
        <div className="flex items-center gap-2">
          {custom && (
            <button
              type="button"
              onClick={() => {
                update({ streamPriority: [] });
                setAnnounce(t("Following addon order"));
              }}
              className="flex h-9 items-center rounded-full px-3 text-[12.5px] font-semibold text-ink-muted transition-colors hover:bg-raised hover:text-ink"
            >
              {t("Use addon order")}
            </button>
          )}
          <span className="rounded-full bg-raised px-3 py-1 text-[12px] font-semibold text-ink-muted">
            {custom ? t("Custom") : t("Following addon order")}
          </span>
        </div>
      }
    >
      {loading ? (
        <SkeletonRows />
      ) : tooFew ? (
        <p className="rounded-xl border border-dashed border-edge-soft bg-canvas/30 px-5 py-4 text-[13.5px] text-ink-subtle">
          {t("Priority applies once you have two or more stream addons.")}
        </p>
      ) : (
        <OrganizeList
          entries={entries}
          drag={drag}
          busy={false}
          onMove={(i, delta) => move(i, i + delta)}
          onMoveTop={(i) => move(i, 0)}
          trailing={(entry, i) =>
            entry.muted ? (
              <HoverTooltip label={t("Remove from list")} side="top" align="center" delayMs={200}>
                <button
                  type="button"
                  aria-label={t("Remove from list")}
                  onClick={() => commit(entries.filter((_, n) => n !== i))}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
                >
                  <X size={16} strokeWidth={2.4} />
                </button>
              </HoverTooltip>
            ) : null
          }
        />
      )}
      {otherCount > 0 && !loading && (
        <p className="mt-3 text-[12px] text-ink-subtle">
          {t("{n} addons don't provide streams and aren't listed.", { n: otherCount })}
        </p>
      )}
      <span aria-live="polite" className="sr-only">
        {announce}
      </span>
    </SectionCard>
  );
}
