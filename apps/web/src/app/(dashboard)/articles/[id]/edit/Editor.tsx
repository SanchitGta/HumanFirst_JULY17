"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { PasteGuard } from "./extensions/paste-guard";
import { TypingAnalytics } from "./extensions/typing-analytics";
import { hasPendingChanges, resetDeltaAccumulator } from "@/lib/typingAnalytics";
import { CheckScoreButton } from "./CheckScoreButton";

const FLUSH_INTERVAL_MS = 2000;
const TOAST_DURATION_MS = 3000;
const VIOLATION_MESSAGE = "HumanFirst only allows manually typed content.";

export interface EditorProps {
  articleId: string;
  initialContentJson: unknown;
  initialPasteViolationCount: number;
}

export function Editor({ articleId, initialContentJson, initialPasteViolationCount }: EditorProps) {
  const [pasteViolationCount, setPasteViolationCount] = useState(initialPasteViolationCount);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isFirstFlushRef = useRef(true);
  const isFlushingRef = useRef(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  function onViolation() {
    setPasteViolationCount((count) => count + 1);
    setToastMessage(VIOLATION_MESSAGE);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), TOAST_DURATION_MS);
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      PasteGuard.configure({ onViolation }),
      TypingAnalytics.configure({ onViolation }),
    ],
    content: initialContentJson,
    immediatelyRender: false,
  });

  useEffect(() => {
    function handleCaptureKeydown(event: KeyboardEvent) {
      if (!containerRef.current?.contains(event.target as Node)) return;
      const isPasteShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v";
      if (isPasteShortcut) {
        event.preventDefault();
        event.stopPropagation();
        onViolation();
      }
    }

    window.addEventListener("keydown", handleCaptureKeydown, true);
    return () => window.removeEventListener("keydown", handleCaptureKeydown, true);
  }, []);

  useEffect(() => {
    if (!editor) return;

    async function flush() {
      if (isFlushingRef.current || !editor) return;
      const acc = editor.storage.typingAnalytics.accumulator;
      const contentJson = editor.getJSON();
      if (!hasPendingChanges(acc) && !isFirstFlushRef.current) return;

      isFlushingRef.current = true;
      try {
        const response = await fetch(`/api/articles/${articleId}/draft`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentJson, delta: { ...acc, isNewSession: isFirstFlushRef.current } }),
        });
        if (response.ok) {
          resetDeltaAccumulator(acc);
          isFirstFlushRef.current = false;
        }
      } finally {
        isFlushingRef.current = false;
      }
    }

    const interval = setInterval(flush, FLUSH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [editor, articleId]);

  useEffect(() => {
    if (!editor) return;

    function flushOnUnload() {
      if (!editor) return;
      const acc = editor.storage.typingAnalytics.accumulator;
      const payload = {
        contentJson: editor.getJSON(),
        delta: { ...acc, isNewSession: isFirstFlushRef.current },
      };
      navigator.sendBeacon(
        `/api/articles/${articleId}/draft`,
        new Blob([JSON.stringify(payload)], { type: "application/json" }),
      );
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") flushOnUnload();
    }

    window.addEventListener("beforeunload", flushOnUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", flushOnUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [editor, articleId]);

  return (
    <div>
      <div role="toolbar">
        <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()}>
          Bold
        </button>
        <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()}>
          Italic
        </button>
        <button type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          Bullet list
        </button>
        <button type="button" onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          Ordered list
        </button>
        <button type="button" onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
          Blockquote
        </button>
        <button type="button" onClick={() => editor?.chain().focus().undo().run()}>
          Undo
        </button>
        <button type="button" onClick={() => editor?.chain().focus().redo().run()}>
          Redo
        </button>
      </div>
      <div ref={containerRef}>
        <EditorContent editor={editor} />
      </div>
      {toastMessage && <div role="alert">{toastMessage}</div>}
      <span>Paste violations: {pasteViolationCount}</span>
      <CheckScoreButton articleId={articleId} />
    </div>
  );
}
