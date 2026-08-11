import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DungeonGame from "../app/components/DungeonGame";
import {
  BOSS_DUNGEON_STAGES,
  DUNGEON_DEFINITIONS,
  bossDifficultyForClears,
  bossDungeonClearsAfterOutcome,
  companionToPlayer,
  createBossDungeonOffer,
  createStarterCompanionRoster,
  generateDungeonOffers,
  maximumRecommendedDifficulty,
  normalizeCompanionForHubWithReleasedItems,
  normalizeBossDungeonClears,
} from "../app/game/campaign";
import { COMPANION_CLASS_IDS } from "../app/game/companions";
import { ITEM_DEFS } from "../app/game/data";
import { createPlainEquipmentInstance } from "../app/game/equipment";
import {
  createExpeditionGame,
  createNewGame,
  descendFloor,
} from "../app/game/engine";

const seed = 0xd09e7001;
const initial = generateDungeonOffers(seed, 0);
const initialRecommended = initial.filter(
  (dungeon) => dungeon.offerKind === "recommended",
);
const initialBoss = initial[5];

assert.equal(initial.length, 6);
assert.equal(initialRecommended.length, 5);
assert.equal(initialBoss.offerKind, "boss");
assert.equal(initialBoss.difficulty, 2);
assert.equal(initialBoss.difficultyGrade, "E");
assert.equal(initialBoss.themeId, "flooded_sewers");
assert.equal(initialBoss.bossId, "goo");
assert.equal(initialBoss.floorCount, 2);
assert.ok(initialBoss.mainDropIds.length > 0, "boss loot generation must stay intact");
assert.ok(initialBoss.lootPlan.length > 0, "boss floor loot planning must stay intact");
assert.ok(
  initialRecommended.every(
    (dungeon) => dungeon.difficulty === 1 || dungeon.difficulty === 2,
  ),
);
assert.ok(initialRecommended.some((dungeon) => dungeon.difficulty === 1));
assert.ok(initialRecommended.some((dungeon) => dungeon.difficulty === 2));
assert.ok(
  initialRecommended.every(
    (dungeon) => dungeon.themeId !== initialBoss.themeId,
  ),
  "the active boss theme must be excluded from recommendations",
);
assert.ok(initialRecommended.every((dungeon) => dungeon.bossId === undefined));
assert.deepEqual(initial, generateDungeonOffers(seed, 0));

const firstFloorBase = createNewGame(seed + 1);
const firstFloor = createExpeditionGame(
  seed + 1,
  {
    dungeonId: initialBoss.id,
    dungeonName: initialBoss.nameKo,
    maxFloor: initialBoss.floorCount,
    difficultyScale: initialBoss.difficultyScale,
    difficulty: initialBoss.difficulty,
    bossId: initialBoss.bossId,
    mainDropIds: initialBoss.mainDropIds,
    specialRoomPlan: initialBoss.specialRoomPlan,
    lootPlan: initialBoss.lootPlan,
    goldPlan: initialBoss.goldPlan,
    quests: [],
  },
  firstFloorBase.player,
  [],
);
assert.equal(firstFloor.floor, 1);
assert.equal(firstFloor.bossEncounter, undefined);
assert.ok(firstFloor.enemies.length > 0, "boss dungeon floor 1 must stay ordinary");
const bossFloor = descendFloor(firstFloor);
assert.equal(bossFloor.floor, 2);
assert.equal(bossFloor.bossEncounter?.bossId, "goo");

assert.deepEqual(BOSS_DUNGEON_STAGES[2], {
  difficulty: 2,
  bossId: "goo",
  themeId: "flooded_sewers",
  floorCount: 2,
});
assert.equal(Object.values(BOSS_DUNGEON_STAGES).filter(Boolean).length, 1);

const afterGoo = bossDungeonClearsAfterOutcome(0, initialBoss, "completed");
assert.equal(afterGoo, 1);
const unlockedD = generateDungeonOffers(seed + 2, afterGoo);
const recommendedD = unlockedD.slice(0, 5);
const pendingD = unlockedD[5];
assert.ok(recommendedD.every((dungeon) => dungeon.difficulty <= 3));
assert.ok(recommendedD.some((dungeon) => dungeon.difficulty === 1));
assert.ok(recommendedD.some((dungeon) => dungeon.difficulty === 3));
assert.equal(pendingD.offerKind, "boss");
assert.equal(pendingD.difficulty, 3);
assert.equal(pendingD.difficultyGrade, "D");
assert.equal(pendingD.bossId, undefined);
assert.equal(pendingD.nameKo, "다음 보스 준비 중");

