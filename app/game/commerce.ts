import type { CampaignSave, WarehouseState } from "./campaign";
import { cloneWarehouse } from "./campaign";
import { ITEM_DEFS } from "./data";
import {
  createEquipmentInstance,
  enchantmentGradePower,
  isUpgradeableEquipment,
  normalizeEquipmentInstance,
} from "./equipment";
import {
  ITEM_GRADES,
  itemGradeIndex,
  normalizeItemGrade,
  resolveItemGrade,
  rollItemGrade,
} from "./item-grade";
import {
  WAREHOUSE_SLOT_COUNT,
  normalizeStorageSlots,
  storageInventoryRefs,
} from "./inventory-slots";
import type {
  InventoryInstance,
  ItemCategory,
  ItemDefinition,
  ItemGrade,
  ShopListing,
  ShopState,
} from "./types";

export const SHOP_STOCK_SIZE = 12;

const GEAR_PURCHASE_PRICE: Record<ItemGrade, number> = {
  F: 500,
  E: 1_600,
  D: 5_000,
  C: 16_000,
  B: 50_000,
  A: 160_000,
  S: 500_000,
};

export const BLACKSMITH_UPGRADE_COST: Record<
  Exclude<ItemGrade, "S">,
  number
> = {
  F: 1_600,
  E: 5_000,
  D: 16_000,
  C: 50_000,
  B: 160_000,
  A: 500_000,
};

const SUPPLY_BASE_PRICE: Record<ItemCategory, number> = {
  weapon: 500,
  armor: 500,
  ring: 650,
  wand: 650,
  artifact: 800,
  missile: 360,
  potion: 340,
  scroll: 420,
  brew: 520,
  elixir: 760,
  bomb: 480,
  seed: 120,
  stone: 220,
  food: 160,
  misc: 600,
  key: 0,
};

const GEAR_CATEGORY_MULTIPLIER: Partial<Record<ItemCategory, number>> = {
  weapon: 1,
  armor: 1,
  ring: 1.15,
  wand: 1.15,
  artifact: 1.35,
  missile: 0.72,
};

const seededRandom = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 0x100000000;
  };
};

const shuffleWith = <T,>(values: readonly T[], random: () => number) => {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
};

const roundCommerceGold = (amount: number) => {
  const safe = Math.max(1, Math.round(amount));
  const step = safe >= 100_000 ? 1_000 : safe >= 10_000 ? 100 : 10;
  return Math.max(step, Math.round(safe / step) * step);
};

const cloneInstance = (instance: InventoryInstance): InventoryInstance =>
  normalizeEquipmentInstance(
    {
      ...instance,
      statRoll: instance.statRoll ? { ...instance.statRoll } : undefined,
      traits: (instance.traits ?? []).map((trait) => ({ ...trait })),
    },
    ITEM_DEFS[instance.defId],
  );

const cloneListing = (listing: ShopListing): ShopListing => ({
  ...listing,
  instance: listing.instance ? cloneInstance(listing.instance) : null,
});

export const cloneShopState = (shop: ShopState): ShopState => ({
  version: 1,
  refreshSeed: shop.refreshSeed >>> 0,
  nextListingSerial: Math.max(0, Math.floor(shop.nextListingSerial)),
  stock: shop.stock.map(cloneListing),
  buyback: shop.buyback.map(cloneListing),
});

export function shopPurchasePrice(
  definition: ItemDefinition,
  instance?: InventoryInstance | null,
) {
  if (isUpgradeableEquipment(definition)) {
    const grade = resolveItemGrade(definition, instance);
    const categoryMultiplier = GEAR_CATEGORY_MULTIPLIER[definition.category] ?? 1;
    const tierMultiplier =
      1 + Math.max(0, (definition.minFloor ?? 1) - 1) * 0.08;
    return roundCommerceGold(
      GEAR_PURCHASE_PRICE[grade] * categoryMultiplier * tierMultiplier,
    );
  }
  const tierMultiplier =
    1 + Math.max(0, (definition.minFloor ?? 1) - 1) * 0.28;
  const effectMultiplier = definition.effect === "upgrade" ? 2 : 1;
  return roundCommerceGold(
    SUPPLY_BASE_PRICE[definition.category] *
      tierMultiplier *
      effectMultiplier,
  );
}

export function shopSalePrice(
  definition: ItemDefinition,
  instance?: InventoryInstance | null,
) {
  return roundCommerceGold(shopPurchasePrice(definition, instance) * 0.4);
}

const tradableDefinitions = () =>
  Object.values(ITEM_DEFS).filter(
    (definition) =>
      definition.id !== "gold" && definition.category !== "key",
  );

