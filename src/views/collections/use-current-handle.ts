import { useEffect, useState } from "react";
import { currentAuthor, subscribeAuthor } from "@/lib/theme-auth";

export function useCurrentHandle(): string | null {
  const [handle, setHandle] = useState<string | null>(() => currentAuthor()?.handle ?? null);
  useEffect(() => subscribeAuthor(() => setHandle(currentAuthor()?.handle ?? null)), []);
  return handle;
}
