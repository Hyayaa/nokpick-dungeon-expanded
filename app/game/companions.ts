import { ITEM_DEFS } from "./data";
import { equipmentStatProfile } from "./equipment";
import { experienceForNextLevel } from "./progression";
import {
  createCompanionSkills,
  normalizeCompanionSkills,
  normalizeSkillCooldowns,
} from "./companion-skills";
import {
  Companion,
  CompanionClassId,
  CompanionEquipmentKey,
  CompanionTraitId,
  Direction,
  InventoryInstance,
  Point,
} from "./types";

export const COMPANION_FRAME_WIDTH = 12;
export const COMPANION_FRAME_HEIGHT = 15;

export const COMPANION_IDLE_FRAMES = [0, 0, 0, 1, 0, 0, 1, 1] as const;
export const COMPANION_MOVE_FRAMES = [2, 3, 4, 5, 6, 7] as const;
export const COMPANION_DEFEAT_FRAMES = [8, 9, 10, 11, 12, 11] as const;
export const COMPANION_ATTACK_FRAMES = [13, 14, 15, 0] as const;
export const COMPANION_INTERACT_FRAMES = [16, 17, 16, 17] as const;

export type CompanionClassDefinition = {
  id: CompanionClassId;
  nameKo: string;
  nameEn: string;
  defaultNameKo: string;
  defaultNameEn: string;
  sprite: string;
  sheetWidth: number;
  sheetHeight: number;
  frameWidth: number;
  frameHeight: number;
  animationSet: "companion" | "adventurer";
  maxHp: number;
  attack: number;
  defense: number;
  accuracy: number;
  evasion: number;
  viewDistance: number;
};

export const COMPANION_CLASSES: Record<
  CompanionClassId,
  CompanionClassDefinition
> = {
  adventurer: {
    id: "adventurer",
    nameKo: "방랑자",
    nameEn: "Adventurer",
    defaultNameKo: "모험가",
    defaultNameEn: "Adventurer",
    sprite: "/assets/sprites/player.png",
    sheetWidth: 128,
    sheetHeight: 72,
    frameWidth: 16,
    frameHeight: 24,
    animationSet: "adventurer",
    maxHp: 42,
    attack: 4,
    defense: 0,
    accuracy: 10,
    evasion: 5,
    viewDistance: 7,
  },
  warrior: {
    id: "warrior",
    nameKo: "전사",
    nameEn: "Warrior",
    defaultNameKo: "로완",
    defaultNameEn: "Rowan",
    sprite: "/assets/sprites/companions/warrior.png",
    sheetWidth: 256,
    sheetHeight: 128,
    frameWidth: COMPANION_FRAME_WIDTH,
    frameHeight: COMPANION_FRAME_HEIGHT,
    animationSet: "companion",
    maxHp: 36,
    attack: 5,
    defense: 2,
    accuracy: 11,
    evasion: 5,
    viewDistance: 6,
  },
  huntress: {
    id: "huntress",
    nameKo: "궁수",
    nameEn: "Huntress",
    defaultNameKo: "미라",
    defaultNameEn: "Mira",
    sprite: "/assets/sprites/companions/huntress.png",
    sheetWidth: 256,
    sheetHeight: 128,
    frameWidth: COMPANION_FRAME_WIDTH,
    frameHeight: COMPANION_FRAME_HEIGHT,
    animationSet: "companion",
    maxHp: 29,
    attack: 4,
    defense: 1,
    accuracy: 13,
    evasion: 7,
    viewDistance: 8,
  },
  mage: {
    id: "mage",
    nameKo: "마법사",
    nameEn: "Mage",
    defaultNameKo: "오린",
    defaultNameEn: "Orin",
    sprite: "/assets/sprites/companions/mage.png",
    sheetWidth: 256,
    sheetHeight: 128,
    frameWidth: COMPANION_FRAME_WIDTH,
    frameHeight: COMPANION_FRAME_HEIGHT,
    animationSet: "companion",
    maxHp: 27,
    attack: 3,
    defense: 1,
    accuracy: 12,
    evasion: 6,
    viewDistance: 7,
  },
  rogue: {
    id: "rogue",
    nameKo: "도적",
    nameEn: "Rogue",
    defaultNameKo: "베일",
    defaultNameEn: "Vale",
    sprite: "/assets/sprites/companions/rogue.png",
    sheetWidth: 256,
    sheetHeight: 128,
    frameWidth: COMPANION_FRAME_WIDTH,
    frameHeight: COMPANION_FRAME_HEIGHT,
    animationSet: "companion",
    maxHp: 27,
    attack: 4,
    defense: 1,
    accuracy: 13,
    evasion: 9,
    viewDistance: 7,
  },
  duelist: {
    id: "duelist",
    nameKo: "결투가",
    nameEn: "Duelist",
    defaultNameKo: "세라",
    defaultNameEn: "Sera",
    sprite: "/assets/sprites/companions/duelist.png",
    sheetWidth: 256,
    sheetHeight: 128,
    frameWidth: COMPANION_FRAME_WIDTH,
    frameHeight: COMPANION_FRAME_HEIGHT,
    animationSet: "companion",
    maxHp: 32,
    attack: 5,
    defense: 1,
    accuracy: 13,
    evasion: 7,
    viewDistance: 6,
  },
  cleric: {
    id: "cleric",
    nameKo: "성직자",
    nameEn: "Cleric",
    defaultNameKo: "엘리",
    defaultNameEn: "Eli",
    sprite: "/assets/sprites/companions/cleric.png",
    sheetWidth: 256,
    sheetHeight: 128,
    frameWidth: COMPANION_FRAME_WIDTH,
    frameHeight: COMPANION_FRAME_HEIGHT,
    animationSet: "companion",
    maxHp: 33,
    attack: 3,
    defense: 2,
    accuracy: 11,
    evasion: 6,
    viewDistance: 7,
  },
};

