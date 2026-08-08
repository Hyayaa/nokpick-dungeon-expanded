import type { CompanionSkillId } from "./types";

export type ActiveSlotEntry =
  | {
      kind: "item";
      itemRef: string;
      itemId: string;
    }
  | {
      kind: "skill";
      skillId: CompanionSkillId;
    };
