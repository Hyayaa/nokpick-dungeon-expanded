import { companionSkillBlueprint } from "./companion-skill-blueprints";
import type { CombatSkillBlueprint } from "./combat-skills";
import type { EnemySkillId, StatusEffectId } from "./types";

export type EnemyTargetPolicy = "nearest" | "lowestHP" | "rangedPriority" | "currentAggro";
export type EnemySkillUseRule = {
  skillId: EnemySkillId;
  priority: number;
  minRange?: number;
  maxRange?: number;
  cooldown?: number;
  maxUses?: number;
  windupTurns?: number;
  hpThreshold?: number;
  requiresLineOfSight?: boolean;
  requiresMinionAbsent?: boolean;
  maxActiveSummons?: number;
  targetPolicy?: EnemyTargetPolicy;
  interruptible?: boolean;
  targetLockMode?: "fixed" | "tracking";
};

export type EnemySkillVisualProfile = {
  kind:
    | "projectile"
    | "magicBolt"
    | "beam"
    | "chain"
    | "burst"
    | "summon"
    | "cloud"
    | "none";
  color: string;
  secondaryColor?: string;
  durationMs?: number;
  width?: number;
  impactStyle?: "none" | "burst" | "shockwave" | "web" | "cloud";
};

export type EnemySkillBlueprint = CombatSkillBlueprint<EnemySkillId> & {
  visual?: EnemySkillVisualProfile;
};

const visual = (
  kind: EnemySkillVisualProfile["kind"],
  color: string,
  secondaryColor?: string,
  options: Omit<EnemySkillVisualProfile, "kind" | "color" | "secondaryColor"> = {},
): EnemySkillVisualProfile => ({ kind, color, secondaryColor, ...options });

const skill = (
  id: EnemySkillId,
  name: string,
  description: string,
  range: number,
  cooldown: number,
  footprint: CombatSkillBlueprint["footprint"],
  options: Partial<EnemySkillBlueprint> = {},
): EnemySkillBlueprint => ({
  id,
  name,
  description,
  range,
  cooldown,
  accent: "#ef6b65",
  travelMode: "none",
  impactMode: footprint === "line" ? "thrust" : "burst",
  areaAnchor: "target",
  mechanics: footprint === "line" ? ["line"] : footprint === "burst" ? ["area"] : [],
  scalars: {},
  specialEffects: [],
  footprint,
  ...options,
});

const statusEffect = (id: string, statusId: StatusEffectId, turns: number) => ({
  id,
  kind: "status" as const,
  target: "target" as const,
  statusId,
  turns,
});

const shared = (id: "shockLeap" | "drivingLeap" | "frostNova" | "shadowStep") => {
  const base = companionSkillBlueprint(id);
  return {
    ...base,
    footprint: base.mechanics.includes("line")
      ? "line" as const
      : base.mechanics.includes("area")
        ? "burst" as const
        : "target" as const,
    visual: id === "frostNova"
      ? visual("burst", "#8ee9ff", "#ffffff", { impactStyle: "shockwave" })
      : id === "shadowStep"
        ? visual("burst", "#9270cf", "#2a183d", { impactStyle: "burst" })
        : visual("burst", "#e6a45d", "#fff1b8", { impactStyle: "shockwave" }),
  } as unknown as EnemySkillBlueprint;
};

