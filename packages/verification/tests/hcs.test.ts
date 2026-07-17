import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { computeHumanConfidenceScore } from "../src/hcs";
import { DEFAULT_HCS_CONFIG, getHcsConfig } from "../src/config";
import type { TypingAnalyticsSnapshot } from "../src/types";

// "Clean" baseline: zero violations, WPM exactly at threshold (no penalty), backspace ratio
// healthy, cadence variable enough to avoid the uniform-cadence penalty, one session (no bonus).
// activeTypingMs=60000 (1 min), charsTypedNet=600 -> wpm = (600/5)/(60000/60000) = 120.
const BASELINE: TypingAnalyticsSnapshot = {
  charsTypedNet: 600,
  charsTypedGross: 600,
  backspaceCount: 20, // 20/600 = 0.0333 > 0.02 threshold -> healthy, no penalty
  pasteViolationCount: 0,
  activeTypingMs: 60000,
  sessionCount: 1,
  keystrokeIntervalCount: 30,
  keystrokeIntervalMeanMs: 200,
  keystrokeIntervalM2: 75000, // variance=2500, stdDev=50, CV=0.25 > 0.15 threshold -> no penalty
};

function snapshot(overrides: Partial<TypingAnalyticsSnapshot>): TypingAnalyticsSnapshot {
  return { ...BASELINE, ...overrides };
}

