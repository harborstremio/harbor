import { Pause, Play, X } from "lucide-react";

export function DownloadPauseResumeIcon({ paused, size }: { paused: boolean; size: number }) {
  return (
    <span
      className="download-pause-resume-icon"
      data-state={paused ? "paused" : "downloading"}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Pause
        size={size}
        strokeWidth={2.2}
        data-icon="pause"
        className="download-pause-resume-glyph"
      />
      <Play
        size={size}
        strokeWidth={2.2}
        fill="currentColor"
        data-icon="resume"
        className="download-pause-resume-glyph"
      />
    </span>
  );
}

export function DownloadCancelIcon({ size }: { size: number }) {
  return <X size={size} strokeWidth={2.2} className="download-cancel-icon" aria-hidden="true" />;
}
