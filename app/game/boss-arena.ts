import type { BossArenaProfile } from "./boss-definitions";
import type { BossRoom, Tile } from "./types";

const paintPool = (
  tiles: Tile[][],
  left: number,
  top: number,
  right: number,
  bottom: number,
) => {
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (tiles[y]?.[x]) tiles[y][x].terrain = "water";
    }
  }
};

/** Small per-boss terrain profile layered over the shared generated arena. */
export const paintBossArena = (
  tiles: Tile[][],
  room: BossRoom,
  profile: BossArenaProfile,
) => {
  if (profile !== "goo") return;
  const poolWidth = Math.min(3, Math.max(1, Math.floor((room.right - room.left - 6) / 4)));
  const poolHeight = Math.min(3, Math.max(1, Math.floor((room.bottom - room.top - 6) / 4)));
  const left = room.left + 2;
  const right = room.right - 2;
  const top = room.top + 2;
  const bottom = room.bottom - 2;
  paintPool(tiles, left, top, left + poolWidth - 1, top + poolHeight - 1);
  paintPool(tiles, right - poolWidth + 1, top, right, top + poolHeight - 1);
  paintPool(tiles, left, bottom - poolHeight + 1, left + poolWidth - 1, bottom);
  paintPool(tiles, right - poolWidth + 1, bottom - poolHeight + 1, right, bottom);

  // The entrance/exit lane and the 5x5 boss spawn zone remain dry.
  for (let y = room.top + 1; y < room.bottom; y += 1) {
    tiles[y][room.center.x].terrain = "floor";
  }
  for (let y = room.center.y - 2; y <= room.center.y + 2; y += 1) {
    for (let x = room.center.x - 2; x <= room.center.x + 2; x += 1) {
      if (tiles[y]?.[x]) tiles[y][x].terrain = "floor";
    }
  }
};
