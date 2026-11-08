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
| 공통 셸 | 전체 | `partials/shell.html`, `assets/css/base.css` | `components/ServiceShell.tsx`, `styles/globals.css` | Stage 1 완료(배지 보류) |
| 신청 현황 | `/requests` | `requests.html`, `screens/requests.js·css` | `features/request/RequestList.tsx`, `styles/requests.css` | Stage 1 완료 |
| 신청 상세 | `/requests/[id]` | `request-detail.html`, `submitted.html` | `features/request/RequestDetail.tsx`, `styles/requestDetail.css` | Stage 2 완료 |
| 새 신청 | `/requests/new`, `/cases/[id]` | `new-request.html` | `features/request/NewRequest.tsx`, `CaseInterview.tsx` | Stage 3 예정 |
| 보완·통신 | `/supplements`, `/network` | `supplements.html`, `network.html` | `features/request/SupportingPages.tsx` | Stage 4 예정 |
| 문서함 | `/documents` | `documents.html` | `features/document/DocumentList.tsx` | Stage 4 예정 |
| 처리 이력 | `/history` | `history.html` | `features/audit/AuditList.tsx` | Stage 4 예정 |
| 기관 설정·정책 | `/settings`, `/policies` | `settings.html`, `policies.html` | `features/configuration/ConfigurationPage.tsx`, `components/PlannedPage.tsx` | Stage 4 예정 |
| 로그인·가입·회원 | `/login`, `/signup`, `/members` | 시안 없음 | `features/auth/*`, `features/assignment/*` | 대상 외(공통 토큰만 공유) |

화면별 상세는 각 Stage 완료 시 아래에 추가한다.

### Stage 1 — 공통 셸·신청 현황

측정 방법: 1440×900 라이트 모드에서 시안(`python3 -m http.server`)과 Front(모의 모드 :3001)를 띄워 같은 요소의 렌더링 크기·여백을 `getBoundingClientRect`·`getComputedStyle`로 비교했다. 시안은 루트 56.25%(셸)와 `main`의 `zoom:.9`(본문)를 함께 써서, Front는 셸 기준 약 1.11배, 본문 기준 약 1.23~1.5배 넓었다.

| 요소 | 시안 실효값 | 변경 전 Front | 변경 후 Front |
| --- | --- | --- | --- |
| 사이드바 폭 | 216px | 240px | 216px |
| 머리글 높이 | 72px | 80px | 73px |
| 사이드바 메뉴 높이 | 43px | 48px | 44px (터치 최소 44px 유지) |
| 본문 여백 (상·좌우·하) | 약 26·32·52px | 32·48·64px | 26·32·52px |
| 본문 폭 (1440px) | 1224px | 1200px | 1224px |
| 표 머리·칸 여백 | 약 11·13px / 10·13px | 14·16px / 12·16px | 11·13px / 10·13px |
| 신청 행 높이(신청자) | 78px | 119px | 97px (글자 17px 유지로 남는 차이) |

| 구분 | 내용 |
| --- | --- |
| 기존 구현과 시안 차이 | 셸·목록 구성은 이미 같았음. 차이는 ① 여백·폭(밀도), ② 담당자 열 글자 크기(시안 `20de97d`), ③ 사업명 칸 4줄(시안 3줄), ④ 담당자·관리자 화면에서 내 차례가 아닐 때 상태 아래 회색 진행 안내 없음, ⑤ 사이드바 메뉴 건수 배지 없음 |
| 실제 변경 | ① `styles/globals.css` 끝에 데스크톱(≥1024px) 전용 밀도 정렬 블록 추가, 1440px 이상 `main` 좌우 4.8rem 규칙 제거(새 블록으로 대체). ② `styles/requests.css` `.asg` 칸 폭 7.2rem, 분야 이름 1.5rem·줄바꿈 방지, 진행 글자 1.7rem. ③ 서류 종류를 신청번호 줄로 합쳐 3줄 구성(`신청번호 · 서류 종류`). ④ `features/request/turns.ts`의 `waitingLine`으로 상태별 회색 안내 표시(신청자 작성 중, 신청자 보완 답변 대기, 신청자 최종 제출 대기, ICT인프라 통신 정보 할당 중·협의 중, 정보보안 검토 중, 분야별 최종 확인 중, 정보보안 서류 확정 대기) |
| 변경 파일 | `styles/globals.css`, `styles/requests.css`, `features/request/RequestList.tsx`, `features/request/turns.ts`(신규) |
| 의도적으로 유지한 차이 | 글자 크기 17px(D1) 때문에 행·카드 높이가 시안보다 큼. 상태·필터·요약 카드 이름은 FUNCTIONAL_SPEC(`서류 확정`, `확정` 등, D2). 모의 모드 안내 띠(개발 전용). 역할 전환 대신 로그인 사용자 표시. 알림 건수 점은 P2(알림 미구현)라 표시하지 않음. 1:N 모델 때문에 서류 종류를 계속 표시 |
| 미완료·보류 | **사이드바 건수 배지**: 구현 후 되돌림. 셸이 모든 화면에서 신청 목록을 조회해야 하고, 기존 테스트 `tests/session-drafts.test.tsx`가 셸을 QueryClient 없이 렌더링하는 계약이라 2건이 실패함. 테스트 수정이나 셸의 조회 추가는 표시 변경 범위를 넘으므로 결정 필요로 남김. 시안의 `통신 정보` 미입력 건수 배지도 같은 이유로 미적용 |


