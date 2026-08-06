import {
  EquipmentKey,
  FlexSlotIndex,
  LoadoutTarget,
} from "./types";

export const FLEX_EQUIPMENT_KEYS = [
  "ring",
  "ring2",
  "ring3",
  "ring4",
] as const satisfies readonly EquipmentKey[];

export const COMPANION_PASSIVE_SLOT_INDEXES = [0, 1] as const;
export const COMPANION_QUICKSLOT_INDEXES = [2, 3] as const;

export const isPartyQuickslotTarget = (target: LoadoutTarget) =>
  target.kind === "flex" &&
  COMPANION_QUICKSLOT_INDEXES.includes(
    target.index as (typeof COMPANION_QUICKSLOT_INDEXES)[number],
  );

export const loadoutEquipmentKey = (
  target: LoadoutTarget,
): EquipmentKey => target.kind === "equipment"
  ? target.slot
  : FLEX_EQUIPMENT_KEYS[target.index as FlexSlotIndex];
