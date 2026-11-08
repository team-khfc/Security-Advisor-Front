# UI 통합 변경 명세·인계 기록

기록 시작: 2026-11-08. 이 문서는 `feat/prototype-soo-ui-parity` 브랜치에서 진행하는 prototype-soo 시안 일치 작업의 기준, 화면별 변경, 기능 보존과 검증 결과, 후속 인계 사항을 단계별로 기록한다. 실행하지 않은 검증을 통과로 적지 않는다. 디자인 반영의 일반 원칙과 이전 차이 기록은 [DESIGN_PARITY.md](DESIGN_PARITY.md)를 따른다.

## 0. 최종 요약 (Stage 5, 2026-11-08)

| 항목 | 내용 |
| --- | --- |
| 목표 | prototype-soo 시안을 기준으로 Security-Advisor-Front의 화면 모양을 맞추고, 기존 기능·업무 규칙·API 계약은 그대로 둔다. 실제 Back 연동은 후속 담당 |
| 범위 | 공통 셸, 신청 현황, 신청 상세, 새 신청, 사업 건·인터뷰, 보완 요청, 문서함, 통신 정보, 처리 이력, 기관 설정, 정책 수명주기(11개 화면 영역) |
| 최종 판정 | **인계 가능** — 9개 완료 조건 충족. 미검증 항목(제출·확정 성공 경로, 화면 낭독기, 실제 Back)은 차단 사유가 아닌 후속 검증 항목으로 분리. 근거는 [UI_INTEGRATION_FINAL_VERIFICATION.md](UI_INTEGRATION_FINAL_VERIFICATION.md) |
| 검증 | `npm run check` 92/92, `npm run build` 통과(Stage 5 최종 실행). 모의 API 모드 수동 점검. 실제 Back 미검증 |
| API·계약 | 변경 없음. `lib/*`, `mocks/*`, `app/api/*`, `features/*/use*.ts`, `features/request/domain.ts`·`types.ts`, `features/auth/*` 변경 0건 |
| Stage 5 수정 | Stage 4-A(`4e76d5b`)의 CSS 정리 중 생긴 회귀(새 신청 사업명·부서 칸과 기관 설정 CASE/REQUEST 2열 격자 소실)를 `8e32cdd`로 복구 |
| 임시 결정 | D1~D5는 Phase 0 결정안을 작업용으로 적용한 것이며 **팀이 확정한 정책이 아니다** |

## A. 기준 정보

| 항목 | 값 |
| --- | --- |
| UI 기준 저장소 | https://github.com/team-khfc/prototype-soo · `main` `563dd7e76aeeb4fe63f010bec9cd1f9bac16d5dc` (2026-11-07). 읽기 전용, 수정 없음 |
| 이전 반영 기준 | 같은 저장소 `1af32fb` ([DESIGN_PARITY.md](DESIGN_PARITY.md)). 이후 변경은 `20de97d` 1건(신청 현황 담당자 열 글자 크기) |
| 개발 저장소 | https://github.com/team-khfc/Security-Advisor-Front · 기준 `origin/main` `869678eef72ddd6c678c781a3c3f0da795705a77` |
| 작업 브랜치 | `feat/prototype-soo-ui-parity` (로컬 전용, upstream 미설정, push·PR 없음). 작업 경로는 기존 클론의 git worktree `Security-Advisor-Front-ui` |
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
| 새 신청 | `/requests/new` | `new-request.html`(시작 화면) | `features/request/NewRequest.tsx`, `styles/newRequest.css` | Stage 3 완료 |
| 사업 건·인터뷰 작업 영역 | `/cases/[id]` | `new-request.html`(대화 작업 영역 `renderChat`) | `features/request/CaseInterview.tsx`, `styles/newRequest.css` | Stage 4-A 완료 |
| 보완·통신 | `/supplements`, `/network` | `supplements.html`, `network.html` | `features/request/SupportingPages.tsx`, `styles/components.css` | Stage 4-A 완료 |
| 문서함 | `/documents` | `documents.html` | `features/document/DocumentList.tsx`, `styles/components.css` | Stage 4-A 완료 |
| 처리 이력 | `/history` | `history.html` | `features/audit/AuditList.tsx`, `styles/components.css` | Stage 4-A 완료 |
| 기관 설정·정책 | `/settings`, `/policies` | `settings.html`, `policies.html` | `features/configuration/ConfigurationPage.tsx`, `features/policy/PolicyLifecycle.tsx`, `styles/settings.css` | Stage 4-B 완료(편집·게시·정책 기능은 P2, 비활성) |
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

### Stage 3 — 새 신청

비교 기준: 시안 `new-request.html` 시작 화면(`renderLanding`, 563dd7e), Front `/requests/new` 모의 모드, 신청자 역할 1440×900.

