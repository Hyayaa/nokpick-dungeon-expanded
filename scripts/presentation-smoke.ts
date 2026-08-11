import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import {
  dungeonMusicPath,
  GAME_SOUND_PATHS,
  GameAudioRuntime,
  ORIGINAL_DUNGEON_MUSIC_PATHS,
} from "../app/presentation/audio-runtime";
import { placeDescriptionWindow } from "../app/presentation/description-placement";
import {
  hasProjectileLineOfFire,
  skillTargetableTiles,
} from "../app/game/targeting";
import type { DungeonObject, Terrain, Tile } from "../app/game/types";
import {
  fogMasksForTile,
  SEWER_TILE_FRAMES,
} from "../app/presentation/render";
import { targetingOutlineSegments } from "../app/presentation/targeting-overlay";

const targetingTile = (terrain: Terrain = "floor"): Tile => ({
  terrain,
  discovered: true,
  visible: true,
  discoveredMask: 15,
  visibleMask: 15,
  variant: 0,
});
const targetingState = (width: number, height: number) => ({
  width,
  height,
  tiles: Array.from({ length: height }, () =>
    Array.from({ length: width }, () => targetingTile())),
  objects: [] as DungeonObject[],
});

const partialChasmWallFog = fogMasksForTile(
  {
    ...targetingTile("chasm"),
    visibleMask: 1,
    discoveredMask: 5,
  },
  SEWER_TILE_FRAMES.chasmWall,
);
assert.deepEqual(
  partialChasmWallFog,
  { visibleMask: 1, discoveredMask: 5 },
  "the chasm-wall lower face must preserve quarter-tile fog masks",
);
assert.deepEqual(
  fogMasksForTile(
    {
      ...targetingTile("floor"),
      visibleMask: 1,
      discoveredMask: 5,
    },
    SEWER_TILE_FRAMES.floor,
  ),
  { visibleMask: 15, discoveredMask: 15 },
  "ordinary floor must keep its full-tile reveal rule",
);

const circularState = targetingState(17, 17);
const circularOrigin = { x: 8, y: 8 };
assert.deepEqual(
  skillTargetableTiles(circularState, circularOrigin, 0, true),
  [circularOrigin],
  "a zero-range skill overlay must contain only its caster tile",
);
const centeredSkillRange = skillTargetableTiles(
  circularState,
  circularOrigin,
  8,
  true,
);
assert.equal(
  centeredSkillRange.length,
  197,
  "a range-eight skill must use the integer tiles inside a radius-eight circle",
);
assert.equal(
  centeredSkillRange.some(({ x, y }) => x === 16 && y === 16),
  false,
  "the former square corner must stay outside the circular skill range",
);
assert.equal(
  centeredSkillRange.some(({ x, y }) => x === 16 && y === 8),
  true,
  "the radius-eight axis endpoint must remain targetable",
);

const lineState = targetingState(9, 5);
const lineOrigin = { x: 1, y: 2 };
const lineTarget = { x: 7, y: 2 };
lineState.tiles[2][4].terrain = "highGrass";
assert.equal(
  hasProjectileLineOfFire(lineState, lineOrigin, lineTarget),
  true,
  "dense grass may hide a tile but must not block a skill projectile",
);
lineState.tiles[2][4].terrain = "wall";
assert.equal(
  hasProjectileLineOfFire(lineState, lineOrigin, lineTarget),
  false,
  "a wall must remove every target tile behind it from line of fire",
);
lineState.tiles[2][4].terrain = "door";
assert.equal(
  hasProjectileLineOfFire(lineState, lineOrigin, lineTarget),
  false,
  "a closed door must block the same targeting line as a wall",
);
lineState.tiles[2][4].terrain = "floor";
lineState.objects.push({
  id: "targeting-chest",
  kind: "chest",
  looted: false,
  loot: [],
  x: 4,
  y: 2,
});
assert.equal(
  hasProjectileLineOfFire(lineState, lineOrigin, lineTarget),
  false,
  "an unopened dungeon object must block the skill tiles behind it",
);
lineState.objects[0].looted = true;
assert.equal(
  hasProjectileLineOfFire(lineState, lineOrigin, lineTarget),
  true,
  "a cleared object tile must stop acting as a projectile obstacle",
);

