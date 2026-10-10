/** A shared soft-square silhouette; expression remains readable without color at 18px. */
export type ReviewMood = "delighted" | "positive" | "mixed" | "negative" | "disappointed";
export const REVIEW_FACE_OUTLINE = "M12 2.75c6.2 0 9.25 3.05 9.25 9.25s-3.05 9.25-9.25 9.25S2.75 18.2 2.75 12 5.8 2.75 12 2.75Z";
export const REVIEW_FACE_FEATURES:Record<ReviewMood,string> = {
  delighted:"M7.25 9.5q1.5-1.75 3 0m3.5 0q1.5-1.75 3 0M7.5 13.25c1 4.65 8 4.65 9 0Z",
  positive:"M8.5 8.75v1.5m7-1.5v1.5M7.75 13.75q4.25 4.25 8.5 0",
  mixed:"M8.5 8.75v1.5m7-1.5v1.5M8.5 15h7",
  negative:"M8.5 8.75v1.5m7-1.5v1.5M7.75 16q4.25-4.25 8.5 0",
  disappointed:"M7.25 7.25l2.5 .75m4.5 0 2.5-.75M8.5 10.5v.4m7-.4v.4M7.75 16.5c1-4.75 7.5-4.75 8.5 0",
};
export function ReviewFace({mood,size=24,className}:{mood:ReviewMood;size?:number;className?:string}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false"><path d={REVIEW_FACE_OUTLINE}/><path d={REVIEW_FACE_FEATURES[mood]}/></svg>;
}
