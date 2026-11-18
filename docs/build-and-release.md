# 빌드 · 버저닝 · 릴리스

## 번들링 (webpack)

Extension Host 코드(`src/`)는 webpack으로 단일 `dist/extension.js`로 번들된다.

- `target: 'node'` — 확장은 Node 컨텍스트에서 실행된다.
- `entry: ./src/extension.ts`, 출력 `dist/extension.js` (`commonjs2`).
- `externals: { vscode }` — `vscode` 모듈은 런타임 제공이므로 번들 제외.
- `.ts`는 `ts-loader`로 처리. 개발은 `mode:'none'`, 패키징은 production.

주요 스크립트 (`package.json`):

| 스크립트 | 동작 |
| --- | --- |
| `compile` | webpack 개발 번들 |
| `watch` | webpack watch |
| `package` | production 번들 (`vscode:prepublish`가 호출) |
| `compile-tests` | `tsc`로 테스트를 `out/`에 컴파일 |
| `lint` | `eslint src` |
| `test` | `vscode-test` (헤드리스 VS Code 통합 테스트) |

> **Webview 프론트(`osciloscope/`)는 번들되지 않는다.** 원본 JS/CSS/HTML을 그대로 패키징한다.
> ES 모듈이라 번들 없이도 의존성이 해결된다.

`localResourceRoots`는 `osciloscope/` 하나가 아니라 셋이다 — 도구 파일을 웹뷰가 로드해야 하기
때문이다(`src/WebviewSupport.ts`).

| 경로 | 이유 |
| --- | --- |
| `<확장>/osciloscope` | 우리 웹뷰 자원 |
| `<확장>/tools` | 번들 도구 |
| 워크스페이스 폴더들 | 사용자 도구 (`.osciloscope/tools/`) |

범위가 넓어진 만큼 두 웹뷰 HTML에 CSP 메타를 넣어 인라인 스크립트와 외부 요청을 차단한다.

### 패키징에 반드시 포함되어야 하는 것

`.vscodeignore`가 빼먹으면 런타임에 조용히 깨지는 항목들이다.

| 대상 | 주의 |
| --- | --- |
| `tools/*.tool.js` | 없으면 기본 도구가 사라져 START가 실패한다 |
| `assets/templates/tool-skeleton.js` | 없으면 '만들기'가 동작하지 않는다 |
| `assets/templates/osciloscope-tool.d.ts` | `**/*.ts` 규칙에 걸리므로 **예외 규칙이 필요하다**. 빠지면 도구 작성 시 자동완성이 안 된다 |
| `osciloscope/tool-host/**` | 위젯·검사기·픽스처. 픽스처가 빠지면 유효성 검사가 실패한다 |

## 태그 기반 버저닝

**git 태그(`vX.Y.Z`)가 버전의 단일 진실**이다. `package.json`의 `version`은 자리표시자(`0.0.0`)이며,
빌드 시 `scripts/resolve-version.mjs`가 실제 버전을 계산해 주입한다.

해석 우선순위 (`resolve-version.mjs`):

1. `RELEASE_TAG` 환경변수 (CD 경로, GitHub Release 태그) — 엄격한 `vX.Y.Z`가 아니면 실패.
2. `git describe`로 develop에서 도달 가능한 가장 가까운 `vX.Y.Z` 태그:
   - 태그에 정확히 위치 → `X.Y.Z` (릴리스 빌드)
   - 태그 이후 N 커밋 → `X.Y.Z-dev.N` (개발/CI 빌드)
   - 매칭 태그 없음 → `0.0.0` (최초 릴리스 전)

`--write` 플래그를 주면 `package.json`에 기록한다. stdout에는 해석된 버전만 출력되어
`$(node scripts/resolve-version.mjs)`로 캡처하기 안전하다(사람용 메시지는 stderr).

## CI (`.github/workflows/test.yml`)

- 트리거: `master`/`develop`로의 push·PR.
- **3-OS 매트릭스** (ubuntu/windows/macos), `fail-fast: false`.
- 단계: `npm ci` → lint → compile → test → 버전 주입 → `vsce package`로 패키징 검증(퍼블리시 X).
  - Linux 테스트는 `xvfb-run`으로 가상 디스플레이 필요, Windows/macOS는 불필요.
  - checkout은 `fetch-depth: 0` — `git describe` 버저닝을 위해 전체 히스토리·태그 필요.
- 최종 게이트 `ci` 잡: 매트릭스가 모두 성공해야 통과. **브랜치 보호는 이 `CI` 체크 하나만 요구**한다.

## CD (`.github/workflows/publish.yml`)

- 트리거: GitHub **Release published**.
- `RELEASE_TAG`에서 버전 해석·주입 → lint → `vsce package`로 `.vsix` 생성 → **Open VSX**에 `ovsx publish`.
- `OVSX_PAT` 시크릿 사용. `RELEASE_TAG`는 스크립트 인젝션 방지를 위해 인라인 `${{ }}`이 아닌 env로 전달.

## GitFlow 자동화 (요약)

이 저장소는 릴리스/핫픽스 파이프라인을 워크플로로 자동화한다. 사람의 개입은
**feature 리뷰**와 **"Finish Release" 버튼 한 번**뿐이고, 그 뒤는 무인으로 흐른다.

1. **`cut-release.yml`** — `feature/*` PR이 `develop`에 머지되면 PR 라벨(major/minor/patch)로
   다음 버전을 계산해 `release/vX.Y.Z` 브랜치를 자동 생성(태그는 아직 없음).
2. **`finalize.yml`** — 수동 `workflow_dispatch`("Finish Release"). 브랜치 tip에
   `vX.Y.Z` 태그를 찍고, `→master`·`→develop` PR 두 개를 App 토큰으로 연다
   (그래야 CI가 트리거됨). 두 PR엔 auto-merge를 **폴백으로만** 걸어둔다.
3. **`merge-release.yml`** — 실제 머지 담당. `CI`/`PR Gates` 워크플로가 green으로
   끝나면(`workflow_run`) App이 두 PR을 **직접 머지**한다. `require-approval` 룰셋이
   걸려 있어도 App은 bypass 액터라 통과한다 — GitHub 기본 auto-merge는 App의 bypass를
   쓰지 못해 그대로 `REVIEW_REQUIRED`에 멈추므로, 직접 머지가 유일한 통로다.
4. **`post-merge.yml`** — `→master`·`→develop` **둘 다** 머지된 뒤에만 GitHub Release를
   생성하고(→ `publish.yml` → Open VSX) release/hotfix 브랜치를 삭제한다.
5. **`pr-checklist.yml`** — `PR Gates` 메타데이터 체크(Verify PR Checklist / Version Label /
   Serialize Guard). `CI`와 함께 필수 체크로 요구된다.
6. **`make-hotfix.yml`** — 수동 `workflow_dispatch`("Make Hotfix Branch"). master tip에서
   `hotfix/vX.Y.(Z+1)` 브랜치를 자동 생성(도달 태그 PATCH+1, 1:1 직렬화 가드, opening 커밋
   포함 — `cut-release.yml`과 대칭). 이후 finalize·배포는 release와 동일 흐름
   (`finalize.yml`이 브랜치명에서 버전을 파싱하므로 `hotfix/*`도 그대로 처리).

> 세부 규칙(룰셋 bypass, 직렬화, 재시도 조건)은 각 워크플로 파일 상단 주석과
> 지식 베이스의 `GitFlowPipeline.md`를 정본으로 삼는다.
