// Field names/types match `DraftRevision` columns 1:1 by design, so callers can pass a
// Prisma row through with a straight property pick — no transformation layer needed.
export interface TypingAnalyticsSnapshot {
  charsTypedNet: number;
  charsTypedGross: number;
  backspaceCount: number;
  pasteViolationCount: number;
  activeTypingMs: number;
  sessionCount: number;
  keystrokeIntervalCount: number;
  keystrokeIntervalMeanMs: number;
  keystrokeIntervalM2: number;
}

export interface HcsConfig {
  pasteViolationPenaltyPerCount: number;
  pasteViolationPenaltyCap: number;
  superhumanWpmThreshold: number;
  superhumanWpmPenaltyPerWpmOver: number;
  superhumanWpmPenaltyCap: number;
  minCharsForBackspaceCheck: number;
  nearZeroBackspaceRatioThreshold: number;
  nearZeroBackspacePenalty: number;
  minIntervalsForCadenceCheck: number;
  uniformCadenceCvThreshold: number;
  uniformCadencePenalty: number;
  multiSessionBonusPerExtraSession: number;
  multiSessionBonusCap: number;
}

export interface HcsBreakdown {
  wpm: number;
  backspaceRatio: number;
  cadenceCoefficientOfVariation: number;
  pasteViolationPenalty: number;
  superhumanWpmPenalty: number;
  nearZeroBackspacePenalty: number;
  uniformCadencePenalty: number;
  multiSessionBonus: number;
}

export interface HcsResult {
  score: number;
  breakdown: HcsBreakdown;
}
