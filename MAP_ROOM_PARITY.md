# Map room parity

| 원본 방 | 핵심 구조 | 필요 terrain | 현재 상태 | 우선순위 |
| --- | --- | --- | --- | --- |
| ChasmBridgeRoom | 방을 가르는 낭떠러지와 좁은 횡단 다리 | CHASM, specialFloor | 구현 | P0 |
| ChasmRoom | 크기 비례 군집형 낭떠러지 patch | CHASM | 구현 | P0 |
| PlatformRoom | 재귀 분할 플랫폼과 연결 다리 | CHASM, specialFloor | 구현 | P0 |
| CirclePitRoom | 외곽 보행환과 중앙 타원형 구덩이 | CHASM | 구현, REGION_DECO 장식 제외 | P0 |
| CavesFissureRoom | 문을 피하는 다방향 균열과 다리 | CHASM, specialFloor | 구현 | P0 |
| WaterBridgeRoom | 물 공간과 횡단 다리 | water, floor/specialFloor | 기초형 존재, 원본 parity 필요 | P1 |
| CircleBasinRoom | 원형 수조와 외곽 보행부 | water, floor | 기초형 존재, 원본 parity 필요 | P1 |
| AquariumRoom | 수조형 분리 공간 | water, glass/region 표현 | 미구현 | P1 |
| RegionDecoBridgeRoom | 지역 장식 공간과 다리 | REGION_DECO 계열 | 미구현 | P1 |
| RegionDecoLineRoom | 선형 지역 장식 | REGION_DECO 계열 | 미구현 | P1 |
| RegionDecoPatchRoom | 군집형 지역 장식 | REGION_DECO 계열 | 단순 patch만 존재 | P1 |
| PlantsRoom | 식생 중심 방 | grass, highGrass | 기초형 존재, 원본 parity 필요 | P1 |
| GrassyGraveRoom | 묘지와 식생 | grass, highGrass, 장식 | 미구현 | P1 |
| BurnedRoom | 탄 흔적과 소실 식생 | burned/region 표현 | 미구현 | P1 |
| FissureRoom | 일반 지역 균열 | 지역별 균열 terrain | 미구현 | P1 |
| PillarsRoom | 규칙형 기둥 배치 | wall, floor | 기초형 존재 | P2 |
| RingRoom | 중앙 링 구조 | wall, floor | 기초형 존재 | P2 |
| StripedRoom | 줄무늬 지형대 | 지역별 장식 terrain | 기초형 존재 | P2 |
| SegmentedRoom | 분할벽과 연결부 | wall, floor | 기초형 존재 | P2 |
| CircleWallRoom | 원형 내벽 | wall, floor | 미구현 | P2 |
| RuinsRoom | 불규칙 폐허 벽체 | wall, grass | 기초형 존재 | P2 |
| CaveRoom | 자연 동굴 윤곽 | wall, floor | 미구현 | P2 |
| HallwayRoom | 길쭉한 통로형 방 | wall, floor | 미구현 | P2 |
| Library 계열 일반 방 | 서가·링·분할 도서관 | library/region 장식 | 미구현 | P2 |
| SecretRoom 계열 | 비밀문과 발견 규칙 | secret door, 보상 | 미구현 | P3 |
| Quest/Boss room | 퀘스트·보스 전용 생성 규칙 | 전용 상태·보상 | 미구현 | P3 |

## SpecialRoom

| room | gimmick | required item | required system | 상태 | 우선순위 |
| --- | --- | --- | --- | --- | --- |
| StorageRoom | 가연성 barricade 뒤 다중 보상 | 액체 화염 물약 | guaranteed floor spawn, fire interaction | 구현 | P0 |
| MagicalFireRoom | 통과 가능하지만 매우 위험한 지속성 강화 화염 장판 뒤 보상 | 서리 물약 | persistent DungeonCloud, frost 전역 소화 | 구현 | P0 |
| ToxicGasRoom | 유독 가스와 비활성 통풍구 | 정화 물약 | DungeonCloud, purified 상태 | 구현 | P0 |
| TrapsRoom | 지역별 지원 함정 또는 CHASM 횡단 | 부유 물약 | 공통 trap state, levitation 이동 | 구현 | P0 |
| CrystalChoiceRoom | 두 보상 중 하나 선택 | 수정 열쇠 1개 | CrystalKey/CrystalDoor | 구현 | P0 |
| CrystalPathRoom | 깊이에 따라 가치가 오르는 6구획 | 수정 열쇠 3개 | 공통 crystal-key 소비 | 구현 | P0 |
| PoolRoom | 피라냐 수조 | 투명화 물약 | aquatic enemy | 후속 | P1 |
| SentryRoom | 고정 감시포탑 사거리 돌파 | 신속 물약 | turret/beam AI | 후속 | P1 |
| CrystalVaultRoom | 제한 열쇠 보물 금고 | 수정 열쇠 | vault 보상 배치 | 후속 | P1 |
| PitRoom / WeakFloorRoom | 낙하·층간 연결 | 방별 대응 | 층간 낙하 상태 | 후속 | P1 |

지원 trap은 gripping, poison dart, explosive, teleportation, flashing으로 제한한다. 소환·분해 광선·별도 차원 계열은 필요한 시스템이 없어 현재 room pool에 넣지 않는다.

특수방 종류·필수 해결 아이템·핵심 보상은 던전 전체 loot/special plan에서 먼저 확정한다. 방 painter는 아이템을 다시 뽑지 않고, 배치 가능한 reward slot만 제공한다.

## 후속 작업 가이드

1. 먼저 이 표에서 미구현 P1을 고르고, 원본의 해당 room class와 직접 부모만 확인한다.
2. 방 선택·크기는 `app/game/map.ts`, P0 도색·연결성은 `app/game/room-presets.ts`의 기존 helper를 재사용한다.
3. 새 terrain이 필요할 때만 `app/game/types.ts`와 `app/presentation/render.ts`를 확장한다.