assert.equal(
  targetingOutlineSegments([{ x: 0, y: 0 }, { x: 1, y: 0 }]).length,
  6,
  "adjacent range tiles must omit their shared edge instead of drawing a grid",
);
const targetingOverlaySource = readFileSync(
  "app/presentation/targeting-overlay.ts",
  "utf8",
);
const rangeDrawingSource = targetingOverlaySource.slice(
  targetingOverlaySource.indexOf("if (rangeTiles.length)"),
  targetingOverlaySource.indexOf("const targetCandidate"),
);
assert.doesNotMatch(
  rangeDrawingSource,
  /fillRect|strokeRect/,
  "skill range rendering must draw only its exposed outline, never filled cells or a tile grid",
);

assert.equal(
  dungeonMusicPath({ themeId: "prison_ruins" }, 2),
  "/assets/music/prison_2.ogg",
  "dungeon music must select the original region and rotate by floor",
);
assert.equal(
  dungeonMusicPath({ themeId: "unknown_theme" }, 4),
  "/assets/music/sewers_1.ogg",
  "unknown themes must fall back to the original sewer soundtrack",
);
assert.equal(
  ORIGINAL_DUNGEON_MUSIC_PATHS.length,
  15,
  "all three regular tracks from five original dungeon regions must ship",
);
for (const path of ORIGINAL_DUNGEON_MUSIC_PATHS) {
  const publicPath = `public${path}`;
  assert.equal(
    existsSync(publicPath) && statSync(publicPath).size > 0,
    true,
    `${path} must contain an original Shattered Pixel Dungeon music asset`,
  );
}
for (const [soundId, path] of Object.entries(GAME_SOUND_PATHS)) {
  const publicPath = `public${path}`;
  assert.equal(
    existsSync(publicPath) && statSync(publicPath).size > 0,
    true,
    `${soundId} must resolve to a packaged sound asset`,
  );
}
assert.equal(
  GAME_SOUND_PATHS.uiClick,
  "/assets/sounds/click.mp3",
  "interface controls must use the original click sound",
);
const dungeonGameSource = readFileSync(
  "app/components/DungeonGame.tsx",
  "utf8",
);
const dungeonCssSource = readFileSync("app/globals.css", "utf8");
assert.match(
  dungeonGameSource,
  /function HeldItemCursor[\s\S]*createPortal\([\s\S]*document\.body/,
  "all held item cursors must render in one unscaled viewport-level portal",
);
assert.match(
  dungeonGameSource,
  /style=\{\{ left: held\.clientX, top: held\.clientY \}\}/,
  "the held item cursor must use raw viewport pointer coordinates",
);
assert.doesNotMatch(
  dungeonGameSource,
  /held\.clientX\s*[+-]|held\.clientY\s*[+-]/,
  "held item rendering must not add a scale-specific magic offset",
);
assert.match(
  dungeonGameSource,
  /document[\s\S]*\.elementFromPoint\(event\.clientX, event\.clientY\)/,
  "drop targeting must continue to use viewport pointer coordinates",
);
assert.match(
  dungeonCssSource,
  /\.held-item-cursor\s*\{[\s\S]*position:\s*fixed;[\s\S]*transform:\s*translate\(-50%, -50%\)/,
  "the portal cursor must stay fixed and centered at 0.8x, 1x, and 1.2x UI scale",
);
assert.equal(
  (dungeonGameSource.match(/new GameAudioRuntime\(\)/g) ?? []).length,
  1,
  "hub UI, dungeon effects, skills, and music must share one audio runtime",
);
assert.match(
  dungeonGameSource,
  /function CharacterResourceBars[\s\S]*is-health[\s\S]*is-\$\{resourceType\}/,
  "party portraits must render HP plus exactly the profession's primary resource bar",
);
assert.match(dungeonCssSource, /\.character-resource-bar\.is-stamina > i[\s\S]*#d4b64f/);
assert.match(dungeonCssSource, /\.character-resource-bar\.is-mana > i[\s\S]*#4f83d4/);
assert.match(
  dungeonGameSource,
  /skill-resource-cost[\s\S]*skill\.resourceCost/,
  "skill details must derive cost metadata from the skill definition",
);
assert.match(
  dungeonGameSource,
  /function TrainingGroundModal[\s\S]*CampaignWarehouseInventory[\s\S]*CampaignCompanionEquipmentRoster/,
  "the Training Ground must reuse the shared warehouse and companion facility panels",
);
assert.match(
  dungeonGameSource,
  /training-equipped-slots[\s\S]*\(\[0, 1\] as const\)\.map/,
  "the Training Ground must render exactly two equipped skill slots",
);
assert.match(
  dungeonGameSource,
  /function TrainingGroundModal[\s\S]*is-unlearned[\s\S]*trainingCost/,
  "unlearned skills must remain inspectable and derive their price from skill metadata",
);
assert.match(
  dungeonGameSource,
  /application\/x-nokpick-companion[\s\S]*onDoubleClick[\s\S]*onTrainingSelect/,
  "companions must support drag and double-click Training Ground selection",
);
assert.match(
  dungeonCssSource,
  /\.training-skill-card\.is-unlearned[\s\S]*opacity:\s*0\.58/,
  "unlearned skills must be dimmed without hiding their presentation",
);
assert.match(
  dungeonGameSource,
  /CampaignHeader[\s\S]*CAMPAIGN_MATERIAL_KINDS\.map[\s\S]*CAMPAIGN_MATERIAL_NAMES/,
  "the Hub ledger must show Gold and all three campaign materials",
);
assert.match(
  dungeonGameSource,
  /selectedSkill\.trainingMaterials\[kind\][\s\S]*campaign\.materials\[kind\]/,
  "Training Ground requirements must derive material costs from skill metadata",
);
assert.match(
  dungeonGameSource,
  /smithyUpgradeRequirements\(campaign, currentGrade\)[\s\S]*보유 룬석/,
  "the Blacksmith must show its shared Gold and Runestone requirement state",
);
assert.doesNotMatch(
  dungeonGameSource,
  /selected\s*=\s*candidates\.find\([\s\S]{0,240}\?\?\s*upgradeableCandidates\[0\]/,
  "the Blacksmith must never auto-select its first upgrade candidate",
);
assert.match(
  dungeonGameSource,
  /selected\s*=\s*candidates\.find\([\s\S]{0,180}\?\?\s*null[\s\S]*강화할 아이템을 선택하세요\./,
  "the Blacksmith must enter an explicit empty target state",
);
assert.match(
  dungeonGameSource,
  /skill-level-badge[\s\S]*normalizeCompanionSkillLevel\(companion\.skillLevels\?\.\[skillId\]\)/,
  "learned and equipped Training Ground skills must show their saved level",
);
assert.match(
  dungeonGameSource,
  /현재 효과[\s\S]*companionSkillEffectSummary[\s\S]*다음 레벨[\s\S]*levelRequirement\.nextLevel/,
  "Training Ground details must derive current and next level effects",
);
assert.match(
  dungeonGameSource,
  /levelCompanionSkill\(campaign, companion\.id, selectedSkillId\)[\s\S]*onClick=\{levelSelected\}/,
  "skill level-up must require its explicit detail button transaction",
);
assert.match(dungeonCssSource, /\.skill-level-badge\s*\{/);
assert.match(
  dungeonGameSource,
  /results-materials[\s\S]*result\.materialsGained\[kind\]/,
  "expedition results must show only materials converted on that return",
);

const panel = { width: 240, height: 180 };
const viewport = { width: 1000, height: 700 };
assert.deepEqual(
  placeDescriptionWindow(
    { left: 120, right: 160, top: 90, bottom: 130 },
    panel,
    viewport,
  ),
  { left: 170, top: 90, side: "right" },
  "description windows should open beside the selected element",
);
assert.deepEqual(
  placeDescriptionWindow(
    { left: 920, right: 960, top: 650, bottom: 690 },
    panel,
    viewport,
  ),
  { left: 670, top: 510, side: "left" },
  "description windows should flip and remain inside viewport margins",
);
assert.deepEqual(
  placeDescriptionWindow(
    { left: -20, right: 0, top: -10, bottom: 10 },
    panel,
    viewport,
  ),
  { left: 10, top: 10, side: "right" },
  "description windows should clamp to the top-left viewport margin",
);

type FakeAudioAttempt = {
  src: string;
  audible: boolean;
};

class FakeAudioElement {
  static allowAudiblePlayback = false;
  static attempts: FakeAudioAttempt[] = [];

  src: string;
  preload = "";
  loop = false;
  volume = 1;
  muted = false;
  playbackRate = 1;
  currentTime = 0;
  paused = true;

  constructor(src = "") {
    this.src = src;
  }

  load() {}

  pause() {
    this.paused = true;
  }

  addEventListener() {}

  cloneNode() {
    const clone = new FakeAudioElement(this.src);
    clone.preload = this.preload;
    clone.loop = this.loop;
    clone.volume = this.volume;
    clone.muted = this.muted;
    clone.playbackRate = this.playbackRate;
    return clone;
  }

  play() {
    const audible = !this.muted && this.volume > 0;
    FakeAudioElement.attempts.push({ src: this.src, audible });
    if (audible && !FakeAudioElement.allowAudiblePlayback) {
      this.paused = true;
      return Promise.reject(new Error("NotAllowedError"));
    }
    this.paused = false;
    return Promise.resolve();
  }
}

const audioDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Audio");
try {
  Object.defineProperty(globalThis, "Audio", {
    configurable: true,
    value: FakeAudioElement,
  });
  const runtime = new GameAudioRuntime();
  runtime.preload();

  await runtime.unlock();
  assert.equal(
    FakeAudioElement.attempts.length,
    0,
    "a muted primer must never claim that audible browser media is unlocked",
  );

  runtime.setMusic("/assets/music/sewers_1.ogg");
  await Promise.resolve();
  assert.equal(
    FakeAudioElement.attempts.length,
    0,
    "music must wait for a trusted audible unlock instead of a muted primer",
  );

  runtime.play("step", 0.62);
  assert.deepEqual(
    FakeAudioElement.attempts.at(-1),
    { src: GAME_SOUND_PATHS.step, audible: true },
    "sound playback must still attempt the known-working direct HTML media path",
  );
  await Promise.resolve();

  FakeAudioElement.allowAudiblePlayback = true;
  const attemptsBeforeGesture = FakeAudioElement.attempts.length;
  const trustedPlayback = runtime.unlockAndPlay("uiClick", 0.5, 1.04);
  assert.deepEqual(
    FakeAudioElement.attempts[attemptsBeforeGesture],
    { src: GAME_SOUND_PATHS.uiClick, audible: true },
    "the first audible UI cue must start synchronously inside the trusted gesture",
  );
  await trustedPlayback;
  assert.equal(
    FakeAudioElement.attempts.some(
      ({ src, audible }) => src.endsWith("/assets/music/sewers_1.ogg") && audible,
    ),
    true,
    "the same trusted gesture must start the selected dungeon music",
  );
  runtime.destroy();
} finally {
  if (audioDescriptor) {
    Object.defineProperty(globalThis, "Audio", audioDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, "Audio");
  }
}

console.log("presentation smoke checks passed");
