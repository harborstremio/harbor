import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { createHarborQueryClient } from "./client";

export function HarborQueryProvider({ children }: { children: ReactNode }) {
  // One client per app mount — avoids sharing across HMR tear-downs incorrectly.
  const [client] = useState(() => createHarborQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
