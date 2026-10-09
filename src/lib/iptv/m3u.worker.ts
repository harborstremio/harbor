import { iterateM3uChannels } from "./m3u";
import type { IptvChannel } from "./types";

let parser: Generator<IptvChannel> | null = null;
self.onmessage = (event: MessageEvent<{ text?: string; baseId?: string }>) => {
  if (event.data.text !== undefined)
    parser = iterateM3uChannels(event.data.text, event.data.baseId!);
  const channels: IptvChannel[] = [];
  while (parser && channels.length < 1024) {
    const next = parser.next();
    if (next.done) {
      parser = null;
      break;
    }
    channels.push(next.value);
  }
  self.postMessage({ channels, done: parser === null });
};
