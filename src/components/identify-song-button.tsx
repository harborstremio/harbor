import { Tooltip } from "@/components/player/transport/tooltip";
import { useSettings } from "@/lib/settings";
import { identifyNowPlaying } from "@/lib/song-id";
import { AudioLines } from "lucide-react";
import { useState } from "react";

export function IdentifySongButton({
  className,
  tight,
  editing,
}: {
  className?: string;
  tight?: boolean;
  editing?: boolean;
}) {
  const { settings } = useSettings();
  const [pending, setPending] = useState(false);

  if (!settings.songIdEnabled && !editing) return null;

  const onClick = async () => {
    if (pending) return;
    setPending(true);
    try {
      await identifyNowPlaying(settings.auddKey ?? "");
    } finally {
      setPending(false);
    }
  };

  return (
    <Tooltip label="Identify song">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-label="Identify song"
        className={
          className ??
          "pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full text-white/90 transition hover:bg-white/15 disabled:opacity-50"
        }
      >
        <AudioLines size={tight ? 18 : 22} strokeWidth={1.9} className={pending ? "animate-pulse" : undefined} />
      </button>
    </Tooltip>
  );
}
