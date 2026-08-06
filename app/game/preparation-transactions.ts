import {
  CampaignSave,
  ExpeditionLoadout,
  cloneWarehouse,
  selectedLoadoutSlotCount,
} from "./campaign";
import { ITEM_DEFS } from "./data";
import { createPlainEquipmentInstance } from "./equipment";
import {
  MAX_INVENTORY_SLOTS,
  WAREHOUSE_SLOT_COUNT,
  normalizeFixedSlots,
  normalizeStorageSlots,
  swapFixedSlots,
} from "./inventory-slots";
import {
  FLEX_EQUIPMENT_KEYS,
  isPartyQuickslotTarget,
} from "./loadout";
import { AUTO_SLOT_CATEGORIES } from "./magic";
import {
  Companion,
  InventoryInstance,
  LoadoutTarget,
} from "./types";

export type PreparationSlotAddress =
  | { zone: "warehouse"; index: number }
  | { zone: "preparationInventory"; index: number }
  | {
      zone: "preparationCompanionEquipment";
      companionId: string;
      target: LoadoutTarget;
    };

type WarehouseOrBagAddress = Extract<
  PreparationSlotAddress,
  { zone: "warehouse" | "preparationInventory" }
>;

type PreparationEquipmentAddress = Extract<
  PreparationSlotAddress,
  { zone: "preparationCompanionEquipment" }
>;

type StoredGear = {
  defId: string;
  instance: InventoryInstance;
};

export type PreparationTransferResult = {
  campaign: CampaignSave;
  loadout: ExpeditionLoadout;
  changed: boolean;
};

export const isPreparationSlotAddress = (
  address: { zone: string },
): address is PreparationSlotAddress =>
  address.zone === "warehouse" ||
  address.zone === "preparationInventory" ||
  address.zone === "preparationCompanionEquipment";

const isWarehouseOrBag = (
  address: PreparationSlotAddress,
): address is WarehouseOrBagAddress =>
  address.zone === "warehouse" || address.zone === "preparationInventory";

const isPreparationEquipment = (
  address: PreparationSlotAddress,
): address is PreparationEquipmentAddress =>
  address.zone === "preparationCompanionEquipment";

const clonePreparationCampaign = (campaign: CampaignSave): CampaignSave => ({
  ...campaign,
  warehouse: cloneWarehouse(campaign.warehouse),
  companions: campaign.companions.map((companion) => ({
    ...companion,
    equipment: { ...companion.equipment },
    equipmentInstances: { ...companion.equipmentInstances },
    autoSlots: companion.autoSlots.map((slot) =>
      slot
        ? {
            ...slot,
            instance: slot.instance ? { ...slot.instance } : null,
          }
        : null,
    ) as Companion["autoSlots"],
  })),
});

const clonePreparationLoadout = (
  loadout: ExpeditionLoadout,
): ExpeditionLoadout => ({
  stacks: { ...loadout.stacks },
  instanceIds: [...loadout.instanceIds],
  slotRefs: [...loadout.slotRefs],
});

/**
 * Apply one drag transfer on the expedition-preparation surface.
 *
 * The inputs are treated as immutable. A rejected transfer returns the exact
 * original references, while an accepted transfer returns the updated
 * campaign/loadout pair. This keeps all ownership, curse, and slot-category
 * rules outside React without changing the existing preparation behavior.
 */
