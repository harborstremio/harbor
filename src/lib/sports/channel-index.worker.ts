import { buildSportsChannelIndex } from "./iptv-match";
import type { IptvChannel } from "../iptv/types";

self.onmessage = (event: MessageEvent<IptvChannel[]>) => {
  const index = buildSportsChannelIndex(event.data);
  self.postMessage(index.channels);
};
