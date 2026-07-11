import { useState } from "react";

export function LogoOrText({
  logo,
  fallbackText,
  imgClass,
  textClass,
}: {
  logo: string | null;
  fallbackText: string;
  imgClass: string;
  textClass: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!logo || failed) {
    return <p className={textClass}>{fallbackText}</p>;
  }
  return <img src={logo} alt={fallbackText} onError={() => setFailed(true)} className={imgClass} />;
}