for (const [clears, expected] of [
  [0, 2],
  [1, 3],
  [2, 4],
  [3, 5],
  [4, 6],
  [5, 7],
  [100, 7],
] as const) {
  assert.equal(maximumRecommendedDifficulty(clears), expected);
  assert.equal(bossDifficultyForClears(clears), expected);
  const offers = generateDungeonOffers(seed + clears, clears);
  const recommended = offers.slice(0, 5);
  assert.ok(recommended.every((dungeon) => dungeon.difficulty <= expected));
  assert.ok(recommended.some((dungeon) => dungeon.difficulty === 1));
  assert.ok(recommended.some((dungeon) => dungeon.difficulty === expected));
  assert.equal(offers[5].difficulty, expected);
  assert.equal(offers[5].offerKind, "boss");
}

assert.equal(normalizeBossDungeonClears(undefined), 0);
assert.equal(normalizeBossDungeonClears(Number.NaN), 0);
assert.equal(normalizeBossDungeonClears(-4), 0);
assert.equal(normalizeBossDungeonClears(3.9), 3);
assert.equal(bossDungeonClearsAfterOutcome(4, initial[0], "completed"), 4);
assert.equal(bossDungeonClearsAfterOutcome(4, initialBoss, "retreated"), 4);
assert.equal(bossDungeonClearsAfterOutcome(4, initialBoss, "defeated"), 4);
assert.equal(
  bossDungeonClearsAfterOutcome(
    4,
    { offerKind: undefined },
    "completed",
  ),
  4,
  "developer boss floors must not advance campaign boss progression",
);
assert.equal(createBossDungeonOffer(seed, 100).difficulty, 7);
assert.equal(createBossDungeonOffer(seed, 100).bossId, undefined);

assert.equal(DUNGEON_DEFINITIONS.length, 6);
const initialHubHtml = renderToStaticMarkup(createElement(DungeonGame));
const campaignHeaderActions = initialHubHtml.match(
  /<nav class="campaign-header-actions"[\s\S]*?<\/nav>/,
)?.[0];
assert.ok(campaignHeaderActions, "the Hub header actions must render");
assert.equal(
  (initialHubHtml.match(/class="dungeon-contract"/g) ?? []).length,
  6,
);
assert.equal(
  (initialHubHtml.match(/class="main-drops"/g) ?? []).length,
  5,
);
assert.match(
  initialHubHtml,
  /파밍용 추천 던전 5개와 보스 진행 던전 1개입니다\./,
);
assert.match(campaignHeaderActions, />도감</);
assert.match(campaignHeaderActions, />설정</);
assert.match(campaignHeaderActions, />탐사 안내</);
assert.doesNotMatch(campaignHeaderActions, /상점|대장간|훈련장|창고/);
assert.match(initialHubHtml, />전체 창고 열기</);
assert.match(initialHubHtml, />상점 열기</);
assert.match(initialHubHtml, />대장간 열기</);
assert.match(initialHubHtml, />훈련장 열기</);
assert.match(initialHubHtml, /보스 던전/);
assert.match(initialHubHtml, /<dt>보스<\/dt><dd>구<\/dd>/);
const uiSource = readFileSync("app/components/DungeonGame.tsx", "utf8");
assert.match(
  uiSource,
  /generateDungeonOffers\([\s\S]*campaign\.offerSeed,[\s\S]*campaign\.bossDungeonClears/,
);
assert.match(uiSource, /const isBossOffer = dungeon\.offerKind === "boss"/);
assert.match(uiSource, /\{!isBossOffer && \([\s\S]*className="main-drops"/);
assert.match(uiSource, /disabled=\{isPendingBoss\}/);
assert.match(
  uiSource,
  /bossDungeonClears: bossDungeonClearsAfterOutcome\([\s\S]*finishedDungeon,[\s\S]*outcome/,
);

const starterRoster = createStarterCompanionRoster(COMPANION_CLASS_IDS);
for (const companion of starterRoster) {
  assert.equal(companion.equipmentInstances.weapon?.grade, "F");
  assert.equal(companion.equipmentInstances.armor?.grade, "F");
}
const starterLeader = companionToPlayer(starterRoster[0]);
assert.equal(starterLeader.equipmentInstances.weapon?.grade, "F");
assert.equal(starterLeader.equipmentInstances.armor?.grade, "F");
assert.equal(
  createPlainEquipmentInstance(ITEM_DEFS.shortsword, "default-grade").grade,
  "C",
  "the shared plain-equipment default must remain C",
);
const legacyCompanion = createStarterCompanionRoster(["warrior"])[0];
legacyCompanion.equipmentInstances.weapon = createPlainEquipmentInstance(
  ITEM_DEFS.shortsword,
  "legacy-c-weapon",
  "C",
);
legacyCompanion.equipmentInstances.armor = createPlainEquipmentInstance(
  ITEM_DEFS.leather_armor,
  "legacy-a-armor",
  "A",
);
const restoredLegacy = normalizeCompanionForHubWithReleasedItems(
  legacyCompanion,
).companion;
assert.equal(restoredLegacy.equipmentInstances.weapon?.grade, "C");
assert.equal(restoredLegacy.equipmentInstances.armor?.grade, "A");

console.log("Dungeon offer and boss-gate progression smoke checks passed.");
