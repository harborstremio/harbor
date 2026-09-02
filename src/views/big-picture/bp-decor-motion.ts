import { isAndroidTv } from "@/lib/platform";
import { useReducedMotion } from "@/lib/use-reduced-motion";

// Measured on a Fire TV Stick 4K Max: that WebView does not composite transform
// animations, so a drift that never ends is a full main-thread paint every frame.
// Toggling one 10x10px transform took MessageChannel throughput from 19025 ticks
// per two seconds to 4104, and toggling the real bp-kenburns took the arrow keydown
// handler from a 15.6ms median to 39.1ms. Kind matters more than count: an opacity
// animation lands about halfway (7481 ticks) and going from one transform to
// thirty-two cost almost nothing more, so gating the two or three transforms is
// what pays, not counting them.
//
// Gate on isAndroidTv, not isAndroid: only the stick's WebView was measured, and a
// native Android handheld very likely composites these fine.
export function useBpDecorMotion(): boolean {
  const reduce = useReducedMotion();
  return !reduce && !isAndroidTv();
}
