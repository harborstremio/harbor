import { useEffect } from "react";

import { showHarborError } from "./error-view";

export function DevErrorTrigger() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.shiftKey && (e.key ?? "").toLowerCase() === "e") {
        e.preventDefault();
        showHarborError({
          code: "404",
          title: "404",
          message:
            "We couldn't find what you were looking for. The wire got snipped: either the page moved, the addon's offline, or something glitched on our end.",
          detail: "Triggered manually via Ctrl+Shift+E",
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
