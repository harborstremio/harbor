/** Standard surface markings; variable venue sizes are represented schematically. */
export function VenueMarks({ sport }: { sport: string }) {
  return (
    <div className="sh-venue-marks" aria-hidden="true">
      <i className="sh-venue-boundary" />
      <i className="sh-venue-center" />
      {sport === "hockey" && (
        <>
          {[37.5, 62.5].map((x) => (
            <i key={x} className="sh-rink-blue" style={{ left: `${x}%` }} />
          ))}
          {[5.5, 94.5].map((x) => (
            <i key={x} className="sh-rink-goal-line" style={{ left: `${x}%` }} />
          ))}
          <i className="sh-rink-circle center" />
          {[15.5, 84.5].flatMap((x) =>
            [25.88, 74.12].map((y) => (
              <i
                key={`${x}:${y}`}
                className="sh-rink-circle"
                style={{ left: `${x}%`, top: `${y}%` }}
              />
            )),
          )}
          {[40, 60].flatMap((x) =>
            [25.88, 74.12].map((y) => (
              <i
                key={`${x}:${y}`}
                className="sh-rink-dot"
                style={{ left: `${x}%`, top: `${y}%` }}
              />
            )),
          )}
          {["left", "right"].map((side) => (
            <span key={side}>
              <i className={`sh-rink-goal ${side}`} />
              <i className={`sh-rink-crease ${side}`} />
            </span>
          ))}
        </>
      )}
      {sport === "tennis" && (
        <>
          <i className="sh-tennis-singles" />
          <i className="sh-tennis-service" />
          <i className="sh-tennis-center-service" />
          <i className="sh-tennis-mark left" />
          <i className="sh-tennis-mark right" />
        </>
      )}
      {sport === "rugby" && (
        <>
          {[8.333, 91.667].map((x) => (
            <i key={x} className="sh-rugby-try" style={{ left: `${x}%` }} />
          ))}
          {[26.667, 73.333].map((x) => (
            <i key={x} className="sh-rugby-22" style={{ left: `${x}%` }} />
          ))}
          {[12.5, 41.667, 58.333, 87.5].map((x) => (
            <i key={x} className="sh-rugby-dash vertical" style={{ left: `${x}%` }} />
          ))}
          {[7.143, 21.429, 78.571, 92.857].map((y) => (
            <i key={y} className="sh-rugby-dash horizontal" style={{ top: `${y}%` }} />
          ))}
          <i className="sh-venue-goal left" />
          <i className="sh-venue-goal right" />
        </>
      )}
      {sport === "cricket" && (
        <>
          <i className="sh-cricket-inner" />
          <i className="sh-cricket-pitch">
            <i className="sh-cricket-crease left" />
            <i className="sh-cricket-crease right" />
            <i className="sh-cricket-wicket left" />
            <i className="sh-cricket-wicket right" />
          </i>
        </>
      )}
      {sport === "aussie" && (
        <>
          <i className="sh-aussie-square" />
          <i className="sh-aussie-circle" />
          <i className="sh-aussie-circle inner" />
          {["left", "right"].map((side) => (
            <span key={side}>
              <i className={`sh-aussie-arc ${side}`} />
              <i className={`sh-aussie-goal-square ${side}`} />
              <i className={`sh-aussie-posts ${side}`} />
            </span>
          ))}
        </>
      )}
      {sport === "lacrosse" && (
        <>
          {[31.818, 68.182].map((x) => (
            <i key={x} className="sh-lacrosse-restrain" style={{ left: `${x}%` }} />
          ))}
          <i className="sh-lacrosse-wing top" />
          <i className="sh-lacrosse-wing bottom" />
          {["left", "right"].map((side) => (
            <span key={side}>
              <i className={`sh-lacrosse-crease ${side}`} />
              <i className={`sh-lacrosse-goal ${side}`} />
            </span>
          ))}
        </>
      )}
      {sport === "combat" && (
        <>
          <i className="sh-cage-mat" />
          <i className="sh-cage-center" />
          <i className="sh-cage-corner red" />
          <i className="sh-cage-corner blue" />
        </>
      )}
      {sport === "boxing" && (
        <>
          <i className="sh-ring-rope outer" />
          <i className="sh-ring-rope middle" />
          <i className="sh-ring-rope inner" />
          <i className="sh-ring-corner red" />
          <i className="sh-ring-corner blue" />
          <i className="sh-ring-corner neutral-a" />
          <i className="sh-ring-corner neutral-b" />
        </>
      )}
    </div>
  );
}
