"use client";

import { useEffect, type RefObject } from "react";

interface FocusTrapOptions {
  open: boolean;
  containerRef: RefObject<HTMLElement | null>;
  closeRef: RefObject<HTMLButtonElement | null>;
  triggerRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
}

// 抽屉式对话框的焦点圈定：打开时移焦到面板内、Tab 在面板内循环、Escape 关闭、
// 关闭后把焦点归还给打开前的元素（拿不到时退回触发按钮）
export function useFocusTrap({ open, containerRef, closeRef, triggerRef, onClose }: FocusTrapOptions) {
  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : triggerRef?.current ?? null;
    const drawer = containerRef.current;
    requestAnimationFrame(() => closeRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !drawer) return;

      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute("inert"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [open, containerRef, closeRef, triggerRef, onClose]);
}
