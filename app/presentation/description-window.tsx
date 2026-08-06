"use client";

import { CSSProperties, ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  type DescriptionAnchor,
  placeDescriptionWindow,
} from "./description-placement";

export type { DescriptionAnchor } from "./description-placement";

export const descriptionAnchorFromElement = (
  element: Element,
): DescriptionAnchor => {
  const bounds = element.getBoundingClientRect();
  return {
    left: bounds.left,
    top: bounds.top,
    right: bounds.right,
    bottom: bounds.bottom,
  };
};

export const descriptionAnchorFromPoint = (
  clientX: number,
  clientY: number,
): DescriptionAnchor => ({
  left: clientX - 4,
  top: clientY - 4,
  right: clientX + 4,
  bottom: clientY + 4,
});

const fallbackDescriptionAnchor = (): DescriptionAnchor => {
  const active =
    typeof document !== "undefined" && document.activeElement instanceof Element
      ? document.activeElement
      : null;
  if (active) return descriptionAnchorFromElement(active);
  const width = typeof window === "undefined" ? 1280 : window.innerWidth;
  const height = typeof window === "undefined" ? 720 : window.innerHeight;
  return descriptionAnchorFromPoint(width * 0.5, height * 0.42);
};

export function DescriptionWindow({
  anchor,
  className = "",
  ariaLabel,
  labelledBy,
  onClose,
  style,
  children,
}: {
  anchor?: DescriptionAnchor | null;
  className?: string;
  ariaLabel?: string;
  labelledBy?: string;
  onClose: () => void;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const resolvedAnchor = anchor ?? fallbackDescriptionAnchor();
  const [placement, setPlacement] = useState({
    left: resolvedAnchor.right + 10,
    top: resolvedAnchor.top,
    side: "right" as "left" | "right",
    ready: false,
    fontScale: "1",
  });

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const updatePlacement = () => {
      const bounds = panel.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 10;
      const resolvedPlacement = placeDescriptionWindow(
        {
          left: resolvedAnchor.left,
          top: resolvedAnchor.top,
          right: resolvedAnchor.right,
          bottom: resolvedAnchor.bottom,
        },
        bounds,
        { width: viewportWidth, height: viewportHeight },
        margin,
      );
      const centerX = Math.max(
        0,
        Math.min(
          viewportWidth - 1,
          (resolvedAnchor.left + resolvedAnchor.right) / 2,
        ),
      );
      const centerY = Math.max(
        0,
        Math.min(
          viewportHeight - 1,
          (resolvedAnchor.top + resolvedAnchor.bottom) / 2,
        ),
      );
      const sourceElement = document.elementFromPoint(centerX, centerY);
      const sourceScale = sourceElement
        ? window
            .getComputedStyle(sourceElement)
            .getPropertyValue("--font-scale")
            .trim()
        : "";
      setPlacement({
        ...resolvedPlacement,
        ready: true,
        fontScale: sourceScale || "1",
      });
    };
    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    return () => window.removeEventListener("resize", updatePlacement);
  }, [
    resolvedAnchor.bottom,
    resolvedAnchor.left,
    resolvedAnchor.right,
    resolvedAnchor.top,
  ]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="description-window-layer" role="presentation">
      <section
        ref={panelRef}
        className={`description-window ${className}`.trim()}
        data-anchor-side={placement.side}
        role="dialog"
        aria-modal="false"
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        style={
          {
            ...style,
            left: placement.left,
            top: placement.top,
            visibility: placement.ready ? "visible" : "hidden",
            "--font-scale": placement.fontScale,
          } as CSSProperties
        }
        onPointerDown={(event) => event.stopPropagation()}
      >
        {children}
      </section>
    </div>,
    document.body,
  );
}
