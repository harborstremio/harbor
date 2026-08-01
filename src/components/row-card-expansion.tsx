import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

type RowCardExpansionValue = {
  enabled: boolean;
  expanded: boolean;
  expand: (width: number) => void;
  collapse: () => void;
};

const RowCardExpansionContext = createContext<RowCardExpansionValue | null>(null);

export function RowCardExpansionProvider({
  index,
  enabled,
  expanded,
  onExpand,
  onCollapse,
  children,
}: {
  index: number;
  enabled: boolean;
  expanded: boolean;
  onExpand: (index: number, width: number) => void;
  onCollapse: (index: number) => void;
  children: ReactNode;
}) {
  const expand = useCallback((width: number) => onExpand(index, width), [index, onExpand]);
  const collapse = useCallback(() => onCollapse(index), [index, onCollapse]);
  const value = useMemo<RowCardExpansionValue>(
    () => ({ enabled, expanded, expand, collapse }),
    [collapse, enabled, expand, expanded],
  );

  return (
    <RowCardExpansionContext.Provider value={value}>{children}</RowCardExpansionContext.Provider>
  );
}

export function useRowCardExpansion(): RowCardExpansionValue | null {
  return useContext(RowCardExpansionContext);
}