export const COMPANION_CLASS_IDS = Object.keys(
  COMPANION_CLASSES,
) as CompanionClassId[];

export type CompanionTraitDefinition = {
  id: CompanionTraitId;
  nameKo: string;
  nameEn: string;
  descriptionKo: string;
  descriptionEn: string;
  accent: string;
};

export const COMPANION_TRAITS: Record<
  CompanionTraitId,
  CompanionTraitDefinition
> = {
  tough: {
    id: "tough",
    nameKo: "강인함",
    nameEn: "Tough",
    descriptionKo: "받는 피해가 20% 감소합니다.",
    descriptionEn: "Reduces incoming damage by 20%.",
    accent: "#91b39a",
  },
  aggressive: {
    id: "aggressive",
    nameKo: "공격적",
    nameEn: "Aggressive",
    descriptionKo: "주는 피해가 15% 증가합니다.",
    descriptionEn: "Increases damage dealt by 15%.",
    accent: "#c97a68",
  },
  precise: {
    id: "precise",
    nameKo: "정밀함",
    nameEn: "Precise",
    descriptionKo: "명중이 2 증가합니다.",
    descriptionEn: "Increases accuracy by 2.",
    accent: "#8fb1c5",
  },
  nimble: {
    id: "nimble",
    nameKo: "민첩함",
    nameEn: "Nimble",
    descriptionKo: "회피가 2 증가합니다.",
    descriptionEn: "Increases evasion by 2.",
    accent: "#94b6a8",
  },
  guardian: {
    id: "guardian",
    nameKo: "수호자",
    nameEn: "Guardian",
    descriptionKo: "방어력이 2 증가합니다.",
    descriptionEn: "Increases defense by 2.",
    accent: "#9ba5bd",
  },
  keenSight: {
    id: "keenSight",
    nameKo: "예리한 눈",
    nameEn: "Keen Sight",
    descriptionKo: "시야가 2칸 증가합니다.",
    descriptionEn: "Increases vision by 2 tiles.",
    accent: "#c4ad6b",
  },
  vigorous: {
    id: "vigorous",
    nameKo: "건장함",
    nameEn: "Vigorous",
    descriptionKo: "최대 생명력이 20% 증가합니다.",
    descriptionEn: "Increases maximum health by 20%.",
    accent: "#b98577",
  },
  powerful: {
    id: "powerful",
    nameKo: "완력",
    nameEn: "Powerful",
    descriptionKo: "기본 공격력이 2 증가합니다.",
    descriptionEn: "Increases base attack by 2.",
    accent: "#c18b61",
  },
  cautious: {
    id: "cautious",
    nameKo: "신중함",
    nameEn: "Cautious",
    descriptionKo: "방어력과 회피가 각각 1 증가합니다.",
    descriptionEn: "Increases defense and evasion by 1.",
    accent: "#8a9f92",
  },
  adaptable: {
    id: "adaptable",
    nameKo: "적응력",
    nameEn: "Adaptable",
    descriptionKo: "명중과 방어력이 각각 1 증가합니다.",
    descriptionEn: "Increases accuracy and defense by 1.",
    accent: "#9c8fb3",
  },
};

