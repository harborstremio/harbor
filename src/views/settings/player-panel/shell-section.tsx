import { PLAYER_SHELLS } from "@/lib/player-shells/registry";
import { useSettings } from "@/lib/settings";

export function ShellSection() {
  const { settings, update } = useSettings();
  return (
    <div className="flex flex-col gap-2.5">
      {PLAYER_SHELLS.map((shell) => {
        const selected = settings.playerShellId === shell.id;
        return (
          <button
            key={shell.id}
            type="button"
            onClick={() => update({ playerShellId: shell.id })}
            className={`flex items-start gap-3.5 rounded-md border px-5 py-4 text-start transition-colors ${
              selected
                ? "border-ink bg-elevated"
                : "border-edge-soft bg-canvas hover:border-edge hover:bg-canvas"
            }`}
          >
            <span
              className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                selected ? "border-ink" : "border-edge"
              }`}
            >
              {selected && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[15px] font-semibold text-ink">{shell.name}</span>
              <span className="text-[12.5px] leading-snug text-ink-muted">{shell.description}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
