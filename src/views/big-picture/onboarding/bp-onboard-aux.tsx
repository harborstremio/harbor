import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function BpOnboardAux({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost(document.querySelector<HTMLElement>("[data-bp-onboard-aux]"));
  }, []);

  if (!host) return null;
  return createPortal(children, host);
}
