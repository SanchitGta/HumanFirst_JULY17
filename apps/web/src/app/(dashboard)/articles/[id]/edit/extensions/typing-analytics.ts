import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import {
  createDeltaAccumulator,
  createKeystrokeRingBuffer,
  isSuspiciousBatchInsert,
  recordBackspaceKeydown,
  recordKeystroke,
  recordKeystrokeGap,
  recordPasteViolation,
  recordTransactionDelta,
  type DeltaAccumulator,
  type KeystrokeRingBuffer,
} from "@/lib/typingAnalytics";

export interface TypingAnalyticsOptions {
  onViolation: () => void;
}

export interface TypingAnalyticsStorage {
  ringBuffer: KeystrokeRingBuffer;
  accumulator: DeltaAccumulator;
  lastKeystrokeAt: number | undefined;
}

// Owns the ring buffer, the batch-insert filterTransaction, and the delta accumulator;
// exposes both via addStorage() so Editor.tsx's flush loop can read/reset them.
export const TypingAnalytics = Extension.create<TypingAnalyticsOptions, TypingAnalyticsStorage>({
  name: "typingAnalytics",

  addOptions() {
    return { onViolation: () => {} };
  },

  addStorage() {
    return {
      ringBuffer: createKeystrokeRingBuffer(),
      accumulator: createDeltaAccumulator(),
      lastKeystrokeAt: undefined,
    };
  },

  addProseMirrorPlugins() {
    const { onViolation } = this.options;
    const storage = this.storage;

    return [
      new Plugin({
        props: {
          handleKeyDown: (_view, event) => {
            const now = performance.now();
            if (event.key === "Backspace" || event.key === "Delete") {
              recordBackspaceKeydown(storage.accumulator);
              recordKeystroke(storage.ringBuffer, now);
            } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
              if (storage.lastKeystrokeAt !== undefined) {
                recordKeystrokeGap(storage.accumulator, now - storage.lastKeystrokeAt);
              }
              storage.lastKeystrokeAt = now;
              recordKeystroke(storage.ringBuffer, now);
            }
            return false;
          },
          filterTransaction: (tr, state) => {
            if (!tr.docChanged) return true;

            let insertedCharCount = 0;
            for (const step of tr.steps) {
              const slice = (step as { slice?: { content: { size: number } } }).slice;
              if (slice) insertedCharCount += slice.content.size;
            }

            const now = performance.now();
            if (isSuspiciousBatchInsert(storage.ringBuffer, insertedCharCount, now)) {
              onViolation();
              recordPasteViolation(storage.accumulator);
              return false;
            }

            const netDelta = tr.doc.textContent.length - state.doc.textContent.length;
            recordTransactionDelta(storage.accumulator, netDelta, insertedCharCount);
            return true;
          },
        },
      }),
    ];
  },
});