| 영역 | 시안 | 변경 전 Front | 변경 후 Front |
| --- | --- | --- | --- |
| 제목·설명 | 제목 `새 신청`만 | 제목 + 설명 한 줄 | 제목만(시안과 같음) |
| 사업 정보 입력 | 없음 | 사업명·담당 부서·서류 선택 카드 | 그대로 유지(D3, 업무 필수 입력) |
| 파일 영역 | `.intake > .dropzone`: 점선 테두리, 원형 아이콘, `h-panel` 제목, 도움말, `파일 선택`, 형식 안내(`aria-describedby`), 영역 안 오류(`role=alert`), 분석 전 파일 목록 | 독자 클래스 `.upload-zone`, `h-sec` 제목, 형식 오류는 폼 위 알림 | 시안 구조와 클래스(`.intake`·`.dropzone`·`.dz-ic`·`.pend`·`.iedit-btn`). 파일 오류는 영역 안 `role=alert`. 선택 파일은 `파일명 / 형식, 크기 / 분석 전 / 선택 취소(×)` 한 줄 |
| 드래그 상태 | `.drag`(주색 테두리·옅은 주색 배경), 영역을 벗어날 때만 해제 | 자식 요소 위로 이동하면 상태가 깜박이며 해제 | 시안처럼 영역을 벗어날 때만 해제. 생성 중에는 드래그·놓기·파일 선택 무시 |
| 하단 행동 | 오른쪽 아래 `기획서 없이 대화로 시작`(보조) + 파일이 있으면 `선택한 파일 분석 시작`(주) | 왼쪽 안내 + 오른쪽 주 버튼 | `.intake-actions` 오른쪽 정렬 주 버튼 1개(기존 이름 유지: 파일 없으면 `기획서 없이 대화로 시작`, 있으면 `기획서와 함께 작성 시작`), 왼쪽 안내 문구 |
| 높이 | 작업 영역 전체(`--work-h`) | 36rem | 36rem(위에 입력 카드가 있어 작업 영역 전체 높이는 쓰지 않음) |

| 구분 | 내용 |
| --- | --- |
| 변경 파일 | `features/request/NewRequest.tsx`(파일 영역 마크업, 파일 오류 상태 분리, 드래그 해제 조건, 생성 중 파일 조작 차단, 선택 취소 후 초점), `styles/newRequest.css`(Stage 3 블록), `styles/application.css`(사용하지 않게 된 `.upload-zone`·`.upload-icon`·`.selected-file`·`.new-request-actions` 삭제, `CaseInterview`가 쓰는 `.file-name`은 유지), `tests/new-request.test.tsx`(신규 4개) |
| 보존한 업무 기능 | 사업명 필수(브라우저 필수 검사), 담당 부서 필수(공백만 입력 시 오류), 서류 0개 선택 시 오류, 서류 복수 선택, `useCreateCase` 요청 내용, 형식(PDF·HWP·HWPX·DOCX)·크기(10MB)·1개 제한, 선택 파일은 전송하지 않고 `rememberUpload`로 사업 건 화면에 전달, 입력 초안 복원, 실패 시 입력 유지, 성공 시 `/cases/{id}` 이동, 사업 개요 직접 입력 |
| 추가·변경한 UI 인터랙션 | 파일 오류를 파일 영역 안에 표시(검사 규칙·문구는 같음). 드래그 상태 해제 조건. 생성 중 파일 선택·놓기 비활성. 선택 취소 버튼을 `×` 아이콘으로 바꾸고 접근 이름 `<파일명> 선택 취소`, 취소 뒤 `파일 선택`으로 초점 이동 |
| 의도적으로 유지한 차이 | 시안에 없는 사업 정보 입력 카드(D3). 시안의 여러 파일(최대 5개)·XLSX·TXT·파일당 20MB는 Front가 지원하지 않아 Front 기준(1개, PDF·HWP·HWPX·DOCX, 10MB) 표시. 시안의 `선택한 파일 분석 시작`·브라우저 안 문서 분석은 시연 기능이라 가져오지 않음(분석은 사업 건 화면에서 명시적으로 요청). 버튼 1개 구조와 기존 이름 유지(기존 테스트·흐름) |
| 디자이너 결정 필요 | ① 사업 정보 입력 카드를 파일 영역 위에 둘지, 파일 선택 뒤 단계·대화상자로 받을지(D3). ② 위 카드가 있을 때 파일 영역 높이. ③ 하단 행동을 시안처럼 보조·주 버튼 2개로 나눌지(Front는 생성 1회로 두 흐름을 처리) |

### Stage 4-A — 사업 건·인터뷰 작업 영역과 업무 지원 화면

비교 기준: 시안 563dd7e(`new-request.html` 대화 작업 영역, `supplements.html`, `documents.html`, `network.html`, `history.html`), Front 모의 모드 1440×900. 시안의 라우트와 Front 라우트는 위 대응표와 같다. Front에 없는 시안 기능(CSV 다운로드, 규칙 단위 통신 정보, 브라우저 안 문서 분석, 사용자 전환)은 만들지 않았다.

#### 사업 건·인터뷰 작업 영역 (`/cases/[id]`)

