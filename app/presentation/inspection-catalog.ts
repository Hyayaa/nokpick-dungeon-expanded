import { OBJECT_SPRITES } from "../game/data";
import { CloudKind, Terrain } from "../game/types";

export const TERRAIN_DETAILS: Record<
  Terrain,
  { nameKo: string; nameEn: string; descriptionKo: string; descriptionEn: string }
> = {
  wall: {
    nameKo: "하수도 벽",
    nameEn: "Sewer Wall",
    descriptionKo: "이동과 시야를 막는 단단한 벽입니다.",
    descriptionEn: "A solid wall that blocks movement and sight.",
  },
  floor: {
    nameKo: "석재 바닥",
    nameEn: "Stone Floor",
    descriptionKo: "특별한 효과 없이 걸을 수 있는 바닥입니다.",
    descriptionEn: "Ordinary walkable dungeon floor.",
  },
  specialFloor: {
    nameKo: "특수 석재 바닥",
    nameEn: "Special Stone Floor",
    descriptionKo: "특수방과 다리를 표시하는 안전한 바닥입니다.",
    descriptionEn: "Safe floor used for special chambers and bridges.",
  },
  chasm: {
    nameKo: "낭떠러지",
    nameEn: "Chasm",
    descriptionKo: "평소에는 건널 수 없으며 부유 중에만 안전하게 이동할 수 있습니다.",
    descriptionEn: "Impassable normally, but safely traversable while levitating.",
  },
  grass: {
    nameKo: "짧은 풀",
    nameEn: "Short Grass",
    descriptionKo: "이미 밟혀 낮아진 풀입니다. 이동과 시야를 막지 않습니다.",
    descriptionEn: "Trampled grass that no longer blocks movement or sight.",
  },
  highGrass: {
    nameKo: "높은 풀",
    nameEn: "High Grass",
    descriptionKo: "시야를 가리는 수풀입니다. 밟으면 낮아지며 불이 빠르게 번집니다.",
    descriptionEn: "Dense grass that blocks sight, flattens when crossed, and readily catches fire.",
  },
  water: {
    nameKo: "얕은 물",
    nameEn: "Shallow Water",
    descriptionKo: "걸어서 건널 수 있습니다. 불을 끄며 전기가 연결된 물웅덩이를 따라 전도됩니다.",
    descriptionEn: "Walkable water that extinguishes fire and conducts electricity through connected pools.",
  },
  entrance: {
    nameKo: "층 입구",
    nameEn: "Floor Entrance",
    descriptionKo: "원정대가 이번 층에 들어온 지점입니다.",
    descriptionEn: "The point where the party entered this floor.",
  },
  exit: {
    nameKo: "하강 계단",
    nameEn: "Down Stairway",
    descriptionKo: "현재 층의 잠금을 해결한 뒤 다음 층으로 내려가는 출구입니다.",
    descriptionEn: "The way down after the floor's locked route has been opened.",
  },
  door: {
    nameKo: "닫힌 문",
    nameEn: "Closed Door",
    descriptionKo: "열 때 1턴을 소비하며, 닫힌 동안 이동과 시야를 막습니다.",
    descriptionEn: "Opening it costs a turn; while closed it blocks movement and sight.",
  },
  openDoor: {
    nameKo: "열린 문",
    nameEn: "Open Door",
    descriptionKo: "현재 열려 있어 이동과 시야가 통하는 문입니다.",
    descriptionEn: "An open doorway that currently allows movement and sight.",
  },
  lockedDoor: {
    nameKo: "잠긴 문",
    nameEn: "Locked Door",
    descriptionKo: "이 층의 쇠 열쇠가 있어야 열 수 있습니다. 상호작용에는 1턴이 듭니다.",
    descriptionEn: "Requires this floor's iron key and costs one turn to unlock.",
  },
  crystalDoor: {
    nameKo: "수정문",
    nameEn: "Crystal Door",
    descriptionKo: "이 층의 수정 열쇠 하나를 소비해야 열 수 있는 보상문입니다.",
    descriptionEn: "A reward door that consumes one crystal key from this floor.",
  },
  barricade: {
    nameKo: "바리케이드",
    nameEn: "Barricade",
    descriptionKo: "열쇠로 열 수 없는 가연성 장벽입니다. 화염으로 태울 수 있습니다.",
    descriptionEn: "A flammable barrier that cannot be opened by a key.",
  },
  magicalFire: {
    nameKo: "영원의 불꽃",
    nameEn: "Magical Fire",
    descriptionKo: "통과할 수 없는 마법 불꽃입니다. 냉기 효과로 제거할 수 있습니다.",
    descriptionEn: "Impassable magical flame that can be removed with frost.",
  },
};

