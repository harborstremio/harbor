import { recordRender } from "@/lib/memory-profiler";
import { Profiler, type ReactNode } from "react";

export function ProfileBoundary({ id, children }: { id: string; children: ReactNode }) {
  return (
    <Profiler
      id={id}
      onRender={(profileId, _phase, actualDuration) => {
        recordRender(profileId, actualDuration);
      }}
    >
      {children}
    </Profiler>
  );
}
