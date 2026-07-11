import { Settings as SettingsLucide } from "lucide-react";

export function SettingsIcon({ active = false }: { active?: boolean }) {
  return (
    <span className={`inline-flex h-[26px] w-[26px] items-center justify-center ${active ? "animate-gear-spin" : ""}`}>
      <SettingsLucide size={26} strokeWidth={1.75} />
    </span>
  );
}
