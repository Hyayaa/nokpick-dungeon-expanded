import assert from "node:assert/strict";
import { activateCompanionSkill, createNewGame } from "../app/game/engine";
import { COMPANION_SKILLS } from "../app/game/companion-skills";
import { companionSkillBlueprint } from "../app/game/companion-skill-blueprints";
import { isWalkable, mapPointKey } from "../app/game/map";
import { isSkillTargetableTile } from "../app/game/targeting";
import type { CompanionSkillId } from "../app/game/types";

for (const skillId of Object.keys(COMPANION_SKILLS) as CompanionSkillId[]) {
  const blueprint = companionSkillBlueprint(skillId);
  assert.equal(blueprint.id, skillId);
  assert.ok(blueprint.travelMode && blueprint.impactMode);
  assert.ok(Array.isArray(blueprint.mechanics));
}

const state = createNewGame(0xc04ba7);
state.player.skills = ["shockLeap"];
state.player.skillCooldowns = {};
state.enemies = [];
const occupied = new Set([
  mapPointKey(state.player),
  ...state.companions.map(mapPointKey),
  ...state.objects.filter((object) => !object.looted).map(mapPointKey),
]);
const target = state.tiles.flatMap((row, y) => row.map((tile, x) => ({tile,x,y})))
  .find(({tile,x,y}) =>
    isWalkable(tile.terrain, false) &&
    Math.max(Math.abs(x - state.player.x), Math.abs(y - state.player.y)) >= 2 &&
    Math.max(Math.abs(x - state.player.x), Math.abs(y - state.player.y)) <= 4 &&
    isSkillTargetableTile(state, state.player, {x,y}, 4, true) &&
    !occupied.has(`${x},${y}`),
  );
assert.ok(target, "shockLeap regression needs a nearby open landing tile");
const result = activateCompanionSkill(
  state,
  state.player.companionId,
  "shockLeap",
  { x:target.x, y:target.y },
);
assert.equal(result.consumedTurn, true);
assert.ok(result.motions.some((motion) => motion.travelStyle === "leap"));
assert.ok(result.skillVisuals?.some((visual) => visual.skillId === "shockLeap"));
assert.ok((result.state.player.skillCooldowns.shockLeap ?? 0) > 0);
console.log("companion skill wrapper/executor regression passed");
