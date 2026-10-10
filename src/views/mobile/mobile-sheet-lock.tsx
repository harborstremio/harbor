import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type SheetLock = {
  sheetOpen: boolean;
  pushSheet: () => () => void;
};

const noopRelease = () => {};
const fallback: SheetLock = { sheetOpen: false, pushSheet: () => noopRelease };

const SheetLockContext = createContext<SheetLock>(fallback);

export function SheetLockProvider({ children }: { children: React.ReactNode }) {
  const count = useRef(0);
  const [sheetOpen, setSheetOpen] = useState(false);

  const pushSheet = useCallback(() => {
    count.current += 1;
    if (count.current === 1) setSheetOpen(true);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      count.current = Math.max(0, count.current - 1);
      if (count.current === 0) setSheetOpen(false);
    };
  }, []);

  const value = useMemo(() => ({ sheetOpen, pushSheet }), [sheetOpen, pushSheet]);
  return <SheetLockContext.Provider value={value}>{children}</SheetLockContext.Provider>;
}

export function useSheetLock() {
  return useContext(SheetLockContext);
}

export function useRegisterSheet(active: boolean) {
  const { pushSheet } = useSheetLock();
  useEffect(() => {
    if (!active) return;
    return pushSheet();
  }, [active, pushSheet]);
}
