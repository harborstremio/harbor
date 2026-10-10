import { useT } from "@/lib/i18n";

export function useBpT(): (key: string, vars?: Record<string, string | number>) => string {
  return useT();
}
