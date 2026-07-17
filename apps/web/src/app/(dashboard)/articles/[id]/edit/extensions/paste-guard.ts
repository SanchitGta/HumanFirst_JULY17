import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";

export interface PasteGuardOptions {
  onViolation: () => void;
}

function hasImageFile(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false;
  return Array.from(dataTransfer.files ?? []).some((file) => file.type.startsWith("image/"));
}

function hasTextPayload(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false;
  return Array.from(dataTransfer.types).some((type) => type === "text/plain" || type === "text/html");
}

// DOM-level blocking of paste/drop/dragover on the ProseMirror view (US-2.2). The Ctrl/Cmd+V
// capture-phase keydown listener is intentionally NOT here — it lives in Editor.tsx as a
// window-level listener, because it must fire before focus/target routing inside ProseMirror.
export const PasteGuard = Extension.create<PasteGuardOptions>({
  name: "pasteGuard",

  addOptions() {
    return { onViolation: () => {} };
  },

  addProseMirrorPlugins() {
    const { onViolation } = this.options;

    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            paste(_view, event) {
              event.preventDefault();
              event.stopPropagation();
              onViolation();
              return true;
            },
            drop(_view, event) {
              const dataTransfer = (event as DragEvent).dataTransfer;
              if (hasTextPayload(dataTransfer) && !hasImageFile(dataTransfer)) {
                event.preventDefault();
                event.stopPropagation();
                onViolation();
                return true;
              }
              return false;
            },
            dragover(_view, event) {
              const dataTransfer = (event as DragEvent).dataTransfer;
              if (hasTextPayload(dataTransfer) && !hasImageFile(dataTransfer)) {
                event.preventDefault();
                return true;
              }
              return false;
            },
          },
        },
      }),
    ];
  },
});