### Stage 2 — 신청 상세

비교 기준: 시안 `request-detail.html`(563dd7e), Front `/requests/[id]` 모의 모드. 같은 합성 데이터(demo-request-1~6)와 1440×900에서 변경 전후를 캡처해 비교했다.

| 영역 | 시안 | 변경 전 Front | 변경 후 Front |
| --- | --- | --- | --- |
| 단계 표시 | 4칸 가로 막대(위 4px 단계 색) + `n단계 완료/진행 중` 라벨 | 테두리 상자 안 번호 원 4개 | 시안 `.stepper` 구조. 완료·현재 칸에 단계 색, 라벨은 `n단계 완료` / `n단계 진행 중`. 확정이면 4단계도 `완료`. 종결·철회면 현재 칸을 회색 막대와 `n단계 종결`·`n단계 철회`(FUNCTIONAL_SPEC 상태명)로 표시. 반환 이력 배지 유지 |
| 카드 제목 | `.h-panel`(19px) | `.h-sec`(24px) | `.h-panel` |
| 사업 정보 | 라벨 14rem·값 2열 표(`.dl`), 값 옆 출처 꼬리표, 출처 설명 문구 | 라벨 굵게 위·값 아래 세로 목록, 출처 배지 별도 줄 | 신청 상세 안 값 목록(사업 정보·통신 정보·서류 정보·제출본)을 라벨·값 2열로, 출처 배지를 값 옆에 표시. 출처 설명 문구 추가. 767px 이하 1열 |
| 우측 패널 | 주색 테두리 카드 1장: 분야별 협의 상자 2개 → 처리 제목·버튼 | 카드 2장(협의 현황, 업무 행위) | 주색 테두리 카드 1장(`.review .card`): `.consult` 상자 2개(분야·담당자·상태 배지) → 기한 → 4단계 최종 확인 → 구분선 아래 업무 행위. 종결·철회·확정 상태는 `현재 처리 상황` 안내 |
| 상태 배지 색 | 보완 요청 주황, 완료 초록, 진행 파랑, 대기 회색 | 보완 요청·재검토가 회색 | 보완 요청·재검토 주황(시안과 같음) |

| 구분 | 내용 |
| --- | --- |
| 변경 파일 | `features/request/RequestDetail.tsx`(마크업·클래스, 단계 라벨 계산), `styles/requestDetail.css`(Stage 2 블록 추가), `styles/application.css`(사용하지 않게 된 `.stage-stepper`·`.step-number`·`.review-panel`·`.review-status-grid`·`.review-person` 규칙 110줄 삭제) |
| 업무 로직 | `allowedActions` → 버튼 대응, `invoke`·`CommandDialog`·`SupplementAnswer`·`AnswerEditor` 호출, 훅·API는 그대로. 단계 라벨은 응답의 `stage`·`status`만 사용 |
| 의도적으로 유지한 차이 | 시안의 체크리스트·운영 기간 입력·`검토 초안 저장`·단일 `사전 협의 완료` 버튼은 시연 로직이라 가져오지 않음(D4). Front 행위 버튼(할당 완료, 협의 완료, 보완 요청, 반환, 제출, 최종 확인, 확정, 종결, 철회, 재배정)은 세로 배치 유지. 시안에 없는 함께 신청한 서류 링크, 반환·공통 정보 변경 안내, 신청 문서·처리 이력 카드 유지. 시안의 데이터 흐름도·방화벽 규칙 표·자동 점검 카드는 Front 데이터 모델에 없어 미적용 |
| 남은 차이 | 값이 없을 때 `담당자 확인 필요` 글자와 같은 이름의 배지가 한 줄에 함께 보임(기존 `AnswerView` 동작, 2열 배치로 더 눈에 띔). 우측 패널이 화면보다 길면 하단 버튼은 페이지 끝까지 스크롤해야 보임(변경 전과 같은 sticky 동작, 시안과 같음). 1279px 이하에서 패널이 본문 아래로 내려가는 것은 시안과 같음 |
| Stage 1 공통 CSS 영향 | 신청 상세에는 `.tbl`·`.stats`가 없어 표·카드 여백 변경의 영향 없음. 본문 여백·`.page-head` 여백은 시안 밀도와 맞음. 화면별 충돌 없음 |

