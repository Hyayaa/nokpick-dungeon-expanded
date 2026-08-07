import { GameState, Terrain, Tile } from "../game/types";

export const SOURCE_TILE_SIZE = 16;
export const TILE_SCALE = 3;
export const TILE_SIZE = SOURCE_TILE_SIZE * TILE_SCALE;
export const VIEW_WIDTH = 768;
export const VIEW_HEIGHT = 576;

const SEWER_ATLAS_COLUMNS = 16;
const FULL_TERRAIN_UNDERLAY = Object.freeze({
  draw: true,
  alpha: 1,
});

// Pixel fog is the only visual visibility mask. Terrain remains fully painted
// underneath it even when a tile is undiscovered; otherwise the canvas
// background or a per-tile alpha creates a second, perfectly square fog layer.
export function terrainUnderlayForPixelFog(
  tile: Pick<Tile, "visible" | "discovered">,
) {
  void tile;
  return FULL_TERRAIN_UNDERLAY;
}

// DungeonTileSheet.xy uses one-based atlas coordinates. Keeping that
// conversion here prevents the recurring +17 error caused by treating the
// source constants as zero-based row/column values.
const atlasFrame = (column: number, row: number) =>
  column - 1 + SEWER_ATLAS_COLUMNS * (row - 1);

const GROUND = atlasFrame(1, 1);
const CHASM = atlasFrame(9, 2);
const WATER = atlasFrame(1, 3);
const RAISED_WALLS = atlasFrame(1, 6);
const RAISED_DOORS = atlasFrame(1, 8);
const RAISED_OTHER = atlasFrame(9, 8);
const WALLS_INTERNAL = atlasFrame(1, 10);
const WALLS_OVERHANG = atlasFrame(1, 13);
const DOOR_OVERHANG = atlasFrame(1, 15);

export const SEWER_TILE_FRAMES = Object.freeze({
  floor: GROUND,
  specialFloor: GROUND + 4,
  grass: GROUND + 2,
  floorAlt1: GROUND + 6,
  grassAlt: GROUND + 8,
  specialFloorAlt: GROUND + 10,
  floorAlt2: GROUND + 12,
  chasm: CHASM,
  chasmFloor: CHASM + 1,
  chasmSpecialFloor: CHASM + 2,
  chasmWall: CHASM + 3,
  chasmWater: CHASM + 4,
  entrance: GROUND + 16,
  exit: GROUND + 17,
  water: WATER,
  raisedWall: RAISED_WALLS,
  raisedWallDoor: RAISED_WALLS + 8,
  raisedWallAlt: RAISED_WALLS + 16,
  raisedDoor: RAISED_DOORS,
  raisedDoorOpen: RAISED_DOORS + 1,
  raisedDoorLocked: RAISED_DOORS + 2,
  raisedDoorCrystal: RAISED_DOORS + 3,
  raisedDoorSideways: RAISED_DOORS + 4,
  raisedBarricade: RAISED_OTHER + 1,
  raisedHighGrass: RAISED_OTHER + 2,
  raisedHighGrassAlt: RAISED_OTHER + 5,
  wallInternal: WALLS_INTERNAL,
  wallOverhang: WALLS_OVERHANG,
  doorSidewaysOverhang: WALLS_OVERHANG + 16,
  doorSidewaysOverhangClosed: WALLS_OVERHANG + 20,
  doorSidewaysOverhangLocked: WALLS_OVERHANG + 24,
  doorSidewaysOverhangCrystal: WALLS_OVERHANG + 28,
  doorOverhang: DOOR_OVERHANG,
  doorOverhangOpen: DOOR_OVERHANG + 1,
  doorOverhangCrystal: DOOR_OVERHANG + 2,
  doorSideways: DOOR_OVERHANG + 3,
  doorSidewaysLocked: DOOR_OVERHANG + 4,
  doorSidewaysCrystal: DOOR_OVERHANG + 5,
});

const tileAt = (state: GameState, x: number, y: number): Terrain | null => {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return null;
  return state.tiles[y][x].terrain;
};

