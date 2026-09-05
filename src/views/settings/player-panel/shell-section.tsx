import { PLAYER_SHELLS } from "@/lib/player-shells/registry";
import { useSettings } from "@/lib/settings";
import { ChoiceBlock } from "./choice";

export function ShellSection() {
  const { settings, update } = useSettings();
  return (
    <div className="harbor-settings-group">
      {PLAYER_SHELLS.map((shell) => (
        <ChoiceBlock
          key={shell.id}
          selected={settings.playerShellId === shell.id}
          onClick={() => update({ playerShellId: shell.id })}
          label={shell.name}
          sub={shell.description}
        />
      ))}
    </div>
  );
}
