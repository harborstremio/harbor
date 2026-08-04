import { useEffect } from "react";
import { registerRemoteManga, type RemoteMangaBinding } from "./manga-session";

type Params = RemoteMangaBinding;

export function useMangaRemoteBinding(params: Params) {
  useEffect(() => {
    registerRemoteManga(params);
  }, [params]);

  useEffect(() => {
    return () => {
      registerRemoteManga(null);
    };
  }, []);
}
