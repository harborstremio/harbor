import { useEffect, useState } from "react";
import { screensaverMediaSrc } from "@/lib/screensaver/media";
import type { ScreensaverMedia } from "@/lib/settings/types";

export function CustomMediaOverlay({
  media,
  visible,
  onDismiss,
  onFail,
}: {
  media: ScreensaverMedia;
  visible: boolean;
  onDismiss: () => void;
  onFail: () => void;
}) {
  const [ready, setReady] = useState(false);
  const src = screensaverMediaSrc(media.path);

  useEffect(() => {
    setReady(false);
  }, [src]);

  return (
    <div
      role="presentation"
      aria-hidden
      onPointerDown={(e) => {
        e.preventDefault();
        onDismiss();
      }}
      className="fixed inset-0 z-[200] cursor-none select-none overflow-hidden bg-black"
      style={{
        opacity: visible && ready ? 1 : 0,
        transition: `opacity ${visible ? 900 : 420}ms ease-out`,
        willChange: "opacity",
      }}
    >
      {media.kind === "video" ? (
        <video
          key={src}
          ref={(el) => {
            if (el) el.muted = true;
          }}
          src={src}
          autoPlay
          loop
          muted
          playsInline
          disablePictureInPicture
          onCanPlay={() => setReady(true)}
          onError={onFail}
          className="h-full w-full object-cover"
        />
      ) : (
        <img
          key={src}
          src={src}
          alt=""
          draggable={false}
          onLoad={() => setReady(true)}
          onError={onFail}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}
