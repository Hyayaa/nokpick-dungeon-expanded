import { bossDefinition } from "./boss-definitions";
import { random } from "./random";
import type {
  CombatEffect,
  Companion,
  Enemy,
  GameState,
  Player,
  StatusEffect,
} from "./types";

type PartyTarget = Player | Companion;

const addStatus = (
  statuses: StatusEffect[],
  id: StatusEffect["id"],
  turns: number,
  power = 1,
) => {
  const current = statuses.find((status) => status.id === id);
  if (current) {
    current.turns = Math.max(current.turns, turns);
    current.power = Math.max(current.power, power);
  } else {
    statuses.push({ id, turns, power });
  }
};

const isGooBoss = (state: GameState, enemy: Enemy) =>
  state.bossEncounter?.bossId === "goo" &&
  state.bossEncounter.bossEnemyId === enemy.id &&
  enemy.kind === "goo_boss";

export const initializeBossBehaviorInPlace = (
  state: GameState,
  boss: Enemy,
) => {
  if (!isGooBoss(state, boss)) return;
  boss.behaviorState = {
    ...(boss.behaviorState ?? {}),
    gooBaseAttack: boss.attack,
    gooBaseAccuracy: boss.accuracy,
    gooBaseDefense: boss.defense,
  };
};

export const syncBossPhaseInPlace = (
  state: GameState,
  boss: Enemy,
) => {
  const encounter = state.bossEncounter;
  if (!encounter || !isGooBoss(state, boss)) return false;
  const threshold = bossDefinition("goo").phaseThreshold ?? 0.5;
  const enteredPhaseTwo =
    boss.hp > 0 &&
    encounter.phase !== 2 &&
    boss.hp / Math.max(1, boss.maxHp) <= threshold;
  if (enteredPhaseTwo) {
    encounter.phase = 2;
    state.logs.push("구가 격노했습니다!");
  }
  if (encounter.phase !== 2) return false;

  const baseAttack = Number(boss.behaviorState?.gooBaseAttack ?? boss.attack);
  const baseAccuracy = Number(boss.behaviorState?.gooBaseAccuracy ?? boss.accuracy);
  const baseDefense = Number(boss.behaviorState?.gooBaseDefense ?? boss.defense);
  boss.behaviorState = {
    ...(boss.behaviorState ?? {}),
    gooBaseAttack: baseAttack,
    gooBaseAccuracy: baseAccuracy,
    gooBaseDefense: baseDefense,
  };
  boss.attack = Math.max(1, Math.round(baseAttack * 1.35));
  boss.accuracy = Math.max(1, Math.round(baseAccuracy * 1.25));
  boss.defense = Math.max(1, Math.round(baseDefense * 1.25));
  return enteredPhaseTwo;
};

export const runBossTurnStartInPlace = (
  state: GameState,
  boss: Enemy,
  effects: CombatEffect[],
) => {
  syncBossPhaseInPlace(state, boss);
  if (
    !isGooBoss(state, boss) ||
    state.tiles[boss.y]?.[boss.x]?.terrain !== "water" ||
    boss.hp >= boss.maxHp
  ) return 0;
  const ratio = state.bossEncounter?.phase === 2 ? 0.03 : 0.02;
  const healing = Math.min(
    boss.maxHp - boss.hp,
    Math.max(1, Math.round(boss.maxHp * ratio)),
  );
  boss.hp = Math.min(boss.maxHp, boss.hp + healing);
  effects.push({
    x: boss.x,
    y: boss.y,
    text: `+${healing}`,
    color: "#6fcf97",
    kind: "healing",
    sourceId: boss.id,
  });
  return healing;
};

export const applyBossMeleeIdentity = (
  state: GameState,
  boss: Enemy,
  target: PartyTarget,
) => {
  if (!isGooBoss(state, boss) || random(state) >= 1 / 3) return false;
  addStatus(target.statuses, "corroded", 3, 1);
  return true;
};