| 영역 | 시안 | 변경 전 Front | 변경 후 Front |
| --- | --- | --- | --- |
| 구조 | `.work` 3열(대화 `.chatp` / 너비 조절 `.splitter` / 수집 정보 `.infop`), 높이 `--work-h` | 독자 클래스(`.interview-workspace`, `.conversation-*`, `.collected-*`) | 시안 클래스 그대로 사용. 너비 조절(키보드 ←/→, 두 번 눌러 기본값)은 기존 동작 유지 |
| 대화 머리 | 원형 아바타 + 제목 왼쪽, 안내 문구 오른쪽 | 큰 아이콘 + 제목·설명 세로 | 시안 배치. 아바타는 글자 `AI` 대신 기존 아이콘(정적 안내이므로 AI 응답처럼 보이지 않게) |
| 메시지 | `.m-ai` 말풍선(아바타 포함), 내 답변 `.m-me` | 회색 상자, 질문·답변 쌍 | 시안 말풍선. 저장한 답변은 질문 말풍선 + 내 답변 말풍선으로 쌓임(기존 데이터 그대로) |
| 질문 카드 | 대화 영역 하단 주색 테두리 `.qcard`, `.qnum`·`.qtitle`·`.qhelp` | 상단 주색 선 + 독자 구조 | 시안 카드. 진행 `공통 질문 n / N`, 입력란·저장·나중에 입력·충돌 안내 유지 |
| 수집 정보 | 제목과 `필수정보 n / N` 한 줄, 얇은 진행 막대, 회색 그룹 머리(`.grp`), 라벨 9.6rem·값 한 줄(`.irow`) | 세로 목록 | 시안 배치. 값 목록은 `AnswerView`를 그대로 쓰고 CSS로 9.6rem 라벨·값·출처 배지 한 줄 |
| 문서 분석 | 작업 영역 위 문서 막대(`.docbar`) | 대화 영역 안 펼침 | 작업 영역 위 `.docbar` 펼침으로 이동(`AnalysisPanel` 그대로) |

> Stage 5 확인: 이 단계의 커밋 `4e76d5b`에서 `.supplement-grid`를 지울 때 묶음 선택자 `.form-two, .settings-two`가 `.crumb` 규칙에 붙어 2열 격자가 사라졌다. Stage 5에서 `8e32cdd`로 복구했다.

#### 업무 지원 화면

| 화면 | 시안과 맞춘 것 | 의도적으로 유지·미적용한 것 |
| --- | --- | --- |
| 보완 요청 `/supplements` | 설명 줄 제거, 첫 섹션 제목·건수(파랑), 신청별 카드(신청번호·사업명 링크·상태 배지) 안에 분야별 보완 상자(`.supp`), 아래 `확인한 요청` 표(없으면 빈 상자) | 답변 입력은 시안처럼 이 화면에서 받지 않고 기존처럼 신청 상세로 이동(중복 입력 방지, Stage 2 패널 한 곳). 시안 `답변한 요청`은 Front 상태 모델상 `확인한 요청`(RESOLVED) |
| 문서함 `/documents` | 필터 라벨을 시안처럼 작은 보조 글자, 검색 버튼 글자만, 카드 정의 목록을 `적용 설정 / 확인 상태 / 마지막 저장(제출 시각)`으로(확인 상태는 시안처럼 목록 안 주의 글자), 서류 종류·신청 상태를 제목 아래 한 줄 | 시안의 `TXT 다운로드`·`협의 내용과 근거` 대신 기존 `미리보기 데이터(JSON)`·`신청 상세` 유지(정식 문서 생성 미구현) |
| 통신 정보 `/network` | 설명 줄 제거, 행 전체가 상세로 가는 `.rows-link` 표, 사업명 칸 `신청번호 · 서류` + 사업명, 비어 있는 값은 주의 배지 | 시안은 방화벽 규칙 단위 행·`업무 표현`·`방향` 열·`입력 필요` 필터 칩·CSV. Front 데이터는 신청 단위 공통 답변이라 신청 단위 행·`할당 상태` 열 유지, 기존 사업명 검색 유지. 배지 문구는 Front 출처 규칙의 `담당자 확인 필요` |
| 처리 이력 `/history` | 일시 `YYYY-MM-DD HH:mm`(한국표준시), 대상 칸 위에 작은 글자(`신청 · 기록 버전 n`)와 링크, 처리자 `이름 (역할)` 한 줄 | 감사 이력 불변 안내, 업무 구분 필터, 검색은 유지. 시안의 CSV 다운로드는 Front에 없음 |

| 구분 | 내용 |
| --- | --- |
| 변경 파일 | `features/request/CaseInterview.tsx`, `features/request/SupportingPages.tsx`, `features/document/DocumentList.tsx`, `features/audit/AuditList.tsx`, `styles/newRequest.css`(Stage 4-A 블록), `styles/components.css`(Stage 4-A 블록), `styles/application.css`·`styles/globals.css`(사용하지 않게 된 `.interview-workspace`·`.conversation-*`·`.collected-*`·`.panel-resizer`·`.supplement-grid`·`.document-state` 규칙 삭제), `tests/case-workspace.test.tsx`(3), `tests/supporting-screens.test.tsx`(5) |
| 업무 로직 | 훅(`useCase`, `useSaveCase`, `useAnalysis`, `useApplyAnalysis`, `useRequests`, `useAudit`), 저장 요청 본문, 입력 초안, revision 충돌 처리, 편집 가능 조건, 역할 제한(통신 정보는 ICT인프라만), 필터·검색 동작은 그대로 |
| 미구현 AI 기능 표시 | 대화 영역의 문구는 정해진 안내이며 자연어 대화 AI가 아니다. 분석 결과는 기존처럼 `모의 AI 제안 · 미확정`과 "실제 파일 파싱·LLM 호출은 Back 연동 후 지원" 문구를 유지한다. 시안의 AI 아바타 글자 `AI`는 쓰지 않았다 |

