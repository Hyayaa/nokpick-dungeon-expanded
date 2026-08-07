import { ENEMY_SPRITES, ITEM_DEFS, OBJECT_SPRITES } from "../game/data";
import { partyActor, PLAYER_ACTOR_ID } from "../game/party";
import { pointEquals } from "../game/spatial";
import type {
  CombatEffect,
  Companion,
  CompanionClassId,
  Enemy,
  EnemyKind,
  GameState,
  ItemPickup,
  ItemThrow,
  MagicVisual,
  Motion,
  Point,
  StatusEffectId,
  StatusSignal,
} from "../game/types";
import {
  COMPANION_ATTACK_FRAMES,
  COMPANION_DEFEAT_FRAMES,
  COMPANION_IDLE_FRAMES,
  COMPANION_INTERACT_FRAMES,
  COMPANION_MOVE_FRAMES,
  COMPANION_PRESENTATIONS,
  companionArmorTier,
  companionFrameIndex,
} from "./companion-visuals";
import type { EffectTrajectory } from "./effects";
import {
  FOG_PIXELS_PER_TILE,
  type PixelFogRuntime,
  drawPixelFogTexture,
} from "./fog-frontier";
import { itemSpriteOffset } from "./item-visuals";
import {
  type LogicalGridPixel,
  type PixelCameraShake,
  type PixelEffect,
  burningStatusPixels,
  cameraShakeOffset,
  createPixelEffectBuckets,
  drawPixelEffects,
  fieldTilePixels,
  pruneCameraShakes,
  prunePixelEffects,
  syncPixelEffectBuckets,
} from "./pixel-effects";
import { motionUsesRunFrames, sampleTravelMotion } from "./skill-motion";
import {
  PLAYER_ATTACK_FRAMES,
  PLAYER_IDLE_FRAMES,
  PLAYER_INTERACT_FRAMES,
  PLAYER_MOVE_FRAMES,
} from "./player-animation";
import {
  type DungeonRenderCache,
  fogMaskBitAt,
  overlayFrameAt,
  syncDungeonRenderCache,
  terrainFrameAt,
} from "./render-cache";
import {
  TILE_SIZE,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  drawSheetFrame,
  terrainUnderlayForPixelFog,
  waterTextureSlices,
} from "./render";
import {
  drawTargetingOverlay,
  type TargetingOverlay,
} from "./targeting-overlay";
import { PLAYER_MOVE_DURATION } from "./timing";
import { ENTITY_SPRITE_SCALE, clampCamera } from "./viewport";
import { retainInPlace } from "./animation-runtime";

export type VisualMotion = Motion & {
  startedAt: number;
  duration: number;
};

export type FloatingEffect = CombatEffect & EffectTrajectory & {
  id: string;
  startedAt: number;
};

export type PickupVisual = ItemPickup & { startedAt: number };
export type ThrowVisual = ItemThrow & { startedAt: number; duration: number };
export type StatusSignalVisual = StatusSignal & {
  id: string;
  startedAt: number;
  duration: number;
  releasedAt?: number;
};
export type MagicVisualRuntime = MagicVisual & {
  startedAt: number;
  duration: number;
};
export type PlayerActionAnimation = {
  kind: "interact";
  startedAt: number;
  duration: number;
};
export type EntityFlashVisual = {
  id: string;
  startedAt: number;
  duration: number;
};
export type DefeatedEnemyVisual = { enemy: Enemy; removeAt: number };
export type DefeatedCompanionVisual = {
  companion: Companion;
  revealAt: number;
};

export type GameAssets = {
  tiles: HTMLImageElement;
  water: HTMLImageElement;
  terrainFeatures: HTMLImageElement;
  items: HTMLImageElement;
  player: HTMLImageElement;
  enemies: Record<EnemyKind, HTMLImageElement>;
  companions: Record<CompanionClassId, HTMLImageElement>;
};

export type CameraDrag = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startCameraX: number;
  startCameraY: number;
  moved: boolean;
};

export type CompanionMapDrag = {
  pointerId: number;
  companionId: string;
  startClientX: number;
  startClientY: number;
  cursor: Point;
  grabOffset: Point;
  target: Point | null;
  moved: boolean;
};

type RefLike<T> = { current: T };

export type DungeonRendererOptions = {
  assetsReady: boolean;
  canvasRef: RefLike<HTMLCanvasElement | null>;
  fogTextureCanvasRef: RefLike<HTMLCanvasElement | null>;
  renderCacheRef: RefLike<DungeonRenderCache | null>;
  assetsRef: RefLike<GameAssets | null>;
  gameRef: RefLike<GameState>;
  motionRef: RefLike<Map<string, VisualMotion>>;
  playerMoveCycleStartedAtRef: RefLike<number | null>;
  effectsRef: RefLike<FloatingEffect[]>;
  pickupRef: RefLike<PickupVisual[]>;
  throwRef: RefLike<ThrowVisual[]>;
  magicRef: RefLike<MagicVisualRuntime[]>;
  statusSignalRef: RefLike<StatusSignalVisual[]>;
  pixelEffectsRef: RefLike<PixelEffect[]>;
  cameraShakesRef: RefLike<PixelCameraShake[]>;
  pixelFogRuntimeRef: RefLike<PixelFogRuntime>;
  entityFlashRef: RefLike<EntityFlashVisual[]>;
  defeatedEnemyVisualRef: RefLike<DefeatedEnemyVisual[]>;
  defeatedCompanionVisualRef: RefLike<DefeatedCompanionVisual[]>;
  playerActionRef: RefLike<PlayerActionAnimation | null>;
  cameraRef: RefLike<Point>;
  cameraFollowRef: RefLike<boolean>;
  cameraDragRef: RefLike<CameraDrag | null>;
  companionMapDragRef: RefLike<CompanionMapDrag | null>;
  zoomRef: RefLike<number>;
  developerModeRef: RefLike<boolean>;
  manualPartyModeRef: RefLike<boolean>;
  controlledActorIdRef: RefLike<string>;
  hoverRef: RefLike<Point | null>;
  pathRef: RefLike<Point[]>;
  autoTravelRef: RefLike<boolean>;
  inspectModeRef: RefLike<boolean>;
  targetingOverlayRef: RefLike<TargetingOverlay | null>;
};

const PLAYER_ID = PLAYER_ACTOR_ID;
const PLAYER_IDLE_FRAME_DURATION = 150;
const PLAYER_MOVE_FRAME_DURATION = 64;
const PICKUP_DURATION = 620;

