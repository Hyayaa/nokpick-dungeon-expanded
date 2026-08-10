import type { EnemyKind, EnemyRegion } from "./types";

export type BossId = "dev_training_boss" | "goo";

export type BossArenaProfile = "plain" | "goo";

export type BossArenaSettings = {
  minimumWidth: number;
  minimumHeight: number;
  profile: BossArenaProfile;
};

export type BossDefinition = {
  id: BossId;
  nameKo: string;
  nameEn: string;
  enemyKind: EnemyKind;
  region: EnemyRegion;
  minionCount: number;
  arena: BossArenaSettings;
  phaseThreshold?: number;
  production: boolean;
};

export const BOSS_DEFINITIONS: Readonly<Record<BossId, BossDefinition>> = {
  dev_training_boss: {
    id: "dev_training_boss",
    nameKo: "훈련용 보스",
    nameEn: "Training Boss",
    enemyKind: "training_leaper",
    region: "halls",
    minionCount: 10,
    arena: {
      minimumWidth: 19,
      minimumHeight: 19,
      profile: "plain",
    },
    production: false,
  },
  goo: {
    id: "goo",
    nameKo: "구",
    nameEn: "Goo",
    enemyKind: "goo_boss",
    region: "sewers",
    minionCount: 10,
    arena: {
      minimumWidth: 19,
      minimumHeight: 19,
      profile: "goo",
    },
    phaseThreshold: 0.5,
    production: true,
  },
};

export const bossDefinition = (bossId: BossId) =>
  BOSS_DEFINITIONS[bossId];

export const isBossFloor = (
  bossId: BossId | undefined,
  floor: number,
  maxFloor: number,
) => Boolean(bossId && floor === maxFloor);
