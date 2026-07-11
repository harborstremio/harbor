import { useMemo } from "react";

const ORBS = 7;

type Orb = {
  x: number;
  y: number;
  size: number;
  color: string;
  blur: number;
  opacity: number;
  delay: number;
  duration: number;
};

const PALETTE = [
  "rgba(124,214,255,0.55)",
  "rgba(174,140,255,0.45)",
  "rgba(94,165,247,0.50)",
  "rgba(255,180,220,0.35)",
  "rgba(110,255,210,0.35)",
];

function seeded(i: number): number {
  const s = Math.sin(i * 99.83) * 43758.5453;
  return s - Math.floor(s);
}

export function AuroraBokeh() {
  const orbs = useMemo<Orb[]>(() => {
    return Array.from({ length: ORBS }, (_, i) => {
      const r1 = seeded(i * 3 + 1);
      const r2 = seeded(i * 3 + 2);
      const r3 = seeded(i * 3 + 3);
      const size = 180 + r1 * 220;
      return {
        x: r1 * 100,
        y: r2 * 100,
        size,
        color: PALETTE[i % PALETTE.length],
        blur: 24 + r3 * 28,
        opacity: 0.4 + r2 * 0.35,
        delay: -r1 * 30,
        duration: 28 + r3 * 24,
      };
    });
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {orbs.map((o, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: `${o.x}%`,
            top: `${o.y}%`,
            width: `${o.size}px`,
            height: `${o.size}px`,
            background: `radial-gradient(circle, ${o.color}, transparent 65%)`,
            filter: `blur(${o.blur}px)`,
            opacity: o.opacity,
            transform: "translate(-50%, -50%)",
            animation: `aurora-orb ${o.duration}s ease-in-out ${o.delay}s infinite alternate`,
            willChange: "transform",
          }}
        />
      ))}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 60% 35% at 50% 110%, rgba(255,255,255,0.05), transparent 70%)",
        }}
      />
      <style>{`
        @keyframes aurora-orb {
          0% { transform: translate(-50%, -50%) translateY(0px) scale(1); }
          50% { transform: translate(-50%, -50%) translateY(-40px) scale(1.1); }
          100% { transform: translate(-50%, -50%) translateY(20px) scale(0.95); }
        }
      `}</style>
    </div>
  );
}
