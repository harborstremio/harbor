import type { ImgHTMLAttributes } from "react";
import { useProxiedImageSrc } from "@/lib/remote-image-proxy";

export function CoverImg({ src, ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  const resolved = useProxiedImageSrc(src);
  return <img {...rest} src={resolved} />;
}
