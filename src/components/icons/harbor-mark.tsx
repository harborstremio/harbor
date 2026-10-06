import jlMark from "@/assets/brand/jl-mark.webp";

// The app mark everywhere the shell shows one: the JL Media Vision "JL" with its star.
export function HarborMark({ className }: { className?: string }) {
  return <img src={jlMark} alt="" aria-hidden draggable={false} className={`object-contain ${className ?? ""}`} />;
}