### Stage 4-B — 기관 설정·정책 수명주기

비교 기준: 시안 563dd7e `settings.html`(관리자), `policies.html`(ICT인프라), Front 모의 모드 1440×900. 시안의 편집·게시·정책 처리 동작은 브라우저 저장소 시연 로직이라 가져오지 않았다(임시 기준 D5).

| 화면 | 시안 | 변경 전 Front | 변경 후 Front |
| --- | --- | --- | --- |
| 기관 설정 `/settings` | 제목만, 게시본·초안 배지 막대(`.org-bar`/`.verbar`), 탭 5개, 탭 패널 카드, 하단 `초안 변경 취소 / 설정 초안 저장 / 변경 검토·게시`(변경 없으면 비활성+사유), 설정 버전 탭은 게시 이력 표 | 제목+설명, 안내 상자, 탭, 카드 안 큰 제목 | 제목만, 배지 막대(`게시본 v1`, `모의 seed 게시본 · 읽기 전용`)와 기준 정보 안내 한 줄, 탭 패널 카드(`.h-panel` 제목), 검토 절차는 시안 흐름 칩(`.flow`), 설정 버전은 게시 이력 표(v1·현재 게시본·모의 seed), 하단 행동 막대의 세 버튼은 항상 비활성이며 `P2 구현 예정이라 사용할 수 없습니다` 사유를 `aria-describedby`로 연결. 설정 버전 탭에서는 막대를 숨김(시안과 같음) |
| 정책 수명주기 `/policies` | 요약 카드 4개(건수·필터 버튼), 정책 목록 제목, 거르기 알약 3개, 9열 정책 표와 처리 버튼(연장 문의·회수 예정·회수 완료) | 구현 예정 안내 카드 한 장(`PlannedPage`) | 시안 배치(요약 카드 4개, `정책 목록`, 거르기 알약 3개, 빈 목록 상자)를 쓰되 데이터가 없으므로 건수는 `–`(`데이터 연결 전`), 카드는 버튼이 아닌 비활성 표시, 알약 3개는 `disabled`와 사유 연결, 표 대신 `연결된 정책이 없습니다` 빈 상자. 상단에 P2 구현 예정·서류 확정≠방화벽 적용 안내 |

| 구분 | 내용 |
| --- | --- |
| 변경 파일 | `features/configuration/ConfigurationPage.tsx`, `features/policy/PolicyLifecycle.tsx`(신규), `features/policy/index.ts`(신규), `app/(service)/policies/page.tsx`(라우트가 새 화면을 사용), `styles/settings.css`·`styles/components.css`(Stage 4-B 블록), `styles/application.css`(사용하지 않게 된 `.settings-steps` 선택자 제거), `tests/administration.test.tsx`(5) |
| 보존한 기존 기능 | 기관 설정의 관리자 전용 표시(다른 역할은 안내만), 탭 키보드 이동(←/→/Home/End), 설치 정보(`useInstallation`)의 기관명 표시, 기준 정보 내용. 메뉴 구성(정책 수명주기는 ICT인프라·정보보안 메뉴, 관리자·신청자 메뉴에는 없음)과 라우트 접근 방식은 그대로 |
| 미구현·비활성 | 설정 질문·절차·양식·기준 편집, 초안 저장, 변경 검토·게시, 게시 이력 조회, LLM 구성 관리. 정책 생성·적용 기록·연장 문의·회수 예정 표시·회수 완료 기록·만료 관리·트래픽 표시·거르기 |
| 남은 디자인 차이 | 시안의 질문 목록·편집 폼·라디오·체크 등 편집 UI는 기능이 없어 넣지 않고 기존 기준 정보 설명을 유지. 탭 이름 `점검 기준·기한`(시안 `점검 기준·알림`)은 Front 내용(기한·감사 기준)에 맞춰 유지. 질문 개수 배지(`tcount`) 없음. 정책 표의 열(정책·신청자·출발지·목적지·포트·만료일·트래픽·상태·처리)은 데이터가 없어 표시하지 않음 |
| `components/PlannedPage.tsx` | 정책 라우트가 더 이상 쓰지 않지만 파일 삭제는 사람 확인 사항이라 남겨 둠(현재 사용처 없음) |

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

### Stage 3 검증

