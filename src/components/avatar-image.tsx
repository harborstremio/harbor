import { useEffect, useState } from "react";
import { CatAvatar } from "@/components/icons/cat-avatar";

export function AvatarImage({ src, className }: { src?: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) return <CatAvatar className={className} />;

  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