export const COMPANION_TRAIT_IDS = Object.keys(
  COMPANION_TRAITS,
) as CompanionTraitId[];

const stableTraitRandom = (seedKey: string) => {
  let value = 0x811c9dc5;
  for (const character of seedKey) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 0x01000193);
  }
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 0x100000000;
  };
};

export const createCompanionTraits = (seedKey: string) => {
  const random = stableTraitRandom(seedKey);
  const shuffled = [...COMPANION_TRAIT_IDS];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled.slice(0, 1 + Math.floor(random() * 4));
};

type TraitCarrier = { traits?: readonly CompanionTraitId[] };
const hasTrait = (carrier: TraitCarrier, id: CompanionTraitId) =>
  (carrier.traits ?? []).includes(id);

export const characterDamageTakenMultiplier = (carrier: TraitCarrier) =>
  hasTrait(carrier, "tough") ? 0.8 : 1;

export const characterAttackMultiplier = (carrier: TraitCarrier) =>
  hasTrait(carrier, "aggressive") ? 1.15 : 1;

export const characterAttackBonus = (carrier: TraitCarrier) =>
  hasTrait(carrier, "powerful") ? 2 : 0;

export const characterDefenseBonus = (carrier: TraitCarrier) =>
  (hasTrait(carrier, "guardian") ? 2 : 0) +
  (hasTrait(carrier, "cautious") ? 1 : 0) +
  (hasTrait(carrier, "adaptable") ? 1 : 0);

export const characterAccuracyBonus = (carrier: TraitCarrier) =>
  (hasTrait(carrier, "precise") ? 2 : 0) +
  (hasTrait(carrier, "adaptable") ? 1 : 0);

export const characterEvasionBonus = (carrier: TraitCarrier) =>
  (hasTrait(carrier, "nimble") ? 2 : 0) +
  (hasTrait(carrier, "cautious") ? 1 : 0);

export const characterViewBonus = (carrier: TraitCarrier) =>
  hasTrait(carrier, "keenSight") ? 2 : 0;

export const characterMaxHpMultiplier = (carrier: TraitCarrier) =>
  hasTrait(carrier, "vigorous") ? 1.2 : 1;

export const createCompanion = (
  classId: CompanionClassId,
  point: Point,
  index = 0,
): Companion => {
  const definition = COMPANION_CLASSES[classId];
  const id = `companion-${classId}-${index}`;
  const traits = createCompanionTraits(id);
  const skills = createCompanionSkills(id);
  const maxHp = Math.round(
    definition.maxHp * characterMaxHpMultiplier({ traits }),
  );
  return {
    id,
    name: definition.defaultNameKo,
    classId,
    command: "follow",
    ...point,
    hp: maxHp,
    maxHp,
    level: 1,
    xp: 0,
    nextXp: experienceForNextLevel(1),
    traits,
    skills,
    skillCooldowns: {},
    statuses: [],
    baseAttack: definition.attack,
    baseDefense: definition.defense,
    accuracy: definition.accuracy,
    evasion: definition.evasion,
    viewDistance: definition.viewDistance,
    facing: "down",
    equipment: {
      weapon: null,
      armor: null,
      ring: null,
      ring2: null,
      ring3: null,
      ring4: null,
    },
    equipmentInstances: {
      weapon: null,
      armor: null,
      ring: null,
      ring2: null,
      ring3: null,
      ring4: null,
    },
    autoSlots: [null, null, null, null],
    priorityTarget: null,
    exploreTarget: null,
    commandTargetId: null,
    actionCooldown: 0,
    recoveryProgress: 0,
  };
};

