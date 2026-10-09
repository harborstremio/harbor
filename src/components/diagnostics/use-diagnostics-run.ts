import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import { collectRuntime } from "@/lib/diagnostics/collect-runtime";
import { uploadDiagnosticsBundle } from "@/lib/social/diagnostics";
import { DIAG_STEPS, type DiagError } from "./remote-support-progress";

const STEP_ADVANCE_MS = 380;
const BUNDLE_STAGE = 6;
const TRANSMIT_STAGE = 7;

type CollectResult = { tempPath: string; bytes: number };

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}

export function useDiagnosticsRun(requestId: string, ticket: string) {
  const reducedMotion = prefersReducedMotion();
  const [stage, setStage] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<DiagError | null>(null);
  const stageRef = useRef(0);
  const runningRef = useRef(false);

  const advance = useCallback((s: number) => {
    stageRef.current = s;
    setStage(s);
  }, []);

  const run = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setError(null);
    setDone(false);
    advance(0);
    try {
      const runtimeText = collectRuntime();
      const collectP = invoke<CollectResult>("diagnostics_collect", {
        input: { requestId, ticket, runtimeText },
      });
      const step = reducedMotion ? 0 : STEP_ADVANCE_MS;
      for (let s = 0; s < BUNDLE_STAGE; s++) {
        advance(s);
        if (step) await delay(step);
      }
      advance(BUNDLE_STAGE);
      const { tempPath } = await collectP;
      advance(TRANSMIT_STAGE);
      const bytes = await readFile(tempPath);
      await uploadDiagnosticsBundle(requestId, bytes);
      void invoke("diagnostics_cleanup", { tempPath }).catch(() => {});
      advance(DIAG_STEPS.length);
      setDone(true);
    } catch (e) {
      setError({ stage: stageRef.current, message: e instanceof Error ? e.message : String(e) });
    } finally {
      runningRef.current = false;
    }
  }, [requestId, ticket, reducedMotion, advance]);

  useEffect(() => {
    void run();
  }, [run]);

  return { stage, done, error, reducedMotion, retry: run };
}
