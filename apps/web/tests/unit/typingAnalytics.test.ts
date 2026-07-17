import { describe, expect, it } from "vitest";
import {
  ACTIVE_GAP_THRESHOLD_MS,
  BATCH_INSERT_CHAR_THRESHOLD,
  BATCH_INSERT_WINDOW_MS,
  RING_BUFFER_CAPACITY,
  createDeltaAccumulator,
  createKeystrokeRingBuffer,
  isSuspiciousBatchInsert,
  mergeIntervalStats,
  recordKeystroke,
  recordKeystrokeGap,
  mostRecentKeystrokeAt,
} from "@/lib/typingAnalytics";

describe("keystroke ring buffer", () => {
  it("records keystrokes up to capacity", () => {
    const buffer = createKeystrokeRingBuffer(3);
    recordKeystroke(buffer, 1);
    recordKeystroke(buffer, 2);
    recordKeystroke(buffer, 3);
    expect(buffer.items).toEqual([1, 2, 3]);
  });

  it("evicts the oldest entry once at capacity", () => {
    const buffer = createKeystrokeRingBuffer(3);
    recordKeystroke(buffer, 1);
    recordKeystroke(buffer, 2);
    recordKeystroke(buffer, 3);
    recordKeystroke(buffer, 4);
    expect(buffer.items).toEqual([2, 3, 4]);
  });

  it("defaults to RING_BUFFER_CAPACITY when no capacity given", () => {
    const buffer = createKeystrokeRingBuffer();
    expect(buffer.capacity).toBe(RING_BUFFER_CAPACITY);
  });

  it("mostRecentKeystrokeAt returns the last pushed timestamp, undefined when empty", () => {
    const buffer = createKeystrokeRingBuffer();
    expect(mostRecentKeystrokeAt(buffer)).toBeUndefined();
    recordKeystroke(buffer, 100);
    recordKeystroke(buffer, 200);
    expect(mostRecentKeystrokeAt(buffer)).toBe(200);
  });
});

describe("isSuspiciousBatchInsert", () => {
  it("does not trigger at exactly the char threshold (>12, not >=12)", () => {
    const buffer = createKeystrokeRingBuffer();
    expect(isSuspiciousBatchInsert(buffer, BATCH_INSERT_CHAR_THRESHOLD, 1000)).toBe(false);
  });

  it("triggers one char over the threshold with no recent keystroke", () => {
    const buffer = createKeystrokeRingBuffer();
    expect(isSuspiciousBatchInsert(buffer, BATCH_INSERT_CHAR_THRESHOLD + 1, 1000)).toBe(true);
  });

  it("does not trigger over-threshold inserts when a keystroke happened within the window", () => {
    const buffer = createKeystrokeRingBuffer();
    recordKeystroke(buffer, 800);
    expect(isSuspiciousBatchInsert(buffer, 20, 900)).toBe(false); // gap = 100ms < 300ms
  });

  it("triggers at exactly one ms over the window boundary", () => {
    const buffer = createKeystrokeRingBuffer();
    recordKeystroke(buffer, 800);
    expect(isSuspiciousBatchInsert(buffer, 20, 800 + BATCH_INSERT_WINDOW_MS + 1)).toBe(true);
  });

  it("does not trigger at exactly the window boundary (not > not >=)", () => {
    const buffer = createKeystrokeRingBuffer();
    recordKeystroke(buffer, 800);
    expect(isSuspiciousBatchInsert(buffer, 20, 800 + BATCH_INSERT_WINDOW_MS)).toBe(false);
  });

  it("triggers when the buffer has no keystrokes at all", () => {
    const buffer = createKeystrokeRingBuffer();
    expect(isSuspiciousBatchInsert(buffer, 50, 100000)).toBe(true);
  });
});

describe("recordKeystrokeGap", () => {
  it("counts a gap under the active-gap threshold", () => {
    const acc = createDeltaAccumulator();
    recordKeystrokeGap(acc, ACTIVE_GAP_THRESHOLD_MS - 1);
    expect(acc.intervalCount).toBe(1);
    expect(acc.activeTypingMs).toBe(ACTIVE_GAP_THRESHOLD_MS - 1);
    expect(acc.intervalSum).toBe(ACTIVE_GAP_THRESHOLD_MS - 1);
    expect(acc.intervalSumSq).toBe((ACTIVE_GAP_THRESHOLD_MS - 1) ** 2);
  });

  it("drops a gap at exactly the active-gap threshold", () => {
    const acc = createDeltaAccumulator();
    recordKeystrokeGap(acc, ACTIVE_GAP_THRESHOLD_MS);
    expect(acc.intervalCount).toBe(0);
    expect(acc.activeTypingMs).toBe(0);
  });

  it("drops a gap over the active-gap threshold", () => {
    const acc = createDeltaAccumulator();
    recordKeystrokeGap(acc, ACTIVE_GAP_THRESHOLD_MS + 1000);
    expect(acc.intervalCount).toBe(0);
    expect(acc.activeTypingMs).toBe(0);
  });
});

function naiveMeanAndM2(samples: number[]): { meanMs: number; m2: number } {
  const mean = samples.reduce((sum, x) => sum + x, 0) / samples.length;
  const m2 = samples.reduce((sum, x) => sum + (x - mean) ** 2, 0);
  return { meanMs: mean, m2 };
}

describe("mergeIntervalStats", () => {
  it("returns existing unchanged when the batch is empty (idle flush, no-op)", () => {
    const existing = { count: 5, meanMs: 120, m2: 400 };
    const merged = mergeIntervalStats(existing, { count: 0, sum: 0, sumSq: 0 });
    expect(merged).toEqual(existing);
  });

  it("adopts the batch directly when existing is the first-ever batch (count 0)", () => {
    const batch = { count: 3, sum: 300, sumSq: 31000 };
    const merged = mergeIntervalStats({ count: 0, meanMs: 0, m2: 0 }, batch);
    const expectedMean = batch.sum / batch.count;
    const expectedM2 = batch.sumSq - (batch.sum * batch.sum) / batch.count;
    expect(merged.count).toBe(3);
    expect(merged.meanMs).toBeCloseTo(expectedMean);
    expect(merged.m2).toBeCloseTo(expectedM2);
  });

  it("matches a naive two-pass mean/variance over the concatenated raw sample set", () => {
    const firstBatchSamples = [100, 120, 90, 150, 80];
    const secondBatchSamples = [200, 210, 195, 205, 190, 220];

    const firstBatch = {
      count: firstBatchSamples.length,
      sum: firstBatchSamples.reduce((a, b) => a + b, 0),
      sumSq: firstBatchSamples.reduce((a, b) => a + b * b, 0),
    };
    const secondBatch = {
      count: secondBatchSamples.length,
      sum: secondBatchSamples.reduce((a, b) => a + b, 0),
      sumSq: secondBatchSamples.reduce((a, b) => a + b * b, 0),
    };

    const afterFirst = mergeIntervalStats({ count: 0, meanMs: 0, m2: 0 }, firstBatch);
    const afterSecond = mergeIntervalStats(afterFirst, secondBatch);

    const naive = naiveMeanAndM2([...firstBatchSamples, ...secondBatchSamples]);

    expect(afterSecond.count).toBe(firstBatchSamples.length + secondBatchSamples.length);
    expect(afterSecond.meanMs).toBeCloseTo(naive.meanMs, 6);
    expect(afterSecond.m2).toBeCloseTo(naive.m2, 6);
  });
});
