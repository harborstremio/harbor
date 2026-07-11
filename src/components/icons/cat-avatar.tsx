import stremioDefaultAvatar from "@/assets/stremio-default-avatar.png";

export function CatAvatar({ className }: { className?: string }) {
  return <img src={stremioDefaultAvatar} alt="" draggable={false} className={`${className ?? ""} object-cover`} />;
}
