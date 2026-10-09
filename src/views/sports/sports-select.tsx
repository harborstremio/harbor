import { Dropdown, type DropdownOption } from "@/components/dropdown";
import "./sports-select.css";

/** Shared Harbor menu, with the compact Sports control treatment. */
export function SportsSelect({
  className = "",
  ...props
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <Dropdown
      {...props}
      size="sm"
      className={`sports-select ${className}`}
      menuClassName="sports-select-menu"
    />
  );
}