export function createShopState(seed: number, refreshNumber = 0): ShopState {
  const refreshSeed =
    (seed ^ Math.imul(refreshNumber + 1, 0x85ebca6b)) >>> 0;
  const random = seededRandom(refreshSeed || 0x2f6e2b1d);
  const definitions = tradableDefinitions();
  const gear = shuffleWith(
    definitions.filter((definition) => isUpgradeableEquipment(definition)),
    random,
  ).slice(0, SHOP_STOCK_SIZE / 2);
  const supplies = shuffleWith(
    definitions.filter((definition) => !isUpgradeableEquipment(definition)),
    random,
  ).slice(0, SHOP_STOCK_SIZE / 2);
  const stock = shuffleWith([...gear, ...supplies], random).map(
    (definition, index): ShopListing => {
      const id = `shop-${refreshSeed.toString(16)}-${index + 1}`;
      if (isUpgradeableEquipment(definition)) {
        const grade = rollItemGrade(random);
        const instance = createEquipmentInstance(
          definition,
          `${id}-instance`,
          random,
          { grade, allowCurse: false },
        );
        if (definition.category === "missile") {
          const charges = 3 + Math.floor(random() * 3);
          instance.baseMaxCharges = charges;
          instance.maxCharges = charges;
          instance.charges = charges;
        }
        return {
          id,
          itemId: definition.id,
          quantity: 1,
          unitPrice: shopPurchasePrice(definition, instance),
          instance,
        };
      }
      return {
        id,
        itemId: definition.id,
        quantity: 1 + Math.floor(random() * 3),
        unitPrice: shopPurchasePrice(definition),
        instance: null,
      };
    },
  );
  return {
    version: 1,
    refreshSeed,
    nextListingSerial: stock.length + 1,
    stock,
    buyback: [],
  };
}

const normalizedListing = (
  value: unknown,
  fallbackId: string,
): ShopListing | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ShopListing>;
  if (
    typeof raw.itemId !== "string" ||
    !ITEM_DEFS[raw.itemId] ||
    raw.itemId === "gold" ||
    ITEM_DEFS[raw.itemId].category === "key" ||
    typeof raw.quantity !== "number" ||
    !Number.isFinite(raw.quantity) ||
    typeof raw.unitPrice !== "number" ||
    !Number.isFinite(raw.unitPrice)
  ) {
    return null;
  }
  const definition = ITEM_DEFS[raw.itemId];
  const instance =
    raw.instance && typeof raw.instance === "object"
      ? cloneInstance({ ...raw.instance, defId: raw.itemId })
      : null;
  if (isUpgradeableEquipment(definition) && !instance) return null;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : fallbackId,
    itemId: raw.itemId,
    quantity: Math.max(1, Math.floor(raw.quantity)),
    unitPrice: Math.max(1, Math.floor(raw.unitPrice)),
    instance,
  };
};

export function normalizeShopState(
  value: unknown,
  fallbackSeed: number,
  refreshNumber = 0,
): ShopState {
  if (!value || typeof value !== "object") {
    return createShopState(fallbackSeed, refreshNumber);
  }
  const raw = value as Partial<ShopState>;
  if (
    raw.version !== 1 ||
    !Array.isArray(raw.stock) ||
    !Array.isArray(raw.buyback)
  ) {
    return createShopState(fallbackSeed, refreshNumber);
  }
  const stock = raw.stock.flatMap((listing, index) => {
    const normalized = normalizedListing(
      listing,
      `restored-stock-${index + 1}`,
    );
    return normalized ? [normalized] : [];
  });
  const legacyBuyback = raw.buyback.flatMap((listing, index) => {
    const normalized = normalizedListing(
      listing,
      `restored-buyback-${index + 1}`,
    );
    return normalized ? [normalized] : [];
  });
  return {
    version: 1,
    refreshSeed:
      typeof raw.refreshSeed === "number" && Number.isFinite(raw.refreshSeed)
        ? raw.refreshSeed >>> 0
        : fallbackSeed >>> 0,
    nextListingSerial:
      typeof raw.nextListingSerial === "number" &&
      Number.isFinite(raw.nextListingSerial)
        ? Math.max(stock.length + 1, Math.floor(raw.nextListingSerial))
        : stock.length + buyback.length + 1,
    stock,
    buyback,
  };
}

type ShopFailureReason =
  | "missing-item"
  | "invalid-item"
  | "missing-listing"
  | "not-enough-gold"
  | "warehouse-full";

type ShopTransactionResult = {
  campaign: CampaignSave;
  changed: boolean;
  reason: "ok" | ShopFailureReason;
  goldDelta: number;
  itemId: string | null;
};

