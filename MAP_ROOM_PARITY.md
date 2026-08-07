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
| SpecialRoom 계열 | 함정·보상·몬스터·키 의존 방 | 방별 추가 시스템 | 미구현 | P3 |
| SecretRoom 계열 | 비밀문과 발견 규칙 | secret door, 보상 | 미구현 | P3 |
| Quest/Boss room | 퀘스트·보스 전용 생성 규칙 | 전용 상태·보상 | 미구현 | P3 |

## 후속 작업 가이드

1. 먼저 이 표에서 미구현 P1을 고르고, 원본의 해당 room class와 직접 부모만 확인한다.
2. 방 선택·크기는 `app/game/map.ts`, P0 도색·연결성은 `app/game/room-presets.ts`의 기존 helper를 재사용한다.
3. 새 terrain이 필요할 때만 `app/game/types.ts`와 `app/presentation/render.ts`를 확장한다.
