export function TopTenRibbon({ side }: { side: "left" | "right" }) {
  return (
    <img
      src={side === "left" ? "/toptabl.png" : "/toptabr.png"}
      alt="Top 10"
      draggable={false}
      className={`pointer-events-none absolute top-0 z-20 w-[17%] max-w-[36px] select-none drop-shadow-[0_3px_7px_rgba(0,0,0,0.45)] ${
        side === "left" ? "start-1" : "end-1"
      }`}
    />
  );
}
