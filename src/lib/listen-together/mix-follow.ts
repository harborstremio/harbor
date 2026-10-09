import type { MusicAudioSettingsValue } from "@/lib/music/audio-settings";
import { listenMixMatches, readListenMix, writeListenMix, type ListenMix } from "./mix-state";

export type ListenMixIo = {
  read: () => MusicAudioSettingsValue;
  write: (next: MusicAudioSettingsValue) => Promise<unknown>;
};

export type ListenMixFollower = {
  begin: () => void;
  apply: (mix: ListenMix | null) => Promise<void>;
  end: () => Promise<void>;
};

export function createListenMixFollower(io: ListenMixIo): ListenMixFollower {
  let saved: ListenMix | null = null;
  let touched = false;
  let chain: Promise<void> = Promise.resolve();

  const queue = (make: () => MusicAudioSettingsValue | null): Promise<void> => {
    chain = chain
      .then(async () => {
        const next = make();
        if (next) await io.write(next);
      })
      .catch(() => {});
    return chain;
  };

  return {
    begin() {
      if (saved === null) saved = readListenMix(io.read());
    },
    apply(mix) {
      if (!mix || saved === null) return chain;
      if (listenMixMatches(io.read(), mix)) return chain;
      touched = true;
      return queue(() => (listenMixMatches(io.read(), mix) ? null : writeListenMix(io.read(), mix)));
    },
    end() {
      const restore = saved;
      const changed = touched;
      saved = null;
      touched = false;
      if (!restore || !changed) return chain;
      return queue(() =>
        listenMixMatches(io.read(), restore) ? null : writeListenMix(io.read(), restore),
      );
    },
  };
}
