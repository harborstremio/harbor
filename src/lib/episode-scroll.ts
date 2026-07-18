export function scrollToDataEp(
  root: HTMLElement | null,
  episode: number,
  opts: { behavior?: ScrollBehavior; center?: boolean } = {},
) {
  let tries = 0;
  const tryScroll = () => {
    if (!root) return;
    const target = root.querySelector<HTMLElement>(`[data-ep="${episode}"]`);
    if (!target) {
      if (tries++ < 30) requestAnimationFrame(tryScroll);
      return;
    }
    if (opts.center) {
      target.scrollIntoView({
        behavior: opts.behavior ?? "auto",
        block: "center",
        inline: "center",
      });
      return;
    }
    const rootRect = root.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const offset = targetRect.top - rootRect.top + root.scrollTop - 90;
    root.scrollTo({ top: Math.max(0, offset), behavior: opts.behavior ?? "smooth" });
  };
  requestAnimationFrame(tryScroll);
}
