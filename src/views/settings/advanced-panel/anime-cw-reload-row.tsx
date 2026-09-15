import { Loader2, RefreshCw } from "../icons";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { listAnimeCw, refreshAnimeCw } from "@/lib/anime-progress";
import type { LibraryItem } from "@/lib/stremio";
import { ActionRow } from "./action-row";

export function AnimeCwReloadRow() {
  const t = useT();
  const { settings } = useSettings();
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshItems, setRefreshItems] = useState<LibraryItem[]>([]);
  const [refreshErr, setRefreshErr] = useState<string | null>(null);

  const cwSources = settings.cwSources;
  const anyEnabled = cwSources.trakt || cwSources.simkl || cwSources.mal || cwSources.anilist;

  const onReload = async () => {
    if (refreshing || !anyEnabled) return;
    setRefreshing(true);
    setRefreshErr(null);
    setRefreshItems([]);
    try {
      await refreshAnimeCw(true);
      setRefreshItems(listAnimeCw());
    } catch (err) {
      setRefreshErr(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
      setModalOpen(true);
    }
  };

  const sub = (() => {
    if (!anyEnabled) {
      return t("Enable at least one anime Continue Watching source to use this.");
    }
    return t("Re-queries the connected anime tracker(s) and updates the anime continue watching row.");
  })();

  const modal = modalOpen ? (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={() => setModalOpen(false)}
    >
      <div
        style={{
          background: "var(--bg-elevated, #1e1e1e)",
          borderRadius: 12,
          padding: 24,
          maxWidth: 560,
          width: "90%",
          maxHeight: "80vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          style={{
            margin: "0 0 14px",
            paddingBottom: 10,
            borderBottom: "1px solid var(--border, rgba(255,255,255,0.14))",
            fontSize: 17,
            fontWeight: 600,
            lineHeight: 1.35,
          }}
        >
          {t("Anime continue watching: refresh result")}
        </h3>
        {refreshErr ? (
          <p style={{ margin: "0 0 4px", fontSize: 14, color: "var(--danger, #e5534b)" }}>
            {t("Error:")} {refreshErr}
          </p>
        ) : refreshItems.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, opacity: 0.7 }}>
            {t("No anime continue watching items were produced.")}
          </p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {refreshItems.map((i, idx) => (
              <li
                key={i._id}
                style={{
                  padding: "10px 2px",
                  borderTop: idx > 0 ? "1px solid var(--border, rgba(255,255,255,0.1))" : undefined,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{i.name}</span>
                  {i.external ? (
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        letterSpacing: 0.5,
                        textTransform: "uppercase",
                        padding: "1px 7px",
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.1)",
                      }}
                    >
                      {i.external}
                    </span>
                  ) : null}
                </div>
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 12.5,
                    color: "var(--ink-muted, rgba(255,255,255,0.6))",
                  }}
                >
                  {t("Season {s}, Episode {e}", {
                    s: i.state?.season ?? 1,
                    e: i.state?.episode ?? 1,
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={() => setModalOpen(false)}
          style={{
            marginTop: 18,
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid var(--border, #444)",
            background: "transparent",
            color: "inherit",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {t("Close")}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <ActionRow
        label={t("Reload anime continue watching")}
        sub={sub}
        cta={refreshing ? t("Refreshing…") : t("Reload")}
        icon={
          refreshing ? (
            <Loader2 size={16} strokeWidth={2.4} className="animate-spin" />
          ) : (
            <RefreshCw size={16} strokeWidth={2.4} />
          )
        }
        onClick={onReload}
        disabled={refreshing || !anyEnabled}
      />
      {modal}
    </>
  );
}
