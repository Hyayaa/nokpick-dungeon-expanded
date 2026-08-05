import {
  EquipmentStatRoll,
  EquipmentTrait,
  EquipmentTraitId,
  InventoryInstance,
  ItemCategory,
  ItemDefinition,
} from "./types";

export type EquipmentTraitDefinition = {
  id: EquipmentTraitId;
  name: string;
  description: string;
  accent: string;
};

export type EquipmentStatProfile = {
  attack: number;
  defense: number;
  magic: number;
  speed: number;
  moveSpeed: number;
  attackSpeed: number;
  quality: number;
  upgradeLevel: number;
};

export const EQUIPMENT_TRAITS: Record<
  EquipmentTraitId,
  EquipmentTraitDefinition
> = {
  keen: {
    id: "keen",
    name: "예리함",
    description: "공격력 +1",
    accent: "#ef9d69",
  },
  guarded: {
    id: "guarded",
    name: "수호",
    description: "방어력 +1",
    accent: "#78b8da",
  },
  swift: {
    id: "swift",
    name: "신속",
    description: "이동·공격 속도 +5%",
    accent: "#91d6a1",
  },
  focused: {
    id: "focused",
    name: "집중",
    description: "마력 +1",
    accent: "#c69bea",
  },
  charged: {
    id: "charged",
    name: "충전",
    description: "지팡이 최대 충전 +1",
    accent: "#f1d374",
  },
  balanced: {
    id: "balanced",
    name: "균형",
    description: "공격력·방어력 +1",
    accent: "#e5c88d",
  },
};

export const UPGRADEABLE_ITEM_CATEGORIES = new Set<ItemCategory>([
  "weapon",
  "armor",
  "missile",
  "wand",
  "artifact",
  "ring",
]);

export const isUpgradeableEquipment = (
  definition: ItemDefinition | undefined,
) => Boolean(definition && UPGRADEABLE_ITEM_CATEGORIES.has(definition.category));

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

const traitRank = (
  instance: InventoryInstance | null | undefined,
  id: EquipmentTraitId,
) =>
  (instance?.traits ?? [])
    .filter((trait) => trait.id === id)
    .reduce((total, trait) => total + trait.rank, 0);

const baseMagic = (definition: ItemDefinition) => {
  if (definition.category === "wand") {
    return Math.max(3, definition.power ?? 0, 2 + (definition.minFloor ?? 1));
  }
  if (definition.category === "artifact") {
    return Math.max(2, 1 + Math.ceil((definition.minFloor ?? 1) / 2));
  }
  if (definition.category === "ring") return 2;
  return definition.power ?? 0;
};

const baseAttack = (definition: ItemDefinition) => {
  if (definition.attack !== undefined) return definition.attack;
  if (definition.category === "missile") {
    return Math.max(2, 1 + (definition.minFloor ?? 1));
  }
  return 0;
};

const upgradeBonuses = (
  definition: ItemDefinition,
  upgradeLevel: number,
) => {
  if (definition.category === "armor") {
    return { attack: 0, defense: upgradeLevel, magic: 0 };
  }
  if (definition.category === "wand" || definition.category === "artifact") {
    return { attack: 0, defense: 0, magic: upgradeLevel };
  }
  if (definition.category === "ring") {
    return {
      attack: Math.ceil(upgradeLevel / 2),
      defense: Math.floor(upgradeLevel / 2),
      magic: upgradeLevel,
    };
  }
  return { attack: upgradeLevel, defense: 0, magic: 0 };
};

export function equipmentStatProfile(
  definition: ItemDefinition,
  instance?: InventoryInstance | null,
): EquipmentStatProfile {
  const roll = instance?.statRoll ?? {
    attack: 0,
    defense: 0,
    magic: 0,
    speed: 0,
  };
  const upgradeLevel = instance?.upgradeLevel ?? 0;
  const upgrades = upgradeBonuses(definition, upgradeLevel);
  const keen = traitRank(instance, "keen");
  const guarded = traitRank(instance, "guarded");
  const focused = traitRank(instance, "focused");
  const balanced = traitRank(instance, "balanced");
  const swift = traitRank(instance, "swift");
  const moveSpeed = Math.max(
    0.25,
    (definition.moveSpeed ?? 1) * (1 + swift * 0.05),
  );
  const attackSpeed = Math.max(
    0.25,
    (definition.attackSpeed ?? 1) * (1 + swift * 0.05),
  );
  return {
    attack: Math.max(
      0,
      baseAttack(definition) +
        roll.attack +
        upgrades.attack +
        keen +
        balanced,
    ),
    defense: Math.max(
      0,
      (definition.defense ?? 0) +
        roll.defense +
        upgrades.defense +
        guarded +
        balanced,
    ),
    magic: Math.max(
      0,
      baseMagic(definition) + roll.magic + upgrades.magic + focused,
    ),
    speed: Math.max(
      0,
      Math.round(
        ((moveSpeed - 1) * 10 +
          (attackSpeed - 1) * 10 +
          roll.speed +
          2) *
          10,
      ) / 10,
    ),
    moveSpeed,
    attackSpeed,
    quality: clamp(instance?.quality ?? 3, 1, 5),
    upgradeLevel,
  };
}

