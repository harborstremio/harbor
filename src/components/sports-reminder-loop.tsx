import { useEffect, useRef, useSyncExternalStore } from "react";
import { useSettings } from "@/lib/settings";
import { fireWebhook } from "@/lib/calendar";
import { getUiLanguage } from "@/lib/i18n/store";
import { readSportsReminders, saveSportsReminder } from "@/lib/sports/reminders";
import { dueReminderChannels, reminderMessage } from "@/lib/sports/reminder-state";
import {
  getSportsConsentSnapshot,
  getSportsConsentServerSnapshot,
  subscribeSportsConsent,
} from "@/lib/sports/consent";

/** Local reminders intentionally run only while Harbor is open. No credentials are copied
 * into reminder storage, and a successful destination is not retried with a failed peer. */
export function SportsReminderLoop() {
  const { settings } = useSettings();
  const current = useRef(settings.webhooks);
  current.current = settings.webhooks;
  const consent = useSyncExternalStore(
    subscribeSportsConsent,
    getSportsConsentSnapshot,
    getSportsConsentServerSnapshot,
  );
  useEffect(() => {
    if (consent.status !== "accepted") return;
    const controller = new AbortController();
    let busy = false;
    let stopped = false;
    const sendDue = async () => {
      if (stopped) return;
      for (const reminder of readSportsReminders())
        for (const channel of dueReminderChannels(reminder, Date.now())) {
          if (stopped) return;
          const latest = readSportsReminders().find((item) => item.id === reminder.id);
          if (!latest || !dueReminderChannels(latest, Date.now()).includes(channel)) continue;
          const url =
            channel === "discord" ? current.current.discordUrl : current.current.telegramUrl;
          if (!url) continue;
          const attempt = { ...latest, attempted: { ...latest.attempted, [channel]: Date.now() } };
          if (!saveSportsReminder(attempt)) continue;
          if (stopped) return;
          const message = reminderMessage(latest, Date.now(), getUiLanguage());
          const text = channel === "telegram" ? message.replace(/([_*`[])/g, "\\$1") : message;
          const result = await fireWebhook(
            channel,
            url,
            { text, items: [] },
            AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]),
          );
          if (stopped) return;
          const remaining = readSportsReminders().find((item) => item.id === reminder.id);
          if (!remaining || remaining.startMs !== latest.startMs) continue;
          saveSportsReminder({
            ...remaining,
            sent: result.ok ? { ...remaining.sent, [channel]: Date.now() } : remaining.sent,
            failed: result.ok
              ? remaining.failed.filter((item) => item !== channel)
              : [...new Set([...remaining.failed, channel])],
          });
        }
    };
    const tick = async () => {
      if (busy) return;
      busy = true;
      try {
        if (navigator.locks)
          await navigator.locks.request("harbor-sports-reminders", { ifAvailable: true }, (lock) =>
            lock ? sendDue() : undefined,
          );
        else await sendDue();
      } finally {
        busy = false;
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 30_000);
    window.addEventListener("focus", tick);
    return () => {
      stopped = true;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, [consent.status]);
  return null;
}