const wallLike = (terrain: Terrain | null) => terrain === "wall";
const doorLike = (terrain: Terrain | null) =>
  terrain === "door" ||
  terrain === "openDoor" ||
  terrain === "lockedDoor" ||
  terrain === "crystalDoor";
const stitchableWithWater = (terrain: Terrain | null) =>
  terrain === "floor" ||
  terrain === "specialFloor" ||
  terrain === "grass" ||
  terrain === "highGrass" ||
  terrain === "entrance" ||
  terrain === "exit" ||
  doorLike(terrain);

const floorVisual = (variant: number) => {
  if (variant >= 95) return SEWER_TILE_FRAMES.floorAlt2;
  if (variant >= 50) return SEWER_TILE_FRAMES.floorAlt1;
  return SEWER_TILE_FRAMES.floor;
};

const chasmVisualForAbove = (terrain: Terrain | null) => {
  if (terrain === "specialFloor") return SEWER_TILE_FRAMES.chasmSpecialFloor;
  if (terrain === "water") return SEWER_TILE_FRAMES.chasmWater;
  if (terrain === "wall" || doorLike(terrain)) {
    return SEWER_TILE_FRAMES.chasmWall;
  }
  if (
    terrain === "floor" ||
    terrain === "grass" ||
    terrain === "highGrass" ||
    terrain === "entrance" ||
    terrain === "exit"
  ) {
    return SEWER_TILE_FRAMES.chasmFloor;
  }
  return SEWER_TILE_FRAMES.chasm;
};

export function terrainVisual(state: GameState, x: number, y: number) {
  const tile = state.tiles[y][x];
  const terrain = tile.terrain;

  if (terrain === "floor") return floorVisual(tile.variant);
  if (terrain === "barricade") return SEWER_TILE_FRAMES.raisedBarricade;
  if (terrain === "specialFloor") {
    return tile.variant >= 50
      ? SEWER_TILE_FRAMES.specialFloorAlt
      : SEWER_TILE_FRAMES.specialFloor;
  }
  if (terrain === "chasm") {
    // Shattered stitches a chasm cell from the terrain directly above it,
    // preserving the raised perspective of floors, bridges, walls, and water.
    return chasmVisualForAbove(tileAt(state, x, y - 1));
  }
  if (terrain === "grass") {
    return tile.variant >= 50
      ? SEWER_TILE_FRAMES.grassAlt
      : SEWER_TILE_FRAMES.grass;
  }
  // These frames already contain both the sewer floor and untouched bush.
  if (terrain === "highGrass") {
    return tile.variant >= 50
      ? SEWER_TILE_FRAMES.raisedHighGrassAlt
      : SEWER_TILE_FRAMES.raisedHighGrass;
  }
  if (terrain === "entrance") return SEWER_TILE_FRAMES.entrance;
  if (terrain === "exit") return SEWER_TILE_FRAMES.exit;
  if (terrain === "water") {
    let mask = 0;
    if (stitchableWithWater(tileAt(state, x, y - 1))) mask += 1;
    if (stitchableWithWater(tileAt(state, x + 1, y))) mask += 2;
    if (stitchableWithWater(tileAt(state, x, y + 1))) mask += 4;
    if (stitchableWithWater(tileAt(state, x - 1, y))) mask += 8;
    // DungeonTileSheet.WATER is xy(1,3) = frame 32. Bits indicate adjacent
    // ground (top/right/bottom/left); adjacent water deliberately adds no bit.
    return SEWER_TILE_FRAMES.water + mask;
  }

  if (terrain === "wall") {
    const below = tileAt(state, x, y + 1);
    if (wallLike(below) || below === null) return null;
    let visual = doorLike(below)
      ? SEWER_TILE_FRAMES.raisedWallDoor
      : SEWER_TILE_FRAMES.raisedWall;
    if (!wallLike(tileAt(state, x + 1, y))) visual += 1;
    if (!wallLike(tileAt(state, x - 1, y))) visual += 2;
    if (tile.variant >= 50 && !doorLike(below)) {
      visual +=
        SEWER_TILE_FRAMES.raisedWallAlt -
        SEWER_TILE_FRAMES.raisedWall;
    }
    return visual;
  }

  if (doorLike(terrain)) {
    // DungeonTerrainTilemap passes map[pos - mapWidth] into
    // getRaisedDoorTile: a wall above the door selects the sideways floor
    // frame while DungeonWallsTilemap paints the matching upper door sprite.
    const wallAbove = wallLike(tileAt(state, x, y - 1));
    if (wallAbove) return SEWER_TILE_FRAMES.raisedDoorSideways;
    if (terrain === "crystalDoor") return SEWER_TILE_FRAMES.raisedDoorCrystal;
    if (terrain === "openDoor") return SEWER_TILE_FRAMES.raisedDoorOpen;
    if (terrain === "lockedDoor") return SEWER_TILE_FRAMES.raisedDoorLocked;
    return SEWER_TILE_FRAMES.raisedDoor;
  }
  return SEWER_TILE_FRAMES.floor;
}

