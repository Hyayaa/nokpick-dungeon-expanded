import { ITEM_DEFS } from "./data";
import type {
  CampaignMaterialCost,
  CampaignMaterialKind,
  CampaignMaterials,
  ItemDefinition,
} from "./types";

export type {
  CampaignMaterialCost,
  CampaignMaterialKind,
  CampaignMaterials,
} from "./types";

export const CAMPAIGN_MATERIAL_KINDS: readonly CampaignMaterialKind[] = [
  "potion",
  "seed",
  "runestone",
];

export const CAMPAIGN_MATERIAL_NAMES: Record<CampaignMaterialKind, string> = {
  potion: "포션",
  seed: "씨앗",
  runestone: "룬석",
};

export const createCampaignMaterials = (
  values: CampaignMaterialCost = {},
): CampaignMaterials => normalizeCampaignMaterials(values);

export const normalizeCampaignMaterials = (
  value: unknown,
): CampaignMaterials => {
  const raw = value && typeof value === "object"
    ? value as Partial<Record<CampaignMaterialKind, unknown>>
    : {};
  return Object.fromEntries(
    CAMPAIGN_MATERIAL_KINDS.map((kind) => {
      const amount = raw[kind];
      return [
        kind,
        typeof amount === "number" && Number.isFinite(amount)
          ? Math.max(0, Math.floor(amount))
          : 0,
      ];
    }),
  ) as CampaignMaterials;
};

export const materialKindForItem = (
  definition: Pick<ItemDefinition, "category"> | null | undefined,
): CampaignMaterialKind | null => {
  if (definition?.category === "potion") return "potion";
  if (definition?.category === "seed") return "seed";
  if (definition?.category === "stone") return "runestone";
  return null;
};

export const materialKindForItemId = (itemId: string) =>
  materialKindForItem(ITEM_DEFS[itemId]);

export const addMaterials = (
  materials: CampaignMaterials,
  gained: CampaignMaterialCost,
): CampaignMaterials => {
  const current = normalizeCampaignMaterials(materials);
  const additions = normalizeCampaignMaterials(gained);
  return Object.fromEntries(
    CAMPAIGN_MATERIAL_KINDS.map((kind) => [
      kind,
      current[kind] + additions[kind],
    ]),
  ) as CampaignMaterials;
};

export const canPayMaterials = (
  materials: CampaignMaterials,
  cost: CampaignMaterialCost,
) => {
  const current = normalizeCampaignMaterials(materials);
  const required = normalizeCampaignMaterials(cost);
  return CAMPAIGN_MATERIAL_KINDS.every(
    (kind) => current[kind] >= required[kind],
  );
};

export const payMaterials = (
  materials: CampaignMaterials,
  cost: CampaignMaterialCost,
): CampaignMaterials | null => {
  if (!canPayMaterials(materials, cost)) return null;
  const current = normalizeCampaignMaterials(materials);
  const required = normalizeCampaignMaterials(cost);
  return Object.fromEntries(
    CAMPAIGN_MATERIAL_KINDS.map((kind) => [
      kind,
      current[kind] - required[kind],
    ]),
  ) as CampaignMaterials;
};

export const extractWarehouseMaterials = <T extends {
  stacks: Record<string, number>;
  instances: Array<{ id: string; defId: string }>;
  slots: Array<string | null>;
}>(warehouse: T) => {
  const materialsGained = createCampaignMaterials();
  const stacks = { ...warehouse.stacks };
  Object.entries(stacks).forEach(([itemId, quantity]) => {
    const kind = materialKindForItemId(itemId);
    if (!kind) return;
    materialsGained[kind] += Number.isFinite(quantity)
      ? Math.max(0, Math.floor(quantity))
      : 0;
    delete stacks[itemId];
  });
  const removedInstanceIds = new Set<string>();
  const instances = warehouse.instances.filter((instance) => {
    const kind = materialKindForItemId(instance.defId);
    if (!kind) return true;
    materialsGained[kind] += 1;
    removedInstanceIds.add(instance.id);
    return false;
  });
  return {
    warehouse: {
      ...warehouse,
      stacks,
      instances,
      slots: warehouse.slots.map((slot) =>
        slot && removedInstanceIds.has(slot) ? null : slot,
      ),
    },
    materialsGained,
  };
};
