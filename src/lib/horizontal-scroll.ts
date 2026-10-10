/** Logical distance from the start, including RTL's negative scrollLeft range. */
export function horizontalScrollState(el: HTMLElement) {
  const rtl = getComputedStyle(el).direction === "rtl";
  const max = Math.max(0, el.scrollWidth - el.clientWidth);
  const position = Math.max(0, Math.min(max, rtl ? -el.scrollLeft : el.scrollLeft));
  return { rtl, max, position };
}
