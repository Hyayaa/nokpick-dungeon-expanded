# 개발 작업 흐름

`main`은 항상 검증을 통과한 안정 기준으로 유지합니다. 기능 개발과 수정은 별도
브랜치에서 진행하고 Pull Request의 자동 검사를 통과한 뒤 병합합니다.

## 브랜치 이름

- 새 기능: `feature/간단한-기능명`
- 버그 수정: `fix/간단한-문제명`
- 문서·도구 정리: `chore/간단한-작업명`

예: `feature/companion-command`, `fix/vertical-door-sprite`

## 작업 순서

1. 최신 `main`에서 목적별 브랜치를 만듭니다.
2. 하나의 변경 목적만 담아 작게 커밋합니다.
3. 작업 중에는 `npm run test:quick`으로 린트, 게임 회귀, 성능 계약을 확인합니다.
4. Pull Request를 만들고 GitHub Actions의 `CI` 검사를 통과시킵니다.
5. 검토가 끝나면 `main`에 병합합니다.

Windows 로컬 실행 ZIP을 갱신하는 릴리스 작업에서는 기능 소스를 고정한 뒤
`npm run verify:local`을 최종 게이트로 한 번 실행합니다. 검증 후
`bash scripts/build-source-archive.sh`로 다운로드용 소스 ZIP을 갱신합니다.

## 커밋 원칙

- 커밋 메시지는 변경 결과가 바로 보이도록 짧게 작성합니다.
- 생성 가능한 `local-dist/`, `dist/`, Windows 실행 파일, 의존성 폴더는 커밋하지
  않습니다.
- 게임 로직 변경에는 가능한 한 `scripts/game-smoke.ts` 회귀 검사를 함께
  추가합니다.
- `app/game/`은 React, DOM, Canvas, 오디오, 화면 타이밍과 스프라이트 자산을
  import하지 않습니다. 시각 코드는 `app/presentation/`에 두며 표시 문구를
  규칙 판정에 사용하지 않습니다.
- 생성된 실행 파일과 로컬 번들 검사는 규칙 회귀에 넣지 않고
  `test:artifact`에서만 검사합니다.
- 기존 저장 구조를 바꾸면 구버전 데이터를 잃지 않는 변환 경로를 포함합니다.
