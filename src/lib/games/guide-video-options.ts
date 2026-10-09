export type GuideVideoSort = "popular" | "newest" | "relevance";
export type GuideVideoDate = "year" | "month" | "week" | "all";
export function guideVideoFilter(sort: GuideVideoSort, date: GuideVideoDate, live: boolean) {
  // YouTube's public search filter protobuf: order + upload window/type or Live.
  const order = sort === "popular" ? 3 : sort === "newest" ? 2 : 0;
  const filters = live ? [64,1] : [...(date === "all" ? [] : [8,{year:5,month:4,week:3}[date]]),16,1];
  const bytes = [8,order,18,filters.length,...filters];
  return btoa(String.fromCharCode(...bytes));
}
/** English provider age labels retain their display text; this value only ranks cards. */
export function guideVideoAge(label = ""): number {
  const match=label.toLowerCase().match(/(\d+)\s*(seconds?|secs?|s|minutes?|mins?|hours?|hrs?|h|days?|d|weeks?|w|months?|mo|years?|y)\s+ago/);
  if(!match)return /just now/i.test(label)?0:Number.POSITIVE_INFINITY;
  const unit=match[2],scale=/^(month|mo)/.test(unit)?30*86400:/^(year|y)/.test(unit)?365*86400:/^(week|w)/.test(unit)?7*86400:/^(day|d)/.test(unit)?86400:/^(hour|hr|h)/.test(unit)?3600:/^(min)/.test(unit)?60:1;
  return Number(match[1])*scale;
}