| 검증 | 실행 | 결과 |
| --- | --- | --- |
| `npm run check` | 실행 | 통과. 8개 파일 79개(Stage 2의 75개 유지 + 신규 4개) |
| `npm run build` | 실행 | 통과 |
| 정상 생성: 방화벽만 / 보안성검토만 / 둘 다 + 파일 | 수동(모의) | 각각 `/cases/{id}`로 이동, 생성된 사업 건의 신청 서류가 `[FIREWALL]` / `[SECURITY_REVIEW]` / `[SECURITY_REVIEW, FIREWALL]`. 파일은 사업 건 화면의 기획서 영역에 `선택됨, 분석 요청 전에는 전송하지 않습니다`로 표시 |
| 필수값 누락 | 수동 | 사업명 빈칸 → 브라우저 필수 검사로 제출 안 됨. 담당 부서 공백 → `담당 부서를 입력해 주세요.` 서류 0개 → `신청할 서류를 한 가지 이상 선택해 주세요.` 모두 입력값 유지 |
| 파일 미선택·선택 | 수동 | 미선택 시 버튼 `기획서 없이 대화로 시작`, 선택 시 분석 전 목록과 `기획서와 함께 작성 시작` |
| 지원하지 않는 형식(.exe) / 10MB 초과 | 수동 + 테스트 | 영역 안 `role=alert` 오류, 파일 선택 안 됨 |
| 드래그 오버·놓기·선택 취소 | 수동 + 테스트 | `.drag` 상태 표시(라이트·다크), 놓은 파일 표시, 취소 뒤 목록 제거·`파일 선택` 초점 |
| 생성 실패 후 입력 보존 | 테스트(모의 API로는 실패 유도 불가) | 오류 문구 표시, 이동 안 함, 사업명·부서·서류 선택·파일 유지 |
| 1440 라이트·다크 / 1024 / 390 | 수동 | 가로 넘침 없음. 390px에서 하단 버튼 전체 폭, 긴 파일명 줄바꿈 |
| 키보드 | 수동 | 사업명 → 부서 → 서류 2개 → 파일 선택 → 사업 개요 → 시작 버튼 순서. 숨은 파일 입력은 탭 순서에서 제외, 형식 안내는 버튼 설명으로 연결 |
| 미검증 | – | 운영체제 파일 선택 창에서의 실제 선택(브라우저 자동화 한계로 `change`·`drop` 이벤트로 검증), 화면 낭독기, 실제 Back의 생성 오류 응답 |

### Stage 4-A 검증

| 검증 | 실행 | 결과 |
| --- | --- | --- |
| `npm run check` | 실행 | 통과. 10개 파일 87개(Stage 3의 79개 유지 + 신규 8개). 실패 0 |
| `npm run build` | 실행 | 통과 |
| 사업 건 작업 영역(신청자) | 수동(모의) | 답변 저장 → 내 답변 말풍선 추가, 다음 질문(`2 / 4`), 수집 정보 값 갱신. 문서 분석 막대 열기 → 개요 입력 → 분석 요청 → `모의 AI 제안 · 미확정` 결과와 `제안을 미확정 답변으로 적용` 버튼 표시 |
| 사업 건 읽기 전용 | 테스트 | 다른 신청자는 읽기 전용 안내만, 질문 카드·문서 분석 막대 없음 |
| 보완 요청(신청자) | 수동 + 테스트 | 신청별 카드·분야별 보완 상자·`신청에서 보완하기` 링크(`#supplements`), 확인한 요청 표·빈 상태 |
| 문서함(신청자) | 수동 | 미리보기 대화상자 열기·닫기, 신청번호 검색(1건), 확인 상태 표시 |
| 통신 정보(ICT인프라) | 수동 + 테스트 | 검색(1건·0건·빈 상태), 행의 빈 칸 클릭 → 신청 상세 이동, 빈 값 배지. 신청자 접근 시 안내만 |
| 처리 이력(ICT인프라) | 수동 + 테스트 | 업무 구분 필터(1건), 검색(0건·빈 상태), 초기화(8건), 시각 형식 |
| 공통 화면 회귀 | 수동 | 390px(다크): 신청 현황·신청 상세·새 신청·보완·문서함·사업 건·통신 정보·처리 이력 가로 넘침 없음(표는 표 영역 안 스크롤). 1024px(라이트): 통신 정보·처리 이력·문서함·신청 현황 넘침 없음, 사업 건 2열 유지 |
| 미검증 | – | 정보보안·관리자 역할의 처리 이력 화면, 사업 건 화면의 실제 파일 첨부 분석(운영체제 파일 창), 화면 낭독기, 실제 Back 연동 |

### Stage 4-B 검증

| 검증 | 실행 | 결과 |
| --- | --- | --- |
| `npm run check` | 실행 | 통과. 11개 파일 92개(Stage 4-A의 87개 유지 + 신규 5개). 실패 0 |
| `npm run build` | 실행 | 통과(`/policies` 정적 생성) |
| 관리자 | 수동 + 테스트 | 기관 설정 배지 막대·탭 5개·탭 패널·흐름 칩·게시 이력 표, 하단 세 버튼 비활성과 사유, 설정 버전 탭에서 막대 숨김, 탭 키보드 이동(→, End). 관리자 메뉴에는 정책 수명주기 없음(직접 주소 접근 시 같은 P2 화면) |
| 정보보안 | 수동 + 테스트 | 메뉴 `정책 수명주기` 선택 상태로 P2 화면 표시, `/settings`는 `기관 관리자만 설정을 확인할 수 있습니다.`만 표시 |
| ICT인프라·신청자 | 테스트 | `/settings` 관리자 전용 안내만(탭 없음) |
| 정책 화면 비활성 | 테스트 | 거르기 3개 `disabled`, 건수 `–` 4개, 숫자 건수 없음, 빈 상자와 `신청 현황으로` 링크 |
| 1440 라이트 / 390 다크 / 1024 | 수동 | 가로 넘침 없음. 390px에서 탭 줄은 자체 가로 스크롤(기존 동작), 하단 버튼 줄바꿈, 정책 요약 카드 2열 |
| 미검증 | – | ICT인프라 역할의 정책 화면 브라우저 확인(정보보안으로 같은 화면 확인), 화면 낭독기, 실제 Back 연동 |