export function wallOverlayVisual(state: GameState, x: number, y: number) {
  const terrain = tileAt(state, x, y);
  const below = tileAt(state, x, y + 1);

  if (wallLike(terrain)) {
    if (!wallLike(below) && doorLike(below)) {
      if (below === "openDoor") return null;
      if (below === "lockedDoor") return SEWER_TILE_FRAMES.doorSidewaysLocked;
      if (below === "crystalDoor") return SEWER_TILE_FRAMES.doorSidewaysCrystal;
      return SEWER_TILE_FRAMES.doorSideways;
    }
    if (wallLike(below)) {
      let visual = SEWER_TILE_FRAMES.wallInternal;
      if (!wallLike(tileAt(state, x + 1, y))) visual += 1;
      if (!wallLike(tileAt(state, x + 1, y + 1))) visual += 2;
      if (!wallLike(tileAt(state, x - 1, y + 1))) visual += 4;
      if (!wallLike(tileAt(state, x - 1, y))) visual += 8;
      return visual;
    }
  }

  if (wallLike(below)) {
    // DungeonWallsTilemap.stitchWallOverhangTile uses dedicated lower
    // overhangs when a door itself sits directly above a wall. These are the
    // missing lower halves of wall-set vertical doors.
    let visual =
      terrain === "openDoor"
        ? SEWER_TILE_FRAMES.doorSidewaysOverhang
        : terrain === "door"
          ? SEWER_TILE_FRAMES.doorSidewaysOverhangClosed
          : terrain === "lockedDoor"
            ? SEWER_TILE_FRAMES.doorSidewaysOverhangLocked
            : terrain === "crystalDoor"
              ? SEWER_TILE_FRAMES.doorSidewaysOverhangCrystal
            : SEWER_TILE_FRAMES.wallOverhang;
    if (!wallLike(tileAt(state, x + 1, y + 1))) visual += 1;
    if (!wallLike(tileAt(state, x - 1, y + 1))) visual += 2;
    return visual;
  }

  if (doorLike(below)) {
    if (below === "openDoor") return SEWER_TILE_FRAMES.doorOverhangOpen;
    if (below === "crystalDoor") return SEWER_TILE_FRAMES.doorOverhangCrystal;
    return SEWER_TILE_FRAMES.doorOverhang;
  }
  return null;
}

export function waterPatternFrame(x: number, y: number) {
  const column = ((x % 2) + 2) % 2;
  const row = ((y % 2) + 2) % 2;
  return column + row * 2;
}

export const WATER_SCROLL_PIXELS_PER_SECOND = 5;

export type WaterTextureSlice = {
  sourceX: number;
  sourceY: number;
  sourceHeight: number;
  destinationY: number;
};

const WATER_TEXTURE_SLICE_CACHE: Array<
  WaterTextureSlice[] | undefined
> = [];