const shopFailure = (
  campaign: CampaignSave,
  reason: ShopFailureReason,
): ShopTransactionResult => ({
  campaign,
  changed: false,
  reason,
  goldDelta: 0,
  itemId: null,
});

const warehouseCanStore = (
  warehouse: WarehouseState,
  itemId: string,
  instance: InventoryInstance | null,
) => {
  if (!instance && (warehouse.stacks[itemId] ?? 0) > 0) return true;
  return storageInventoryRefs(warehouse).length < WAREHOUSE_SLOT_COUNT;
};

export function sellWarehouseItem(
  campaign: CampaignSave,
  slotIndex: number,
): ShopTransactionResult {
  const slots = normalizeStorageSlots(
    campaign.warehouse,
    WAREHOUSE_SLOT_COUNT,
  );
  const itemRef = slots[slotIndex];
  if (!itemRef) return shopFailure(campaign, "missing-item");
  const storedInstance =
    campaign.warehouse.instances.find((instance) => instance.id === itemRef) ??
    null;
  const itemId =
    storedInstance?.defId ??
    ((campaign.warehouse.stacks[itemRef] ?? 0) > 0 ? itemRef : null);
  const definition = itemId ? ITEM_DEFS[itemId] : null;
  if (!itemId || !definition || definition.category === "key") {
    return shopFailure(campaign, "invalid-item");
  }
  const nextWarehouse = cloneWarehouse(campaign.warehouse);
  let soldInstance: InventoryInstance | null = null;
  if (storedInstance) {
    const instanceIndex = nextWarehouse.instances.findIndex(
      (instance) => instance.id === storedInstance.id,
    );
    if (instanceIndex < 0) return shopFailure(campaign, "missing-item");
    [soldInstance] = nextWarehouse.instances.splice(instanceIndex, 1);
  } else {
    const available = nextWarehouse.stacks[itemId] ?? 0;
    if (available <= 0) return shopFailure(campaign, "missing-item");
    if (available === 1) delete nextWarehouse.stacks[itemId];
    else nextWarehouse.stacks[itemId] = available - 1;
  }
  nextWarehouse.slots = normalizeStorageSlots(
    nextWarehouse,
    WAREHOUSE_SLOT_COUNT,
  );
  const payout = shopSalePrice(definition, soldInstance);
  const nextShop = cloneShopState(campaign.shop);
  const mergeTarget = !soldInstance
    ? nextShop.stock.find(
        (listing) =>
          listing.itemId === itemId &&
          !listing.instance &&
          listing.unitPrice === payout,
      )
    : null;
  if (mergeTarget) {
    mergeTarget.quantity += 1;
  } else {
    nextShop.stock.push({
      id: `resale-${nextShop.refreshSeed.toString(16)}-${nextShop.nextListingSerial}`,
      itemId,
      quantity: 1,
      unitPrice: payout,
      instance: soldInstance ? cloneInstance(soldInstance) : null,
    });
    nextShop.nextListingSerial += 1;
  }
  return {
    campaign: {
      ...campaign,
      warehouse: nextWarehouse,
      shop: nextShop,
      gold: campaign.gold + payout,
    },
    changed: true,
    reason: "ok",
    goldDelta: payout,
    itemId,
  };
}

export type ShopListingSource = "stock" | "buyback";

export function buyShopListing(
  campaign: CampaignSave,
  source: ShopListingSource,
  listingId: string,
): ShopTransactionResult {
  const listings =
    source === "stock" ? campaign.shop.stock : campaign.shop.buyback;
  const listing = listings.find((candidate) => candidate.id === listingId);
  if (!listing) return shopFailure(campaign, "missing-listing");
  const definition = ITEM_DEFS[listing.itemId];
  if (!definition) return shopFailure(campaign, "invalid-item");
  if (campaign.gold < listing.unitPrice) {
    return shopFailure(campaign, "not-enough-gold");
  }
  if (
    !warehouseCanStore(
      campaign.warehouse,
      listing.itemId,
      listing.instance,
    )
  ) {
    return shopFailure(campaign, "warehouse-full");
  }
  const nextWarehouse = cloneWarehouse(campaign.warehouse);
  if (listing.instance) {
    if (
      nextWarehouse.instances.some(
        (instance) => instance.id === listing.instance?.id,
      )
    ) {
      return shopFailure(campaign, "invalid-item");
    }
    nextWarehouse.instances.push(cloneInstance(listing.instance));
  } else {
    nextWarehouse.stacks[listing.itemId] =
      (nextWarehouse.stacks[listing.itemId] ?? 0) + 1;
  }
  nextWarehouse.slots = normalizeStorageSlots(
    nextWarehouse,
    WAREHOUSE_SLOT_COUNT,
  );
  const nextShop = cloneShopState(campaign.shop);
  const nextListings =
    source === "stock" ? nextShop.stock : nextShop.buyback;
  const nextListingIndex = nextListings.findIndex(
    (candidate) => candidate.id === listingId,
  );
  if (nextListingIndex < 0) {
    return shopFailure(campaign, "missing-listing");
  }
  if (
    nextListings[nextListingIndex].instance ||
    nextListings[nextListingIndex].quantity <= 1
  ) {
    nextListings.splice(nextListingIndex, 1);
  } else {
    nextListings[nextListingIndex].quantity -= 1;
  }
  return {
    campaign: {
      ...campaign,
      warehouse: nextWarehouse,
      shop: nextShop,
      gold: campaign.gold - listing.unitPrice,
    },
    changed: true,
    reason: "ok",
    goldDelta: -listing.unitPrice,
    itemId: listing.itemId,
  };
}

