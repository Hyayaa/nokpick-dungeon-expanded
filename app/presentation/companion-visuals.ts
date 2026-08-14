import { ITEM_DEFS } from "../game/data";
import { COMPANION_CLASSES } from "../game/companions";
import { normalizeCompanionProfession } from "../game/companion-skills";
import {
  Companion,
  CompanionClassId,
  CompanionProfessionId,
} from "../game/types";

export const CHARACTER_FRAME_WIDTH = 24;
export const CHARACTER_FRAME_HEIGHT = 24;
export const CHARACTER_SHEET_WIDTH = 192;
export const CHARACTER_SHEET_HEIGHT = 72;

// Compatibility names for presentation callers that still describe party
// members as companions. Every playable character now uses the player layout.
export const COMPANION_FRAME_WIDTH = CHARACTER_FRAME_WIDTH;
export const COMPANION_FRAME_HEIGHT = CHARACTER_FRAME_HEIGHT;

export const COMPANION_IDLE_FRAMES = [0, 0, 0, 1, 0, 0, 1, 1] as const;
export const COMPANION_MOVE_FRAMES = [2, 3, 4, 5, 6, 7] as const;
export const COMPANION_DEFEAT_FRAMES = [8, 9, 10, 11, 12, 11] as const;
export const COMPANION_ATTACK_FRAMES = [13, 14, 15, 0] as const;
export const COMPANION_INTERACT_FRAMES = [16, 17, 16, 17] as const;

export type CompanionVisualDefinition = {
  sprite: string;
  sheetWidth: number;
  sheetHeight: number;
  frameWidth: number;
  frameHeight: number;
  animationSet: "companion" | "adventurer";
};

const companionSprite = (
  sprite: string,
): CompanionVisualDefinition => ({
  sprite,
  sheetWidth: CHARACTER_SHEET_WIDTH,
  sheetHeight: CHARACTER_SHEET_HEIGHT,
  frameWidth: CHARACTER_FRAME_WIDTH,
  frameHeight: CHARACTER_FRAME_HEIGHT,
  animationSet: "adventurer",
});

export const CHARACTER_VISUALS_BY_PROFESSION: Readonly<
  Record<CompanionProfessionId, CompanionVisualDefinition>
> = {
  cleric: companionSprite("/assets/sprites/characters/cleric.png"),
  rogue: companionSprite("/assets/sprites/characters/rogue.png"),
  mage: companionSprite("/assets/sprites/characters/mage.png"),
  warrior: companionSprite("/assets/sprites/characters/warrior.png"),
};

export const COMPANION_VISUALS: Record<
  CompanionClassId,
  CompanionVisualDefinition
> = Object.fromEntries(
  (Object.keys(COMPANION_CLASSES) as CompanionClassId[]).map((classId) => [
    classId,
    CHARACTER_VISUALS_BY_PROFESSION[
      normalizeCompanionProfession(classId, undefined)
    ],
  ]),
) as Record<CompanionClassId, CompanionVisualDefinition>;

export const COMPANION_PRESENTATIONS = Object.fromEntries(
  (Object.keys(COMPANION_CLASSES) as CompanionClassId[]).map((classId) => [
    classId,
    {
      ...COMPANION_CLASSES[classId],
      ...COMPANION_VISUALS[classId],
    },
  ]),
) as {
  [ClassId in CompanionClassId]:
    (typeof COMPANION_CLASSES)[ClassId] & CompanionVisualDefinition;
};

export const characterPresentation = (
  character: Pick<Companion, "classId" | "professionId">,
) => ({
  ...COMPANION_PRESENTATIONS[character.classId],
  ...CHARACTER_VISUALS_BY_PROFESSION[character.professionId],
});

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
  _armorTier: number,
  frameWithinTier: number,
) => Math.max(0, Math.min(23, frameWithinTier));