export const OBJECT_DETAILS: Record<
  keyof typeof OBJECT_SPRITES,
  { descriptionKo: string; descriptionEn: string }
> = {
  chest: {
    descriptionKo: "일반 장비 한 점을 보관한 나무 상자입니다. 가까이에서 조사하면 열 수 있습니다.",
    descriptionEn: "A wooden chest holding one equipment reward. Interact nearby to open it.",
  },
  crystalChest: {
    descriptionKo: "희귀한 장비가 담긴 수정 상자입니다. 가까이에서 조사하면 열 수 있습니다.",
    descriptionEn: "A crystal chest containing rare equipment. Interact nearby to open it.",
  },
  tomb: {
    descriptionKo: "오래된 장비가 묻힌 무덤입니다. 가까이에서 조사하면 내용물을 꺼낼 수 있습니다.",
    descriptionEn: "An old tomb concealing equipment. Interact nearby to recover it.",
  },
  alchemy: {
    descriptionKo: "가까이에서 조사하면 연금술 창을 열 수 있는 재사용 작업대입니다.",
    descriptionEn: "A reusable workbench that opens the alchemy interface when investigated nearby.",
  },
};

export const CLOUD_DETAILS: Record<
  CloudKind,
  { nameKo: string; nameEn: string; descriptionKo: string; descriptionEn: string }
> = {
  fire: {
    nameKo: "화염 장판",
    nameEn: "Burning Ground",
    descriptionKo: "머무는 대상을 태우며 수풀과 문을 따라 빠르게 번집니다. 물 위에는 유지되지 않습니다.",
    descriptionEn: "Burns occupants and spreads quickly through grass and doors, but cannot persist on water.",
  },
  frost: {
    nameKo: "냉기 장판",
    nameEn: "Frost Field",
    descriptionKo: "대상에게 한기를 누적시키고 심해지면 빙결시킵니다.",
    descriptionEn: "Builds chill on occupants and can eventually freeze them.",
  },
  paralytic: {
    nameKo: "마비 가스",
    nameEn: "Paralytic Gas",
    descriptionKo: "들이마신 대상을 일정 시간 행동할 수 없게 만듭니다.",
    descriptionEn: "Prevents affected targets from acting for a time.",
  },
  toxic: {
    nameKo: "맹독 가스",
    nameEn: "Toxic Gas",
    descriptionKo: "범위 안의 대상에게 지속적인 독 피해를 줍니다.",
    descriptionEn: "Poisons targets within the affected area over time.",
  },
  corrosive: {
    nameKo: "부식 가스",
    nameEn: "Corrosive Gas",
    descriptionKo: "방어를 무시하는 부식 피해를 지속적으로 줍니다.",
    descriptionEn: "Deals ongoing corrosive damage that bypasses defense.",
  },
  storm: {
    nameKo: "폭풍 구름",
    nameEn: "Storm Cloud",
    descriptionKo: "범위 안을 물로 적시고 번개가 전도되기 쉬운 환경을 만듭니다.",
    descriptionEn: "Soaks its area and creates favorable conditions for conducting lightning.",
  },
};