export function applyPreparationSlotTransfer(
  campaign: CampaignSave,
  loadout: ExpeditionLoadout,
  source: PreparationSlotAddress,
  target: PreparationSlotAddress,
): PreparationTransferResult {
  const unchanged = (): PreparationTransferResult => ({
    campaign,
    loadout,
    changed: false,
  });
  const nextCampaign = clonePreparationCampaign(campaign);
  const nextLoadout = clonePreparationLoadout(loadout);
  const selectedRefs = () => [
    ...Object.keys(nextLoadout.stacks).filter(
      (itemId) => nextLoadout.stacks[itemId] > 0,
    ),
    ...nextLoadout.instanceIds,
  ];
  const normalizeLoadout = () => {
    nextLoadout.slotRefs = normalizeFixedSlots(
      nextLoadout.slotRefs,
      selectedRefs(),
      MAX_INVENTORY_SLOTS,
    );
  };
  const selectStoredRef = (itemRef: string) => {
    const instance = nextCampaign.warehouse.instances.find(
      (candidate) => candidate.id === itemRef,
    );
    if (instance) {
      if (!nextLoadout.instanceIds.includes(itemRef)) {
        nextLoadout.instanceIds.push(itemRef);
      }
    } else if ((nextCampaign.warehouse.stacks[itemRef] ?? 0) > 0) {
      nextLoadout.stacks[itemRef] = nextCampaign.warehouse.stacks[itemRef];
    }
    normalizeLoadout();
  };
  const deselectStoredRef = (itemRef: string) => {
    delete nextLoadout.stacks[itemRef];
    nextLoadout.instanceIds = nextLoadout.instanceIds.filter(
      (candidate) => candidate !== itemRef,
    );
    normalizeLoadout();
  };
  const warehouseSlots = () =>
    normalizeStorageSlots(nextCampaign.warehouse, WAREHOUSE_SLOT_COUNT);
  const visibleWarehouseRefAt = (index: number) => {
    const itemRef = warehouseSlots()[index];
    return itemRef && !selectedRefs().includes(itemRef) ? itemRef : null;
  };
  const bagRefAt = (index: number) => {
    normalizeLoadout();
    return nextLoadout.slotRefs[index] ?? null;
  };
  const placeWarehouseRef = (itemRef: string, index: number) => {
    const slots = warehouseSlots();
    const fromIndex = slots.indexOf(itemRef);
    nextCampaign.warehouse.slots = fromIndex >= 0
      ? swapFixedSlots(slots, fromIndex, index)
      : slots;
  };
  const placeBagRef = (itemRef: string, index: number) => {
    normalizeLoadout();
    const fromIndex = nextLoadout.slotRefs.indexOf(itemRef);
    if (fromIndex >= 0) {
      nextLoadout.slotRefs = swapFixedSlots(
        nextLoadout.slotRefs,
        fromIndex,
        index,
      );
    }
  };

  if (source.zone === "warehouse" && target.zone === "warehouse") {
    nextCampaign.warehouse.slots = swapFixedSlots(
      warehouseSlots(),
      source.index,
      target.index,
    );
    return { campaign: nextCampaign, loadout, changed: true };
  }
  if (
    source.zone === "preparationInventory" &&
    target.zone === "preparationInventory"
  ) {
    normalizeLoadout();
    nextLoadout.slotRefs = swapFixedSlots(
      nextLoadout.slotRefs,
      source.index,
      target.index,
    );
    return { campaign, loadout: nextLoadout, changed: true };
  }
  if (source.zone === "warehouse" && target.zone === "preparationInventory") {
    const sourceRef = visibleWarehouseRefAt(source.index);
    const targetRef = bagRefAt(target.index);
    if (!sourceRef) return unchanged();
    if (
      !targetRef &&
      selectedLoadoutSlotCount(nextLoadout) >= MAX_INVENTORY_SLOTS
    ) {
      return unchanged();
    }
    if (targetRef) deselectStoredRef(targetRef);
    selectStoredRef(sourceRef);
    placeBagRef(sourceRef, target.index);
    if (targetRef) {
      const targetWarehouseIndex = warehouseSlots().indexOf(targetRef);
      if (targetWarehouseIndex >= 0) {
        nextCampaign.warehouse.slots = swapFixedSlots(
          warehouseSlots(),
          source.index,
          targetWarehouseIndex,
        );
      }
    }
    return { campaign: nextCampaign, loadout: nextLoadout, changed: true };
  }
  if (source.zone === "preparationInventory" && target.zone === "warehouse") {
    const sourceRef = bagRefAt(source.index);
    const targetRef = visibleWarehouseRefAt(target.index);
    if (!sourceRef) return unchanged();
    deselectStoredRef(sourceRef);
    if (targetRef) selectStoredRef(targetRef);
    const sourceWarehouseIndex = warehouseSlots().indexOf(sourceRef);
    if (sourceWarehouseIndex >= 0) {
      nextCampaign.warehouse.slots = swapFixedSlots(
        warehouseSlots(),
        sourceWarehouseIndex,
        target.index,
      );
    }
    if (targetRef) placeBagRef(targetRef, source.index);
    return { campaign: nextCampaign, loadout: nextLoadout, changed: true };
  }

  const equipmentKey = (address: PreparationEquipmentAddress) =>
    address.target.kind === "equipment"
      ? address.target.slot
      : FLEX_EQUIPMENT_KEYS[address.target.index];
  const equipmentOwner = (address: PreparationEquipmentAddress) =>
    nextCampaign.companions.find(
      (companion) => companion.id === address.companionId,
    ) ?? null;
  const readGear = (address: PreparationEquipmentAddress) => {
    const owner = equipmentOwner(address);
    if (!owner) return null;
    if (address.target.kind === "flex") {
      const autoItem = owner.autoSlots[address.target.index];
      if (autoItem?.instance) {
        return {
          defId: autoItem.defId,
          instance: autoItem.instance,
        };
      }
      if (autoItem) return null;
    }
    const key = equipmentKey(address);
    const defId = owner.equipment[key];
    if (!defId) return null;
    return {
      defId,
      instance:
        owner.equipmentInstances[key] ??
        createPlainEquipmentInstance(
          ITEM_DEFS[defId],
          `preparation-${defId}-${address.zone}-${key}`,
        ),
    };
  };
  const acceptsGear = (
    gear: StoredGear,
    address: PreparationEquipmentAddress,
  ) => {
    const definition = ITEM_DEFS[gear.defId];
    if (!definition) return false;
    return address.target.kind === "equipment"
      ? definition.slot === address.target.slot
      : isPartyQuickslotTarget(address.target)
        ? AUTO_SLOT_CATEGORIES.has(definition.category)
        : definition.category === "ring" || definition.category === "artifact";
  };
  const writeGear = (
    address: PreparationEquipmentAddress,
    gear: StoredGear | null,
  ) => {
    const owner = equipmentOwner(address);
    if (!owner) return;
    if (address.target.kind === "flex") {
      const ringKey = FLEX_EQUIPMENT_KEYS[address.target.index];
      owner.equipment[ringKey] = null;
      owner.equipmentInstances[ringKey] = null;
      owner.autoSlots[address.target.index] = null;
      if (!gear) return;
      if (
        !isPartyQuickslotTarget(address.target) &&
        ["ring", "artifact"].includes(ITEM_DEFS[gear.defId]?.category ?? "")
      ) {
        owner.equipment[ringKey] = gear.defId;
        owner.equipmentInstances[ringKey] = gear.instance;
      } else if (
        isPartyQuickslotTarget(address.target) &&
        ITEM_DEFS[gear.defId] &&
        AUTO_SLOT_CATEGORIES.has(ITEM_DEFS[gear.defId].category)
      ) {
        owner.autoSlots[address.target.index] = {
          defId: gear.defId,
          quantity: 1,
          instance: gear.instance,
        };
      }
      return;
    }
    const key = equipmentKey(address);
    owner.equipment[key] = gear?.defId ?? null;
    owner.equipmentInstances[key] = gear?.instance ?? null;
  };
  const takeStoredGear = (itemRef: string): StoredGear | null => {
    const instanceIndex = nextCampaign.warehouse.instances.findIndex(
      (instance) => instance.id === itemRef,
    );
    if (instanceIndex < 0) return null;
    const [instance] = nextCampaign.warehouse.instances.splice(instanceIndex, 1);
    const gear = { defId: instance.defId, instance };
    deselectStoredRef(itemRef);
    nextCampaign.warehouse.slots = normalizeStorageSlots(
      nextCampaign.warehouse,
      WAREHOUSE_SLOT_COUNT,
    );
    return gear;
  };
  const storeGear = (
    gear: StoredGear,
    warehouseIndex: number | null,
    bagIndex: number | null,
  ) => {
    nextCampaign.warehouse.instances.push(gear.instance);
    nextCampaign.warehouse.slots = normalizeStorageSlots(
      nextCampaign.warehouse,
      WAREHOUSE_SLOT_COUNT,
    );
    if (warehouseIndex !== null) {
      placeWarehouseRef(gear.instance.id, warehouseIndex);
    }
    if (bagIndex !== null) {
      selectStoredRef(gear.instance.id);
      placeBagRef(gear.instance.id, bagIndex);
    }
  };
  const sharedAutoItemAt = (address: PreparationEquipmentAddress) => {
    if (address.target.kind !== "flex") return null;
    const owner = equipmentOwner(address);
    if (!owner) return null;
    const item = owner.autoSlots[address.target.index];
    if (!item) return null;
    return typeof item === "string"
      ? { defId: item, shared: true }
      : {
          defId: item.defId,
          shared: !item.instance,
        };
  };
  const clearSharedAutoReferences = (defId: string) => {
    nextCampaign.companions.forEach((companion) => {
      companion.autoSlots = companion.autoSlots.map((item) =>
        item?.defId === defId && !item.instance ? null : item,
      ) as Companion["autoSlots"];
    });
  };

  if (isWarehouseOrBag(source) && isPreparationEquipment(target)) {
    const sourceRef = source.zone === "warehouse"
      ? visibleWarehouseRefAt(source.index)
      : bagRefAt(source.index);
    const sourceInstance = sourceRef
      ? nextCampaign.warehouse.instances.find(
          (instance) => instance.id === sourceRef,
        ) ?? null
      : null;
    const sourceDefId = sourceRef && !sourceInstance ? sourceRef : null;
    const sourceDefinition = sourceDefId ? ITEM_DEFS[sourceDefId] : null;
    if (
      sourceRef &&
      sourceDefId &&
      sourceDefinition &&
      target.target.kind === "flex" &&
      isPartyQuickslotTarget(target.target) &&
      AUTO_SLOT_CATEGORIES.has(sourceDefinition.category) &&
      sourceDefinition.category !== "wand"
    ) {
      if (
        source.zone === "warehouse" &&
        !selectedRefs().includes(sourceRef) &&
        selectedLoadoutSlotCount(nextLoadout) >= MAX_INVENTORY_SLOTS
      ) {
        return unchanged();
      }
      if (source.zone === "warehouse") selectStoredRef(sourceRef);
      const owner = equipmentOwner(target);
      if (!owner) return unchanged();
      const previousAuto = owner.autoSlots[target.target.index];
      if (previousAuto && previousAuto.instance) return unchanged();
      const ringKey = FLEX_EQUIPMENT_KEYS[target.target.index];
      const previousRing = owner.equipment[ringKey];
      if (owner.equipmentInstances[ringKey]?.cursed) return unchanged();
      if (previousRing) {
        nextCampaign.warehouse.instances.push(
          owner.equipmentInstances[ringKey] ??
            createPlainEquipmentInstance(
              ITEM_DEFS[previousRing],
              `preparation-return-${previousRing}-${ringKey}`,
            ),
        );
        owner.equipment[ringKey] = null;
        owner.equipmentInstances[ringKey] = null;
        nextCampaign.warehouse.slots = normalizeStorageSlots(
          nextCampaign.warehouse,
          WAREHOUSE_SLOT_COUNT,
        );
      }
      owner.autoSlots[target.target.index] = {
        defId: sourceDefId,
        quantity: 0,
        instance: null,
      };
      return { campaign: nextCampaign, loadout: nextLoadout, changed: true };
    }
  }

  if (isPreparationEquipment(source) && isWarehouseOrBag(target)) {
    const autoItem = sharedAutoItemAt(source);
    if (autoItem?.shared && source.target.kind === "flex") {
      const owner = equipmentOwner(source);
      if (!owner) return unchanged();
      owner.autoSlots[source.target.index] = null;
      if (target.zone === "warehouse") {
        clearSharedAutoReferences(autoItem.defId);
        deselectStoredRef(autoItem.defId);
        placeWarehouseRef(autoItem.defId, target.index);
      } else {
        if (!selectedRefs().includes(autoItem.defId)) {
          if (selectedLoadoutSlotCount(nextLoadout) >= MAX_INVENTORY_SLOTS) {
            return unchanged();
          }
          selectStoredRef(autoItem.defId);
        }
        placeBagRef(autoItem.defId, target.index);
      }
      return { campaign: nextCampaign, loadout: nextLoadout, changed: true };
    }
  }

  if (isWarehouseOrBag(source) && isPreparationEquipment(target)) {
    const sourceRef = source.zone === "warehouse"
      ? visibleWarehouseRefAt(source.index)
      : bagRefAt(source.index);
    if (!sourceRef) return unchanged();
    const sourceGear = takeStoredGear(sourceRef);
    const targetGear = readGear(target);
    if (
      !sourceGear ||
      !acceptsGear(sourceGear, target) ||
      targetGear?.instance.cursed
    ) {
      return unchanged();
    }
    writeGear(target, sourceGear);
    if (targetGear) {
      storeGear(
        targetGear,
        source.zone === "warehouse" ? source.index : null,
        source.zone === "preparationInventory" ? source.index : null,
      );
    }
    return { campaign: nextCampaign, loadout: nextLoadout, changed: true };
  }

  if (isPreparationEquipment(source) && isWarehouseOrBag(target)) {
    const sourceGear = readGear(source);
    if (!sourceGear || sourceGear.instance.cursed) return unchanged();
    const targetRef = target.zone === "warehouse"
      ? visibleWarehouseRefAt(target.index)
      : bagRefAt(target.index);
    const targetGear = targetRef ? takeStoredGear(targetRef) : null;
    if (targetRef && (!targetGear || !acceptsGear(targetGear, source))) {
      return unchanged();
    }
    writeGear(source, targetGear);
    storeGear(
      sourceGear,
      target.zone === "warehouse" ? target.index : null,
      target.zone === "preparationInventory" ? target.index : null,
    );
    return { campaign: nextCampaign, loadout: nextLoadout, changed: true };
  }

  if (isPreparationEquipment(source) && isPreparationEquipment(target)) {
    const sourceGear = readGear(source);
    const targetGear = readGear(target);
    if (
      !sourceGear ||
      sourceGear.instance.cursed ||
      targetGear?.instance.cursed ||
      !acceptsGear(sourceGear, target) ||
      (targetGear && !acceptsGear(targetGear, source))
    ) {
      return unchanged();
    }
    writeGear(source, targetGear);
    writeGear(target, sourceGear);
    return { campaign: nextCampaign, loadout: nextLoadout, changed: true };
  }

  return unchanged();
}
