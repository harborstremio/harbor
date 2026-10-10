import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { ArrowLeft } from "lucide-react";
import "./sports-skeletons.css";

function Bar({
  w,
  h = 12,
  round = false,
  delay = 0,
}: {
  w: number | string;
  h?: number;
  round?: boolean;
  delay?: 0 | 1 | 2 | 3;
}) {
  return (
    <span
      className={`sk-bar ${round ? "sk-round" : ""} ${delay ? `sk-delay-${delay}` : ""}`}
      style={{ width: typeof w === "number" ? `${w}px` : w, height: `${h}px` }}
    />
  );
}

function Dot({ size = 22, delay = 0 }: { size?: number; delay?: 0 | 1 | 2 | 3 }) {
  return (
    <span
      className={`sk-bar sk-circle ${delay ? `sk-delay-${delay}` : ""}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
}

const PILLS = [72, 88, 64, 96, 78, 68];
const FIXTURE_WIDTHS = [
  [118, 96],
  [92, 132],
  [140, 104],
  [104, 88],
  [126, 118],
  [88, 142],
  [134, 92],
  [110, 126],
];

export function SportsScheduleSkeleton({ rows = 7 }: { rows?: number }) {
  const t = useT();
  return (
    <section
      className="sh-match-center sh-skeleton"
      role="status"
      aria-label={t("Loading schedules…")}
    >
      <div className="sh-section-head">
        <div className="sk-stack">
          <Bar w={104} h={9} round />
          <Bar w={210} h={22} />
        </div>
        <Bar w={86} h={13} />
      </div>
      <div className="sh-match-sport-pills">
        {PILLS.map((w, i) => (
          <Bar key={i} w={w} h={32} round delay={(i % 3) as 0 | 1 | 2} />
        ))}
      </div>
      <div className="sh-match-league-pills">
        {PILLS.slice(0, 4).map((w, i) => (
          <Bar key={i} w={w + 14} h={28} round delay={(i % 3) as 0 | 1 | 2} />
        ))}
      </div>
      <div className="sh-board-toolbar">
        <div className="sh-board-filters">
          {[62, 58, 70].map((w, i) => (
            <Bar key={i} w={w} h={30} round />
          ))}
        </div>
        <Bar w="min(260px, 40%)" h={34} round />
      </div>
      <SportsFixturesSkeleton rows={rows} />
    </section>
  );
}

export function SportsFixturesSkeleton({ rows = 7 }: { rows?: number }) {
  const t = useT();
  return (
    <div className="sh-league-board sh-skeleton" role="status" aria-label={t("Loading schedules…")}>
      <div className="sh-league-heading-row">
        <div className="sk-line">
          <Dot size={26} />
          <Bar w={152} h={14} />
        </div>
        <Bar w={54} h={11} round />
      </div>
      {FIXTURE_WIDTHS.slice(0, rows).map(([away, home], i) => (
        <div className="sh-fixture" key={i}>
          <span className="sh-fixture-time">
            <Bar w={46} h={12} delay={(i % 3) as 0 | 1 | 2} />
          </span>
          <span className="sh-fixture-match">
            <span className="sk-line" style={{ justifyContent: "flex-end" }}>
              <Bar w={away} h={13} delay={(i % 3) as 0 | 1 | 2} />
              <Dot size={22} delay={(i % 3) as 0 | 1 | 2} />
            </span>
            <b>
              <Bar w={42} h={26} />
            </b>
            <span className="sk-line">
              <Dot size={22} delay={((i + 1) % 3) as 0 | 1 | 2} />
              <Bar w={home} h={13} delay={((i + 1) % 3) as 0 | 1 | 2} />
            </span>
          </span>
          <span className="sh-fixture-open">
            <Bar w={16} h={16} round />
          </span>
        </div>
      ))}
    </div>
  );
}

export function SportsHotEventsSkeleton() {
  const t = useT();
  return (
    <div className="sh-skeleton" role="status" aria-label={t("Loading highlights…")}>
      <div className="hot-feature">
        <article className="hot-poster is-lead">
          <span className="sk-block" style={{ minHeight: 470, borderRadius: "13px 13px 0 0" }} />
          <div className="hot-poster-footer">
            <div className="sk-line sk-fill">
              <Dot size={26} />
              <Bar w={132} h={12} />
            </div>
            <Bar w={72} h={12} />
          </div>
        </article>
        <aside className="hot-week">
          <div>
            <Bar w={104} h={16} />
          </div>
          {[0, 1, 2, 3, 4].map((i) => (
            <article className="hot-week-item" key={i}>
              <time>
                <Bar w={24} h={20} />
                <Bar w={26} h={9} />
              </time>
              <Dot size={28} delay={(i % 3) as 0 | 1 | 2} />
              <span className="hot-week-copy">
                <Bar w={62} h={9} round />
                <Bar w={i % 2 ? 128 : 148} h={13} delay={(i % 3) as 0 | 1 | 2} />
              </span>
              <Bar w={16} h={16} round />
            </article>
          ))}
        </aside>
      </div>
      <div className="hot-section-title">
        <Bar w={128} h={17} />
        <Bar w={68} h={12} />
      </div>
      <div className="hot-grid">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <article className="hot-poster" key={i}>
            <span
              className="sk-block"
              style={{ minHeight: 350, borderRadius: "13px 13px 0 0" }}
            />
            <div className="hot-poster-footer">
              <div className="sk-line sk-fill">
                <Dot size={22} delay={(i % 3) as 0 | 1 | 2} />
                <Bar w={110} h={11} delay={(i % 3) as 0 | 1 | 2} />
              </div>
              <Bar w={58} h={11} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function SportsRailSkeleton({ label }: { label?: string }) {
  const t = useT();
  return (
    <div className="sh-skeleton" role="status" aria-label={label ?? t("Loading matches…")}>
      <div className="sh-section-head">
        <div className="sk-stack">
          <Bar w={88} h={9} round />
          <Bar w={168} h={20} />
        </div>
      </div>
      <div className="hot-grid">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`sk-block ${i ? `sk-delay-${i as 1 | 2}` : ""}`}
            style={{ minHeight: 168 }}
          />
        ))}
      </div>
    </div>
  );
}

/** Eager route fallback: its layout must work before the event bundle's CSS loads. */
export function SportsEventSkeleton({
  shellBackAvailable = false,
}: {
  shellBackAvailable?: boolean;
}) {
  const t = useT();
  const { goBack } = useView();
  return (
    <main className="sh-event-skeleton-page">
      <header className="sh-event-skeleton-header">
        {!shellBackAvailable && (
          <button className="sh-event-skeleton-back" onClick={goBack}>
            <ArrowLeft size={18} aria-hidden="true" />
            {t("Back")}
          </button>
        )}
        <span aria-hidden="true">
          <Bar w={92} h={16} />
        </span>
      </header>
      <div className="sh-skeleton" role="status" aria-label={t("Loading match details…")}>
        <div aria-hidden="true">
          <div className="sh-event-skeleton-scoreboard">
            <div className="sh-event-skeleton-competitor">
              <Dot size={120} />
              <Bar w="80%" h={26} />
              <Bar w="55%" h={34} />
            </div>
            <div className="sh-event-skeleton-score">
              <Bar w="65%" h={10} />
              <Bar w="60%" h={54} />
              <Bar w="90%" h={12} />
            </div>
            <div className="sh-event-skeleton-competitor">
              <Dot size={120} delay={1} />
              <Bar w="80%" h={26} delay={1} />
              <Bar w="55%" h={34} delay={1} />
            </div>
          </div>
          <div className="sh-event-skeleton-action">
            <Bar w={138} h={44} />
          </div>
          <div className="sh-event-skeleton-watch">
            <div className="sh-event-skeleton-watch-head">
              <div className="sk-stack sk-fill">
                <Bar w="min(220px, 90%)" h={20} />
                <Bar w="min(390px, 95%)" h={13} delay={1} />
              </div>
              <Bar w={184} h={46} />
            </div>
            <div className="sh-event-skeleton-options">
              <Bar w={170} h={42} />
              <Bar w={150} h={42} delay={1} />
              <Bar w={130} h={42} delay={2} />
            </div>
            <div className="sh-event-skeleton-sources sk-stack">
              <Bar w={156} h={18} />
              <Bar w="min(310px, 85%)" h={12} delay={1} />
              <Bar w="100%" h={38} delay={2} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export function SportsMatchDetailsSkeleton() {
  const t = useT();
  return (
    <div className="sh-skeleton" role="status" aria-label={t("Loading match details…")}>
      <div className="sh-event-skeleton-details" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div className="sh-event-skeleton-detail-row" key={i}>
            <Bar w="65%" h={14} delay={(i % 3) as 0 | 1 | 2} />
            <Bar w="80%" h={11} delay={(i % 3) as 0 | 1 | 2} />
            <Bar w="65%" h={14} delay={(i % 3) as 0 | 1 | 2} />
          </div>
        ))}
      </div>
    </div>
  );
}