## D. API 영향

| Stage | API 경로·요청·응답 | 조회 방식 | 비고 |
| --- | --- | --- | --- |
| 0 | 변경 없음 | 변경 없음 | – |
| 1 | 변경 없음 | 변경 없음(목록은 기존 `GET /api/security-requests?size=100` 결과만 사용) | 모의 모드에서만 확인. 실제 Back 연결 미검증 |
| 2 | 변경 없음 | 변경 없음(상세·명령 훅 그대로) | 모의 모드에서만 확인. 실제 Back 연결 미검증 |
| 3 | 변경 없음 | 변경 없음(`useCreateCase` 요청 본문 title·department·description·docTypes 그대로, 파일은 이 화면에서 전송하지 않음) | 모의 모드에서만 확인. 실제 Back 연결 미검증 |
| 4-A | 변경 없음 | 변경 없음(사업 건 저장·분석·적용, 신청 목록, 감사 이력 조회 그대로) | 모의 모드에서만 확인. 실제 Back 연결 미검증 |
| 4-B | 변경 없음 | 변경 없음(기관 설정은 `GET /api/installation`만 사용, 정책 화면은 API 호출 없음) | 설치 정보는 모의 계약. 실제 Back의 `GET /api/installation`·설정 게시본·정책 API 미검증 |

## E. 후속 담당자 인계

- 결정 필요: 사이드바 건수 배지(셸의 목록 조회 추가 여부와 셸 테스트 계약). Back 연동 후에는 건수 전용 API 또는 목록 캐시 공유 방식도 함께 검토.
- 목록의 회색 진행 안내(`waitingLine`)는 `reviews[].allocationCompleted·status`, `finalConfirmations`, `currentSubmissionId` 필드에 의존한다. 실제 Back 응답에 같은 필드가 없으면 안내 문구가 비거나 달라질 수 있다.
- 밀도 정렬은 `styles/globals.css`의 한 블록에 모여 있어 D1 결정이 바뀌면 그 블록만 조정하면 된다.

- 신청 상세 단계 표시는 `stage`(1~4)와 `status`(특히 `FINALIZED`·`CLOSED`·`WITHDRAWN`)만으로 칸 상태를 정한다. 실제 Back이 확정 후 `stage`를 다르게 두면 `4단계 완료` 표시가 달라질 수 있다.
- 우측 패널 버튼은 응답의 `allowedActions` 코드(`REQUEST_REVIEW`, `COMPLETE_ALLOCATION`, `COMPLETE_REVIEW`, `REQUEST_SUPPLEMENT`, `RETURN`, `SUBMIT`, `GENERATE_DRAFT`, `FINAL_CONFIRM`, `FINALIZE`, `CLOSE`, `WITHDRAW`, `REASSIGN`, `ANSWER_SUPPLEMENT`, `RESOLVE_SUPPLEMENT`)가 그대로 와야 표시된다. Back 계약에서 코드 이름이 바뀌면 버튼이 사라진다.
- 분야별 협의 상자는 `reviews[].status`(`COMPLETE`·`ALLOCATED`·`RECHECK`·`SUPPLEMENT_REQUESTED`)와 `allocationCompleted`, `assignments[].assigneeName`을 사용한다.

- 새 신청 화면은 파일을 서버로 보내지 않는다. 파일은 탭 메모리(`rememberUpload`)로 사업 건 화면에 넘어가고, 분석 요청 시 전송된다. 실제 Back 연동 시 업로드 크기·형식 검사를 서버에서도 같은 기준(PDF·HWP·HWPX·DOCX, 10MB)으로 하는지 확인한다.
- 생성 실패 메시지는 `useCreateCase`가 던지는 오류의 `message`를 그대로 보여 준다. 실제 Back의 ProblemDetail `detail`이 사용자에게 보일 문구로 적절한지 확인한다.

- **파일 업로드 계약 차이:** 시안은 여러 파일(최대 5개)·XLSX·TXT·파일당 20MB와 브라우저 안 파싱을 보여 주지만, Front는 새 신청에서 1개(PDF·HWP·HWPX·DOCX, 10MB)를 고르고 사업 건 화면의 분석 요청 때 `POST /api/business-cases/{id}/analysis-jobs`로 보낸다(모의 계약). 실제 Back의 분석 작업 API·허용 형식·크기·비동기(202·작업 조회) 계약이 확정되면 이 기준을 맞춘다.
- **미구현 AI 기능:** 자연어 대화형 인터뷰, 공개자료 RAG, 실제 문서 파싱·LLM 호출, 방화벽 규칙 초안·데이터 흐름도 자동 생성은 없다. 화면에는 정해진 안내 문구와 모의 분석 결과(미확정 표시)만 있다.
- **통신 정보 데이터 단위:** 시안은 방화벽 규칙 단위 표다. 실제 Back에 규칙(FirewallRule) 자원이 생기면 행 단위·`업무 표현`·`방향` 열·`입력 필요` 필터를 다시 검토한다.
- **처리 이력 대상 표시:** 감사 이력 응답에 사업명이 없어 대상 칸은 신청번호 링크로 표시한다. Back이 대상 제목을 내려주면 시안처럼 사업명 링크로 바꿀 수 있다.

