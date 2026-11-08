# UI 통합 변경 명세·인계 기록

기록 시작: 2026-11-08. 이 문서는 `feat/prototype-soo-ui-parity` 브랜치에서 진행하는 prototype-soo 시안 일치 작업의 기준, 화면별 변경, 기능 보존과 검증 결과, 후속 인계 사항을 단계별로 기록한다. 실행하지 않은 검증을 통과로 적지 않는다. 디자인 반영의 일반 원칙과 이전 차이 기록은 [DESIGN_PARITY.md](DESIGN_PARITY.md)를 따른다.

## A. 기준 정보

| 항목 | 값 |
| --- | --- |
| UI 기준 저장소 | https://github.com/team-khfc/prototype-soo · `main` `563dd7e76aeeb4fe63f010bec9cd1f9bac16d5dc` (2026-11-07). 읽기 전용, 수정 없음 |
| 이전 반영 기준 | 같은 저장소 `1af32fb` ([DESIGN_PARITY.md](DESIGN_PARITY.md)). 이후 변경은 `20de97d` 1건(신청 현황 담당자 열 글자 크기) |
| 개발 저장소 | https://github.com/team-khfc/Security-Advisor-Front · 기준 `origin/main` `869678eef72ddd6c678c781a3c3f0da795705a77` |
| 작업 브랜치 | `feat/prototype-soo-ui-parity` (로컬 전용, upstream 미설정, push·PR 없음) |
| 업무 참고 저장소 | https://github.com/team-khfc/prototype `test/application-flow-e2e` `49f7e00`. 읽기 전용, 수정 없음 |
| 규칙 문서 | AGENTS v1.16, FUNCTIONAL_SPEC v1.11, design.md v3.1, PROJECT_RULES v1.14 |

### 작업 범위

- 대상: 공통 셸, 신청 현황, 신청 상세, 새 신청, 보완 요청, 문서함, 통신 정보, 처리 이력, 기관 설정, 정책 화면의 **표시 계층**(마크업 구조, 클래스, `styles/`).
- 제외: API 경로·요청·응답, 도메인 모델, 권한 규칙, 훅(`features/*/use*.ts`), `lib/*`, `mocks/*`, 백엔드 코드, 실제 Back 연동.
- 시안의 시연 동작(브라우저 저장소 데이터, 역할 전환, CDN 문서 파서, 저장·게시·AI 버튼 동작)은 이식하지 않는다(AGENTS 6장).
- 11.08 기능 동결: 이 작업은 사용자가 지시한 UI 통합 범위로 한정하며, 신규 기능과 업무 규칙 변경은 하지 않는다.

### 임시 결정 기준 (Phase 0 결정안, 확정된 팀 정책 아님)

| # | 기준 |
| --- | --- |
| D1 | 본문 17px(루트 62.5%) 유지. 시안의 56.25% + `zoom:.9`는 따르지 않고 간격·패널 너비로 밀도에 접근 |
| D2 | 상태 이름은 FUNCTIONAL_SPEC 우선, 배지 외형은 시안 적용 |
| D3 | 새 신청의 사업명·부서·서류 선택 입력 유지 |
| D4 | 업무 행위·권한은 현행 유지, 단계 표시·정보 표·행위 패널 외형은 시안 적용 |
| D5 | 설정·정책 화면은 시안 외형, 미구현 동작은 비활성과 사유 표시 |

## B. 화면별 변경 사항

| 화면 | 경로 | 시안 파일 | Front 구현 | 상태 |
| --- | --- | --- | --- | --- |
| 공통 셸 | 전체 | `partials/shell.html`, `assets/css/base.css` | `components/ServiceShell.tsx` | Stage 1 |
| 신청 현황 | `/requests` | `requests.html`, `screens/requests.js·css` | `features/request/RequestList.tsx`, `styles/requests.css` | Stage 1 |
| 신청 상세 | `/requests/[id]` | `request-detail.html`, `submitted.html` | `features/request/RequestDetail.tsx` | Stage 2 예정 |
| 새 신청 | `/requests/new`, `/cases/[id]` | `new-request.html` | `features/request/NewRequest.tsx`, `CaseInterview.tsx` | Stage 3 예정 |
| 보완·통신 | `/supplements`, `/network` | `supplements.html`, `network.html` | `features/request/SupportingPages.tsx` | Stage 4 예정 |
| 문서함 | `/documents` | `documents.html` | `features/document/DocumentList.tsx` | Stage 4 예정 |
| 처리 이력 | `/history` | `history.html` | `features/audit/AuditList.tsx` | Stage 4 예정 |
| 기관 설정·정책 | `/settings`, `/policies` | `settings.html`, `policies.html` | `features/configuration/ConfigurationPage.tsx`, `components/PlannedPage.tsx` | Stage 4 예정 |
| 로그인·가입·회원 | `/login`, `/signup`, `/members` | 시안 없음 | `features/auth/*`, `features/assignment/*` | 대상 외(공통 토큰만 공유) |

화면별 상세는 각 Stage 완료 시 아래에 추가한다.

## C. 기능 보존

### 기준선 (Stage 0, 코드 변경 전)

| 검증 | 실행 | 결과 |
| --- | --- | --- |
| `npm ci` | 실행 | 418 패키지 설치. 의존성 변경 없음 |
| `npm run check` (format·typecheck·lint·test·docs) | 실행 | 통과. Vitest 6개 파일 66개 테스트 통과, 문서 9종 점검 통과 |
| `npm run build` | 실행 | 통과. 라우트 16개 생성 |
| 실행 환경 | 확인 | Node v24.13.1, npm 11.8.0, macOS. Docker 없음(컨테이너 빌드 미검증) |

## D. API 영향

Stage 0 기준 변경 없음. 각 Stage에서 갱신한다.

## E. 후속 담당자 인계

각 Stage에서 누적한다.

## F. 커밋 이력

| 단계 | 커밋 | 변경 요약 | 검증 |
| --- | --- | --- | --- |
| Stage 0 | (이 커밋) | 기준선 기록, 이 문서 생성 | check·build 통과 |