export const smithyNextGrade = (grade: ItemGrade): ItemGrade | null => {
  const index = itemGradeIndex(grade);
  return ITEM_GRADES[index + 1] ?? null;
};

export const smithyUpgradeCost = (grade: ItemGrade): number | null =>
  grade === "S" ? null : BLACKSMITH_UPGRADE_COST[grade];

export type SmithyRequirement = {
  resourceKind: "currency" | "item";
  resourceId: string;
  required: number;
  owned: number;
  satisfied: boolean;
};

type SmithyRequirementDefinition = Pick<
  SmithyRequirement,
  "resourceKind" | "resourceId" | "required"
>;

const smithyRequirementDefinitions = (
  grade: ItemGrade,
): SmithyRequirementDefinition[] => {
  const goldCost = smithyUpgradeCost(grade);
  if (goldCost === null) return [];
  return [
    {
      resourceKind: "currency",
      resourceId: "gold",
      required: goldCost,
    },
  ];
};

export function smithyUpgradeRequirements(
  campaign: CampaignSave,
  grade: ItemGrade,
): SmithyRequirement[] {
  return smithyRequirementDefinitions(grade).map((requirement) => {
    const owned = requirement.resourceKind === "currency"
      ? requirement.resourceId === "gold"
        ? campaign.gold
        : 0
      : (campaign.warehouse.stacks[requirement.resourceId] ?? 0) +
        campaign.warehouse.instances.filter(
          (instance) => instance.defId === requirement.resourceId,
        ).length;
    return {
      ...requirement,
      owned,
      satisfied: owned >= requirement.required,
    };
  });
}

export type SmithyTarget =
  | { kind: "warehouse"; instanceId: string }
  | {
      kind: "companionEquipment";
      companionId: string;
      equipmentKey: string;
    }
  | { kind: "companionAuto"; companionId: string; index: number };

export type SmithyCandidate = {
  target: SmithyTarget;
  ownerLabel: string;
  itemId: string;
  instance: InventoryInstance;
};

export function listSmithyCandidates(
  campaign: CampaignSave,
): SmithyCandidate[] {
  const candidates: SmithyCandidate[] = [];
  campaign.warehouse.instances.forEach((instance) => {
    if (!isUpgradeableEquipment(ITEM_DEFS[instance.defId])) return;
    candidates.push({
      target: { kind: "warehouse", instanceId: instance.id },
      ownerLabel: "창고",
      itemId: instance.defId,
      instance,
    });
  });
  campaign.companions.forEach((companion) => {
    Object.entries(companion.equipmentInstances).forEach(
      ([equipmentKey, instance]) => {
        if (!instance || !isUpgradeableEquipment(ITEM_DEFS[instance.defId])) {
          return;
        }
        candidates.push({
          target: {
            kind: "companionEquipment",
            companionId: companion.id,
            equipmentKey,
          },
          ownerLabel: `${companion.name} 착용`,
          itemId: instance.defId,
          instance,
        });
      },
    );
    companion.autoSlots.forEach((autoItem, index) => {
      if (
        !autoItem?.instance ||
        !isUpgradeableEquipment(ITEM_DEFS[autoItem.instance.defId])
      ) {
        return;
      }
      candidates.push({
        target: { kind: "companionAuto", companionId: companion.id, index },
        ownerLabel: `${companion.name} 퀵슬롯`,
        itemId: autoItem.instance.defId,
        instance: autoItem.instance,
      });
    });
  });
  return candidates;
}

type SmithyFailureReason =
  | "missing-item"
  | "invalid-item"
  | "maximum-grade"
  | "not-enough-gold";