- **기관 설정:** 현재 화면의 게시본 표시(`게시본 v1`, 모의 seed)와 기준 정보는 코드에 적힌 고정 문구다. Back에 설정 게시본 조회 API(`GET /api/configurations/...`, 게시 이력)와 게시 API(`POST /api/configurations/{id}/publications`, AGENTS 5장 제안)가 생기면 배지·게시 이력 표를 응답으로 바꾸고, 하단 버튼은 관리자 권한과 변경 여부에 따라 활성화한다.
- **정책 수명주기:** 정책(FirewallRule) 목록·요약 건수·처리 API(`PUT /api/firewall-rules/{id}/application`, `.../revocation` 제안)가 생기면 요약 카드를 버튼(거르기)으로, 빈 상자를 시안의 9열 표와 처리 버튼으로 바꾼다. 현재 비활성 마크업은 그 자리 표시다.
- 정책 메뉴는 ICT인프라·정보보안에만 있고 라우트 자체는 역할 확인을 하지 않는다(기존과 같음). 실제 정책 데이터가 생기면 서버 권한과 화면 접근 조건을 함께 정한다.

## G. Git·병합 유의사항 (Stage 5 확인)

| 항목 | 결과 |
| --- | --- |
| HEAD | `feat/prototype-soo-ui-parity`, 작업 트리 깨끗함(문서 커밋 전 기준) |
| `origin/main` | `869678e`(작업 시작 기준과 같음). `git fetch` 후 원격 main에 새 커밋 없음 → 브랜치는 main보다 앞서기만 하고 뒤처지지 않음 |
| prototype-soo | `origin/main` `563dd7e` 그대로(기준 이후 시안 변경 없음) |
| 변경 파일 | 25개(추가 9: `docs/UI_INTEGRATION_HANDOFF.md`, `features/policy/*` 2, `features/request/turns.ts`, 테스트 5 / 수정 16: 화면 컴포넌트 9, CSS 7). 삭제된 파일 없음. Stage 5 문서 커밋에서 `docs/UI_INTEGRATION_FINAL_VERIFICATION.md` 추가 |
| 비밀정보·생성 파일 | `.env*`, `.next`, `node_modules`, `next-env.d.ts` 커밋 없음. `git diff --check` 통과 |
| 열린 팀 브랜치 | `origin/fix/6-instant-request-search`(`737b4bd`, 미병합)가 같은 파일 `features/request/RequestList.tsx`를 수정함. 임시 worktree에서 이 브랜치를 병합해 보니 **충돌 없이 자동 병합**, 병합 결과 테스트 97/97 통과(우리 92 + 그 브랜치 5), 타입 검사 통과. 실제 병합 순서는 팀이 정한다 |
| 병합된 원격 브랜치 | `feat/1-fresh-front-v112`, `feat/2-front-v113`, `fix/4-applicant-alignment`는 main에 포함되어 겹치는 변경 없음 |
| 실행하지 않은 것 | merge·rebase·reset·push·PR 생성 없음 |

## H. 위험 점검 (Stage 5-D)

| ID | 위험 | 확인 결과 | 후속 조치 |
| --- | --- | --- | --- |
| R-UI-01 | 업로드 계약 불일치 | Front: 새 신청에서 1개, PDF·HWP·HWPX·DOCX, 10MB(클라이언트 검사) → 사업 건 화면의 분석 요청 때 `POST /api/business-cases/{id}/analysis-jobs`(모의 계약). 시안: 최대 5개, XLSX·TXT 포함, 20MB, 브라우저 안 파싱. Back 확정 OpenAPI 없음 | Back 분석 작업 API의 형식·크기·개수·202 비동기 계약 확정 후 Front 검사와 문구를 맞춘다. 서버 측 형식·크기 검사 필수 |
| R-UI-02 | 미구현 AI 기능 | 사업 건 대화 영역 문구는 정해진 안내(자연어 AI 아님, 아바타도 `AI` 글자 대신 아이콘). 분석 결과는 `모의 AI 제안 · 미확정`, 적용해도 `confirmed=false`로 저장되어 사람 확인이 필요함(Stage 5 브라우저 확인). 신청 상세 `AI 최종 초안 제안`은 모의 동작 | 대화형 인터뷰·RAG·실제 파싱·LLM·최종 초안은 미구현. 연동 시 미확정 표시와 확인 절차 유지 |
| R-UI-03 | 정책 화면 직접 접근 | 정책 메뉴는 ICT인프라·정보보안에만 있으나, 메뉴가 없는 관리자도 `/policies` 직접 주소로 P2 안내 화면이 열림(Stage 5 브라우저 확인, 신청자도 같은 라우트 구조). 화면은 데이터·API 호출이 없어 정보 노출은 없음 | 실제 정책 API 연결 시 서버 권한 검사(403/404)와 화면 접근 조건을 함께 구현 |
| R-UI-04 | 모의 게시 정보 | 기관 설정의 `게시본 v1`·게시 이력 1행은 코드에 고정된 합성 값. 화면에 `모의 seed 게시본 · 읽기 전용`, `모의 seed`, `실제 게시 이력 API 연결 전`, 하단 버튼 비활성 사유를 함께 표시해 실제 승인·게시 이력으로 오인되지 않게 함 | 설정 게시본·게시 이력 API가 생기면 응답 값으로 교체 |
| R-UI-05 | 시안과 남은 차이 | 아래 "남은 디자인 결정 사항" 참조 | 디자이너·기획 결정 필요 |
| R-UI-06 | 원격 브랜치 변경 | G절 참조. main 변경 없음, 열린 브랜치 1개와 자동 병합 가능 | 병합 전 그 브랜치의 검색 동작과 Stage 1 목록 변경을 함께 수동 확인 권장 |

