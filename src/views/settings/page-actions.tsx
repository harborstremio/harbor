import { createContext, useContext, useEffect, type ReactNode } from "react";

export type PageAction = {
  id: string;
  label: string;
  onSelect: () => void;
  tone?: "primary" | "quiet" | "danger";
  disabled?: boolean;
  icon?: ReactNode;
};

export type PageActionReg = { note?: string; actions: PageAction[] } | null;

const Ctx = createContext<{ reg: PageActionReg; setReg: (r: PageActionReg) => void }>({
  reg: null,
  setReg: () => {},
});

export const PageActionsProvider = Ctx.Provider;

export function usePageActionReg() {
  return useContext(Ctx).reg;
}

export function usePageActions(actions: PageAction[], note?: string) {
  const { setReg } = useContext(Ctx);
  const key = actions
    .map((a) => `${a.id}|${a.label}|${a.tone ?? ""}|${a.disabled ? 1 : 0}`)
    .join(",");
  useEffect(() => {
    setReg(actions.length ? { note, actions } : null);
  }, [key, note, setReg]);
  useEffect(() => () => setReg(null), [setReg]);
}
