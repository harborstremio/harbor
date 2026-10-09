import { useState } from "react";
import { loadStripPreview, saveStripPreview } from "../manga-read/local-reader-types";

export type RemoteLayout = "swipe" | "strip" | "strip-h" | "tap";

const KEY = "harbor.remote-reader.layout.v1";

function read(): RemoteLayout {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "strip" || v === "strip-h" || v === "tap") return v;
  } catch {
    /* fall through to default */
  }
  return "swipe";
}

export function useRemoteLayout() {
  const [layout, setLayoutState] = useState<RemoteLayout>(read);
  const setLayout = (next: RemoteLayout) => {
    setLayoutState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* persistence is best-effort */
    }
  };
  return [layout, setLayout] as const;
}

export function useStripPreview() {
  const [show, setShowState] = useState<boolean>(loadStripPreview);
  const setShow = (next: boolean) => {
    setShowState(next);
    saveStripPreview(next);
  };
  return [show, setShow] as const;
}
