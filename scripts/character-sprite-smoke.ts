import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { ENEMY_SPRITES } from "../app/game/data";
import type {
  CompanionClassId,
  CompanionProfessionId,
} from "../app/game/types";
import {
  CHARACTER_VISUALS_BY_PROFESSION,
  COMPANION_VISUALS,
  characterPresentation,
} from "../app/presentation/companion-visuals";
import {
  PLAYER_ATTACK_FRAMES,
  PLAYER_IDLE_FRAMES,
  PLAYER_INTERACT_FRAMES,
  PLAYER_MOVE_FRAMES,
} from "../app/presentation/player-animation";

const expectedSprites: Record<CompanionProfessionId, string> = {
  cleric: "/assets/sprites/characters/cleric.png",
  rogue: "/assets/sprites/characters/rogue.png",
  mage: "/assets/sprites/characters/mage.png",
  warrior: "/assets/sprites/characters/warrior.png",
};

const representativeClasses: Record<CompanionProfessionId, CompanionClassId> = {
  cleric: "cleric",
  rogue: "rogue",
  mage: "mage",
  warrior: "warrior",
};

for (const professionId of Object.keys(expectedSprites) as CompanionProfessionId[]) {
  const expectedSprite = expectedSprites[professionId];
  const professionVisual = CHARACTER_VISUALS_BY_PROFESSION[professionId];
  assert.equal(professionVisual.sprite, expectedSprite);
  assert.deepEqual(
    {
      sheetWidth: professionVisual.sheetWidth,
      sheetHeight: professionVisual.sheetHeight,
      frameWidth: professionVisual.frameWidth,
      frameHeight: professionVisual.frameHeight,
      animationSet: professionVisual.animationSet,
    },
    {
      sheetWidth: 192,
      sheetHeight: 72,
      frameWidth: 24,
      frameHeight: 24,
      animationSet: "adventurer",
    },
  );

  const playerVisual = characterPresentation({
    classId: representativeClasses[professionId],
    professionId,
  });
  const companionVisual = characterPresentation({
    classId: "adventurer",
    professionId,
  });
  assert.equal(playerVisual.sprite, expectedSprite, `${professionId} player mapping`);
  assert.equal(
    companionVisual.sprite,
    expectedSprite,
    `${professionId} companion mapping`,
  );

  const spritePath = `public${expectedSprite}`;
  assert.equal(existsSync(spritePath), true);
  const bytes = readFileSync(spritePath);
  assert.equal(bytes.readUInt32BE(16), 192);
  assert.equal(bytes.readUInt32BE(20), 72);
}

assert.equal(COMPANION_VISUALS.huntress.sprite, expectedSprites.rogue);
assert.equal(COMPANION_VISUALS.duelist.sprite, expectedSprites.warrior);
assert.equal(COMPANION_VISUALS.adventurer.sprite, expectedSprites.warrior);

const allCharacterFrames = [
  ...PLAYER_IDLE_FRAMES,
  ...PLAYER_ATTACK_FRAMES,
  ...PLAYER_INTERACT_FRAMES,
  ...PLAYER_MOVE_FRAMES,
];
assert.equal(Math.min(...allCharacterFrames), 0);
assert.equal(Math.max(...allCharacterFrames), 23);
assert.equal(new Set(allCharacterFrames).size, 24);

const rendererSource = readFileSync("app/presentation/dungeon-renderer.ts", "utf8");
const uiSource = readFileSync("app/components/DungeonGame.tsx", "utf8");
const runtimeAssetSource = readFileSync("app/presentation/runtime-assets.ts", "utf8");
const cssSource = readFileSync("app/globals.css", "utf8");
const localBuildSource = readFileSync("scripts/build-local-bundle.sh", "utf8");
const presentationSource = readFileSync(
  "app/presentation/companion-visuals.ts",
  "utf8",
);

assert.match(
  rendererSource,
  /const definition = characterPresentation\(companion\)[\s\S]*resolveCharacterAnimationFrame/,
);
assert.match(
  rendererSource,
  /const playerDefinition = characterPresentation\(state\.player\)[\s\S]*playerDefinition\.frameWidth[\s\S]*playerCenterX - playerWidth \/ 2/,
);
assert.match(rendererSource, /imageSmoothingEnabled = false/);
assert.doesNotMatch(rendererSource, /COMPANION_(?:IDLE|MOVE|ATTACK|INTERACT|DEFEAT)_FRAMES/);
assert.match(uiSource, /characterPresentation\(controlledCharacter\)/);
assert.match(uiSource, /characterPresentation\(game\.player\)/);
assert.doesNotMatch(
  `${rendererSource}\n${uiSource}\n${runtimeAssetSource}\n${presentationSource}\n${cssSource}\n${localBuildSource}`,
  /\/assets\/sprites\/(?:player\.png|companions\/)/,
);
for (const sprite of Object.values(expectedSprites)) {
  assert.match(runtimeAssetSource, new RegExp(sprite.replaceAll("/", "\\/")));
}

for (const definition of Object.values(ENEMY_SPRITES)) {
  assert.equal(
    existsSync(`public${definition.file}`),
    true,
    `enemy sprite must remain available: ${definition.file}`,
  );
}

console.log("24x24 player and companion sprite smoke checks passed");