## C. 기능 보존

### 기준선 (Stage 0, 코드 변경 전)

| 검증 | 실행 | 결과 |
| --- | --- | --- |
| `npm ci` | 실행 | 418 패키지 설치. 의존성 변경 없음 |
| `npm run check` (format·typecheck·lint·test·docs) | 실행 | 통과. Vitest 6개 파일 66개 테스트 통과, 문서 9종 점검 통과 |
| `npm run build` | 실행 | 통과. 라우트 16개 생성 |
| 실행 환경 | 확인 | Node v24.13.1, npm 11.8.0, macOS. Docker 없음(컨테이너 빌드 미검증) |

### Stage 1 검증

| 검증 | 실행 | 결과 |
| --- | --- | --- |
| `npm run check` | 실행 | 통과. 66개 테스트 통과. 배지 구현 시 `session-drafts.test.tsx` 2건 실패를 확인하고 해당 변경을 되돌린 뒤 재실행해 통과 |
| `npm run build` | 실행 | 통과 |
| 신청자 화면 (1440, 라이트) | 수동 | 목록 필터·검색·요약 카드·행 링크·페이지 이동 표시 유지. 담당자 열 새 크기 적용, 3줄 사업명 칸 확인 |
| ICT인프라 화면 (1440, 다크) | 수동 | 내 차례 행은 파랑 할 일, 작성 중 신청은 회색 `신청자 작성 중` 표시. 다크 토큰 정상 |
| 1024px | 수동 | 가로 페이지 넘침 없음(`scrollWidth`=1024). 요약 카드 이름 줄바꿈은 시안 1024px와 같음. 표는 표 영역 안 가로 스크롤 |
| 390px | 수동 | 가로 넘침 없음. 밀도 블록은 1024px 미만에 적용되지 않아 모바일 여백 변화 없음 |
| 미확인 | – | 관리자·정보보안 역할 화면, 모바일 메뉴 펼침 상태의 시각 비교, 화면 낭독기 |

동작 영향: 버튼·링크·필터·페이지 이동·상태 계산 로직은 변경하지 않았다. 추가된 회색 안내는 기존 신청 응답 필드(status, reviews, finalConfirmations)만 읽는 표시이며 권한이나 허용 행위에 쓰이지 않는다.

### Stage 2 검증

| 검증 | 실행 | 결과 |
| --- | --- | --- |
| `npm run check` | 실행 | 통과. 테스트 7개 파일 75개(신규 `tests/turns.test.tsx` 9개 포함) |
| `npm run build` | 실행 | 통과 |
| 역할별 버튼 = `allowedActions` | 수동(API 응답과 화면 버튼 대조) | ICT인프라: demo-request-1·3·5 일치. 정보보안: 3·5 일치. 신청자: 1-security(협의 요청·철회), 2(AI 초안·제출[blocker로 비활성]·반환·철회), 5(보완 답변·철회) 일치. 관리자: 1(재배정) 일치 |
| 실제 업무 처리(모의) | 수동 | 신청자 보완 답변 등록 → 상태 `보완 요청`→`협의 중`, 보완 카드 `담당자 재검토`. 신청자 철회(사유 입력) → `철회`, 단계 표시 `1단계 철회`, 행위 버튼 0개. ICT인프라 할당 완료 → 도메인 규칙 거부 메시지 표시(입력 미완료, 기존 동작) |
| 대화상자 | 수동 | 반환(단계·항목·사유), 재배정(분야·담당자·사유), 철회(사유) 열림·닫힘 정상 |
| 단계 상태 | 수동 | 1단계(작성 중), 2단계(협의 중·보완 요청), 3단계(최종 검토 중), 4단계(제출됨, 최종 확인 대기 표시), 확정, 철회 |
| 1440 라이트 / 다크 | 수동 | 정상. 다크 토큰으로 단계 색·패널 테두리 표시 |
| 1024px | 수동 | 가로 넘침 없음. 패널이 본문 아래 1열(시안 1279px 이하 규칙과 같음) |
| 390px | 수동 | 가로 넘침 없음. 값 목록 1열, 단계 4칸 유지(시안과 같음) |
| 미검증 | – | 종결(반려) 상태 화면(시드 없음, 철회와 같은 분기), 3단계로의 반환 후 화면, 제출·확정 성공 경로(시드 데이터가 blocker를 가져 미실행), 화면 낭독기 |

