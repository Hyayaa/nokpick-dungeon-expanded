import { GameState, Point } from "../game/types";
import { CompanionVisualDefinition } from "./companion-visuals";
import { TILE_SIZE, VIEW_HEIGHT, VIEW_WIDTH } from "./render";

export const ENTITY_SPRITE_SCALE = 3;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

export const clampCamera = (
  camera: Point,
  zoom: number,
  state: Pick<GameState, "width" | "height">,
) => {
  const clampAxis = (value: number, worldSize: number, viewSize: number) => {
    const visibleWorldSize = viewSize / zoom;
    const overscroll = Math.max(
      TILE_SIZE * 6,
      Math.min(visibleWorldSize * 0.75, worldSize * 0.75),
    );
    if (worldSize <= visibleWorldSize) {
      const centered = (worldSize - visibleWorldSize) / 2;
      return clamp(value, centered - overscroll, centered + overscroll);
    }
    return clamp(
      value,
      -overscroll,
      worldSize - visibleWorldSize + overscroll,
    );
  };
  return {
    x: clampAxis(camera.x, state.width * TILE_SIZE, VIEW_WIDTH),
    y: clampAxis(camera.y, state.height * TILE_SIZE, VIEW_HEIGHT),
  };
};

export const canvasPointFromClient = (
  client: Point,
  bounds: Pick<DOMRect, "left" | "top" | "width" | "height">,
) => ({
  x: ((client.x - bounds.left) / bounds.width) * VIEW_WIDTH,
  y: ((client.y - bounds.top) / bounds.height) * VIEW_HEIGHT,
});

export const tileAtCanvasPoint = (
  canvasPoint: Point,
  camera: Point,
  zoom: number,
) => ({
  x: Math.floor((camera.x + canvasPoint.x / zoom) / TILE_SIZE),
  y: Math.floor((camera.y + canvasPoint.y / zoom) / TILE_SIZE),
});

export const worldToCanvasPoint = (
  worldPoint: Point,
  camera: Point,
  zoom: number,
  shake: Point = { x: 0, y: 0 },
) => ({
  x: (worldPoint.x - camera.x) * zoom + shake.x,
  y: (worldPoint.y - camera.y) * zoom + shake.y,
});

export const companionScreenBounds = (
  position: Point,
  visual: CompanionVisualDefinition,
  camera: Point,
  zoom: number,
) => {
  const width = visual.frameWidth * ENTITY_SPRITE_SCALE * zoom;
  const height = visual.frameHeight * ENTITY_SPRITE_SCALE * zoom;
  const centerX =
    (position.x * TILE_SIZE + TILE_SIZE / 2 - camera.x) * zoom;
  const bottom =
    (position.y * TILE_SIZE + TILE_SIZE - 3 - camera.y) * zoom;
  return {
    left: centerX - width / 2,
    right: centerX + width / 2,
    top: bottom - height,
    bottom,
    width,
    height,
    centerX,
  };
};
