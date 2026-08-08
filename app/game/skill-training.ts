import type { CampaignSave } from "./campaign";
import {
  COMPANION_PROFESSIONS,
  COMPANION_SKILLS,
  normalizeEquippedSkills,
  normalizeLearnedSkills,
} from "./companion-skills";
import type { Companion, CompanionSkillId } from "./types";

export type SkillTrainingFailure =
  | "companion-not-found"
  | "invalid-skill"
  | "wrong-profession"
  | "already-learned"
  | "not-learned"
  | "not-enough-gold"
  | "already-equipped"
  | "slot-required";

type SkillTrainingResult = {
  campaign: CampaignSave;
  changed: boolean;
  reason: "ok" | SkillTrainingFailure;
  cost: number;
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
): SkillTrainingResult => ({ campaign, changed: false, reason, cost });

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
    return { changed: false, reason: "companion-not-found", cost: 0 };
  }
  if (!definition) {
    return { changed: false, reason: "invalid-skill", cost: 0 };
  }
  if (!COMPANION_PROFESSIONS[companion.professionId].skillPool.includes(skillId)) {
    return {
      changed: false,
      reason: "wrong-profession",
      cost: definition.trainingCost,
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
    };
  }
  if (campaign.gold < definition.trainingCost) {
    return {
      changed: false,
      reason: "not-enough-gold",
      cost: definition.trainingCost,
    };
  }
  return { changed: true, reason: "ok", cost: definition.trainingCost };
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
  const nextCampaign = replaceCompanion(campaign, {
    ...companion,
    learnedSkills,
    skills: normalizeEquippedSkills(
      companion.professionId,
      learnedSkills,
      companion.skills,
    ),
  });
  return {
    campaign: { ...nextCampaign, gold: campaign.gold - validation.cost },
    changed: true,
    reason: "ok",
    cost: validation.cost,
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
  };
};
