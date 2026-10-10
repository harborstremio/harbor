import { useState } from "react";
import { Bell, BellRing, Clock } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import type { SportsGame } from "@/lib/sports/espn-types";
import { reminderId, saveSportsReminder, useSportsReminders } from "@/lib/sports/reminders";
import { SportsSelect } from "./sports-select";
import { ReminderDialog } from "./reminder-dialog";
export function SportsReminderButton({ game }: { game: SportsGame }) {
  const t = useT();
  const locale = useUiLanguage();
  const { settings } = useSettings();
  const { openSettings } = useView();
  const reminders = useSportsReminders();
  const id = reminderId(game);
  const existing = reminders.find((item) => item.id === id);
  const [open, setOpen] = useState(false);
  const [lead, setLead] = useState(existing?.leadMinutes ?? 15);
  const [error, setError] = useState(false);
  const destinations = (["discord", "telegram"] as const).filter((channel) =>
    channel === "discord" ? settings.webhooks.discordUrl : settings.webhooks.telegramUrl,
  );
  if (
    game.dateOnly !== undefined ||
    game.state !== "pre" ||
    !Number.isFinite(game.startMs) ||
    game.startMs <= Date.now()
  )
    return null;
  const save = () => {
    const okay = saveSportsReminder({
      id,
      name: game.context?.name || `${game.away.name} · ${game.home.name}`,
      league: game.league,
      startMs: game.startMs,
      leadMinutes: lead,
      channels: destinations,
      sent: {},
      attempted: {},
      failed: [],
    });
    setError(!okay);
    if (okay) setOpen(false);
  };
  return (
    <div className="sh-reminder">
      <button
        className="sh-button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setLead(existing?.leadMinutes ?? 15);
          setError(false);
          setOpen(true);
        }}
      >
        {existing ? <BellRing size={17} /> : <Bell size={17} />}{" "}
        {t(existing ? "Reminder set" : "Remind me")}
      </button>
      {existing && (
        <small>
          {new Date(existing.startMs - existing.leadMinutes * 60_000).toLocaleString(locale, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}{" "}
          ·{" "}
          {existing.channels
            .map((channel) => (channel === "discord" ? "Discord" : "Telegram"))
            .join(" + ")}
          {existing.failed.length > 0 &&
            ` · ${t("Delivery failed. Retrying while Harbor is open.")}`}
        </small>
      )}
      {open && (
        <ReminderDialog onClose={() => setOpen(false)}>
          {destinations.length ? (
            <>
              <strong>{t("Notify me before the event")}</strong>
              <SportsSelect
                ariaLabel={t("Reminder time")}
                value={String(lead)}
                onChange={(value) => setLead(+value)}
                options={[5, 15, 60, 1440].map((minutes) => ({
                  value: String(minutes),
                  label:
                    minutes === 1440 ? t("1 day before") : t("{n} minutes before", { n: minutes }),
                  left: <Clock size={20} />,
                }))}
              />
              <p>
                {destinations
                  .map((channel) => (channel === "discord" ? "Discord" : "Telegram"))
                  .join(" + ")}{" "}
                · {t("Keep Harbor open to deliver reminders.")}
              </p>
              <button className="sh-button primary" onClick={save}>
                {t("Save reminder")}
              </button>
            </>
          ) : (
            <>
              <p>{t("Connect Discord or Telegram in Settings to receive event reminders.")}</p>
              <button
                className="sh-button"
                onClick={() => {
                  setOpen(false);
                  openSettings("webhooks");
                }}
              >
                {t("Configure notifications")}
              </button>
            </>
          )}
          {existing && (
            <button
              className="sh-text-button"
              onClick={() => {
                const ok = saveSportsReminder(null, id);
                setError(!ok);
                if (ok) setOpen(false);
              }}
            >
              {t("Cancel reminder")}
            </button>
          )}
          {error && <p role="alert">{t("Reminder could not be saved. Please try again.")}</p>}
        </ReminderDialog>
      )}
    </div>
  );
}
