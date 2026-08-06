# Shattered Web Dungeon

Shattered Pixel Dungeon의 오픈소스 구조와 자산을 바탕으로 재구성한 비공식
반자동 원정형 웹 로그라이크입니다. 메인 거점에서 난이도와 주요 전리품이 다른
6개의 추천 던전 중 하나를 고르고, 창고 물자와 최대 세 명의 동료를 편성해
출정합니다. 동행 원정대의 첫 번째 동료가 직접 조작하는 캐릭터가 되며, 별도의
플레이어 개체는 사용하지 않습니다. 추천 목록의 깊이·난이도·주요 전리품은 원정을 마칠 때마다 새로
생성되며, 주요 전리품 아이콘을 누르면 출정 전에 상세 설명을 확인할 수 있습니다.
탐사는 기존의 픽셀 전장의 안개, 장비·인벤토리, 마법·투척 전투를 유지하며,
현재 자동탐사는 체감 테스트를 위해 일시적으로 완전히 비활성화되어 있습니다.
각 동료는 20종의 수동 스킬 중 2개를 지니며, 동료 탭에서 스킬 버튼을 누른 뒤
지도 타일·적·원정대원을 클릭해 사용합니다. 도약·밀치기·장판·무기 투척·지팡이
전충전 방출을 포함한 모든 스킬은 한 턴을 소비하고 개별 재사용 대기시간을
가집니다. 3칸 폭 중심의 복도와
고정 슬롯식 가방·창고를 사용하고, 탐사 준비 화면에서 아이템 설명도 바로
확인할 수 있습니다. 아이템은 길게 눌러 가방·장비·동료 사이에서 옮길 수 있으며,
소모품 퀵슬롯은 공유 재고를 참조합니다. 지팡이와 투척물은 퀵슬롯에 장착하면
가방·창고에서 빠지는 고유 장비로 취급합니다. 같은 종류의 투척물도 각각 별도의
충전·내구도·강화치를 가지며, 던진 투척물을 회수하면 그 투척물이 나온 장비만
충전됩니다. 투척물은 탐사 중 최대 충전량을 깎는 내구도도 사용합니다. 귀환 시 새 전리품과 전투 성과가
정산됩니다. 증강 선택 시스템 대신 동료마다 10종 중 1~4개의 고유 특성이
배정되며, 경험치와 레벨도 동료별로 독립적으로 누적됩니다.

## Windows Local Launcher

Extract the full source ZIP and double-click
`ShatteredWebDungeon-Local.exe`. The unsigned, open-source launcher checks
Node.js, serves the prebuilt `local-dist/` bundle without installing npm
dependencies, selects an unused local-only port, and opens it without a console
window. Each run starts its own server instead of reusing a previous package,
and local assets are never retained across extractions. The game tab keeps its
server alive with a heartbeat and closes that server when the tab is closed.
The game directory therefore does not grow by hundreds of megabytes after
launch. See `LOCAL_TESTING_KO.md` for Korean instructions and cleanup guidance
for older packages.

## Prerequisites

- Node.js `>=22.13.0`
- Linux with `flock`, `curl`, and GNU `timeout`

## Sites Lifecycle

The Sites lifecycle CLI runs the locked dependency install before returning this checkout. Edit the source under `app/`, then checkpoint when a coherent milestone is ready to inspect or share. The remote Sites builder runs `npm run build` against the pushed commit. Do not repeat install or build as a normal pre-checkpoint step.

This starter does not use `wrangler.jsonc`.

`install:ci` first validates the existing lockfile/runtime install stamp and
returns immediately when `node_modules` is already current. Only a missing or
stale install runs one non-retrying `npm ci`. It refuses concurrent installs,
uses a matching image-seeded cache when available, verifies the locked Vinext
tarball, limits npm to one socket, and terminates a stall. `build` applies a
short timeout and validates the Sites artifact. These helpers target Linux and
use GNU `timeout`; they are not native macOS scripts.

Scripts that need writable project-scoped home, npm, XDG, and temporary paths use `scripts/sites-env.sh`. The `dev` and `start` scripts honor the caller's runtime environment and keep Wrangler logs inside the checkout. The generated `.sites-runtime/` directory is disposable and ignored by Git.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Diagnostic Commands

- `npm run install:ci`: reuse a matching install or perform one bounded install
- `npm run dev`: start the Vite/Vinext development server
- `npm run test:architecture`: enforce the game/presentation dependency boundary
- `npm run test:quick`: run lint, architecture, game regressions, and performance contracts
- `npm run test:artifact`: verify an already-built local bundle and Windows launcher
- `npm run verify:local`: run the complete local release gate exactly once
- `npm run build`: build and validate the deployable Sites artifact
- `npm run start`: start the built Vinext application
- `npm test`: build, validate, and verify the rendered development-preview metadata
- `npm run validate:artifact`: recheck an existing artifact's manifest and ESM `default.fetch` export
- `npm run db:generate`: generate Drizzle migrations after schema changes
- `bash scripts/build-source-archive.sh`: rebuild the tracked downloadable source ZIP from the current local commit

Use build and validation commands for targeted diagnosis after a remote failure, not as part of the normal checkpoint path.

Use `scripts/restore-source-overlay.sh <archive.zip>` to update a warm checkout
without discarding Git metadata, installed dependencies, or the project npm
cache. The rendering/state-sharing design is documented in
`PERFORMANCE_AND_ARCHITECTURE_KO.md`.

게임 규칙은 `app/game/`, Canvas·애니메이션·스프라이트·설명창은
`app/presentation/`에 둡니다. 화면은 `game/session.ts`가 반환한 상태 전이와
의미 기반 전투 피드백을 표시하며, 번역 문구를 규칙 신호로 판독하지 않습니다.

GitHub 작업은 안정 브랜치 `main`과 목적별 `feature/...`, `fix/...` 브랜치를
사용합니다. Pull Request마다 린트, 게임 회귀, 성능 계약, 프로덕션 빌드가 자동
검사됩니다. 자세한 절차는 `CONTRIBUTING.md`를 참고하세요.

The timeout defaults can be overridden for a controlled canary with `SITES_INSTALL_TIMEOUT`, `SITES_INSTALL_KILL_AFTER`, `SITES_BUILD_TIMEOUT`, and `SITES_BUILD_KILL_AFTER`. A timeout fails the command; the helpers never retry an unchanged install or build.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
