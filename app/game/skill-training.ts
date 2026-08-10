import type { CampaignSave } from "./campaign";
import {
  COMPANION_PROFESSIONS,
  COMPANION_SKILLS,
  MAX_COMPANION_SKILL_LEVEL,
  normalizeEquippedSkills,
  normalizeCompanionSkillLevel,
  normalizeCompanionSkillLevels,
  normalizeLearnedSkills,
} from "./companion-skills";
import type { Companion, CompanionSkillId } from "./types";
import {
  canPayMaterials,
  payMaterials,
  type CampaignMaterialCost,
} from "./campaign-materials";

export type SkillTrainingFailure =
  | "companion-not-found"
  | "invalid-skill"
  | "wrong-profession"
  | "already-learned"
  | "not-learned"
  | "not-enough-gold"
  | "not-enough-materials"
  | "maximum-level"
  | "already-equipped"
  | "slot-required";

type SkillTrainingResult = {
  campaign: CampaignSave;
  changed: boolean;
  reason: "ok" | SkillTrainingFailure;
  cost: number;
  materialCost: CampaignMaterialCost;
};

export type SkillLevelRequirement = {
  currentLevel: number;
  nextLevel: number;
  gold: number;
  materials: CampaignMaterialCost;
};

const SKILL_LEVEL_MATERIAL_COSTS: Readonly<
  Record<1 | 2 | 3 | 4, CampaignMaterialCost>
> = {
  1: { seed: 4, potion: 1 },
  2: { seed: 6, potion: 2 },
  3: { seed: 9, potion: 3 },
  4: { seed: 12, potion: 4 },
};

export const skillLevelRequirements = (
  skillId: CompanionSkillId,
  currentLevel: number,
): SkillLevelRequirement | null => {
  const definition = COMPANION_SKILLS[skillId];
  const level = normalizeCompanionSkillLevel(currentLevel);
  if (!definition || level >= MAX_COMPANION_SKILL_LEVEL) return null;
  const materials = SKILL_LEVEL_MATERIAL_COSTS[level as 1 | 2 | 3 | 4];
  return {
    currentLevel: level,
    nextLevel: level + 1,
    gold: definition.trainingCost * (2 ** level),
    materials: { ...materials },
  };
};

export type SkillLevelResult = {
  campaign: CampaignSave;
  changed: boolean;
  reason: "ok" | SkillTrainingFailure;
  requirement: SkillLevelRequirement | null;
};

const replaceCompanion = (
  campaign: CampaignSave,
  companion: Companion,
): CampaignSave => ({
  ...campaign,
  companions: campaign.companions.map((candidate) =>
    candidate.id === companion.id ? companion : candidate,
  ),
});

const failure = (
  campaign: CampaignSave,
  reason: SkillTrainingFailure,
  cost = 0,
  materialCost: CampaignMaterialCost = {},
): SkillTrainingResult => ({
  campaign,
  changed: false,
  reason,
  cost,
  materialCost,
});

export const canLearnCompanionSkill = (
  campaign: CampaignSave,
  companionId: string,
  skillId: CompanionSkillId,
): Omit<SkillTrainingResult, "campaign"> => {
  const companion = campaign.companions.find(
    (candidate) => candidate.id === companionId,
  );
  const definition = COMPANION_SKILLS[skillId];
  if (!companion) {
    return { changed: false, reason: "companion-not-found", cost: 0, materialCost: {} };
  }
  if (!definition) {
    return { changed: false, reason: "invalid-skill", cost: 0, materialCost: {} };
  }
  if (!COMPANION_PROFESSIONS[companion.professionId].skillPool.includes(skillId)) {
    return {
      changed: false,
      reason: "wrong-profession",
      cost: definition.trainingCost,
      materialCost: definition.trainingMaterials,
    };
  }
  const learnedSkills = normalizeLearnedSkills(
    companion.professionId,
    companion.learnedSkills,
    companion.skills,
  );
  if (learnedSkills.includes(skillId)) {
    return {
      changed: false,
      reason: "already-learned",
      cost: definition.trainingCost,
      materialCost: definition.trainingMaterials,
    };
  }
  if (campaign.gold < definition.trainingCost) {
    return {
      changed: false,
      reason: "not-enough-gold",
      cost: definition.trainingCost,
      materialCost: definition.trainingMaterials,
    };
  }
  if (!canPayMaterials(campaign.materials, definition.trainingMaterials)) {
    return {
      changed: false,
      reason: "not-enough-materials",
      cost: definition.trainingCost,
      materialCost: definition.trainingMaterials,
    };
  }
  return {
    changed: true,
    reason: "ok",
    cost: definition.trainingCost,
    materialCost: definition.trainingMaterials,
  };
};

