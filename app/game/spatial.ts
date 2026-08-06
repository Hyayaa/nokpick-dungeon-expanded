import { GameState, Point } from "./types";

export const pointEquals = (a: Point, b: Point) =>
  a.x === b.x && a.y === b.y;

export const gridDistance = (a: Point, b: Point) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export const pointInBounds = (
  state: Pick<GameState, "width" | "height">,
  point: Point,
) =>
  point.x >= 0 &&
  point.x < state.width &&
  point.y >= 0 &&
  point.y < state.height;

/**
 * Known tiles remain selectable, while the live field of view contributes a
 * one-tile (including diagonal) frontier. This lets a player click one step
 * into the fog without exposing or selecting the rest of the hidden map.
 */
export const isTileClickReachable = (
  state: Pick<GameState, "width" | "height" | "tiles">,
  point: Point,
  revealAll = false,
) => {
  if (!pointInBounds(state, point)) return false;
  if (revealAll || state.tiles[point.y][point.x].discovered) return true;
  for (let y = point.y - 1; y <= point.y + 1; y += 1) {
    for (let x = point.x - 1; x <= point.x + 1; x += 1) {
      if (state.tiles[y]?.[x]?.visible) return true;
    }
  }
  return false;
};
