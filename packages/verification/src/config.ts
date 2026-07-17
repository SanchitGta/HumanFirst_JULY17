import type { HcsConfig } from "./types";

// This spec's own calibrated defaults (no PRD.md/IMPLEMENTATION_PLAN.md present in the
// project to transcribe from) — every value is env-overridable per US-3.3 specifically so
// they can be recalibrated later without a code change.
export const DEFAULT_HCS_CONFIG: HcsConfig = {
  pasteViolationPenaltyPerCount: 8,
  pasteViolationPenaltyCap: 100,
  superhumanWpmThreshold: 120,
  superhumanWpmPenaltyPerWpmOver: 2,
  superhumanWpmPenaltyCap: 40,
  minCharsForBackspaceCheck: 200,
  nearZeroBackspaceRatioThreshold: 0.02,
  nearZeroBackspacePenalty: 15,
  minIntervalsForCadenceCheck: 30,
  uniformCadenceCvThreshold: 0.15,
  uniformCadencePenalty: 15,
  multiSessionBonusPerExtraSession: 3,
  multiSessionBonusCap: 10,
};

const HCS_ENV_VAR_BY_CONFIG_KEY: Record<keyof HcsConfig, string> = {
  pasteViolationPenaltyPerCount: "HCS_PASTE_VIOLATION_PENALTY_PER_COUNT",
  pasteViolationPenaltyCap: "HCS_PASTE_VIOLATION_PENALTY_CAP",
  superhumanWpmThreshold: "HCS_SUPERHUMAN_WPM_THRESHOLD",
  superhumanWpmPenaltyPerWpmOver: "HCS_SUPERHUMAN_WPM_PENALTY_PER_WPM_OVER",
  superhumanWpmPenaltyCap: "HCS_SUPERHUMAN_WPM_PENALTY_CAP",
  minCharsForBackspaceCheck: "HCS_MIN_CHARS_FOR_BACKSPACE_CHECK",
  nearZeroBackspaceRatioThreshold: "HCS_NEAR_ZERO_BACKSPACE_RATIO_THRESHOLD",
  nearZeroBackspacePenalty: "HCS_NEAR_ZERO_BACKSPACE_PENALTY",
  minIntervalsForCadenceCheck: "HCS_MIN_INTERVALS_FOR_CADENCE_CHECK",
  uniformCadenceCvThreshold: "HCS_UNIFORM_CADENCE_CV_THRESHOLD",
  uniformCadencePenalty: "HCS_UNIFORM_CADENCE_PENALTY",
  multiSessionBonusPerExtraSession: "HCS_MULTI_SESSION_BONUS_PER_EXTRA_SESSION",
  multiSessionBonusCap: "HCS_MULTI_SESSION_BONUS_CAP",
};

export function getHcsConfig(): HcsConfig {
  const config = {} as HcsConfig;
  for (const key of Object.keys(DEFAULT_HCS_CONFIG) as (keyof HcsConfig)[]) {
    const raw = process.env[HCS_ENV_VAR_BY_CONFIG_KEY[key]];
    const parsed = raw !== undefined ? Number(raw) : NaN;
    config[key] = Number.isFinite(parsed) ? parsed : DEFAULT_HCS_CONFIG[key];
  }
  return config;
}