export const ENEMY_SKILLS: Readonly<Partial<Record<EnemySkillId, EnemySkillBlueprint>>> = {
  shockLeap: shared("shockLeap"),
  drivingLeap: shared("drivingLeap"),
  frostNova: shared("frostNova"),
  shadowStep: shared("shadowStep"),
  chainPull: skill("chainPull", "사슬 끌어당기기", "직선상의 적을 가까이 끌고 와 4턴 동안 이동을 둔화시킵니다.", 4, 99, "line", {
    mechanics: ["line", "movement", "status"],
    specialEffects: [statusEffect("chain-cripple", "crippled", 4)],
    visual: visual("chain", "#9fa6ad", "#e5edf2", { durationMs: 460, width: 2 }),
  }),
  summonSkeleton: skill("summonSkeleton", "해골 소환", "대상 주변에 연결된 해골을 소환하고 이후 회복하거나 강화합니다.", 8, 2, "target", { mechanics: ["summon"], visual: visual("summon", "#a98bea", "#efe4ff", { impactStyle: "burst" }) }),
  summonWraith: skill("summonWraith", "망령 소환", "대상 주변에 연결된 망령을 소환합니다.", 8, 2, "target", { mechanics: ["summon"], visual: visual("summon", "#8fd8e8", "#e9fdff", { impactStyle: "burst" }) }),
  summonRipper: skill("summonRipper", "리퍼 악마 소환", "주변의 유효한 타일에 리퍼 악마를 소환합니다.", 6, 12, "target", { mechanics: ["summon"], visual: visual("summon", "#d06060", "#ffb075", { impactStyle: "burst" }) }),
  lightningBolt: skill("lightningBolt", "번개 화살", "시야가 트인 대상에게 전격 피해를 줍니다.", 7, 1, "line", { mechanics: ["line", "conductive"], scalars: { power: 1.05 }, visual: visual("magicBolt", "#8bdcff", "#fff37a", { impactStyle: "burst" }) }),
  shamanBolt: skill("shamanBolt", "주술 화살", "원소 피해와 주술사의 색에 맞는 약화 효과를 부여합니다.", 7, 1, "line", { mechanics: ["line", "status"], scalars: { power: 1.1, statusTurns: 4 }, visual: visual("magicBolt", "#b88cff", "#f4e8ff", { impactStyle: "burst" }) }),
  poisonWeb: skill("poisonWeb", "독 거미줄", "예측 지점에 거미줄을 펼쳐 중독시키고 이동을 막습니다.", 6, 8, "burst", { mechanics: ["area", "status"], scalars: { radius: 1, statusTurns: 3 }, visual: visual("projectile", "#c8c2a0", "#84b56a", { impactStyle: "web" }) }),
  toxicVent: skill("toxicVent", "독가스 분출", "대상까지의 선과 주변에 독성 가스를 분출합니다.", 6, 7, "line", { mechanics: ["line", "cloud"], scalars: { durationTurns: 5 }, visual: visual("cloud", "#759d4f", "#c9dc79", { impactStyle: "cloud" }) }),
  corrosiveVent: skill("corrosiveVent", "부식 가스 분출", "고정된 범위에 강한 부식 가스를 분출합니다.", 6, 7, "burst", { mechanics: ["area", "cloud", "status"], scalars: { radius: 1, durationTurns: 5 }, visual: visual("cloud", "#a5bd50", "#e0df75", { impactStyle: "cloud" }) }),
  elementalBolt: skill("elementalBolt", "원소 화살", "원소 종류에 따라 화상, 냉기, 감전 또는 혼돈 효과를 줍니다.", 7, 2, "line", { mechanics: ["line", "status"], scalars: { power: 1.1, statusTurns: 3 }, visual: visual("magicBolt", "#ff8a45", "#fff0a8", { impactStyle: "burst" }) }),
  darkBolt: skill("darkBolt", "암흑 화살", "마법 피해와 장비 약화 효과를 줍니다.", 7, 2, "line", { mechanics: ["line", "status"], scalars: { power: 1.2 }, specialEffects: [statusEffect("dark-degrade", "degraded", 5)], visual: visual("magicBolt", "#844fba", "#d6a9ff", { impactStyle: "burst" }) }),
  teleportSelf: skill("teleportSelf", "공간 전이", "자신 또는 대상을 전이시켜 유리한 거리를 만듭니다.", 8, 8, "target", { travelMode: "teleport", mechanics: ["movement"] }),
  charm: skill("charm", "매혹", "대상을 매혹하고 가까운 위치로 순간이동합니다.", 6, 5, "target", { travelMode: "teleport", mechanics: ["movement", "status"], specialEffects: [statusEffect("succubus-charm", "charmed", 4)] }),
  deathGaze: skill("deathGaze", "죽음의 시선", "2턴 동안 조준한 뒤 처음 지정한 직선을 강력한 광선으로 공격합니다.", 10, 5, "line", { mechanics: ["line"], scalars: { power: 2.2 }, visual: visual("beam", "#ff4f52", "#fff4d6", { durationMs: 560, width: 6, impactStyle: "burst" }) }),
  cripplingShot: skill("cripplingShot", "무력화 사격", "거리를 유지하며 사격하고 대상을 둔화시킵니다.", 8, 1, "line", { mechanics: ["line", "status"], scalars: { power: 1 }, specialEffects: [statusEffect("shot-cripple", "crippled", 3)], visual: visual("projectile", "#d2c5a3", "#f3e8c2", { impactStyle: "burst" }) }),
  acidicShot: skill("acidicShot", "산성 사격", "사격과 함께 부식성 점액을 묻힙니다.", 8, 1, "line", { mechanics: ["line", "status"], scalars: { power: 1 }, specialEffects: [statusEffect("acid-ooze", "corroded", 4)], visual: visual("projectile", "#a9c64c", "#edf58b", { impactStyle: "burst" }) }),
  splitSwarm: skill("splitSwarm", "군체 분열", "치명상이 아닌 큰 피해를 받으면 체력을 나눠 새 군체를 만듭니다.", 1, 0, "target"),
  lifeSteal: skill("lifeSteal", "흡혈", "공격으로 준 피해 일부를 생명력으로 회복합니다.", 1, 0, "target", { mechanics: ["healing"] }),
  bruteRage: skill("bruteRage", "광폭화", "치명상을 입으면 일시적인 보호막과 강화된 공격을 얻습니다.", 0, 0, "target", { areaAnchor: "caster", mechanics: ["threshold"] }),
  ghoulRevive: skill("ghoulRevive", "공동 부활", "다른 구울이 살아 있으면 쓰러진 뒤 일정 시간이 지나 부활합니다.", 0, 0, "target", { areaAnchor: "caster", mechanics: ["threshold"] }),
};

export const enemySkill = (id: EnemySkillId) => ENEMY_SKILLS[id] ?? null;
