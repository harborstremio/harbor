import { Check, Loader2, UserPlus, X } from "lucide-react";
import { Search } from "@/components/icons/search-icon";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { sendFriendRequest } from "@/lib/social/friends";
import { requestOpenProfile } from "@/lib/social/open-profile";
import { searchUsers, type UserHit } from "@/lib/social/user-search";
import { currentAuthor } from "@/lib/theme-auth";
import { useT } from "@/lib/i18n";
import { Avatar, VerifiedCheck } from "./profile-bits";

type RowState = "idle" | "sending" | "requested" | "friends" | "self";

export function AddFriendsModal({
  onClose,
  existingHandles = [],
}: {
  onClose: () => void;
  existingHandles?: string[];
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserHit[]>([]);
  const [phase, setPhase] = useState<"idle" | "searching" | "done">("idle");
  const [states, setStates] = useState<Record<string, RowState>>({});
  const [error, setError] = useState<string | null>(null);

  const myHandle = (currentAuthor()?.handle ?? "").toLowerCase();
  const friendSet = useMemo(
    () => new Set(existingHandles.map((h) => h.toLowerCase())),
    [existingHandles],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setPhase("idle");
      return;
    }
    setPhase("searching");
    const ctrl = new AbortController();
    const id = window.setTimeout(() => {
      searchUsers(q, ctrl.signal)
        .then((hits) => {
          if (ctrl.signal.aborted) return;
          setResults(hits);
          setPhase("done");
        })
        .catch(() => {
          if (ctrl.signal.aborted) return;
          setResults([]);
          setPhase("done");
        });
    }, 280);
    return () => {
      ctrl.abort();
      window.clearTimeout(id);
    };
  }, [query]);

  const stateFor = (hit: UserHit): RowState => {
    const key = hit.handle.toLowerCase();
    if (states[key]) return states[key];
    if (key === myHandle) return "self";
    if (friendSet.has(key)) return "friends";
    return "idle";
  };

  const add = async (hit: UserHit) => {
    const key = hit.handle.toLowerCase();
    setStates((s) => ({ ...s, [key]: "sending" }));
    try {
      const { edge } = await sendFriendRequest(hit.handle);
      const accepted = edge.status === "accepted" || edge.status === "friends";
      setStates((s) => ({ ...s, [key]: accepted ? "friends" : "requested" }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/already|friend|pending|exists|request/i.test(msg)) {
        setStates((s) => ({ ...s, [key]: "requested" }));
      } else {
        setStates((s) => ({ ...s, [key]: "idle" }));
        setError(msg || t("Could not send request."));
      }
    }
  };

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[230] flex items-start justify-center bg-canvas/80 p-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in flex w-[min(94vw,460px)] flex-col rounded-2xl border border-edge-soft bg-elevated shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="font-display text-[19px] font-medium text-ink">{t("Add friend")}</h2>
          <button
            onClick={onClose}
            aria-label={t("Close")}
            className="grid h-9 w-9 place-items-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <p className="px-5 pt-1 text-[12.5px] text-ink-muted">
          {t("Search by handle or name to send a request.")}
        </p>

        <div className="px-5 pt-4">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute inset-y-0 start-3.5 my-auto text-ink-subtle" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setError(null);
              }}
              placeholder={t("@handle or name")}
              spellCheck={false}
              className="h-11 w-full rounded-xl border border-edge bg-canvas ps-10 pe-10 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-ink"
            />
            {phase === "searching" && (
              <Loader2 size={16} className="absolute inset-y-0 end-3.5 my-auto animate-spin text-ink-subtle" />
            )}
          </div>
        </div>

        {error && (
          <p className="mx-5 mt-3 rounded-lg bg-danger/15 px-3 py-2 text-[12.5px] text-danger">{error}</p>
        )}

        <div className="mt-3 max-h-[46vh] overflow-y-auto px-2.5 pb-3">
          {phase === "idle" && <Empty text={t("Start typing to find people.")} />}
          {phase !== "idle" && results.length === 0 && (
            <Empty text={phase === "searching" ? t("Searching...") : t("No one found by that name.")} />
          )}
          {results.map((hit) => (
            <ResultRow
              key={hit.handle}
              hit={hit}
              state={stateFor(hit)}
              onAdd={() => add(hit)}
              onOpen={() => {
                requestOpenProfile(hit.handle);
                onClose();
              }}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ResultRow({ hit, state, onAdd, onOpen }: { hit: UserHit; state: RowState; onAdd: () => void; onOpen: () => void }) {
  const t = useT();
  return (
    <div className="flex items-center gap-3 rounded-[12px] px-2.5 py-2 transition-colors hover:bg-elevated/60">
      <button onClick={onOpen} aria-label={t("Open {alias} profile", { alias: hit.alias })} className="flex min-w-0 flex-1 items-center gap-3 text-start">
        <Avatar src={hit.avatarUrl} size={40} online={hit.online} alias={hit.alias} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold text-ink">{hit.alias}</span>
            {hit.verified && <VerifiedCheck size={14} />}
          </div>
          <div className="truncate text-[12px] text-ink-subtle">@{hit.handle}</div>
        </div>
      </button>
      <AddButton state={state} onAdd={onAdd} />
    </div>
  );
}

function AddButton({ state, onAdd }: { state: RowState; onAdd: () => void }) {
  const t = useT();
  if (state === "self") return <Tag label={t("You")} />;
  if (state === "friends") return <Tag label={t("Friends")} tone="success" icon={<Check size={14} />} />;
  if (state === "requested") return <Tag label={t("Requested")} icon={<Check size={14} />} />;
  return (
    <button
      onClick={onAdd}
      disabled={state === "sending"}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {state === "sending" ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
      {t("Add")}
    </button>
  );
}

function Tag({ label, tone = "muted", icon }: { label: string; tone?: "muted" | "success"; icon?: ReactNode }) {
  return (
    <span
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium ${
        tone === "success" ? "text-success" : "text-ink-subtle"
      }`}
    >
      {icon}
      {label}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-10 text-center text-[13px] text-ink-subtle">{text}</p>;
}