## D. API 영향

| Stage | API 경로·요청·응답 | 조회 방식 | 비고 |
| --- | --- | --- | --- |
| 0 | 변경 없음 | 변경 없음 | – |
| 1 | 변경 없음 | 변경 없음(목록은 기존 `GET /api/security-requests?size=100` 결과만 사용) | 모의 모드에서만 확인. 실제 Back 연결 미검증 |
| 2 | 변경 없음 | 변경 없음(상세·명령 훅 그대로) | 모의 모드에서만 확인. 실제 Back 연결 미검증 |

## E. 후속 담당자 인계

- 결정 필요: 사이드바 건수 배지(셸의 목록 조회 추가 여부와 셸 테스트 계약). Back 연동 후에는 건수 전용 API 또는 목록 캐시 공유 방식도 함께 검토.
- 목록의 회색 진행 안내(`waitingLine`)는 `reviews[].allocationCompleted·status`, `finalConfirmations`, `currentSubmissionId` 필드에 의존한다. 실제 Back 응답에 같은 필드가 없으면 안내 문구가 비거나 달라질 수 있다.
- 밀도 정렬은 `styles/globals.css`의 한 블록에 모여 있어 D1 결정이 바뀌면 그 블록만 조정하면 된다.

- 신청 상세 단계 표시는 `stage`(1~4)와 `status`(특히 `FINALIZED`·`CLOSED`·`WITHDRAWN`)만으로 칸 상태를 정한다. 실제 Back이 확정 후 `stage`를 다르게 두면 `4단계 완료` 표시가 달라질 수 있다.
- 우측 패널 버튼은 응답의 `allowedActions` 코드(`REQUEST_REVIEW`, `COMPLETE_ALLOCATION`, `COMPLETE_REVIEW`, `REQUEST_SUPPLEMENT`, `RETURN`, `SUBMIT`, `GENERATE_DRAFT`, `FINAL_CONFIRM`, `FINALIZE`, `CLOSE`, `WITHDRAW`, `REASSIGN`, `ANSWER_SUPPLEMENT`, `RESOLVE_SUPPLEMENT`)가 그대로 와야 표시된다. Back 계약에서 코드 이름이 바뀌면 버튼이 사라진다.
- 분야별 협의 상자는 `reviews[].status`(`COMPLETE`·`ALLOCATED`·`RECHECK`·`SUPPLEMENT_REQUESTED`)와 `allocationCompleted`, `assignments[].assigneeName`을 사용한다.

## F. 커밋 이력

| 단계 | 커밋 | 변경 요약 | 검증 |
| --- | --- | --- | --- |
| Stage 0 | `0c4bfbc` | 기준선 기록, 이 문서 생성 | check·build 통과 |
| Stage 1 | `3283fa2` | 셸·신청 현황 밀도 정렬, 담당자 열 크기, 사업명 칸 3줄, 담당자 화면 진행 안내 | check(66/66)·build 통과, 수동 점검 |
| Stage 1 | `70709ec` | 문서에 Stage 1 커밋 기록 | – |
| Stage 2 | `d70fbfc` | 신청 상세 단계 표시·라벨·값 표·우측 단일 패널, 사용 안 하는 CSS 정리, `waitingLine` 테스트 | check(75/75)·build 통과, 4개 역할 수동 점검 |
| Stage 2 | (이 커밋) | Stage 2 변경 명세 기록 | – |
