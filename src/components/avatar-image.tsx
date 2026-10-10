import { useEffect, useState } from "react";
import { DefaultAvatar } from "@/components/icons/default-avatar";

export function AvatarImage({
  src,
  seed,
  className,
}: {
  src?: string | null;
  seed?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) return <DefaultAvatar seed={seed} className={className} />;

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