const drawLogicalGridPixels = (
  context: CanvasRenderingContext2D,
  pixels: readonly LogicalGridPixel[],
  originX: number,
  originY: number,
  pixelSize: number,
  opacity = 1,
) => {
  context.save();
  context.imageSmoothingEnabled = false;
  pixels.forEach((pixel) => {
    context.globalAlpha = opacity * pixel.alpha;
    context.fillStyle = pixel.color;
    context.fillRect(
      Math.round(originX + pixel.x * pixelSize),
      Math.round(originY + pixel.y * pixelSize),
      Math.max(1, Math.ceil(pixel.size * pixelSize)),
      Math.max(1, Math.ceil(pixel.size * pixelSize)),
    );
  });
  context.restore();
};

export function startDungeonRenderer({
  assetsReady,
  canvasRef,
  fogTextureCanvasRef,
  renderCacheRef,
  assetsRef,
  gameRef,
  motionRef,
  playerMoveCycleStartedAtRef,
  effectsRef,
  pickupRef,
  throwRef,
  magicRef,
  statusSignalRef,
  pixelEffectsRef,
  cameraShakesRef,
  pixelFogRuntimeRef,
  entityFlashRef,
  defeatedEnemyVisualRef,
  defeatedCompanionVisualRef,
  playerActionRef,
  cameraRef,
  cameraFollowRef,
  cameraDragRef,
  companionMapDragRef,
  zoomRef,
  developerModeRef,
  manualPartyModeRef,
  controlledActorIdRef,
  hoverRef,
  pathRef,
  autoTravelRef,
  inspectModeRef,
  targetingOverlayRef,
}: DungeonRendererOptions) {
    const canvas = canvasRef.current;
    if (!canvas || !assetsReady) return;
    const context = canvas.getContext("2d");
    const assets = assetsRef.current;
    if (!context || !assets) return;

    let frame = 0;
    let lastDrawAt = Number.NEGATIVE_INFINITY;
    const vignette = context.createRadialGradient(
      VIEW_WIDTH / 2,
      VIEW_HEIGHT / 2,
      VIEW_HEIGHT * 0.2,
      VIEW_WIDTH / 2,
      VIEW_HEIGHT / 2,
      VIEW_WIDTH * 0.62,
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,.46)");
    const pixelEffectBuckets = createPixelEffectBuckets();
    const interpolate = (
      id: string,
      fallback: Point,
      now: number,
    ): {
      point: Point;
      motion: VisualMotion | null;
      progress: number;
      spriteLift: number;
      opacity: number;
    } => {
      const motion = motionRef.current.get(id);
      if (!motion) {
        return {
          point: fallback,
          motion: null,
          progress: 1,
          spriteLift: 0,
          opacity: 1,
        };
      }
      if (now < motion.startedAt) {
        return {
          point: motion.from,
          motion: null,
          progress: 0,
          spriteLift: 0,
          opacity: 1,
        };
      }
      const progress = Math.max(
        0,
        Math.min(1, (now - motion.startedAt) / motion.duration),
      );
      if (progress >= 1) {
        const settledPoint =
          motion.kind === "move" ? motion.to : motion.from;
        if (pointEquals(fallback, settledPoint)) {
          motionRef.current.delete(id);
        }
        return {
          point: settledPoint,
          motion: null,
          progress: 1,
          spriteLift: 0,
          opacity: 1,
        };
      }
      if (motion.kind === "attack") {
        const amount = Math.sin(progress * Math.PI) * 0.36;
        return {
          point: {
            x: motion.from.x + (motion.to.x - motion.from.x) * amount,
            y: motion.from.y + (motion.to.y - motion.from.y) * amount,
          },
          motion,
          progress,
          spriteLift: 0,
          opacity: 1,
        };
      }
      const travel = sampleTravelMotion(motion.travelStyle, progress);
      return {
        point: {
          x:
            motion.from.x +
            (motion.to.x - motion.from.x) * travel.positionProgress,
          y:
            motion.from.y +
            (motion.to.y - motion.from.y) * travel.positionProgress,
        },
        motion,
        progress,
        spriteLift: travel.spriteLift,
        opacity: travel.opacity,
      };
    };

    const render = (now: number) => {
      retainInPlace(
        defeatedEnemyVisualRef.current,
        (visual) => visual.removeAt > now,
      );
      retainInPlace(
        defeatedCompanionVisualRef.current,
        (visual) => visual.revealAt > now,
      );
      const highMotion =
        companionMapDragRef.current?.moved === true ||
        motionRef.current.size > 0 ||
        defeatedEnemyVisualRef.current.length > 0 ||
        defeatedCompanionVisualRef.current.length > 0 ||
        playerActionRef.current !== null ||
        effectsRef.current.length > 0 ||
        pickupRef.current.length > 0 ||
        throwRef.current.length > 0 ||
        magicRef.current.length > 0 ||
        pixelEffectsRef.current.length > 0 ||
        cameraShakesRef.current.length > 0 ||
        entityFlashRef.current.length > 0 ||
        pixelFogRuntimeRef.current.transitions.size > 0;
      const minimumFrameInterval = highMotion ? 1000 / 60 : 1000 / 30;
      if (now - lastDrawAt < minimumFrameInterval - 1) {
        frame = requestAnimationFrame(render);
        return;
      }
      lastDrawAt = now;

      const state = gameRef.current;
      const renderCache = syncDungeonRenderCache(
        renderCacheRef.current!,
        state,
      );
      const revealAll = developerModeRef.current;
      context.imageSmoothingEnabled = false;
      context.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      context.fillStyle = "#020405";
      context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

      const playerVisual = interpolate(PLAYER_ID, state.player, now);
      const followedActorId = manualPartyModeRef.current
        ? controlledActorIdRef.current
        : PLAYER_ID;
      const followedActor = partyActor(state, followedActorId);
      const followedVisual = followedActorId === PLAYER_ID
        ? playerVisual
        : interpolate(followedActorId, followedActor, now);
      const zoom = zoomRef.current;
      if (cameraFollowRef.current) {
        cameraRef.current = clampCamera(
          {
            x:
              followedVisual.point.x * TILE_SIZE +
              TILE_SIZE / 2 -
              VIEW_WIDTH / zoom / 2,
            y:
              followedVisual.point.y * TILE_SIZE +
              TILE_SIZE / 2 -
              VIEW_HEIGHT / zoom / 2,
          },
          zoom,
          state,
        );
      } else {
        cameraRef.current = clampCamera(cameraRef.current, zoom, state);
      }
      cameraShakesRef.current = pruneCameraShakes(
        cameraShakesRef.current,
        now,
      );
      const shake = cameraShakeOffset(cameraShakesRef.current, now);
      const cameraX = cameraRef.current.x;
      const cameraY = cameraRef.current.y;
      const tileScreenSize = TILE_SIZE * zoom;
      const spritePixelSize = ENTITY_SPRITE_SCALE * zoom;
      const screenX = (worldX: number) =>
        (worldX - cameraX) * zoom + shake.x;
      const screenY = (worldY: number) =>
        (worldY - cameraY) * zoom + shake.y;
      const pixelViewport = {
        screenX,
        screenY,
        zoom,
        width: VIEW_WIDTH,
        height: VIEW_HEIGHT,
      };
      pixelEffectsRef.current = prunePixelEffects(
        pixelEffectsRef.current,
        now,
      );
      syncPixelEffectBuckets(pixelEffectsRef.current, pixelEffectBuckets);
      retainInPlace(
        entityFlashRef.current,
        (flash) => now < flash.startedAt + flash.duration,
      );
      const entityFlashAlphas = new Map<string, number>();
      for (const flash of entityFlashRef.current) {
        if (now < flash.startedAt) continue;
        const progress = (now - flash.startedAt) / flash.duration;
        entityFlashAlphas.set(
          flash.id,
          Math.max(0, Math.sin(progress * Math.PI)),
        );
      }
      const entityFlashAlpha = (id: string) =>
        entityFlashAlphas.get(id) ?? 0;
      const drawSpeechBubble = (
        centerX: number,
        bottomY: number,
        text: string,
        color: string,
        alpha = 1,
      ) => {
        const bubbleWidth = (text.length > 1 ? 26 : 20) * zoom;
        const bubbleHeight = 17 * zoom;
        const left = Math.round(centerX - bubbleWidth / 2);
        const top = Math.round(bottomY - bubbleHeight);
        context.save();
        context.globalAlpha = alpha;
        context.fillStyle = "rgba(12, 16, 14, .94)";
        context.strokeStyle = color;
        context.lineWidth = Math.max(1, zoom);
        context.fillRect(left, top, bubbleWidth, bubbleHeight);
        context.strokeRect(left, top, bubbleWidth, bubbleHeight);
        context.beginPath();
        context.moveTo(centerX - 3 * zoom, bottomY);
        context.lineTo(centerX + 3 * zoom, bottomY);
        context.lineTo(centerX, bottomY + 5 * zoom);
        context.closePath();
        context.fill();
        context.stroke();
        context.fillStyle = color;
        context.font = `${Math.round(9 * zoom)}px MonaGame, monospace`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(text, centerX, top + bubbleHeight * 0.54);
        context.restore();
      };
      const drawEntityShadow = (
        centerX: number,
        bottomY: number,
        width: number,
        alpha = 0.34,
      ) => {
        context.save();
        context.globalAlpha = alpha;
        context.fillStyle = "#000";
        context.beginPath();
        context.ellipse(
          Math.round(centerX),
          Math.round(bottomY - 2 * zoom),
          Math.max(7 * zoom, width * 0.32),
          Math.max(2.5 * zoom, width * 0.1),
          0,
          0,
          Math.PI * 2,
        );
        context.fill();
        context.restore();
      };

      const startX = Math.max(0, Math.floor(cameraX / TILE_SIZE) - 2);
      const endX = Math.min(
        state.width - 1,
        Math.ceil((cameraX + VIEW_WIDTH / zoom) / TILE_SIZE) + 2,
      );
      const startY = Math.max(0, Math.floor(cameraY / TILE_SIZE) - 2);
      const endY = Math.min(
        state.height - 1,
        Math.ceil((cameraY + VIEW_HEIGHT / zoom) / TILE_SIZE) + 2,
      );
      const inViewport = (x: number, y: number, padding = 2) =>
        x >= startX - padding &&
        x <= endX + padding &&
        y >= startY - padding &&
        y <= endY + padding;

      for (let y = startY; y <= endY; y += 1) {
        for (let x = startX; x <= endX; x += 1) {
          const tile = state.tiles[y][x];
          const underlay = terrainUnderlayForPixelFog(tile);
          if (!underlay.draw) continue;
          const visual = terrainFrameAt(renderCache, x, y);
          if (visual === null) continue;
          context.globalAlpha = underlay.alpha;
          if (tile.terrain === "water") {
            const waterX = screenX(x * TILE_SIZE);
            const waterY = screenY(y * TILE_SIZE);
            for (const slice of waterTextureSlices(x, y, now)) {
              context.drawImage(
                assets.water,
                slice.sourceX,
                slice.sourceY,
                16,
                slice.sourceHeight,
                waterX,
                waterY +
                  (slice.destinationY / 16) * tileScreenSize,
                tileScreenSize,
                (slice.sourceHeight / 16) * tileScreenSize,
              );
            }
          }
          drawSheetFrame(
            context,
            assets.tiles,
            visual,
            16,
            16,
            screenX(x * TILE_SIZE),
            screenY(y * TILE_SIZE),
            tileScreenSize,
            tileScreenSize,
          );
        }
      }
      context.globalAlpha = 1;
      const trapFrames = {
        gripping: 16,
        poisonDart: 33,
        explosive: 50,
        teleportation: 67,
        flashing: 84,
        toxicVent: 96,
      } as const;
      for (const trap of state.traps ?? []) {
        if (!inViewport(trap.x, trap.y)) continue;
        if (
          !revealAll &&
          (!trap.revealed || !state.tiles[trap.y]?.[trap.x]?.discovered)
        ) continue;
        drawSheetFrame(
          context,
          assets.terrainFeatures,
          trap.active ? trapFrames[trap.kind] : 0,
          16,
          16,
          screenX(trap.x * TILE_SIZE),
          screenY(trap.y * TILE_SIZE),
          tileScreenSize,
          tileScreenSize,
        );
      }
      drawPixelEffects(
        context,
        pixelEffectBuckets.ground,
        now,
        pixelViewport,
      );

      const activePath = pathRef.current;
      activePath.forEach((point, index) => {
        if (!inViewport(point.x, point.y)) return;
        if (
          !revealAll &&
          !state.tiles[point.y]?.[point.x]?.discovered
        ) return;
        const centerX = screenX(point.x * TILE_SIZE + TILE_SIZE / 2);
        const centerY = screenY(point.y * TILE_SIZE + TILE_SIZE / 2);
        context.fillStyle =
          index === activePath.length - 1
            ? "rgba(255, 215, 112, .78)"
            : "rgba(255, 215, 112, .38)";
        context.beginPath();
        context.arc(
          centerX,
          centerY,
          (index === activePath.length - 1 ? 5 : 3) * zoom,
          0,
          Math.PI * 2,
        );
        context.fill();
      });

      state.groundItems.forEach((item) => {
        if (!inViewport(item.x, item.y)) return;
        if (!revealAll && !state.tiles[item.y][item.x].visible) return;
        const definition = ITEM_DEFS[item.defId];
        const offset = itemSpriteOffset(item.defId);
        const bob = Math.sin(now / 270 + item.x) * zoom;
        drawSheetFrame(
          context,
          assets.items,
          definition.sprite,
          16,
          16,
          screenX(item.x * TILE_SIZE + offset.x * 3),
          screenY(item.y * TILE_SIZE + offset.y * 3) + bob,
          tileScreenSize,
          tileScreenSize,
        );
      });

      retainInPlace(throwRef.current, (itemThrow) => {
        const progress = Math.max(
          0,
          Math.min(
            1,
            (now - itemThrow.startedAt) / itemThrow.duration,
          ),
        );
        if (progress >= 1) return false;
        const travelProgress = progress;
        const arcProgress = progress;
        const offset = itemSpriteOffset(itemThrow.defId);
        const worldX =
          itemThrow.from.x +
          (itemThrow.to.x - itemThrow.from.x) * travelProgress;
        const worldY =
          itemThrow.from.y +
          (itemThrow.to.y - itemThrow.from.y) * travelProgress;
        const arc = Math.sin(arcProgress * Math.PI) * TILE_SIZE * 0.55;
        const centerX = screenX(worldX * TILE_SIZE + TILE_SIZE / 2);
        const centerY =
          screenY(worldY * TILE_SIZE + TILE_SIZE / 2) - arc * zoom;
        const travelAngle = Math.atan2(
          itemThrow.to.y - itemThrow.from.y,
          itemThrow.to.x - itemThrow.from.x,
        );
        // Missile sheet art faces north-east by default (-45 degrees).
        context.save();
        context.translate(Math.round(centerX), Math.round(centerY));
        context.rotate(travelAngle + Math.PI / 4);
        drawSheetFrame(
          context,
          assets.items,
          ITEM_DEFS[itemThrow.defId].sprite,
          16,
          16,
          -tileScreenSize / 2 + offset.x * 3 * zoom,
          -tileScreenSize / 2 + offset.y * 3 * zoom,
          tileScreenSize,
          tileScreenSize,
        );
        context.restore();
        return true;
      });

      state.objects.forEach((object) => {
        if (
          !inViewport(object.x, object.y) ||
          object.looted ||
          (!revealAll && !state.tiles[object.y][object.x].visible)
        ) return;
        const definition = OBJECT_SPRITES[object.kind];
        const bob = Math.sin(now / 420 + object.x * 0.7) * 0.5 * zoom;
        drawSheetFrame(
          context,
          assets.items,
          definition.sprite,
          16,
          16,
          screenX(object.x * TILE_SIZE),
          screenY(object.y * TILE_SIZE) + bob,
          tileScreenSize,
          tileScreenSize,
        );
      });

      state.tiles.forEach((row, y) => row.forEach((tile, x) => {
        if (tile.terrain !== "magicalFire" || !inViewport(x, y)) return;
        if (!revealAll && !tile.visible) return;
        drawLogicalGridPixels(
          context,
          fieldTilePixels("fire", now, x * 31 + y * 17),
          screenX(x * TILE_SIZE),
          screenY(y * TILE_SIZE),
          tileScreenSize / 16,
          1,
        );
      }));

      const cloudColors: Record<string, string> = {
        fire: "rgba(255, 103, 48, .32)",
        frost: "rgba(116, 224, 255, .32)",
        paralytic: "rgba(226, 217, 123, .34)",
        toxic: "rgba(111, 181, 75, .34)",
        corrosive: "rgba(157, 205, 63, .38)",
        storm: "rgba(77, 144, 203, .34)",
      };
      for (const cloud of state.clouds ?? []) {
        for (const cloudTile of cloud.tiles) {
          if (
            !inViewport(cloudTile.x, cloudTile.y) ||
            !revealAll &&
            !state.tiles[cloudTile.y]?.[cloudTile.x]?.visible
          ) continue;
          const drawX = screenX(cloudTile.x * TILE_SIZE);
          const drawY = screenY(cloudTile.y * TILE_SIZE);
          const pulse =
            0.78 +
            Math.sin(now / 190 + cloudTile.x * 1.7 + cloudTile.y) * 0.12;
          context.save();
          context.globalAlpha =
            Math.max(0.24, cloudTile.intensity) * pulse;
          context.fillStyle = cloudColors[cloud.kind];
          context.fillRect(
            Math.floor(drawX),
            Math.floor(drawY),
            Math.ceil(tileScreenSize) + 1,
            Math.ceil(tileScreenSize) + 1,
          );
          context.restore();
          drawLogicalGridPixels(
            context,
            fieldTilePixels(
              cloud.kind,
              now,
              cloudTile.x * 31 + cloudTile.y * 17,
            ),
            drawX,
            drawY,
            tileScreenSize / 16,
            Math.max(0.28, cloudTile.intensity),
          );
        }
      }
      for (const ward of state.wards ?? []) {
        if (!inViewport(ward.x, ward.y)) continue;
        if (!revealAll && !state.tiles[ward.y]?.[ward.x]?.visible) continue;
        const centerX = screenX(ward.x * TILE_SIZE + TILE_SIZE / 2);
        const centerY = screenY(ward.y * TILE_SIZE + TILE_SIZE / 2);
        context.save();
        context.translate(centerX, centerY);
        context.rotate(now / 700);
        context.strokeStyle = "#c7a5ff";
        context.lineWidth = Math.max(1, 2 * zoom);
        context.strokeRect(-7 * zoom, -7 * zoom, 14 * zoom, 14 * zoom);
        context.restore();
      }

      retainInPlace(magicRef.current, (visual) => {
        const progress = (now - visual.startedAt) / visual.duration;
        if (progress < 0) return true;
        if (progress >= 1) return false;
        const fromX = screenX(visual.from.x * TILE_SIZE + TILE_SIZE / 2);
        const fromY = screenY(visual.from.y * TILE_SIZE + TILE_SIZE / 2);
        const toX = screenX(visual.to.x * TILE_SIZE + TILE_SIZE / 2);
        const toY = screenY(visual.to.y * TILE_SIZE + TILE_SIZE / 2);
        context.save();
        context.globalAlpha = Math.sin(progress * Math.PI);
        context.strokeStyle = visual.color;
        context.shadowColor = visual.secondaryColor ?? visual.color;
        context.shadowBlur = 9 * zoom;
        context.lineWidth =
          (visual.kind === "cone" ? 9 : 3) * zoom * (1 - progress * 0.45);
        context.beginPath();
        context.moveTo(fromX, fromY);
        context.lineTo(toX, toY);
        context.stroke();
        context.fillStyle = visual.secondaryColor ?? "#fff";
        context.beginPath();
        context.arc(
          fromX + (toX - fromX) * Math.min(1, progress * 1.8),
          fromY + (toY - fromY) * Math.min(1, progress * 1.8),
          3.5 * zoom,
          0,
          Math.PI * 2,
        );
        context.fill();
        context.restore();
        return true;
      });

      const drawBurningStatus = (
        id: string,
        point: Point,
        statuses: readonly { id: StatusEffectId; turns: number }[],
        opacity = 1,
      ) => {
        if (
          !statuses.some(
            (status) => status.id === "burning" && status.turns > 0,
          )
        ) return;
        let seed = 0;
        for (const character of id) {
          seed = Math.imul(seed ^ character.charCodeAt(0), 31);
        }
        drawLogicalGridPixels(
          context,
          burningStatusPixels(now, seed),
          screenX(point.x * TILE_SIZE),
          screenY(point.y * TILE_SIZE),
          tileScreenSize / 16,
          opacity,
        );
      };

      const drawEnemy = (enemy: Enemy) => {
        if (!inViewport(enemy.x, enemy.y)) return;
        if (!revealAll && !state.tiles[enemy.y][enemy.x].visible) return;
        const sprite = ENEMY_SPRITES[enemy.kind];
        const visual = interpolate(enemy.id, enemy, now);
        let frames = sprite.idle;
        if (motionUsesRunFrames(visual.motion)) frames = sprite.run;
        if (visual.motion?.kind === "attack") frames = sprite.attackFrames;
        const frameIndex = visual.motion
          ? Math.min(
              frames.length - 1,
              Math.floor(visual.progress * frames.length),
            )
          : Math.floor(now / 430) % frames.length;
        const sourceFrame = frames[frameIndex] ?? frames[0];
        const width = sprite.frameWidth * spritePixelSize;
        const height = sprite.frameHeight * spritePixelSize;
        const centerX = screenX(
          visual.point.x * TILE_SIZE + TILE_SIZE / 2,
        );
        const bottom = screenY(
          visual.point.y * TILE_SIZE + TILE_SIZE - 3,
        );
        const flip =
          visual.motion && visual.motion.to.x < visual.motion.from.x;

        drawEntityShadow(centerX, bottom, width, enemy.sleeping ? 0.25 : 0.36);
        const paintEnemySprite = () => {
          context.save();
          if (flip) {
            context.translate(Math.round(centerX), 0);
            context.scale(-1, 1);
            drawSheetFrame(
              context,
              assets.enemies[enemy.kind],
              sourceFrame,
              sprite.frameWidth,
              sprite.frameHeight,
              -width / 2,
              bottom - height,
              width,
              height,
            );
          } else {
            drawSheetFrame(
              context,
              assets.enemies[enemy.kind],
              sourceFrame,
              sprite.frameWidth,
              sprite.frameHeight,
              centerX - width / 2,
              bottom - height,
              width,
              height,
            );
          }
          context.restore();
        };
        paintEnemySprite();
        const flashAlpha = entityFlashAlpha(enemy.id);
        if (flashAlpha > 0) {
          context.save();
          context.globalAlpha = flashAlpha;
          context.globalCompositeOperation = "screen";
          paintEnemySprite();
          context.restore();
        }

        if (
          (enemy.statuses ?? []).some(
            (status) => status.id === "corrupted" && status.turns > 0,
          )
        ) {
          context.save();
          context.strokeStyle = "rgba(201, 156, 255, .9)";
          context.shadowColor = "#9b55d8";
          context.shadowBlur = 7 * zoom;
          context.lineWidth = Math.max(1, 1.5 * zoom);
          context.beginPath();
          context.ellipse(
            centerX,
            bottom - height * 0.45,
            width * 0.55,
            height * 0.6,
            0,
            0,
            Math.PI * 2,
          );
          context.stroke();
          context.restore();
        }
        drawBurningStatus(enemy.id, visual.point, enemy.statuses ?? []);

        if (enemy.sleeping) {
          drawSpeechBubble(
            centerX,
            bottom - height - (8 + Math.sin(now / 360 + enemy.x) * 2) * zoom,
            "Zz",
            "#9dc8d6",
          );
        }

        if (enemy.hp < enemy.maxHp) {
          const barWidth = Math.max(24 * zoom, width);
          const barX = centerX - barWidth / 2;
          const barY = bottom - height - 7 * zoom;
          context.fillStyle = "rgba(0,0,0,.8)";
          context.fillRect(
            Math.round(barX - zoom),
            Math.round(barY - zoom),
            barWidth + 2 * zoom,
            5 * zoom,
          );
          context.fillStyle = "#b82f3b";
          context.fillRect(
            Math.round(barX),
            Math.round(barY),
            Math.round(barWidth * (enemy.hp / enemy.maxHp)),
            3 * zoom,
          );
        }
      };

      renderCache.sortedEnemies.forEach(drawEnemy);
      const liveEnemyIds = new Set(state.enemies.map((enemy) => enemy.id));
      defeatedEnemyVisualRef.current.forEach(({ enemy }) => {
        if (!liveEnemyIds.has(enemy.id)) drawEnemy(enemy);
      });

      const drawCompanion = (companion: Companion) => {
        if (!inViewport(companion.x, companion.y)) return;
        if (
          !revealAll &&
          !state.tiles[companion.y]?.[companion.x]?.visible
        ) {
          return;
        }
        const visual = interpolate(companion.id, companion, now);
        const definition = COMPANION_PRESENTATIONS[companion.classId];
        const usesAdventurerFrames = definition.animationSet === "adventurer";
        let frames: readonly number[] = usesAdventurerFrames
          ? PLAYER_IDLE_FRAMES
          : COMPANION_IDLE_FRAMES;
        if (companion.hp <= 0) {
          frames = usesAdventurerFrames
            ? [PLAYER_IDLE_FRAMES[0]]
            : COMPANION_DEFEAT_FRAMES;
        } else if (motionUsesRunFrames(visual.motion)) {
          frames = usesAdventurerFrames
            ? PLAYER_MOVE_FRAMES
            : COMPANION_MOVE_FRAMES;
        } else if (visual.motion?.kind === "attack") {
          frames = usesAdventurerFrames
            ? PLAYER_ATTACK_FRAMES
            : COMPANION_ATTACK_FRAMES;
        } else if (visual.motion?.kind === "interact") {
          frames = usesAdventurerFrames
            ? PLAYER_INTERACT_FRAMES
            : COMPANION_INTERACT_FRAMES;
        }
        const frameProgress = visual.motion
          ? visual.progress * frames.length
          : companion.hp <= 0
            ? frames.length - 1
            : now / 180;
        const frameWithinTier =
          frames[
            Math.min(
              frames.length - 1,
              Math.floor(frameProgress) % frames.length,
            )
          ] ?? frames[0];
        const sourceFrame = usesAdventurerFrames
          ? frameWithinTier
          : companionFrameIndex(
              companionArmorTier(companion),
              frameWithinTier,
            );
        const width = definition.frameWidth * spritePixelSize;
        const height = definition.frameHeight * spritePixelSize;
        const centerX = screenX(
          visual.point.x * TILE_SIZE + TILE_SIZE / 2,
        );
        const groundBottom = screenY(
          visual.point.y * TILE_SIZE + TILE_SIZE - 3,
        );
        const bottom = screenY(
          visual.point.y * TILE_SIZE +
            TILE_SIZE -
            3 -
            visual.spriteLift * TILE_SIZE,
        );
        const flip =
          visual.motion?.kind === "move" ||
          visual.motion?.kind === "attack"
            ? visual.motion.to.x < visual.motion.from.x
            : companion.facing === "left";
        drawEntityShadow(
          centerX,
          groundBottom,
          width,
          (companion.hp <= 0 ? 0.16 : 0.34) * visual.opacity,
        );
        const paintCompanion = () => {
          context.save();
          const isDragSource =
            companionMapDragRef.current?.moved === true &&
            companionMapDragRef.current.companionId === companion.id;
          context.globalAlpha =
            visual.opacity *
            (isDragSource
              ? 0.34
              : companion.hp <= 0
                ? 0.58
                : 1);
          if (flip) {
            context.translate(Math.round(centerX), 0);
            context.scale(-1, 1);
            drawSheetFrame(
              context,
              assets.companions[companion.classId],
              sourceFrame,
              definition.frameWidth,
              definition.frameHeight,
              -width / 2,
              bottom - height,
              width,
              height,
            );
          } else {
            drawSheetFrame(
              context,
              assets.companions[companion.classId],
              sourceFrame,
              definition.frameWidth,
              definition.frameHeight,
              centerX - width / 2,
              bottom - height,
              width,
              height,
            );
          }
          context.restore();
        };
        paintCompanion();
        const flashAlpha = entityFlashAlpha(companion.id);
        if (flashAlpha > 0) {
          context.save();
          context.globalAlpha = flashAlpha;
          context.globalCompositeOperation = "screen";
          paintCompanion();
          context.restore();
        }
        context.save();
        context.globalAlpha = visual.opacity;
        drawBurningStatus(
          companion.id,
          visual.point,
          companion.statuses ?? [],
          visual.opacity,
        );
        if (companion.hp > 0 && companion.hp < companion.maxHp) {
          const barWidth = Math.max(22 * zoom, width);
          const barX = centerX - barWidth / 2;
          const barY = bottom - height - 6 * zoom;
          context.fillStyle = "rgba(0,0,0,.8)";
          context.fillRect(
            Math.round(barX - zoom),
            Math.round(barY - zoom),
            barWidth + 2 * zoom,
            5 * zoom,
          );
          context.fillStyle = "#5faf78";
          context.fillRect(
            Math.round(barX),
            Math.round(barY),
            Math.round(barWidth * (companion.hp / companion.maxHp)),
            3 * zoom,
          );
        }
        context.restore();
      };

      renderCache.sortedCompanions.forEach((companion) => {
          const pendingDefeat = defeatedCompanionVisualRef.current.find(
            (visual) => visual.companion.id === companion.id,
          );
          drawCompanion(pendingDefeat?.companion ?? companion);
      });

      const playerMotion = playerVisual.motion;
      const playerProgress = playerVisual.progress;
      const playerDefinition = COMPANION_PRESENTATIONS[state.player.classId];
      const usesAdventurerFrames =
        playerDefinition.animationSet === "adventurer";
      let playerAction = playerActionRef.current;
      let playerActionProgress = -1;
      if (playerAction) {
        playerActionProgress =
          (now - playerAction.startedAt) / playerAction.duration;
        if (playerActionProgress >= 1) {
          playerActionRef.current = null;
          playerAction = null;
        }
      }

      let playerFrames: readonly number[] = usesAdventurerFrames
        ? PLAYER_IDLE_FRAMES
        : COMPANION_IDLE_FRAMES;
      let playerFrameProgress =
        (now / PLAYER_IDLE_FRAME_DURATION) % playerFrames.length;
      if (playerMotion?.kind === "attack") {
        playerFrames = usesAdventurerFrames
          ? PLAYER_ATTACK_FRAMES
          : COMPANION_ATTACK_FRAMES;
        playerFrameProgress = playerProgress * playerFrames.length;
      } else if (
        playerAction?.kind === "interact" &&
        playerActionProgress >= 0
      ) {
        playerFrames = usesAdventurerFrames
          ? PLAYER_INTERACT_FRAMES
          : COMPANION_INTERACT_FRAMES;
        playerFrameProgress = playerActionProgress * playerFrames.length;
      } else if (
        motionUsesRunFrames(playerMotion) ||
        (autoTravelRef.current &&
          pathRef.current.length > 0 &&
          playerMoveCycleStartedAtRef.current !== null)
      ) {
        playerFrames = usesAdventurerFrames
          ? PLAYER_MOVE_FRAMES
          : COMPANION_MOVE_FRAMES;
        const cycleStartedAt =
          playerMoveCycleStartedAtRef.current ??
          now - playerProgress * PLAYER_MOVE_DURATION;
        playerFrameProgress =
          Math.max(0, now - cycleStartedAt) / PLAYER_MOVE_FRAME_DURATION;
      }
      const playerFrameWithinTier =
        playerFrames[
          Math.min(
            playerFrames.length - 1,
            Math.floor(playerFrameProgress) % playerFrames.length,
          )
        ];
      const playerFrame = usesAdventurerFrames
        ? playerFrameWithinTier
        : companionFrameIndex(
            companionArmorTier(state.player),
            playerFrameWithinTier,
          );
      const playerWidth = playerDefinition.frameWidth * spritePixelSize;
      const playerHeight = playerDefinition.frameHeight * spritePixelSize;
      const playerCenterX = screenX(
        playerVisual.point.x * TILE_SIZE + TILE_SIZE / 2,
      );
      const playerGroundBottom = screenY(
        playerVisual.point.y * TILE_SIZE + TILE_SIZE - 2,
      );
      const playerBottom = screenY(
        playerVisual.point.y * TILE_SIZE +
          TILE_SIZE -
          2 -
          playerVisual.spriteLift * TILE_SIZE,
      );
      drawEntityShadow(
        playerCenterX,
        playerGroundBottom,
        playerWidth,
        (state.player.invisibleTurns > 0 ? 0.16 : 0.38) *
          playerVisual.opacity,
      );
      const paintPlayerSprite = () => {
        context.save();
        if (state.player.facing === "left") {
          context.translate(Math.round(playerCenterX), 0);
          context.scale(-1, 1);
          drawSheetFrame(
            context,
            assets.companions[state.player.classId],
            playerFrame,
            playerDefinition.frameWidth,
            playerDefinition.frameHeight,
            -playerWidth / 2,
            playerBottom - playerHeight,
            playerWidth,
            playerHeight,
          );
        } else {
          drawSheetFrame(
            context,
            assets.companions[state.player.classId],
            playerFrame,
            playerDefinition.frameWidth,
            playerDefinition.frameHeight,
            playerCenterX - playerWidth / 2,
            playerBottom - playerHeight,
            playerWidth,
            playerHeight,
          );
        }
        context.restore();
      };
      context.globalAlpha =
        (state.player.invisibleTurns > 0 ? 0.48 : 1) *
        playerVisual.opacity;
      paintPlayerSprite();
      context.globalAlpha = 1;
      const playerFlashAlpha = entityFlashAlpha(PLAYER_ID);
      if (playerFlashAlpha > 0) {
        context.save();
        context.globalAlpha = playerFlashAlpha;
        context.globalCompositeOperation = "screen";
        paintPlayerSprite();
        context.restore();
      }
      context.save();
      context.globalAlpha = playerVisual.opacity;
      drawBurningStatus(
        state.player.companionId,
        playerVisual.point,
        state.player.statuses ?? [],
        playerVisual.opacity,
      );
      context.restore();
      drawPixelEffects(
        context,
        pixelEffectBuckets.actor,
        now,
        pixelViewport,
      );

      for (let y = startY; y <= endY; y += 1) {
        for (let x = startX; x <= endX; x += 1) {
          const tile = state.tiles[y][x];
          const underlay = terrainUnderlayForPixelFog(tile);
          if (!underlay.draw) continue;
          const overlay = overlayFrameAt(renderCache, x, y);
          if (overlay === null) continue;
          context.globalAlpha = underlay.alpha;
          drawSheetFrame(
            context,
            assets.tiles,
            overlay,
            16,
            16,
            screenX(x * TILE_SIZE),
            screenY(y * TILE_SIZE),
            tileScreenSize,
            tileScreenSize,
          );
        }
      }
      context.globalAlpha = 1;

      (state.companions ?? []).forEach((companion) => {
        const target = companion.priorityTarget;
        const tile = target ? state.tiles[target.y]?.[target.x] : null;
        if (!target || !tile || (!revealAll && !tile.discovered)) return;
        const left = screenX(target.x * TILE_SIZE);
        const top = screenY(target.y * TILE_SIZE);
        const pulse =
          0.52 + Math.sin(now / 150 + companion.id.length) * 0.16;
        context.save();
        context.globalAlpha = pulse;
        context.strokeStyle = "#79f0c4";
        context.lineWidth = Math.max(1, zoom);
        context.strokeRect(
          left + 4 * zoom,
          top + 4 * zoom,
          tileScreenSize - 8 * zoom,
          tileScreenSize - 8 * zoom,
        );
        context.restore();
      });

      const hovered = hoverRef.current;
      if (
        hovered &&
        (revealAll ||
          state.tiles[hovered.y]?.[hovered.x]?.discovered) &&
        !cameraDragRef.current?.moved
      ) {
        const x = screenX(hovered.x * TILE_SIZE);
        const y = screenY(hovered.y * TILE_SIZE);
          context.strokeStyle = inspectModeRef.current
            ? "rgba(126, 222, 255, .95)"
            : "rgba(255, 219, 126, .9)";
        context.lineWidth = Math.max(1, 2 * zoom);
        context.strokeRect(
          Math.round(x + 3 * zoom),
          Math.round(y + 3 * zoom),
          tileScreenSize - 6 * zoom,
          tileScreenSize - 6 * zoom,
        );
      }

      const companionDrag = companionMapDragRef.current;
      if (companionDrag?.moved) {
        const companion = (state.companions ?? []).find(
          (candidate) =>
            candidate.id === companionDrag.companionId && candidate.hp > 0,
        );
        if (companion) {
          const target = companionDrag.target;
          const targetTile = target
            ? state.tiles[target.y]?.[target.x]
            : null;
          const visual = interpolate(companion.id, companion, now);
          const originX = screenX((visual.point.x + 0.5) * TILE_SIZE);
          const originY = screenY((visual.point.y + 0.5) * TILE_SIZE);
          const ghostCenterX =
            companionDrag.cursor.x - companionDrag.grabOffset.x;
          const ghostBottom =
            companionDrag.cursor.y - companionDrag.grabOffset.y;
          const definition = COMPANION_PRESENTATIONS[companion.classId];
          const usesAdventurerFrames =
            definition.animationSet === "adventurer";
          const idleFrames = usesAdventurerFrames
            ? PLAYER_IDLE_FRAMES
            : COMPANION_IDLE_FRAMES;
          const idleFrame =
            idleFrames[Math.floor(now / 180) % idleFrames.length] ??
            idleFrames[0];
          const sourceFrame = usesAdventurerFrames
            ? idleFrame
            : companionFrameIndex(
                companionArmorTier(companion),
                idleFrame,
              );
          const ghostWidth = definition.frameWidth * spritePixelSize;
          const ghostHeight = definition.frameHeight * spritePixelSize;
          const pulse = 0.72 + Math.sin(now / 105) * 0.2;
          context.save();
          context.globalAlpha = pulse;
          context.strokeStyle = "#79f0c4";
          context.fillStyle = "rgba(72, 210, 168, .18)";
          context.lineWidth = Math.max(1, zoom);
          context.setLineDash([4 * zoom, 3 * zoom]);
          context.beginPath();
          context.moveTo(originX, originY);
          context.lineTo(ghostCenterX, ghostBottom - ghostHeight / 2);
          context.stroke();
          context.setLineDash([]);
          if (target && targetTile && (revealAll || targetTile.discovered)) {
            const targetX = screenX((target.x + 0.5) * TILE_SIZE);
            const targetY = screenY((target.y + 0.5) * TILE_SIZE);
            context.fillRect(
              targetX - tileScreenSize / 2 + 2 * zoom,
              targetY - tileScreenSize / 2 + 2 * zoom,
              tileScreenSize - 4 * zoom,
              tileScreenSize - 4 * zoom,
            );
            context.strokeRect(
              targetX - tileScreenSize / 2 + 2 * zoom,
              targetY - tileScreenSize / 2 + 2 * zoom,
              tileScreenSize - 4 * zoom,
              tileScreenSize - 4 * zoom,
            );
          }
          context.restore();

          context.save();
          context.globalAlpha = 0.58;
          if (companion.facing === "left") {
            context.translate(Math.round(ghostCenterX), 0);
            context.scale(-1, 1);
            drawSheetFrame(
              context,
              assets.companions[companion.classId],
              sourceFrame,
              definition.frameWidth,
              definition.frameHeight,
              -ghostWidth / 2,
              ghostBottom - ghostHeight,
              ghostWidth,
              ghostHeight,
            );
          } else {
            drawSheetFrame(
              context,
              assets.companions[companion.classId],
              sourceFrame,
              definition.frameWidth,
              definition.frameHeight,
              ghostCenterX - ghostWidth / 2,
              ghostBottom - ghostHeight,
              ghostWidth,
              ghostHeight,
            );
          }
          context.restore();
        }
      }

      if (!revealAll) {
        const visibleBitAt = (cellX: number, cellY: number) =>
          fogMaskBitAt(renderCache, cellX, cellY, "visible");
        const discoveredBitAt = (cellX: number, cellY: number) =>
          fogMaskBitAt(renderCache, cellX, cellY, "discovered");
        const pixelFogRuntime = pixelFogRuntimeRef.current;
        const fogTextureCanvas =
          fogTextureCanvasRef.current ?? document.createElement("canvas");
        fogTextureCanvasRef.current = fogTextureCanvas;
        const fogTextureWidth = state.width * FOG_PIXELS_PER_TILE;
        const fogTextureHeight = state.height * FOG_PIXELS_PER_TILE;
        if (fogTextureCanvas.width !== fogTextureWidth) {
          fogTextureCanvas.width = fogTextureWidth;
        }
        if (fogTextureCanvas.height !== fogTextureHeight) {
          fogTextureCanvas.height = fogTextureHeight;
        }
        const fogTexture = fogTextureCanvas.getContext("2d", {
          alpha: true,
        });
        if (fogTexture) {
          fogTexture.imageSmoothingEnabled = false;
          drawPixelFogTexture(fogTexture, {
            now,
            visibilityRevision: renderCache.fogRevision,
            mapKey: state.floor,
            runtime: pixelFogRuntime,
            originCellX: state.player.x * 2 + 1,
            originCellY: state.player.y * 2 + 1,
            minCellX: 0,
            maxCellX: state.width * 2 - 1,
            minCellY: 0,
            maxCellY: state.height * 2 - 1,
            isVisible: visibleBitAt,
            isDiscovered: discoveredBitAt,
          });
          context.save();
          context.imageSmoothingEnabled = false;
          context.drawImage(
            fogTextureCanvas,
            screenX(0),
            screenY(0),
            state.width * TILE_SIZE * zoom,
            state.height * TILE_SIZE * zoom,
          );
          context.restore();
        }
      }
      const targetingOverlay = targetingOverlayRef.current;
      if (targetingOverlay) {
        const origin = partyActor(state, targetingOverlay.originActorId);
        drawTargetingOverlay(
          context,
          targetingOverlay,
          origin,
          hoverRef.current,
          now,
          {
            screenX,
            screenY,
            zoom,
            tileSize: TILE_SIZE,
          },
        );
      }
      drawPixelEffects(
        context,
        pixelEffectBuckets.overlay,
        now,
        pixelViewport,
      );

      retainInPlace(statusSignalRef.current, (signal) => {
        if (signal.holdUntilTurnEnd) {
          if (now < signal.startedAt) return true;
          const releaseProgress = signal.releasedAt
            ? (now - signal.releasedAt) / 180
            : 0;
          if (releaseProgress >= 1) return false;
          if (
            !revealAll &&
            !state.tiles[signal.y]?.[signal.x]?.visible
          ) {
            return true;
          }
          const bob =
            Math.sin((now - signal.startedAt) / 115) * 1.5 * zoom;
          drawSpeechBubble(
            screenX(signal.x * TILE_SIZE + TILE_SIZE / 2),
            screenY(signal.y * TILE_SIZE) - 7 * zoom - bob,
            signal.text,
            signal.color,
            Math.max(0, 1 - releaseProgress),
          );
          return true;
        }
        const progress = (now - signal.startedAt) / signal.duration;
        if (progress < 0) return true;
        if (progress >= 1) return false;
        if (
          !revealAll &&
          !state.tiles[signal.y]?.[signal.x]?.visible
        ) return true;
        const rise = Math.sin(progress * Math.PI) * 8 * zoom;
        const fade =
          progress < 0.7 ? 1 : (1 - progress) / 0.3;
        drawSpeechBubble(
          screenX(signal.x * TILE_SIZE + TILE_SIZE / 2),
          screenY(signal.y * TILE_SIZE) - 7 * zoom - rise,
          signal.text,
          signal.color,
          Math.max(0, fade),
        );
        return true;
      });

      retainInPlace(pickupRef.current, (pickup) => {
        const progress = (now - pickup.startedAt) / PICKUP_DURATION;
        if (progress < 0) return true;
        if (progress >= 1) return false;
        const definition = ITEM_DEFS[pickup.defId];
        if (!definition) return false;
        const eased = 1 - Math.pow(1 - progress, 3);
        const pulse = 1 + Math.sin(progress * Math.PI) * 0.24;
        const size = tileScreenSize * pulse;
        const offset = itemSpriteOffset(pickup.defId);
        const centerX = screenX(pickup.x * TILE_SIZE + TILE_SIZE / 2);
        const centerY =
          screenY(pickup.y * TILE_SIZE + TILE_SIZE / 2) -
          eased * 30 * zoom;
        const fade = progress < 0.58 ? 1 : 1 - (progress - 0.58) / 0.42;

        context.save();
        context.globalAlpha = Math.max(0, fade);
        context.translate(Math.round(centerX), Math.round(centerY));
        context.rotate(progress * Math.PI * 0.5);
        context.strokeStyle = "rgba(255, 221, 123, .9)";
        context.lineWidth = Math.max(1, 2 * zoom);
        const sparkleSize = (12 + progress * 9) * zoom;
        context.strokeRect(
          -sparkleSize / 2,
          -sparkleSize / 2,
          sparkleSize,
          sparkleSize,
        );
        context.rotate(-progress * Math.PI * 0.5);
        drawSheetFrame(
          context,
          assets.items,
          definition.sprite,
          16,
          16,
          -size / 2 + offset.x * (size / 16),
          -size / 2 + offset.y * (size / 16),
          size,
          size,
        );
        context.restore();
        return true;
      });
      context.globalAlpha = 1;

      retainInPlace(effectsRef.current, (effect) => {
        const progress = (now - effect.startedAt) / 900;
        if (progress < 0) return true;
        if (progress >= 1) return false;
        const fade =
          progress < 0.58 ? 1 : Math.max(0, (1 - progress) / 0.42);
        const travelX =
          effect.originOffsetX + effect.velocityX * progress;
        const travelY =
          effect.originOffsetY +
          effect.velocityY * progress +
          0.5 * effect.gravity * progress * progress;
        context.globalAlpha = fade;
        context.fillStyle = effect.color;
        context.font = `${Math.round(14 * zoom)}px MonaGame, monospace`;
        context.textAlign = "center";
        context.shadowColor = "#000";
        context.shadowBlur = Math.max(1, 2 * zoom);
        context.fillText(
          effect.text,
          screenX(effect.x * TILE_SIZE + TILE_SIZE / 2) + travelX * zoom,
          screenY(effect.y * TILE_SIZE + 5) + travelY * zoom,
        );
        context.shadowBlur = 0;
        return true;
      });
      context.globalAlpha = 1;

      context.fillStyle = vignette;
      context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
}
