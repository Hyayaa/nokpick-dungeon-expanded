import type {
  Companion,
  CompanionProfessionId,
  GameState,
  Player,
  SkillResourceState,
  SkillResourceType,
} from "./types";

export const SKILL_RESOURCE_DEFAULTS = Object.freeze({
  maxStamina: 100,
  staminaRegen: 10,
  maxMana: 100,
  manaRegen: 0.5,
});

type SkillResourceCarrier = Partial<SkillResourceState>;

const finiteOr = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const positiveOr = (value: unknown, fallback: number) => {
  const normalized = finiteOr(value, fallback);
  return normalized > 0 ? normalized : fallback;
};

const clamp = (value: number, maximum: number) =>
  Math.max(0, Math.min(maximum, value));

export const createSkillResources = (): SkillResourceState => ({
  currentStamina: SKILL_RESOURCE_DEFAULTS.maxStamina,
  maxStamina: SKILL_RESOURCE_DEFAULTS.maxStamina,
  staminaRegen: SKILL_RESOURCE_DEFAULTS.staminaRegen,
  currentMana: SKILL_RESOURCE_DEFAULTS.maxMana,
  maxMana: SKILL_RESOURCE_DEFAULTS.maxMana,
  manaRegen: SKILL_RESOURCE_DEFAULTS.manaRegen,
});

export const normalizeSkillResources = (
  carrier: SkillResourceCarrier,
): SkillResourceState => {
  const maxStamina = positiveOr(
    carrier.maxStamina,
    SKILL_RESOURCE_DEFAULTS.maxStamina,
  );
  const maxMana = positiveOr(
    carrier.maxMana,
    SKILL_RESOURCE_DEFAULTS.maxMana,
  );
  return {
    currentStamina: clamp(
      finiteOr(carrier.currentStamina, maxStamina),
      maxStamina,
    ),
    maxStamina,
    staminaRegen: Math.max(
      0,
      finiteOr(carrier.staminaRegen, SKILL_RESOURCE_DEFAULTS.staminaRegen),
    ),
    currentMana: clamp(finiteOr(carrier.currentMana, maxMana), maxMana),
    maxMana,
    manaRegen: Math.max(
      0,
      finiteOr(carrier.manaRegen, SKILL_RESOURCE_DEFAULTS.manaRegen),
    ),
  };
};

export const fillSkillResources = (
  carrier: SkillResourceCarrier,
): SkillResourceState => {
  const normalized = normalizeSkillResources(carrier);
  return {
    ...normalized,
    currentStamina: normalized.maxStamina,
    currentMana: normalized.maxMana,
  };
};

export const primarySkillResource = (
  professionId: CompanionProfessionId,
): SkillResourceType =>
  professionId === "mage" || professionId === "cleric" ? "mana" : "stamina";

export const currentSkillResource = (
  carrier: SkillResourceCarrier,
  resourceType: SkillResourceType,
) => {
  const normalized = normalizeSkillResources(carrier);
  return resourceType === "stamina"
    ? normalized.currentStamina
    : normalized.currentMana;
};

export const maxSkillResource = (
  carrier: SkillResourceCarrier,
  resourceType: SkillResourceType,
) => {
  const normalized = normalizeSkillResources(carrier);
  return resourceType === "stamina"
    ? normalized.maxStamina
    : normalized.maxMana;
};

export const canPaySkillResource = (
  carrier: SkillResourceCarrier,
  resourceType: SkillResourceType,
  resourceCost: number,
) => currentSkillResource(carrier, resourceType) >= Math.max(0, resourceCost);

export const paySkillResource = (
  carrier: SkillResourceCarrier,
  resourceType: SkillResourceType,
  resourceCost: number,
) => {
  const normalized = normalizeSkillResources(carrier);
  Object.assign(carrier, normalized);
  const cost = Math.max(0, finiteOr(resourceCost, 0));
  if (!canPaySkillResource(normalized, resourceType, cost)) return false;
  if (resourceType === "stamina") {
    carrier.currentStamina = clamp(normalized.currentStamina - cost, normalized.maxStamina);
  } else {
    carrier.currentMana = clamp(normalized.currentMana - cost, normalized.maxMana);
  }
  return true;
};

export const recoverSkillResources = (
  carrier: SkillResourceCarrier,
  elapsedTurns: number,
) => {
  const normalized = normalizeSkillResources(carrier);
  const elapsed = Math.max(0, finiteOr(elapsedTurns, 0));
  const recovered = {
    ...normalized,
    currentStamina: clamp(
      normalized.currentStamina + normalized.staminaRegen * elapsed,
      normalized.maxStamina,
    ),
    currentMana: clamp(
      normalized.currentMana + normalized.manaRegen * elapsed,
      normalized.maxMana,
    ),
  };
  Object.assign(carrier, recovered);
  return recovered;
};

const actorResourceId = (actor: Player | Companion) =>
  "companionId" in actor ? actor.companionId : actor.id;

export const recoverPartySkillResources = (
  state: GameState,
  elapsedTurns: number,
  excludedActorIds: ReadonlySet<string> = new Set(),
) => {
  [state.player, ...(state.companions ?? [])].forEach((actor) => {
    if (!excludedActorIds.has(actorResourceId(actor))) {
      recoverSkillResources(actor, elapsedTurns);
    }
  });
};

export const formatSkillResourceAmount = (value: number) => {
  const safe = Math.max(0, finiteOr(value, 0));
  return Number.isInteger(safe) ? `${safe}` : safe.toFixed(1);
};
