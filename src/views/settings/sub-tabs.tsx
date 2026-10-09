import { createContext, useContext, useEffect } from "react";
import { SECTION_TABS } from "./tab-registry";

export type SubTab = { id: string; label: string; icon?: string; dot?: boolean; count?: number };

export type SubTabReg = {
  section: string;
  tabs: SubTab[];
  value: string;
  onChange: (id: string) => void;
} | null;

const Ctx = createContext<{ section: string; reg: SubTabReg; setReg: (r: SubTabReg) => void }>({
  section: "",
  reg: null,
  setReg: () => {},
});

export const SubTabsProvider = Ctx.Provider;

export function useSubTabReg() {
  return useContext(Ctx).reg;
}

export function assertTabRegistry(section: string, tabs: SubTab[]): void {
  if (!import.meta.env.DEV) return;
  const known = SECTION_TABS[section as keyof typeof SECTION_TABS];
  if (!known) return;
  const live = tabs.map((tab) => tab.id).join(",");
  const listed = known.map((tab) => tab.id).join(",");
  if (live !== listed) {
    console.warn(
      `[settings] tab-registry drift for "${section}": sidebar lists [${listed}] but the panel registered [${live}]`,
    );
  }
}

export function useSubTabs(tabs: SubTab[], value: string, onChange: (id: string) => void) {
  const { section, setReg } = useContext(Ctx);
  const key = tabs
    .map((tab) => `${tab.id}|${tab.label}|${tab.icon ?? ""}|${tab.dot ? 1 : 0}|${tab.count ?? ""}`)
    .join(",");
  useEffect(() => {
    setReg({ section, tabs, value, onChange });
  }, [section, key, value, setReg]);
  useEffect(() => () => setReg(null), [setReg]);
}
