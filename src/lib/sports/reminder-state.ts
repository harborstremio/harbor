export type SportsReminderChannel = "discord" | "telegram";
export type SportsReminder = {
  id: string;
  name: string;
  league: string;
  startMs: number;
  leadMinutes: number;
  /** Keep the user's choices while the provider has no published start time. */
  awaitingStartTime?: boolean;
  channels: SportsReminderChannel[];
  sent: Partial<Record<SportsReminderChannel, number>>;
  attempted: Partial<Record<SportsReminderChannel, number>>;
  failed: SportsReminderChannel[];
};
export function dueReminderChannels(reminder: SportsReminder, now: number) {
  if (reminder.awaitingStartTime) return [];
  if (
    now < reminder.startMs - reminder.leadMinutes * 60_000 ||
    now > reminder.startMs + 10 * 60_000
  )
    return [];
  return reminder.channels.filter(
    (channel) => !reminder.sent[channel] && now - (reminder.attempted[channel] ?? 0) >= 60_000,
  );
}
export function reminderMessage(reminder: SportsReminder, now: number, locale?: string) {
  const minutes = Math.max(0, Math.ceil((reminder.startMs - now) / 60_000));
  return `Harbor Sports · ${reminder.league}\n${reminder.name}\n${minutes ? `Starts in ${minutes} minutes` : "Starting now"}\n${new Date(reminder.startMs).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}\nWatch through your authorized provider or connected sources.`;
}
