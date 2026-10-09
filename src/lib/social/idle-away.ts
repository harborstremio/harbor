import { currentStatus, setStatus } from "@/lib/social/presence";

const IDLE_MS = 15 * 60 * 1000;
const MOVE_THROTTLE_MS = 2000;

export function startIdleAway(): () => void {
  let autoAway = false;
  let lastMove = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const goIdle = () => {
    if (currentStatus() === "online") {
      autoAway = true;
      setStatus("away");
      try {
        localStorage.setItem("harbor.presence.status", "online");
      } catch {
        void 0;
      }
    }
  };

  const arm = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(goIdle, IDLE_MS);
  };

  const onActivity = () => {
    if (autoAway && currentStatus() === "away") {
      autoAway = false;
      setStatus("online");
    }
    arm();
  };

  const onMove = () => {
    const now = Date.now();
    if (now - lastMove < MOVE_THROTTLE_MS) return;
    lastMove = now;
    onActivity();
  };

  window.addEventListener("pointerdown", onActivity, true);
  window.addEventListener("keydown", onActivity, true);
  window.addEventListener("focus", onActivity, true);
  window.addEventListener("mousemove", onMove, true);

  arm();

  return () => {
    if (timer) clearTimeout(timer);
    window.removeEventListener("pointerdown", onActivity, true);
    window.removeEventListener("keydown", onActivity, true);
    window.removeEventListener("focus", onActivity, true);
    window.removeEventListener("mousemove", onMove, true);
  };
}
