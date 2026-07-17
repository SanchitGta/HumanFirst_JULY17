import type { HcsBreakdown, HcsConfig, HcsResult, TypingAnalyticsSnapshot } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Pure, deterministic, 0-100. All five components (paste, WPM, backspace, cadence,
// multi-session) are independent and additive, so order of evaluation does not matter.
export function computeHumanConfidenceScore(
  snapshot: TypingAnalyticsSnapshot,
  config: HcsConfig,
): HcsResult {
  const wpm =
    snapshot.activeTypingMs > 0
      ? snapshot.charsTypedNet / 5 / (snapshot.activeTypingMs / 60000)
      : 0;

  const backspaceRatio =
    snapshot.charsTypedGross > 0 ? snapshot.backspaceCount / snapshot.charsTypedGross : 0;

  const cadenceStdDevMs =
    snapshot.keystrokeIntervalCount > 1
      ? Math.sqrt(snapshot.keystrokeIntervalM2 / snapshot.keystrokeIntervalCount)
      : 0;
  const cadenceCoefficientOfVariation =
    snapshot.keystrokeIntervalMeanMs > 0 ? cadenceStdDevMs / snapshot.keystrokeIntervalMeanMs : 0;

  const pasteViolationPenalty = Math.min(
    snapshot.pasteViolationCount * config.pasteViolationPenaltyPerCount,
    config.pasteViolationPenaltyCap,
  );

  const superhumanWpmPenalty =
    wpm > config.superhumanWpmThreshold
      ? Math.min(
          (wpm - config.superhumanWpmThreshold) * config.superhumanWpmPenaltyPerWpmOver,
          config.superhumanWpmPenaltyCap,
        )
      : 0;

  const nearZeroBackspacePenalty =
    snapshot.charsTypedGross >= config.minCharsForBackspaceCheck &&
    backspaceRatio < config.nearZeroBackspaceRatioThreshold
      ? config.nearZeroBackspacePenalty
      : 0;

  const uniformCadencePenalty =
    snapshot.keystrokeIntervalCount >= config.minIntervalsForCadenceCheck &&
    cadenceCoefficientOfVariation < config.uniformCadenceCvThreshold
      ? config.uniformCadencePenalty
      : 0;

  const multiSessionBonus = Math.min(
    Math.max(snapshot.sessionCount - 1, 0) * config.multiSessionBonusPerExtraSession,
    config.multiSessionBonusCap,
  );

  const rawScore =
    100 -
    pasteViolationPenalty -
    superhumanWpmPenalty -
    nearZeroBackspacePenalty -
    uniformCadencePenalty +
    multiSessionBonus;

  const breakdown: HcsBreakdown = {
    wpm,
    backspaceRatio,
    cadenceCoefficientOfVariation,
    pasteViolationPenalty,
    superhumanWpmPenalty,
    nearZeroBackspacePenalty,
    uniformCadencePenalty,
    multiSessionBonus,
  };

  return { score: Math.round(clamp(rawScore, 0, 100)), breakdown };
}
