import { CastIcon } from "@/components/player/cast-icon";
import type { CastDeviceInfo } from "@/lib/cast";

export function CastingOverlay({
  device,
  title,
  poster,
  playing,
  connecting,
}: {
  device: CastDeviceInfo;
  title?: string;
  poster?: string | null;
  playing: boolean;
  connecting?: boolean;
}) {
  const label = connecting ? "Connecting to" : playing ? "Casting to" : "Paused on";
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex animate-[harbor-cast-in_240ms_ease-out] items-center justify-center bg-canvas">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-canvas via-canvas to-canvas/95" />
      {poster && (
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage: `url(${poster})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(60px) saturate(1.4)",
          }}
        />
      )}
      <div className="relative z-10 flex flex-col items-center gap-10 px-10 text-center">
        <div className="relative flex h-32 w-32 items-center justify-center">
          <span
            className="absolute inset-0 rounded-[28px] bg-accent/20 blur-2xl"
            style={{ animation: "harbor-cast-pulse 2.6s ease-in-out infinite" }}
          />
          <span className="relative flex h-32 w-32 items-center justify-center rounded-[28px] border border-edge bg-elevated/85 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] backdrop-blur-xl">
            <CastIcon device={device} size={64} />
          </span>
          {connecting && (
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2">
              <span className="flex gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-accent"
                  style={{ animation: "harbor-cast-dot 1.2s ease-in-out 0s infinite" }}
                />
                <span
                  className="h-1.5 w-1.5 rounded-full bg-accent"
                  style={{ animation: "harbor-cast-dot 1.2s ease-in-out 0.18s infinite" }}
                />
                <span
                  className="h-1.5 w-1.5 rounded-full bg-accent"
                  style={{ animation: "harbor-cast-dot 1.2s ease-in-out 0.36s infinite" }}
                />
              </span>
            </span>
          )}
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-ink-subtle">
            {label}
          </span>
          <span
            className="text-[28px] font-semibold leading-tight text-ink"
            style={{ fontFamily: "Fraunces, serif" }}
          >
            {device.name}
          </span>
          {title && !connecting && (
            <span className="mt-3 max-w-[28rem] truncate text-[14px] font-medium text-ink-muted">
              {title}
            </span>
          )}
        </div>
      </div>
      <style>{`
        @keyframes harbor-cast-pulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.08); }
        }
        @keyframes harbor-cast-dot {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes harbor-cast-in {
          from { opacity: 0; transform: scale(0.985); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
