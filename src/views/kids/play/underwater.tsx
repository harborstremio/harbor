const BUBBLES = [
  { left: 6, size: 14, delay: 0, dur: 4.2 },
  { left: 14, size: 8, delay: 1.4, dur: 3.6 },
  { left: 23, size: 18, delay: 0.6, dur: 5.0 },
  { left: 31, size: 10, delay: 2.2, dur: 4.4 },
  { left: 44, size: 15, delay: 0.2, dur: 4.8 },
  { left: 52, size: 9, delay: 1.8, dur: 3.8 },
  { left: 63, size: 20, delay: 0.9, dur: 5.4 },
  { left: 71, size: 11, delay: 2.6, dur: 4.0 },
  { left: 82, size: 16, delay: 0.4, dur: 4.6 },
  { left: 90, size: 9, delay: 1.1, dur: 3.5 },
  { left: 96, size: 13, delay: 2.0, dur: 5.2 },
];

const DRIFTERS = [
  { src: "lilbluewhale", top: 16, left: 74, w: 120, dur: 9, flip: true, op: 0.95 },
  { src: "lilwhale1", top: 64, left: 4, w: 96, dur: 11, op: 0.92 },
  { src: "liloctored", top: 30, left: 8, w: 72, dur: 8, op: 0.9 },
  { src: "lilpurpocto", top: 74, left: 86, w: 66, dur: 10, flip: true, op: 0.9 },
  { src: "lilwhitestar", top: 12, left: 38, w: 26, dur: 7, op: 0.75 },
  { src: "lilorangestar2", top: 48, left: 92, w: 30, dur: 9, op: 0.8 },
  { src: "lilpurplestar", top: 86, left: 30, w: 28, dur: 8, op: 0.75 },
  { src: "lilwhitestar2", top: 40, left: 55, w: 22, dur: 10, op: 0.65 },
];

export function UnderwaterScene() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #2a9db8 0%, #1a7d9e 26%, #10618a 52%, #0a4062 78%, #062c47 100%)",
        }}
      />
      <div
        className="absolute inset-x-0 top-0 h-[62%]"
        style={{
          background:
            "linear-gradient(115deg, transparent 12%, rgba(255,255,255,0.10) 18%, transparent 26%, transparent 38%, rgba(255,255,255,0.07) 46%, transparent 54%, transparent 68%, rgba(255,255,255,0.09) 76%, transparent 84%)",
          maskImage:
            "linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 55%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 55%, transparent 100%)",
        }}
      />
      <div className="kids-sparkles opacity-60" />
      {DRIFTERS.map((d, i) => (
        <img
          key={i}
          src={`/kids/doodles/${d.src}.png`}
          alt=""
          draggable={false}
          className="absolute"
          style={{
            top: `${d.top}%`,
            left: `${d.left}%`,
            width: `${d.w}px`,
            opacity: d.op,
            transform: d.flip ? "scaleX(-1)" : undefined,
            animation: `kids-drift ${d.dur}s ease-in-out infinite`,
            animationDelay: `${(i * 0.7) % 3}s`,
          }}
        />
      ))}
      {BUBBLES.map((b, i) => (
        <span
          key={i}
          className="absolute bottom-[-24px] rounded-full border-2 border-white/45 bg-white/10"
          style={{
            left: `${b.left}%`,
            width: `${b.size}px`,
            height: `${b.size}px`,
            animation: `kid-bubble-rise ${b.dur}s ease-in infinite`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
      <div
        className="absolute inset-x-0 bottom-0 h-[72px]"
        style={{
          background: "linear-gradient(180deg, transparent 0%, rgba(3,18,30,0.55) 100%)",
        }}
      />
      <img
        src="/kids/octofooter.svg"
        alt=""
        draggable={false}
        className="absolute bottom-0 end-2 w-[clamp(120px,14vw,220px)] opacity-90"
      />
    </div>
  );
}
