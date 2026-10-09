import { useEffect, useState } from "react";
import { useAnnouncement } from "@/lib/announcements";
import { AnnouncementModal } from "./announcement-hero/announcement-modal";

export function AnnouncementGlobal() {
  const { announcement, dismiss } = useAnnouncement("global");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!announcement) return;
    const t = window.setTimeout(() => setReady(true), 600);
    return () => window.clearTimeout(t);
  }, [announcement]);

  if (!announcement || !ready) return null;
  return <AnnouncementModal announcement={announcement} onClose={dismiss} />;
}