type SmithyResult = {
  campaign: CampaignSave;
  changed: boolean;
  reason: "ok" | SmithyFailureReason;
  cost: number;
  itemId: string | null;
  fromGrade: ItemGrade | null;
  toGrade: ItemGrade | null;
};

const smithyFailure = (
  campaign: CampaignSave,
  reason: SmithyFailureReason,
  details: Partial<
    Pick<SmithyResult, "cost" | "itemId" | "fromGrade" | "toGrade">
  > = {},
): SmithyResult => ({
  campaign,
  changed: false,
  reason,
  cost: details.cost ?? 0,
  itemId: details.itemId ?? null,
  fromGrade: details.fromGrade ?? null,
  toGrade: details.toGrade ?? null,
});

const resolveSmithyCandidate = (
  campaign: CampaignSave,
  target: SmithyTarget,
) =>
  listSmithyCandidates(campaign).find(
    (candidate) =>
      JSON.stringify(candidate.target) === JSON.stringify(target),
  ) ?? null;

const applySmithyGrade = (
  instance: InventoryInstance,
  definition: ItemDefinition,
  toGrade: ItemGrade,
) => {
  const firstTrait = instance.traits?.[0];
  if (firstTrait?.id === "charged" && definition.category === "wand") {
    const previousPower = enchantmentGradePower(
      normalizeItemGrade(firstTrait.grade),
    );
    const nextPower = enchantmentGradePower(toGrade);
    const chargeIncrease = Math.max(0, nextPower - previousPower);
    instance.maxCharges =
      Math.max(0, instance.maxCharges ?? 3) + chargeIncrease;
    instance.charges = Math.min(
      instance.maxCharges,
      Math.max(0, instance.charges ?? 0) + chargeIncrease,
    );
  }
  instance.grade = toGrade;
  if (firstTrait) firstTrait.grade = toGrade;
};

export function upgradeCampaignEquipmentGrade(
  campaign: CampaignSave,
  target: SmithyTarget,
): SmithyResult {
  const candidate = resolveSmithyCandidate(campaign, target);
  if (!candidate) return smithyFailure(campaign, "missing-item");
  const definition = ITEM_DEFS[candidate.itemId];
  if (!isUpgradeableEquipment(definition)) {
    return smithyFailure(campaign, "invalid-item");
  }
  const fromGrade = normalizeItemGrade(candidate.instance.grade);
  const toGrade = smithyNextGrade(fromGrade);
  if (!toGrade) {
    return smithyFailure(campaign, "maximum-grade", {
      itemId: candidate.itemId,
      fromGrade,
    });
  }
  const cost = smithyUpgradeCost(fromGrade)!;
  const requirements = smithyUpgradeRequirements(campaign, fromGrade);
  if (!requirements.every((requirement) => requirement.satisfied)) {
    return smithyFailure(campaign, "not-enough-gold", {
      itemId: candidate.itemId,
      fromGrade,
      toGrade,
      cost,
    });
  }
  let warehouse = campaign.warehouse;
  let companions = campaign.companions;
  if (target.kind === "warehouse") {
    warehouse = cloneWarehouse(campaign.warehouse);
    const instance = warehouse.instances.find(
      (stored) => stored.id === target.instanceId,
    );
    if (!instance) return smithyFailure(campaign, "missing-item");
    applySmithyGrade(instance, definition, toGrade);
  } else {
    companions = campaign.companions.map((companion) => {
      if (companion.id !== target.companionId) return companion;
      if (target.kind === "companionEquipment") {
        const equipmentKey =
          target.equipmentKey as keyof typeof companion.equipmentInstances;
        const instance = companion.equipmentInstances[equipmentKey];
        if (!instance) return companion;
        const upgradedInstance = cloneInstance(instance);
        applySmithyGrade(upgradedInstance, definition, toGrade);
        return {
          ...companion,
          equipmentInstances: {
            ...companion.equipmentInstances,
            [equipmentKey]: upgradedInstance,
          },
        };
      }
      const autoSlots = companion.autoSlots.map((autoItem, index) => {
        if (index !== target.index || !autoItem?.instance) return autoItem;
        const upgradedInstance = cloneInstance(autoItem.instance);
        applySmithyGrade(upgradedInstance, definition, toGrade);
        return { ...autoItem, instance: upgradedInstance };
      });
      return { ...companion, autoSlots };
    });
  }
  return {
    campaign: {
      ...campaign,
      warehouse,
      companions,
      gold: campaign.gold - cost,
    },
    changed: true,
    reason: "ok",
    cost,
    itemId: candidate.itemId,
    fromGrade,
    toGrade,
  };
}