export const learnCompanionSkill = (
  campaign: CampaignSave,
  companionId: string,
  skillId: CompanionSkillId,
): SkillTrainingResult => {
  const validation = canLearnCompanionSkill(campaign, companionId, skillId);
  if (!validation.changed) {
    return failure(
      campaign,
      validation.reason as SkillTrainingFailure,
      validation.cost,
      validation.materialCost,
    );
  }
  const companion = campaign.companions.find(
    (candidate) => candidate.id === companionId,
  )!;
  const learnedSkills = normalizeLearnedSkills(
    companion.professionId,
    [...(companion.learnedSkills ?? companion.skills), skillId],
    companion.skills,
  );
  const skillLevels = {
    ...normalizeCompanionSkillLevels(learnedSkills, companion.skillLevels),
    [skillId]: 1,
  };
  const nextCampaign = replaceCompanion(campaign, {
    ...companion,
    learnedSkills,
    skillLevels,
    skills: normalizeEquippedSkills(
      companion.professionId,
      learnedSkills,
      companion.skills,
    ),
  });
  const materials = payMaterials(campaign.materials, validation.materialCost)!;
  return {
    campaign: {
      ...nextCampaign,
      gold: campaign.gold - validation.cost,
      materials,
    },
    changed: true,
    reason: "ok",
    cost: validation.cost,
    materialCost: validation.materialCost,
  };
};

export const canLevelCompanionSkill = (
  campaign: CampaignSave,
  companionId: string,
  skillId: CompanionSkillId,
): Omit<SkillLevelResult, "campaign"> => {
  const companion = campaign.companions.find(
    (candidate) => candidate.id === companionId,
  );
  const definition = COMPANION_SKILLS[skillId];
  if (!companion) {
    return { changed: false, reason: "companion-not-found", requirement: null };
  }
  if (!definition) {
    return { changed: false, reason: "invalid-skill", requirement: null };
  }
  if (!COMPANION_PROFESSIONS[companion.professionId].skillPool.includes(skillId)) {
    return { changed: false, reason: "wrong-profession", requirement: null };
  }
  const learnedSkills = normalizeLearnedSkills(
    companion.professionId,
    companion.learnedSkills,
    companion.skills,
  );
  if (!learnedSkills.includes(skillId)) {
    return { changed: false, reason: "not-learned", requirement: null };
  }
  const skillLevels = normalizeCompanionSkillLevels(
    learnedSkills,
    companion.skillLevels,
  );
  const requirement = skillLevelRequirements(skillId, skillLevels[skillId] ?? 1);
  if (!requirement) {
    return { changed: false, reason: "maximum-level", requirement: null };
  }
  if (campaign.gold < requirement.gold) {
    return { changed: false, reason: "not-enough-gold", requirement };
  }
  if (!canPayMaterials(campaign.materials, requirement.materials)) {
    return { changed: false, reason: "not-enough-materials", requirement };
  }
  return { changed: true, reason: "ok", requirement };
};

