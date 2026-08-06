import type { Point } from "../game/types";

export type TargetingOverlayMode = "skill" | "quickslot" | "throw" | "wand";

export type TargetingOverlay = {
  mode: TargetingOverlayMode;
  originActorId: string;
  suggestedTarget: Point | null;
  range: number | null;
  targetableTiles: readonly Point[] | null;
  accent: string;
};

export type TargetingOverlayViewport = {
  screenX: (worldX: number) => number;
  screenY: (worldY: number) => number;
  zoom: number;
  tileSize: number;
};

const pointKey = (point: Point) => `${point.x},${point.y}`;

export type TargetingOutlineSegment = {
  from: Point;
  to: Point;
};

/**
 * Converts a gameplay-valid tile footprint into only its exposed boundary.
 * Shared edges are omitted, so the renderer never draws a per-tile range grid.
 */
export const targetingOutlineSegments = (
  rangeTiles: readonly Point[],
): TargetingOutlineSegment[] => {
  const rangeKeys = new Set(rangeTiles.map(pointKey));
  const segments: TargetingOutlineSegment[] = [];
  for (const tile of rangeTiles) {
    if (!rangeKeys.has(`${tile.x},${tile.y - 1}`)) {
      segments.push({
        from: { x: tile.x, y: tile.y },
        to: { x: tile.x + 1, y: tile.y },
      });
    }
    if (!rangeKeys.has(`${tile.x + 1},${tile.y}`)) {
      segments.push({
        from: { x: tile.x + 1, y: tile.y },
        to: { x: tile.x + 1, y: tile.y + 1 },
      });
    }
    if (!rangeKeys.has(`${tile.x},${tile.y + 1}`)) {
      segments.push({
        from: { x: tile.x + 1, y: tile.y + 1 },
        to: { x: tile.x, y: tile.y + 1 },
      });
    }
    if (!rangeKeys.has(`${tile.x - 1},${tile.y}`)) {
      segments.push({
        from: { x: tile.x, y: tile.y + 1 },
        to: { x: tile.x, y: tile.y },
      });
    }
  }
  return segments;
};

export function drawTargetingOverlay(
  context: CanvasRenderingContext2D,
  overlay: TargetingOverlay,
  origin: Point,
  hoveredTarget: Point | null,
  now: number,
  viewport: TargetingOverlayViewport,
) {
  const { tileSize, zoom, screenX, screenY } = viewport;
  const tileScreenSize = tileSize * zoom;
  const rangeTiles = overlay.targetableTiles ?? [];
  const rangeKeys = new Set(rangeTiles.map(pointKey));
  const pulse = 0.78 + Math.sin(now / 125) * 0.18;

  context.save();
  context.imageSmoothingEnabled = false;
  if (rangeTiles.length) {
    context.strokeStyle = overlay.accent;
    context.globalAlpha = 0.72 * pulse;
    context.lineWidth = Math.max(1, Math.round(1.5 * zoom));
    context.lineCap = "square";
    context.lineJoin = "miter";
    context.beginPath();
    for (const segment of targetingOutlineSegments(rangeTiles)) {
      context.moveTo(
        Math.round(screenX(segment.from.x * tileSize)),
        Math.round(screenY(segment.from.y * tileSize)),
      );
      context.lineTo(
        Math.round(screenX(segment.to.x * tileSize)),
        Math.round(screenY(segment.to.y * tileSize)),
      );
    }
    context.stroke();
  }

  const targetCandidate = hoveredTarget ?? overlay.suggestedTarget;
  const target = targetCandidate &&
    (overlay.range === null || rangeKeys.has(pointKey(targetCandidate)))
    ? targetCandidate
    : null;
  if (target) {
    const targetLeft = screenX(target.x * tileSize);
    const targetTop = screenY(target.y * tileSize);
    const originX = screenX((origin.x + 0.5) * tileSize);
    const originY = screenY((origin.y + 0.5) * tileSize);
    context.globalAlpha = pulse;
    context.strokeStyle = overlay.accent;
    context.fillStyle = "#f4fdff";
    context.lineWidth = Math.max(1, zoom);
    context.setLineDash([
      Math.max(2, Math.round(3 * zoom)),
      Math.max(2, Math.round(2 * zoom)),
    ]);
    context.beginPath();
    context.moveTo(Math.round(originX), Math.round(originY));
    context.lineTo(
      Math.round(targetLeft + tileScreenSize / 2),
      Math.round(targetTop + tileScreenSize / 2),
    );
    context.stroke();
    context.setLineDash([]);
    context.lineWidth = Math.max(1, 2 * zoom);
    context.strokeRect(
      Math.round(targetLeft + 2 * zoom),
      Math.round(targetTop + 2 * zoom),
      Math.max(1, Math.round(tileScreenSize - 4 * zoom)),
      Math.max(1, Math.round(tileScreenSize - 4 * zoom)),
    );
    const corner = Math.max(2, Math.round(3 * zoom));
    for (const [offsetX, offsetY] of [
      [0, 0],
      [tileScreenSize - corner, 0],
      [0, tileScreenSize - corner],
      [tileScreenSize - corner, tileScreenSize - corner],
    ] as const) {
      context.fillRect(
        Math.round(targetLeft + offsetX),
        Math.round(targetTop + offsetY),
        corner,
        corner,
      );
    }
  }
  context.restore();
}
