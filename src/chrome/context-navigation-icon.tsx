import { iconComponent } from "@/views/settings/theme-panel/theme-studio/chrome-icons";
import type { NavItem } from "./nav-items";

export function ContextNavigationIcon({
  item,
  active,
  customIcon,
}: {
  item: NavItem;
  active: boolean;
  customIcon?: string;
}) {
  const Icon = customIcon ? iconComponent(customIcon) : undefined;
  if (customIcon && /^data:image\/(?:png|jpeg|webp|gif|svg\+xml)[;,]/i.test(customIcon)) {
    return <img src={customIcon} alt="" className="size-4 object-contain" />;
  }
  if (Icon) return <Icon size={16} />;
  return (
    <span aria-hidden className="relative inline-flex size-[18px] shrink-0">
      {/* Scale the complete sidebar composition, preserving nested padding and badges. */}
      <span
        className="absolute left-0 top-0 inline-flex size-[26px] origin-top-left"
        style={{ transform: `scale(${18 / 26})` }}
      >
        {item.render(active)}
      </span>
    </span>
  );
}