describe("computeHumanConfidenceScore", () => {
  it("baseline clean snapshot scores 100", () => {
    const result = computeHumanConfidenceScore(BASELINE, DEFAULT_HCS_CONFIG);
    expect(result.score).toBe(100);
    expect(result.breakdown.pasteViolationPenalty).toBe(0);
    expect(result.breakdown.superhumanWpmPenalty).toBe(0);
    expect(result.breakdown.nearZeroBackspacePenalty).toBe(0);
    expect(result.breakdown.uniformCadencePenalty).toBe(0);
    expect(result.breakdown.multiSessionBonus).toBe(0);
  });

  it("zero-activity snapshot: no div-by-zero, all checks skipped, score 100", () => {
    const allZero: TypingAnalyticsSnapshot = {
      charsTypedNet: 0,
      charsTypedGross: 0,
      backspaceCount: 0,
      pasteViolationCount: 0,
      activeTypingMs: 0,
      sessionCount: 0,
      keystrokeIntervalCount: 0,
      keystrokeIntervalMeanMs: 0,
      keystrokeIntervalM2: 0,
    };
    const result = computeHumanConfidenceScore(allZero, DEFAULT_HCS_CONFIG);
    expect(result.score).toBe(100);
    expect(result.breakdown.wpm).toBe(0);
    expect(result.breakdown.backspaceRatio).toBe(0);
    expect(result.breakdown.cadenceCoefficientOfVariation).toBe(0);
  });

  it("single paste violation applies one penalty unit", () => {
    const result = computeHumanConfidenceScore(
      snapshot({ pasteViolationCount: 1 }),
      DEFAULT_HCS_CONFIG,
    );
    expect(result.breakdown.pasteViolationPenalty).toBe(8);
    expect(result.score).toBe(92);
  });

  it("paste violation penalty floors the score at 0, never negative, once past its cap", () => {
    const result = computeHumanConfidenceScore(
      snapshot({ pasteViolationCount: 20 }), // 20 * 8 = 160 > cap of 100
      DEFAULT_HCS_CONFIG,
    );
    expect(result.breakdown.pasteViolationPenalty).toBe(100);
    expect(result.score).toBe(0);
  });

  it("WPM exactly at threshold is not penalized", () => {
    const result = computeHumanConfidenceScore(BASELINE, DEFAULT_HCS_CONFIG);
    expect(result.breakdown.wpm).toBe(120);
    expect(result.breakdown.superhumanWpmPenalty).toBe(0);
  });

  it("WPM one unit over threshold applies a proportional penalty", () => {
    const result = computeHumanConfidenceScore(
      snapshot({ charsTypedNet: 605 }), // wpm = (605/5)/1 = 121
      DEFAULT_HCS_CONFIG,
    );
    expect(result.breakdown.wpm).toBe(121);
    expect(result.breakdown.superhumanWpmPenalty).toBe(2);
    expect(result.score).toBe(98);
  });

  it("WPM penalty caps out for extreme superhuman speed", () => {
    const result = computeHumanConfidenceScore(
      snapshot({ charsTypedNet: 2500 }), // wpm = (2500/5)/1 = 500
      DEFAULT_HCS_CONFIG,
    );
    expect(result.breakdown.wpm).toBe(500);
    expect(result.breakdown.superhumanWpmPenalty).toBe(40);
    expect(result.score).toBe(60);
  });

  it("backspace ratio exactly at threshold boundary is not penalized (< not <=)", () => {
    const result = computeHumanConfidenceScore(
      snapshot({ charsTypedGross: 1000, backspaceCount: 20 }), // ratio = 0.02 exactly
      DEFAULT_HCS_CONFIG,
    );
    expect(result.breakdown.backspaceRatio).toBe(0.02);
    expect(result.breakdown.nearZeroBackspacePenalty).toBe(0);
  });

  it("backspace ratio just under threshold is penalized", () => {
    const result = computeHumanConfidenceScore(
      snapshot({ charsTypedGross: 1000, backspaceCount: 19 }), // ratio = 0.019 < 0.02
      DEFAULT_HCS_CONFIG,
    );
    expect(result.breakdown.nearZeroBackspacePenalty).toBe(15);
    expect(result.score).toBe(85);
  });

  it("below minCharsForBackspaceCheck is never penalized regardless of ratio", () => {
    const result = computeHumanConfidenceScore(
      snapshot({ charsTypedGross: 199, backspaceCount: 0 }), // ratio 0, but gross < 200
      DEFAULT_HCS_CONFIG,
    );
    expect(result.breakdown.nearZeroBackspacePenalty).toBe(0);
    expect(result.score).toBe(100);
  });

  it("cadence CV exactly at threshold boundary is not penalized (< not <=)", () => {
    const result = computeHumanConfidenceScore(
      snapshot({
        keystrokeIntervalCount: 30,
        keystrokeIntervalMeanMs: 100,
        keystrokeIntervalM2: 6750, // variance=225, stdDev=15, CV=0.15 exactly
      }),
      DEFAULT_HCS_CONFIG,
    );
    expect(result.breakdown.cadenceCoefficientOfVariation).toBe(0.15);
    expect(result.breakdown.uniformCadencePenalty).toBe(0);
  });

  it("cadence CV just under threshold is penalized (uniform typing)", () => {
    const result = computeHumanConfidenceScore(
      snapshot({
        keystrokeIntervalCount: 30,
        keystrokeIntervalMeanMs: 100,
        keystrokeIntervalM2: 6660.3, // variance=222.01, stdDev=14.9, CV=0.149 < 0.15
      }),
      DEFAULT_HCS_CONFIG,
    );
    expect(result.breakdown.uniformCadencePenalty).toBe(15);
    expect(result.score).toBe(85);
  });

  it("below minIntervalsForCadenceCheck is never penalized regardless of CV", () => {
    const result = computeHumanConfidenceScore(
      snapshot({
        keystrokeIntervalCount: 29, // < 30
        keystrokeIntervalMeanMs: 100,
        keystrokeIntervalM2: 25, // variance=25/29, tiny CV, would penalize if check applied
      }),
      DEFAULT_HCS_CONFIG,
    );
    expect(result.breakdown.uniformCadencePenalty).toBe(0);
    expect(result.score).toBe(100);
  });

  it("sessionCount of 1 gives no multi-session bonus", () => {
    const result = computeHumanConfidenceScore(snapshot({ sessionCount: 1 }), DEFAULT_HCS_CONFIG);
    expect(result.breakdown.multiSessionBonus).toBe(0);
  });

  it("sessionCount of 2 gives one extra-session bonus increment", () => {
    // Combine with a fixed penalty so the bonus's effect is visible in the clamped score too.
    const result = computeHumanConfidenceScore(
      snapshot({ pasteViolationCount: 1, sessionCount: 2 }),
      DEFAULT_HCS_CONFIG,
    );
    expect(result.breakdown.multiSessionBonus).toBe(3);
    expect(result.score).toBe(95); // 100 - 8 + 3
  });

  it("multi-session bonus caps out for a large session count", () => {
    const result = computeHumanConfidenceScore(
      snapshot({ pasteViolationCount: 1, sessionCount: 10 }), // extra=9, 9*3=27 > cap 10
      DEFAULT_HCS_CONFIG,
    );
    expect(result.breakdown.multiSessionBonus).toBe(10);
    expect(result.score).toBe(100); // 100 - 8 + 10 = 102, clamped to 100
  });

  it("all penalties stacked simultaneously clamp the score at 0, not negative", () => {
    const result = computeHumanConfidenceScore(
      {
        charsTypedNet: 5000, // extreme wpm
        charsTypedGross: 5000,
        backspaceCount: 0, // near-zero backspace ratio
        pasteViolationCount: 50, // past paste cap
        activeTypingMs: 60000,
        sessionCount: 1, // no bonus to offset
        keystrokeIntervalCount: 100,
        keystrokeIntervalMeanMs: 100,
        keystrokeIntervalM2: 1, // near-zero variance -> uniform cadence
      },
      DEFAULT_HCS_CONFIG,
    );
    expect(result.breakdown.pasteViolationPenalty).toBe(100);
    expect(result.breakdown.superhumanWpmPenalty).toBe(40);
    expect(result.breakdown.nearZeroBackspacePenalty).toBe(15);
    expect(result.breakdown.uniformCadencePenalty).toBe(15);
    expect(result.score).toBe(0);
  });
});

describe("getHcsConfig", () => {
  const OVERRIDDEN_ENV_VAR = "HCS_PASTE_VIOLATION_PENALTY_PER_COUNT";

  beforeEach(() => {
    delete process.env[OVERRIDDEN_ENV_VAR];
  });

  afterEach(() => {
    delete process.env[OVERRIDDEN_ENV_VAR];
  });

  it("reflects a set env var override", () => {
    process.env[OVERRIDDEN_ENV_VAR] = "25";
    const config = getHcsConfig();
    expect(config.pasteViolationPenaltyPerCount).toBe(25);
  });

  it("falls back to defaults for every unset env var", () => {
    const config = getHcsConfig();
    expect(config).toEqual(DEFAULT_HCS_CONFIG);
  });
});
