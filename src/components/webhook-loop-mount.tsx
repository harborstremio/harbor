import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings";
import { proactiveStorageCleanup } from "@/lib/storage-recovery";
import { runWebhookTick } from "@/lib/webhook-engine";

const TICK_INTERVAL_MS = 30 * 60 * 1000;
const INITIAL_DELAY_MS = 90 * 1000;
const STATUS_KEY = "harbor.webhook.lastTick";

export function WebhookLoopMount() {
  const { settings } = useSettings();
  const { authKey } = useAuth();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const authRef = useRef(authKey);
  authRef.current = authKey;
  const runningRef = useRef(false);

  useEffect(() => {
    proactiveStorageCleanup();
  }, []);

  useEffect(() => {
    const hasUrl = !!settings.webhooks.discordUrl || !!settings.webhooks.telegramUrl;
    if (!hasUrl) return;
    let cancelled = false;

    const tick = async () => {
      if (runningRef.current || cancelled) return;
      if (!settingsRef.current.backgroundNetworkActivity && document.visibilityState === "hidden") return;
      runningRef.current = true;
      try {
        const result = await runWebhookTick(settingsRef.current, authRef.current);
        try {
          localStorage.setItem(
            STATUS_KEY,
            JSON.stringify({
              at: Date.now(),
              fired: result.fired,
              channels: result.channels,
            }),
          );
        } catch {}
        if (result.fired > 0) {
          console.info(`[webhook] fired ${result.fired} new items`);
        }
      } catch (e) {
        console.warn("[webhook] tick failed", e);
      } finally {
        runningRef.current = false;
      }
    };

    const initialTimer = window.setTimeout(() => {
      void tick();
    }, INITIAL_DELAY_MS);
    const interval = window.setInterval(() => {
      void tick();
    }, TICK_INTERVAL_MS);
    const onFocus = () => {
      const raw = (() => {
        try {
          return localStorage.getItem(STATUS_KEY);
        } catch {
          return null;
        }
      })();
      const last = raw ? (JSON.parse(raw) as { at?: number }).at ?? 0 : 0;
      if (Date.now() - last > TICK_INTERVAL_MS) void tick();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [
    settings.backgroundNetworkActivity,
    settings.webhooks.discordUrl,
    settings.webhooks.telegramUrl,
  ]);

  return null;
}
