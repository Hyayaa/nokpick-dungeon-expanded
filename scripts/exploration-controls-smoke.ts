import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  autoExploreDifficultyLimit,
  isAutoExploreUnlockedForDungeon,
  type DungeonDifficulty,
} from "../app/game/campaign";

const dungeon = (difficulty: DungeonDifficulty) => ({ difficulty });
const expectations = [
  { clears: 0, highestUnlocked: 0 },
  { clears: 1, highestUnlocked: 1 },
  { clears: 2, highestUnlocked: 2 },
  { clears: 3, highestUnlocked: 3 },
  { clears: 4, highestUnlocked: 4 },
  { clears: 5, highestUnlocked: 5 },
  { clears: 6, highestUnlocked: 6 },
] as const;

expectations.forEach(({ clears, highestUnlocked }) => {
  assert.equal(autoExploreDifficultyLimit(clears), highestUnlocked);
  for (let difficulty = 1; difficulty <= 7; difficulty += 1) {
    assert.equal(
      isAutoExploreUnlockedForDungeon(
        dungeon(difficulty as DungeonDifficulty),
        clears,
      ),
      highestUnlocked >= 1 && difficulty <= highestUnlocked,
      `boss clears ${clears} must unlock only through difficulty ${highestUnlocked}`,
    );
  }
});

assert.equal(autoExploreDifficultyLimit(99), 6);
assert.equal(isAutoExploreUnlockedForDungeon(dungeon(7), 99), false);
assert.equal(isAutoExploreUnlockedForDungeon(dungeon(3), 3), true);
assert.equal(
  isAutoExploreUnlockedForDungeon(dungeon(4), 3),
  false,
  "clearing the C-tier boss must unlock D and lower, not C itself",
);

for (let difficulty = 1; difficulty <= 7; difficulty += 1) {
  const developerMode = true;
  assert.equal(
    developerMode ||
      isAutoExploreUnlockedForDungeon(
        dungeon(difficulty as DungeonDifficulty),
        0,
      ),
    true,
    "developer mode must unlock auto-explore at every tier",
  );
}

const dungeonUiSource = readFileSync("app/components/DungeonGame.tsx", "utf8");
assert.doesNotMatch(dungeonUiSource, /AUTO_EXPLORATION_ENABLED/);
assert.match(
  dungeonUiSource,
  /autoExploreAllowed=\{[\s\S]*developerMode \|\|[\s\S]*isAutoExploreUnlockedForDungeon\([\s\S]*campaign\.bossDungeonClears/,
  "Campaign must pass a computed permission instead of progression state into DungeonRun",
);
assert.match(
  dungeonUiSource,
  /const startAutoExplore = useCallback\(\(\) => \{\s*if \(!autoExploreAllowed\) return;/,
  "locked dungeons must reject direct auto-explore entry",
);
assert.match(
  dungeonUiSource,
  /if \(autoExploreAllowed\) return;[\s\S]*cancelAutoExploreRuntime\(\)/,
  "revoking developer override must stop an active locked run",
);
assert.match(
  dungeonUiSource,
  /className={`auto-explore-primary[\s\S]*onClick=\{autoExploring \? stopAutoExplore : startAutoExplore\}[\s\S]*자동탐사 중지/,
  "unlocked dungeons must expose start and stop controls",
);
assert.match(
  dungeonUiSource,
  /자동탐사 잠김[\s\S]*클리어한 보스보다 낮은 등급의 던전/,
  "locked dungeons must show progression guidance instead of an action button",
);
assert.match(
  dungeonUiSource,
  /state\.player\.hp \/ Math\.max\(1, state\.player\.maxHp\) < 0\.2[\s\S]*stopAutoExploreOnFullBag[\s\S]*inventorySlotCount\(state\.player\) >= MAX_INVENTORY_SLOTS/,
  "health and full-bag safety stops must remain in the existing loop",
);
assert.match(
  dungeonUiSource,
  /resumeAutoExploreAfterUiActionRef[\s\S]*resumeAutoExploreAfterAugmentRef[\s\S]*autoPickupIfSafe/,
  "UI resume, augment resume, and safe pickup paths must remain wired",
);
assert.match(
  dungeonUiSource,
  /자동탐사는 클리어한 보스 던전보다 낮은 등급[\s\S]*Developer mode enables it at every dungeon[\s\S]*tier/,
  "Korean and English help must describe progression and developer override",
);

console.log("exploration controls smoke checks passed");
