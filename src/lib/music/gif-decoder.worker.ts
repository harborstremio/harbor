import { decodeMusicGif } from "./gif-frames";

self.onmessage = (event: MessageEvent<ArrayBuffer>) => {
  try {
    const animation = decodeMusicGif(event.data);
    self.postMessage({ animation }, { transfer: animation.frames.map(frame => frame.buffer) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error && error.message === "large" ? "large" : "invalid" });
  }
};
