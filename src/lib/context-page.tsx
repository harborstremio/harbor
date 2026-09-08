import { useEffect, useRef } from "react";
import {
  notifyPageContextRefresh,
  registerPageContextRefresh,
  type PageContextRefresh,
} from "./context-page-store";

/** Only the page declares a refresh; navigation never reloads the application. */
export function usePageContextRefresh(refresh: PageContextRefresh): void {
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => registerPageContextRefresh(() => latest.current), []);
  useEffect(
    () => notifyPageContextRefresh(),
    [refresh.id, refresh.page, refresh.active, refresh.busy, refresh.label],
  );
}
