import { createContext, useContext, useEffect } from "react";

export type SubTab = { id: string; label: string; icon?: string; dot?: boolean; count?: number };

export type SubTabReg = {
  tabs: SubTab[];
  value: string;
  onChange: (id: string) => void;
} | null;

const Ctx = createContext<{ reg: SubTabReg; setReg: (r: SubTabReg) => void }>({
  reg: null,
  setReg: () => {},
});

export const SubTabsProvider = Ctx.Provider;

export function useSubTabReg() {
  return useContext(Ctx).reg;
}

export function useSubTabs(tabs: SubTab[], value: string, onChange: (id: string) => void) {
  const { setReg } = useContext(Ctx);
  const key = tabs
    .map((tab) => `${tab.id}|${tab.label}|${tab.icon ?? ""}|${tab.dot ? 1 : 0}|${tab.count ?? ""}`)
    .join(",");
  useEffect(() => {
    setReg({ tabs, value, onChange });
  }, [key, value, setReg]);
  useEffect(() => () => setReg(null), [setReg]);
}