### 남은 디자인 결정 사항 (R-UI-05)

| # | 항목 | 현재 상태 | 결정 주체 |
| --- | --- | --- | --- |
| 1 | D1 글자 배율 | 본문 17px 유지, 간격만 시안 실효값. 행·카드 높이가 시안보다 큼 | 디자이너·팀장 |
| 2 | D2 상태 이름 | FUNCTIONAL_SPEC 이름(협의 중·최종 검토 중·확정 등). 시안의 `사전 협의 중`·`제출 준비`·`처리 완료` 미사용 | 기획·디자이너 |
| 3 | D3 새 신청 입력 카드 | 사업명·부서·서류 선택 카드를 파일 영역 위에 유지, 파일 영역 높이 36rem, 하단 버튼 1개 | 디자이너 |
| 4 | D4 상세 행위 패널 | 업무 행위·권한 유지, 버튼 세로 배치. 시안의 체크리스트·단일 협의 완료 버튼 미적용 | 디자이너·기획 |
| 5 | D5 설정·정책 | 시안 배치 + 비활성·사유. 편집 UI·정책 표 없음 | 팀장 |
| 6 | 사이드바 건수 배지 | 미적용(셸이 목록을 조회해야 하고 기존 셸 테스트 계약과 충돌) | 팀장·개발 |
| 7 | 신청 상세 | 빈 값에서 `담당자 확인 필요` 글자와 같은 배지가 한 줄에 겹쳐 보임. 시안의 데이터 흐름도·방화벽 규칙 표·자동 점검 카드 없음 | 디자이너·개발 |
| 8 | 통신 정보 | 시안은 방화벽 규칙 단위 표·필터 칩·CSV, Front는 신청 단위 표·검색 | Back 규칙 자원 설계 후 |
| 9 | 처리 이력·통신 정보 CSV | 시안의 CSV 다운로드 없음 | 기획 |

## F. 커밋 이력

| 단계 | 커밋 | 변경 요약 | 검증 |
| --- | --- | --- | --- |
| Stage 0 | `0c4bfbc` | 기준선 기록, 이 문서 생성 | check·build 통과 |
| Stage 1 | `3283fa2` | 셸·신청 현황 밀도 정렬, 담당자 열 크기, 사업명 칸 3줄, 담당자 화면 진행 안내 | check(66/66)·build 통과, 수동 점검 |
| Stage 1 | `70709ec` | 문서에 Stage 1 커밋 기록 | – |
| Stage 2 | `d70fbfc` | 신청 상세 단계 표시·라벨·값 표·우측 단일 패널, 사용 안 하는 CSS 정리, `waitingLine` 테스트 | check(75/75)·build 통과, 4개 역할 수동 점검 |
| Stage 2 | `c848bdf` | Stage 2 변경 명세 기록 | – |
| Stage 3 | `deb29cc` | 새 신청 파일 영역 시안 구조 적용, 파일 오류 영역 내 표시, 드래그·생성 중 상태 정리, 옛 CSS 정리, 테스트 4개 | check(79/79)·build 통과, 수동 시나리오 점검 |
| Stage 3 | `c7a9eef` | Stage 3 변경 명세 기록 | – |
| Stage 4-A | `5832d78` | 사업 건·인터뷰 작업 영역 시안 구조 적용, 문서 분석 막대 위치, 옛 CSS 정리, 테스트 3개 | check(82/82)·build 통과, 수동 점검 |
| Stage 4-A | `4e76d5b` | 보완 요청·문서함·통신 정보·처리 이력 시안 정렬, 옛 CSS 정리, 테스트 5개 | check(87/87)·build 통과, 수동 점검 |
| Stage 4-A | `ae340e8` | Stage 4-A 변경 명세 기록 | – |
| Stage 4-B | `cfd11d0` | 기관 설정·정책 수명주기 시안 배치, 미구현 동작 비활성·사유, 테스트 5개 | check(92/92)·build 통과, 역할별 수동 점검 |
| Stage 4-B | `17764e9` | Stage 4-B 변경 명세 기록 | – |
| Stage 5 | `8e32cdd` | Stage 4-A CSS 정리로 사라진 `.form-two`·`.settings-two` 2열 격자 복구 | check(92/92)·build 통과, 화면 확인 |
| Stage 5 | (이 커밋) | 최종 인계 명세·최종 검증 문서 | – |