export function waterTextureSlices(
  x: number,
  y: number,
  now: number,
): WaterTextureSlice[] {
  const textureSize = 32;
  const tileSize = SOURCE_TILE_SIZE;
  const sourceX = (((x * tileSize) % textureSize) + textureSize) % textureSize;
  const scroll = Math.floor(
    (now / 1000) * WATER_SCROLL_PIXELS_PER_SECOND,
  );
  const normalizedScroll =
    ((scroll % textureSize) + textureSize) % textureSize;
  const column = sourceX / tileSize;
  const row = (((y % 2) + 2) % 2);
  const cacheIndex =
    normalizedScroll * 4 + row * 2 + column;
  const cached = WATER_TEXTURE_SLICE_CACHE[cacheIndex];
  if (cached) return cached;
  let sourceY =
    (((y * tileSize + normalizedScroll) % textureSize) + textureSize) %
    textureSize;
  let destinationY = 0;
  let remaining = tileSize;
  const slices: WaterTextureSlice[] = [];
  while (remaining > 0) {
    const sourceHeight = Math.min(
      remaining,
      textureSize - sourceY,
    );
    slices.push({
      sourceX,
      sourceY,
      sourceHeight,
      destinationY,
    });
    remaining -= sourceHeight;
    destinationY += sourceHeight;
    sourceY = 0;
  }
  WATER_TEXTURE_SLICE_CACHE[cacheIndex] = slices;
  return slices;
}

// These 16 masks are derived from the alpha channel of Shattered v3.3.8's
// sewer water-bank frames (atlas frames 32–47). A set bit marks a fully
// transparent bank pixel where only animated water is visible. Using the bank
// silhouette keeps ripple effects on the puddle itself instead of tracing the
// square tile bounds.
const WATER_SURFACE_MASK_ROWS = [
  [0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff],
  [0x0000, 0x0001, 0x0001, 0x8003, 0xc00f, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff],
  [0x0fff, 0x07ff, 0x03ff, 0x03ff, 0x03ff, 0x03ff, 0x03ff, 0x03ff, 0x07ff, 0x07ff, 0x0fff, 0x0fff, 0x0fff, 0x0fff, 0x1fff, 0x7fff],
  [0x0000, 0x0003, 0x001f, 0x00ff, 0x03ff, 0x07ff, 0x07ff, 0x0fff, 0x0fff, 0x1fff, 0x1fff, 0x1fff, 0x3fff, 0x3fff, 0x7fff, 0x7fff],
  [0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xff0f, 0xf803, 0xc001, 0x8000, 0x0000, 0x0000],
  [0x0000, 0x0000, 0x8000, 0x8001, 0xc001, 0xf003, 0xfe07, 0xffff, 0xffff, 0xffff, 0xff1f, 0xf807, 0xc001, 0x8000, 0x8000, 0x0000],
  [0x7fff, 0x3fff, 0x1fff, 0x1fff, 0x1fff, 0x0fff, 0x0fff, 0x0fff, 0x0fff, 0x07ff, 0x03ff, 0x01ff, 0x003f, 0x0003, 0x0001, 0x0000],
  [0x0000, 0x0003, 0x003f, 0x00ff, 0x03ff, 0x07ff, 0x0fff, 0x0fff, 0x0fff, 0x0fff, 0x07ff, 0x03ff, 0x01ff, 0x007f, 0x0007, 0x0000],
  [0xfff8, 0xfff0, 0xfff0, 0xffe0, 0xffe0, 0xffc0, 0xffc0, 0xffc0, 0xffc0, 0xffc0, 0xffc0, 0xffc0, 0xffe0, 0xffe0, 0xfff0, 0xfff8],
  [0x0000, 0xc000, 0xf000, 0xfe00, 0xff80, 0xffc0, 0xffe0, 0xfff0, 0xfff0, 0xfff0, 0xfff0, 0xfff8, 0xfff8, 0xfff8, 0xfff8, 0xfffc],
  [0x3ffc, 0x0ff0, 0x07e0, 0x07e0, 0x03c0, 0x03c0, 0x01c0, 0x01c0, 0x01c0, 0x01c0, 0x03c0, 0x03c0, 0x07e0, 0x0fe0, 0x1ff0, 0x3ff8],
  [0x0000, 0x0000, 0x0000, 0x03c0, 0x07e0, 0x0ff0, 0x0ff0, 0x0ff8, 0x0ff8, 0x1ff8, 0x1ffc, 0x1ffc, 0x3ffc, 0x3ffe, 0x7ffe, 0x7ffe],
  [0xfffe, 0xfffe, 0xfffc, 0xfffc, 0xfffc, 0xfff8, 0xfff8, 0xfff8, 0xfff0, 0xfff0, 0xffe0, 0xffe0, 0xff80, 0xf800, 0x0000, 0x0000],
  [0x0000, 0xc000, 0xf800, 0xffc0, 0xfff0, 0xfff8, 0xfff8, 0xfff8, 0xfff8, 0xfff8, 0xfff8, 0xfff0, 0xffe0, 0xfc00, 0xc000, 0x0000],
  [0x7ffe, 0x7ffe, 0x7ffc, 0x7ffc, 0x3ffc, 0x3ff8, 0x3ff8, 0x3ff8, 0x1ff8, 0x1ff0, 0x1ff0, 0x0fe0, 0x07c0, 0x0000, 0x0000, 0x0000],
  [0x0000, 0x0000, 0x03c0, 0x0ff0, 0x1ff8, 0x1ff8, 0x3ffc, 0x3ffc, 0x3ffc, 0x3ffc, 0x1ffc, 0x1ff8, 0x1ff8, 0x03c0, 0x0000, 0x0000],
] as const;

