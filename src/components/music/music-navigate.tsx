import { createContext, useContext, type ReactNode } from "react";
import type { MusicTrack } from "@/lib/music/types";

type NavigateValue = {
  /** Shows everything the sources know about an artist. */
  goToArtist: (name: string, track?: MusicTrack) => void;
  /** Shows an album by name, scoped to its artist so covers of the same title do not collide. */
  goToAlbum: (album: string, artist: string) => void;
};

const noop = () => {};
const Context = createContext<NavigateValue>({ goToArtist: noop, goToAlbum: noop });

export function useMusicNavigate(): NavigateValue {
  return useContext(Context);
}

export function MusicNavigateProvider({
  value,
  children,
}: {
  value: NavigateValue;
  children: ReactNode;
}) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
