export type DescriptionAnchor = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type DescriptionPlacement = {
  left: number;
  top: number;
  side: "left" | "right";
};

export function placeDescriptionWindow(
  anchor: DescriptionAnchor,
  panel: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = 10,
  gap = 10,
): DescriptionPlacement {
  const roomOnRight = viewport.width - anchor.right;
  const roomOnLeft = anchor.left;
  const side =
    roomOnRight >= panel.width + gap || roomOnRight >= roomOnLeft
      ? "right"
      : "left";
  const preferredLeft =
    side === "right"
      ? anchor.right + gap
      : anchor.left - panel.width - gap;
  return {
    left: Math.max(
      margin,
      Math.min(viewport.width - panel.width - margin, preferredLeft),
    ),
    top: Math.max(
      margin,
      Math.min(viewport.height - panel.height - margin, anchor.top),
    ),
    side,
  };
}