const EMPTY_WATER_SURFACE_MASK = Object.freeze(
  Array.from({ length: SOURCE_TILE_SIZE }, () => 0),
);

export function waterSurfaceMaskRows(
  state: GameState,
  x: number,
  y: number,
): readonly number[] {
  if (state.tiles[y]?.[x]?.terrain !== "water") {
    return EMPTY_WATER_SURFACE_MASK;
  }
  const frame = terrainVisual(state, x, y);
  if (
    frame === null ||
    frame < SEWER_TILE_FRAMES.water ||
    frame >=
      SEWER_TILE_FRAMES.water + WATER_SURFACE_MASK_ROWS.length
  ) {
    return EMPTY_WATER_SURFACE_MASK;
  }
  return WATER_SURFACE_MASK_ROWS[
    frame - SEWER_TILE_FRAMES.water
  ];
}

export const usesQuadrantFogForFrame = (frame: number | null) => {
  if (frame === null || frame < 0) return false;
  // The chasm-wall stitch is the lower face of the wall tile above it. It
  // needs the same quarter-tile visibility as the wall atlas rows or one
  // visible quadrant reveals the entire hidden cliff face.
  if (frame === SEWER_TILE_FRAMES.chasmWall) return true;
  const oneBasedRow = Math.floor(frame / SEWER_ATLAS_COLUMNS) + 1;
  return oneBasedRow >= 10 && oneBasedRow <= 14;
};

export function fogMasksForTile(tile: Tile, frame: number | null) {
  const visibleMask =
    ((tile.visibleMask ?? 0) || (tile.visible ? 15 : 0)) & 15;
  const discoveredMask =
    ((tile.discoveredMask ?? 0) || (tile.discovered ? 15 : 0)) & 15;

  // Wall artwork in atlas rows 10–14 and the chasm-wall lower-face stitch use
  // Shattered's fine silhouette. Doors, grass, raised wall art, and every
  // other frame reveal as one complete tile even when their terrain blocks
  // sight.
  if (usesQuadrantFogForFrame(frame)) {
    return { visibleMask, discoveredMask };
  }
  return {
    visibleMask: visibleMask ? 15 : 0,
    discoveredMask: discoveredMask ? 15 : 0,
  };
}

export function drawSheetFrame(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  index: number,
  frameWidth: number,
  frameHeight: number,
  destinationX: number,
  destinationY: number,
  destinationWidth: number,
  destinationHeight: number,
) {
  const columns = Math.floor(image.naturalWidth / frameWidth);
  const sourceX = (index % columns) * frameWidth;
  const sourceY = Math.floor(index / columns) * frameHeight;
  context.drawImage(
    image,
    sourceX,
    sourceY,
    frameWidth,
    frameHeight,
    Math.round(destinationX),
    Math.round(destinationY),
    destinationWidth,
    destinationHeight,
  );
}
