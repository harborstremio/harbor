import type { ComponentType } from "react";
import type { BpOnboardStepId, BpOnboardStepProps } from "../bp-onboarding-frame";
import { BpStepDone } from "./steps/bp-step-done";
import { BpStepHarbor } from "./steps/bp-step-harbor";
import { BpStepLanguage } from "./steps/bp-step-language";
import { BpStepLayout } from "./steps/bp-step-layout";
import { BpStepPhone } from "./steps/bp-step-phone";
import { BpStepStremio } from "./steps/bp-step-stremio";
import { BpStepStreaming } from "./steps/bp-step-streaming";
import { BpStepSubtitles } from "./steps/bp-step-subtitles";
import { BpStepTaste } from "./steps/bp-step-taste";
import { BpStepTmdb } from "./steps/bp-step-tmdb";

/**
 * The ten decision surfaces, for BpOnboarding's `steps` prop. Typed against
 * bp-onboarding-frame, never against bp-onboarding itself: the frame is the
 * leaf of that tree and importing the machine from a step is a require cycle.
 */
export const BP_ONBOARD_STEP_VIEWS: Record<
  BpOnboardStepId,
  ComponentType<BpOnboardStepProps>
> = {
  language: BpStepLanguage,
  phone: BpStepPhone,
  tmdb: BpStepTmdb,
  stremio: BpStepStremio,
  harbor: BpStepHarbor,
  layout: BpStepLayout,
  streaming: BpStepStreaming,
  subtitles: BpStepSubtitles,
  taste: BpStepTaste,
  done: BpStepDone,
};
