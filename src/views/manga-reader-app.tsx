import { Suspense, lazy, useState } from "react";
import { HarborLoader } from "@/components/harbor-loader";
import { SettingsProvider } from "@/lib/settings";
import { MobileRemoteProvider } from "@/views/mobile/mobile-remote";
import { SheetLockProvider } from "@/views/mobile/mobile-sheet-lock";

const MangaRemote = lazy(() =>
  import("@/views/mobile/manga-remote/manga-remote").then((m) => ({ default: m.MangaRemote })),
);
const MangaLocalReader = lazy(() =>
  import("@/views/mobile/manga-read/manga-local-reader").then((m) => ({
    default: m.MangaLocalReader,
  })),
);

/**
 * Standalone phone entry for `/reader` — remote-control the desktop manga
 * flipbook, or read the current chapter on-device.
 */
export function MangaReaderApp() {
  const [local, setLocal] = useState(false);
  return (
    <SettingsProvider>
      <MobileRemoteProvider>
        <SheetLockProvider>
          <div className="absolute inset-0 z-30 flex flex-col bg-canvas">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center">
                  <HarborLoader />
                </div>
              }
            >
              {local ? (
                <MangaLocalReader onExit={() => setLocal(false)} />
              ) : (
                <MangaRemote standalone onReadHere={() => setLocal(true)} />
              )}
            </Suspense>
          </div>
        </SheetLockProvider>
      </MobileRemoteProvider>
    </SettingsProvider>
  );
}
