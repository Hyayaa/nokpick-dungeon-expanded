export type PixelEffectLayer = "ground" | "actor" | "overlay";

/** Every map tile owns this many logical particle cells on each axis. */
export const PIXEL_EFFECT_CELLS_PER_TILE = 16;

export type PixelClipBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PixelEffectBase = {
  id: string;
  layer: PixelEffectLayer;
  startedAt: number;
  duration: number;
  color: string;
  worldPixelSize?: number;
  clipBounds?: PixelClipBounds;
};

export type PixelParticleEffect = PixelEffectBase & {
  kind: "particle";
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  gravity: number;
  drag: number;
  /** Thickness of this individual mark in logical cells, not its tile reach. */
  cellSize: number;
};

export type PixelRingEffect = PixelEffectBase & {
  kind: "ring";
  x: number;
  y: number;
  startRadius: number;
  endRadius: number;
  aspectY: number;
  pixelSize: number;
  segments: number;
  startAngle?: number;
  sweepAngle?: number;
  revealProgress?: boolean;
};

export type PixelScreenFlashEffect = PixelEffectBase & {
  kind: "screenFlash";
  strength: number;
};

export type PixelWaterFrontierEffect = PixelEffectBase & {
  kind: "waterFrontier";
  x: number;
  y: number;
  worldPixelSize: number;
  expansionDuration: number;
  holdDuration: number;
  fadeDuration: number;
  rings: Uint16Array[];
  edgeRings: Uint16Array[];
};

export type PixelEffect =
  | PixelParticleEffect
  | PixelRingEffect
  | PixelScreenFlashEffect
  | PixelWaterFrontierEffect;

export type PixelEffectViewport = {
  screenX: (worldX: number) => number;
  screenY: (worldY: number) => number;
  zoom: number;
  width: number;
  height: number;
};

export type PixelCameraShake = {
  id: string;
  startedAt: number;
  duration: number;
  amplitude: number;
  seed: number;
};