const equipmentEntries = (companion: Companion) =>
  (Object.keys(companion.equipment) as CompanionEquipmentKey[]).flatMap(
    (slot) => {
      const defId = companion.equipment[slot];
      const definition = defId ? ITEM_DEFS[defId] : null;
      return definition
        ? [{
            definition,
            instance: companion.equipmentInstances[slot],
          }]
        : [];
    },
  );

export const getCompanionAttack = (companion: Companion) =>
  Math.max(
    1,
    Math.round(
      (companion.baseAttack +
        characterAttackBonus(companion) +
        equipmentEntries(companion).reduce(
          (total, { definition, instance }) =>
            total + equipmentStatProfile(definition, instance).attack,
          0,
        )) * characterAttackMultiplier(companion),
    ),
  );

export const getCompanionDefense = (companion: Companion) =>
  companion.baseDefense +
  characterDefenseBonus(companion) +
  equipmentEntries(companion).reduce(
    (total, { definition, instance }) =>
      total + equipmentStatProfile(definition, instance).defense,
    0,
  );

export const getCompanionAccuracy = (companion: Companion) =>
  companion.accuracy + characterAccuracyBonus(companion);

export const getCompanionEvasion = (companion: Companion) =>
  companion.evasion + characterEvasionBonus(companion);

export const getCompanionViewDistance = (companion: Companion) =>
  companion.viewDistance + characterViewBonus(companion);

export const reduceCharacterDamage = (
  carrier: TraitCarrier,
  damage: number,
) => Math.max(1, Math.round(damage * characterDamageTakenMultiplier(carrier)));

export const normalizeCompanionProgression = (
  companion: Companion,
): Companion => {
  const traits = (companion.traits ?? []).filter(
    (id): id is CompanionTraitId => id in COMPANION_TRAITS,
  );
  const normalizedTraits = traits.length > 0
    ? [...new Set(traits)].slice(0, 4)
    : createCompanionTraits(companion.id);
  const level = Math.max(1, Math.min(50, companion.level ?? 1));
  const maxHp = traits.length > 0
    ? companion.maxHp
    : Math.round(
        COMPANION_CLASSES[companion.classId].maxHp *
          characterMaxHpMultiplier({ traits: normalizedTraits }),
      );
  return {
    ...companion,
    hp: Math.min(maxHp, companion.hp),
    maxHp,
    level,
    xp: Math.max(0, companion.xp ?? 0),
    nextXp:
      level >= 50
        ? 0
        : Math.max(1, companion.nextXp ?? experienceForNextLevel(level)),
    traits: normalizedTraits,
    skills: normalizeCompanionSkills(companion.id, companion.skills),
    skillCooldowns: normalizeSkillCooldowns(companion.skillCooldowns),
    statuses: (companion.statuses ?? []).map((status) => ({ ...status })),
  };
};

export const companionArmorTier = (
  companion: Pick<Companion, "equipment">,
) => {
  const armor = companion.equipment.armor;
  if (!armor || armor === "cloth_armor") return 0;
  if (armor === "leather_armor") return 1;
  if (armor === "mail_armor") return 2;
  const minimumFloor = ITEM_DEFS[armor]?.minFloor ?? 1;
  return Math.max(0, Math.min(5, Math.floor((minimumFloor + 1) / 2)));
};

export const companionFrameIndex = (
  armorTier: number,
  frameWithinTier: number,
) => {
  const framesPerRow = Math.floor(256 / COMPANION_FRAME_WIDTH);
  return Math.max(0, armorTier) * framesPerRow + frameWithinTier;
};

export const companionDirection = (from: Point, to: Point): Direction => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "up" : "down";
};

export const cloneCompanionInstance = (
  instance: InventoryInstance | null,
) =>
  instance
    ? {
        ...instance,
        statRoll: instance.statRoll ? { ...instance.statRoll } : undefined,
        traits: (instance.traits ?? []).map((trait) => ({ ...trait })),
      }
    : null;