export const levelCompanionSkill = (
  campaign: CampaignSave,
  companionId: string,
  skillId: CompanionSkillId,
): SkillLevelResult => {
  const validation = canLevelCompanionSkill(campaign, companionId, skillId);
  if (!validation.changed || !validation.requirement) {
    return { campaign, ...validation };
  }
  const companion = campaign.companions.find(
    (candidate) => candidate.id === companionId,
  )!;
  const learnedSkills = normalizeLearnedSkills(
    companion.professionId,
    companion.learnedSkills,
    companion.skills,
  );
  const skillLevels = normalizeCompanionSkillLevels(
    learnedSkills,
    companion.skillLevels,
  );
  const materials = payMaterials(
    campaign.materials,
    validation.requirement.materials,
  );
  if (!materials) {
    return {
      campaign,
      changed: false,
      reason: "not-enough-materials",
      requirement: validation.requirement,
    };
  }
  return {
    campaign: replaceCompanion(
      {
        ...campaign,
        gold: campaign.gold - validation.requirement.gold,
        materials,
      },
      {
        ...companion,
        learnedSkills,
        skillLevels: {
          ...skillLevels,
          [skillId]: validation.requirement.nextLevel,
        },
      },
    ),
    changed: true,
    reason: "ok",
    requirement: validation.requirement,
  };
};

export const equipCompanionSkill = (
  campaign: CampaignSave,
  companionId: string,
  skillId: CompanionSkillId,
  slotIndex?: 0 | 1,
): SkillTrainingResult => {
  const companion = campaign.companions.find(
    (candidate) => candidate.id === companionId,
  );
  if (!companion) return failure(campaign, "companion-not-found");
  if (!COMPANION_SKILLS[skillId]) return failure(campaign, "invalid-skill");
  const pool = COMPANION_PROFESSIONS[companion.professionId].skillPool;
  if (!pool.includes(skillId)) return failure(campaign, "wrong-profession");
  const learnedSkills = normalizeLearnedSkills(
    companion.professionId,
    companion.learnedSkills,
    companion.skills,
  );
  if (!learnedSkills.includes(skillId)) return failure(campaign, "not-learned");
  const equipped = normalizeEquippedSkills(
    companion.professionId,
    learnedSkills,
    companion.skills,
  );
  if (equipped.includes(skillId)) return failure(campaign, "already-equipped");
  const target = slotIndex ?? (equipped.length < 2 ? equipped.length as 0 | 1 : null);
  if (target === null) return failure(campaign, "slot-required");
  const next = [...equipped];
  next[target] = skillId;
  const skills = normalizeEquippedSkills(
    companion.professionId,
    learnedSkills,
    next,
  );
  return {
    campaign: replaceCompanion(campaign, { ...companion, learnedSkills, skills }),
    changed: true,
    reason: "ok",
    cost: 0,
    materialCost: {},
  };
};

export const swapCompanionSkills = (
  campaign: CampaignSave,
  companionId: string,
  fromIndex: 0 | 1,
  toIndex: 0 | 1,
): SkillTrainingResult => {
  const companion = campaign.companions.find(
    (candidate) => candidate.id === companionId,
  );
  if (!companion) return failure(campaign, "companion-not-found");
  const learnedSkills = normalizeLearnedSkills(
    companion.professionId,
    companion.learnedSkills,
    companion.skills,
  );
  const skills = normalizeEquippedSkills(
    companion.professionId,
    learnedSkills,
    companion.skills,
  );
  if (!skills[fromIndex] || fromIndex === toIndex) {
    return failure(campaign, "invalid-skill");
  }
  const next = [...skills];
  [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
  return {
    campaign: replaceCompanion(campaign, {
      ...companion,
      learnedSkills,
      skills: normalizeEquippedSkills(
        companion.professionId,
        learnedSkills,
        next,
      ),
    }),
    changed: true,
    reason: "ok",
    cost: 0,
    materialCost: {},
  };
};

export const unequipCompanionSkill = (
  campaign: CampaignSave,
  companionId: string,
  slotIndex: 0 | 1,
): SkillTrainingResult => {
  const companion = campaign.companions.find(
    (candidate) => candidate.id === companionId,
  );
  if (!companion) return failure(campaign, "companion-not-found");
  const learnedSkills = normalizeLearnedSkills(
    companion.professionId,
    companion.learnedSkills,
    companion.skills,
  );
  const skills = normalizeEquippedSkills(
    companion.professionId,
    learnedSkills,
    companion.skills,
  );
  if (!skills[slotIndex]) return failure(campaign, "invalid-skill");
  skills.splice(slotIndex, 1);
  return {
    campaign: replaceCompanion(campaign, { ...companion, learnedSkills, skills }),
    changed: true,
    reason: "ok",
    cost: 0,
    materialCost: {},
  };
};
