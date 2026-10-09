import { useCallback, useEffect, useState } from "react";
import {
  deleteGroup,
  fetchGroup,
  joinGroup,
  leaveGroup,
  removeMember,
  setGroupAvatar,
  type GroupDetail,
} from "@/lib/social/groups";

export type GroupState = {
  detail: GroupDetail | null;
  phase: "loading" | "ready" | "error";
  busy: boolean;
  error: string | null;
  clearError: () => void;
  reload: () => void;
  apply: (d: GroupDetail) => void;
  join: () => Promise<void>;
  leave: () => Promise<void>;
  kick: (userId: string) => Promise<void>;
  destroy: () => Promise<void>;
  changePhoto: (blob: Blob) => Promise<void>;
};

export function useGroup(id: string, onGone: () => void): GroupState {
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setPhase("loading");
    fetchGroup(id, ctrl.signal)
      .then((g) => {
        if (ctrl.signal.aborted) return;
        setDetail(g);
        setPhase("ready");
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setPhase("error");
      });
    return () => ctrl.abort();
  }, [id, tick]);

  const run = useCallback(async (fn: () => Promise<GroupDetail | void>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      const next = await fn();
      if (next) setDetail(next);
    } catch (e) {
      setError((e as Error).message || fallback);
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    detail,
    phase,
    busy,
    error,
    clearError: useCallback(() => setError(null), []),
    reload: useCallback(() => setTick((n) => n + 1), []),
    apply: useCallback((d: GroupDetail) => setDetail(d), []),
    join: useCallback(() => run(() => joinGroup(id), "Could not join."), [id, run]),
    leave: useCallback(
      () => run(async () => {
        await leaveGroup(id);
        onGone();
      }, "Could not leave."),
      [id, onGone, run],
    ),
    kick: useCallback((userId: string) => run(() => removeMember(id, userId), "Could not remove member."), [id, run]),
    destroy: useCallback(
      () => run(async () => {
        await deleteGroup(id);
        onGone();
      }, "Could not delete group."),
      [id, onGone, run],
    ),
    changePhoto: useCallback((blob: Blob) => run(() => setGroupAvatar(id, blob), "Could not update group photo."), [id, run]),
  };
}
