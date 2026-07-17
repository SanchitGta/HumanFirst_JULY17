// Pure, framework-agnostic typing-capture logic. The Tiptap extensions are thin wrappers
// over these functions.

export const RING_BUFFER_CAPACITY = 20;
export const BATCH_INSERT_CHAR_THRESHOLD = 12;
export const BATCH_INSERT_WINDOW_MS = 300;
// A gap between keystrokes longer than this is treated as "away from keyboard" and is not
// counted toward activeTypingMs or cadence stats.
export const ACTIVE_GAP_THRESHOLD_MS = 5000;

export interface KeystrokeRingBuffer {
  items: number[];
  capacity: number;
}

export function createKeystrokeRingBuffer(capacity = RING_BUFFER_CAPACITY): KeystrokeRingBuffer {
  return { items: [], capacity };
}

export function recordKeystroke(buffer: KeystrokeRingBuffer, timestampMs: number): void {
  buffer.items.push(timestampMs);
  if (buffer.items.length > buffer.capacity) {
    buffer.items.shift();
  }
}

export function mostRecentKeystrokeAt(buffer: KeystrokeRingBuffer): number | undefined {
  return buffer.items[buffer.items.length - 1];
}

// True iff more than BATCH_INSERT_CHAR_THRESHOLD characters landed in one transaction with no
// matching keystroke in the preceding BATCH_INSERT_WINDOW_MS (exactly-12 does not trigger).
export function isSuspiciousBatchInsert(
  buffer: KeystrokeRingBuffer,
  insertedCharCount: number,
  nowMs: number,
): boolean {
  if (insertedCharCount <= BATCH_INSERT_CHAR_THRESHOLD) {
    return false;
  }
  const lastKeystrokeAt = mostRecentKeystrokeAt(buffer);
  return lastKeystrokeAt === undefined || nowMs - lastKeystrokeAt > BATCH_INSERT_WINDOW_MS;
}

export interface DeltaAccumulator {
  charsTypedNet: number;
  charsTypedGross: number;
  backspaceCount: number;
  pasteViolationCount: number;
  activeTypingMs: number;
  intervalCount: number;
  intervalSum: number;
  intervalSumSq: number;
}

export function createDeltaAccumulator(): DeltaAccumulator {
  return {
    charsTypedNet: 0,
    charsTypedGross: 0,
    backspaceCount: 0,
    pasteViolationCount: 0,
    activeTypingMs: 0,
    intervalCount: 0,
    intervalSum: 0,
    intervalSumSq: 0,
  };
}

export function recordTransactionDelta(acc: DeltaAccumulator, netDelta: number, grossDelta: number): void {
  acc.charsTypedNet += netDelta;
  acc.charsTypedGross += grossDelta;
}

export function recordBackspaceKeydown(acc: DeltaAccumulator): void {
  acc.backspaceCount += 1;
}

export function recordPasteViolation(acc: DeltaAccumulator): void {
  acc.pasteViolationCount += 1;
}

export function recordKeystrokeGap(acc: DeltaAccumulator, gapMs: number): void {
  if (gapMs >= ACTIVE_GAP_THRESHOLD_MS) {
    return;
  }
  acc.activeTypingMs += gapMs;
  acc.intervalCount += 1;
  acc.intervalSum += gapMs;
  acc.intervalSumSq += gapMs * gapMs;
}

export function hasPendingChanges(acc: DeltaAccumulator): boolean {
  return (
    acc.charsTypedNet !== 0 ||
    acc.charsTypedGross !== 0 ||
    acc.backspaceCount !== 0 ||
    acc.pasteViolationCount !== 0 ||
    acc.activeTypingMs !== 0 ||
    acc.intervalCount !== 0 ||
    acc.intervalSum !== 0 ||
    acc.intervalSumSq !== 0
  );
}

export function resetDeltaAccumulator(acc: DeltaAccumulator): void {
  acc.charsTypedNet = 0;
  acc.charsTypedGross = 0;
  acc.backspaceCount = 0;
  acc.pasteViolationCount = 0;
  acc.activeTypingMs = 0;
  acc.intervalCount = 0;
  acc.intervalSum = 0;
  acc.intervalSumSq = 0;
}

export interface IntervalStats {
  count: number;
  meanMs: number;
  m2: number;
}

export interface IntervalBatch {
  count: number;
  sum: number;
  sumSq: number;
}

// Parallel Welford combine (Chan et al.) — merges a batch of raw interval sum/sumSq/count
// onto a running mean/variance aggregate in O(1), no unbounded raw-sample storage needed.
export function mergeIntervalStats(existing: IntervalStats, batch: IntervalBatch): IntervalStats {
  if (batch.count === 0) {
    return existing;
  }

  const batchMean = batch.sum / batch.count;
  const batchM2 = batch.sumSq - (batch.sum * batch.sum) / batch.count;

  if (existing.count === 0) {
    return { count: batch.count, meanMs: batchMean, m2: batchM2 };
  }

  const n = existing.count + batch.count;
  const delta = batchMean - existing.meanMs;
  const meanMs = existing.meanMs + (delta * batch.count) / n;
  const m2 = existing.m2 + batchM2 + (delta * delta * existing.count * batch.count) / n;

  return { count: n, meanMs, m2 };
}
