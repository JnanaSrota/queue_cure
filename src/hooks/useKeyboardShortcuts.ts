import { useEffect, useRef } from "react";

interface ShortcutHandlers {
  onCallNext?: () => void;
  onSkip?: () => void;
  onFocusSearch?: () => void;
  onEscape?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers, enabled = true) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      if (e.key === "Escape") {
        handlersRef.current.onEscape?.();
        return;
      }

      if (isTyping) return;

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        handlersRef.current.onCallNext?.();
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        handlersRef.current.onSkip?.();
      } else if (e.key === "/") {
        e.preventDefault();
        handlersRef.current.onFocusSearch?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