const availableTraits = (definition: ItemDefinition): EquipmentTraitId[] => {
  const common: EquipmentTraitId[] = ["swift"];
  if (["weapon", "missile", "ring"].includes(definition.category)) {
    common.push("keen");
  }
  if (["armor", "artifact", "ring"].includes(definition.category)) {
    common.push("guarded");
  }
  if (["wand", "artifact", "ring"].includes(definition.category)) {
    common.push("focused");
  }
  if (definition.category === "wand") common.push("charged");
  if (definition.slot) common.push("balanced");
  return common;
};

const makeStatRoll = (
  definition: ItemDefinition,
  quality: number,
  random: () => number,
): EquipmentStatRoll => {
  const qualityDelta = quality <= 1 ? -1 : quality >= 5 ? 1 : 0;
  const jitter = () => (random() < 0.22 ? 1 : 0);
  return {
    attack:
      ["weapon", "missile"].includes(definition.category)
        ? qualityDelta + jitter()
        : definition.category === "ring"
          ? qualityDelta + (random() < 0.35 ? 1 : 0)
          : 0,
    defense:
      definition.category === "armor"
        ? qualityDelta + jitter()
        : definition.category === "ring"
          ? qualityDelta + (random() < 0.3 ? 1 : 0)
          : definition.category === "artifact" && random() < 0.3
            ? 1
            : 0,
    magic:
      ["wand", "artifact"].includes(definition.category)
        ? qualityDelta + jitter()
        : definition.category === "ring"
          ? qualityDelta + (random() < 0.35 ? 1 : 0)
          : 0,
    speed: Math.floor(random() * 3) - 1,
  };
};

export function createEquipmentInstance(
  definition: ItemDefinition,
  id: string,
  random: () => number,
  options: { allowCurse?: boolean } = {},
): InventoryInstance {
  const quality = clamp(1 + Math.floor(random() * 5), 1, 5);
  const maxCharges =
    definition.category === "wand"
      ? 3 + (quality === 5 ? 1 : 0)
      : definition.category === "missile"
        ? 1
        : undefined;
  const maxDurability = definition.category === "missile" ? 10 : undefined;
  const instance: InventoryInstance = {
    id,
    defId: definition.id,
    cursed: (options.allowCurse ?? true) && random() < 0.14,
    charges: maxCharges,
    maxCharges,
    baseMaxCharges:
      definition.category === "missile" ? maxCharges : undefined,
    rechargeProgress: definition.category === "wand" ? 0 : undefined,
    durability: maxDurability,
    maxDurability,
    quality,
    upgradeLevel: 0,
    statRoll: makeStatRoll(definition, quality, random),
    traits: [],
  };
  if (random() < 0.34) {
    enchantEquipmentInstance(instance, definition, random);
  }
  return instance;
}

export function createPlainEquipmentInstance(
  definition: ItemDefinition,
  id: string,
): InventoryInstance {
  const maxCharges =
    definition.category === "wand"
      ? 3
      : definition.category === "missile"
        ? 1
        : undefined;
  const maxDurability = definition.category === "missile" ? 10 : undefined;
  return {
    id,
    defId: definition.id,
    cursed: false,
    charges: maxCharges,
    maxCharges,
    baseMaxCharges:
      definition.category === "missile" ? maxCharges : undefined,
    rechargeProgress: definition.category === "wand" ? 0 : undefined,
    durability: maxDurability,
    maxDurability,
    quality: 3,
    upgradeLevel: 0,
    statRoll: { attack: 0, defense: 0, magic: 0, speed: 0 },
    traits: [],
  };
}

export function enchantEquipmentInstance(
  instance: InventoryInstance,
  definition: ItemDefinition,
  random: () => number,
  preferred?: EquipmentTraitId,
) {
  if (!isUpgradeableEquipment(definition)) return null;
  const traits = instance.traits ?? (instance.traits = []);
  const candidates = availableTraits(definition);
  const traitId =
    preferred && candidates.includes(preferred)
      ? preferred
      : candidates[Math.floor(random() * candidates.length)];
  const existing = traits.find((trait) => trait.id === traitId);
  if (existing) {
    if (existing.rank >= 3) {
      const alternative = candidates.find(
        (candidate) =>
          !traits.some((trait) => trait.id === candidate && trait.rank >= 3),
      );
      if (!alternative) return null;
      traits.push({ id: alternative, rank: 1 });
      if (alternative === "charged") {
        instance.maxCharges = (instance.maxCharges ?? 3) + 1;
        instance.charges = Math.min(
          instance.maxCharges,
          (instance.charges ?? 0) + 1,
        );
      }
      return alternative;
    }
    existing.rank += 1;
  } else {
    traits.push({ id: traitId, rank: 1 });
  }
  if (traitId === "charged") {
    instance.maxCharges = (instance.maxCharges ?? 3) + 1;
    instance.charges = Math.min(
      instance.maxCharges,
      (instance.charges ?? 0) + 1,
    );
  }
  return traitId;
}

export function upgradeEquipmentInstance(
  instance: InventoryInstance,
  amount = 1,
) {
  instance.upgradeLevel = Math.max(
    0,
    (instance.upgradeLevel ?? 0) + amount,
  );
}

export const equipmentTraitSummary = (
  instance: InventoryInstance | null | undefined,
) =>
  (instance?.traits ?? []).map((trait: EquipmentTrait) => ({
    ...EQUIPMENT_TRAITS[trait.id],
    rank: trait.rank,
  }));
