import type { CalendarFilter } from "@/lib/calendar";
import { useT } from "@/lib/i18n";
import type { Settings } from "@/lib/settings";
import { Calendar as CalendarIcon } from "lucide-react";
import type { ReactNode } from "react";

type Source = Settings["calendarSource"];

function EmptyShell({ heading, body, action }: { heading: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-edge-soft bg-canvas/30 px-8 py-16 text-center">
      <CalendarIcon size={28} strokeWidth={1.6} className="text-ink-subtle" />
      <h2 className="text-[16px] font-semibold text-ink">{heading}</h2>
      <p className="max-w-md text-[13.5px] leading-relaxed text-ink-muted">{body}</p>
      {action}
    </div>
  );
}

function ActionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="mt-1 rounded-full bg-ink px-5 py-2 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90"
    >
      {children}
    </button>
  );
}

export function NoKeyState({ onSetup }: { onSetup: () => void }) {
  const t = useT();
  return (
    <EmptyShell
      heading={t("All upcoming needs a TMDB key")}
      body={t(
        "TMDB powers the firehose of every release this month. The free tier covers it. About 60 seconds to set up. Switch to My Library if you'd rather only see what you've saved.",
      )}
      action={<ActionButton onClick={onSetup}>{t("Open settings")}</ActionButton>}
    />
  );
}

export function NotSignedInState({ onSignIn }: { onSignIn: () => void }) {
  const t = useT();
  return (
    <EmptyShell
      heading={t("Sign in to see your library calendar")}
      body={t("My Library shows upcoming episodes from the shows you've saved on Stremio. Sign in to wire it up.")}
      action={<ActionButton onClick={onSignIn}>{t("Sign in")}</ActionButton>}
    />
  );
}

export function EmptyState({
  source,
  filter,
  watchlistOnly,
}: {
  source: Source;
  filter: CalendarFilter;
  watchlistOnly: boolean;
}) {
  const t = useT();
  const heading =
    source === "library"
      ? t("Nothing from your library this month")
      : source === "trakt"
        ? t("Nothing on Trakt this month")
        : source === "anticipated"
          ? t("Nothing anticipated this month")
          : source === "simkl"
            ? t("Nothing on Simkl this month")
            : source === "simkl-anticipated"
              ? t("No Simkl premieres this month")
              : t("Nothing this month");
  const filterKind = filter === "movie" ? t("movies") : filter === "tv" ? t("TV") : t("anime");
  const body =
    source === "library"
      ? t(
          "Your saved shows have no episodes scheduled for this month. Switch to All upcoming to browse the full release calendar.",
        )
      : source === "trakt"
        ? t(
            "Trakt has no upcoming releases for your watchlist this month. Past months and dates more than six months out aren't covered by Trakt's calendar feed.",
          )
        : source === "anticipated"
          ? t("None of Trakt's most-anticipated upcoming releases land in this month. Try a different month.")
          : source === "simkl"
            ? t(
                "Your Simkl plan-to-watch list has no episodes airing this month. Switch to All upcoming to browse everything.",
              )
            : source === "simkl-anticipated"
              ? t("Simkl lists no new shows or anime premiering this month. Try a different month.")
              : watchlistOnly
                ? t("Nothing from your library lands this month. Toggle Watchlist off to see all releases.")
                : filter === "all"
                  ? t("TMDB has no notable releases for this month and region.")
                  : t("No {kind} releases this month. Try a different filter.", {
                      kind: filterKind,
                    });
  return <EmptyShell heading={heading} body={body} />;
}

export function ErrorState({ message }: { message: string }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-rose-300/30 bg-rose-400/[0.06] px-8 py-14 text-center">
      <p className="text-[14px] font-semibold text-rose-100">{t("Couldn't load the calendar")}</p>
      <p className="text-[12.5px] text-rose-100/85">{message}</p>
    </div>
  );
}
