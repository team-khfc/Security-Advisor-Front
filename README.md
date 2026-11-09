# SecurityAdvisor Front — 보안길잡이

공공기관 현업 담당자와 ICT인프라·정보보안 담당자를 연결하는 **보안길잡이의 프론트엔드 개발 프로젝트**입니다. README만 존재하던 초기 저장소에서 최신 디자인 시안과 개정된 업무 규칙을 바탕으로 Next.js 화면·공통 컴포넌트·모의 API를 새로 구현했습니다.

Front는 Back 없이 합성 데이터로 실행할 수 있습니다. 현재 개발 기본값은 **모의 API**이며, 실제 Back 연결용 프록시와 인증 어댑터를 별도로 제공합니다. 정식 LLM·문서 출력·전체 업무 API 연동까지 완료된 운영 제품은 아닙니다. 실행한 검사와 남은 검증 범위는 [검증 기록](docs/VALIDATION.md), 구현의 경계는 [현재 한계](docs/KNOWN_LIMITATIONS.md)를 확인해 주세요.

3단계의 **AI 최종 보고서 생성 → 수정·확인 → 제출**과 **실제 PDF 다운로드**를 Back API에 연결했습니다. 제출 이후의 미리보기와 PDF는 제출 당시 본문을 사용합니다. 모의 모드에서는 최종 보고서 흐름을 시연할 수 있으며, PDF 다운로드는 실제 서버 연결이 필요하다고 안내합니다. 검증 결과와 호환 범위는 [최종 보고서·PDF 검증 기록](docs/FINAL_DRAFT_20261110.md)에 정리합니다.

## 빠른 시작

**Node.js 24를 권장**합니다. `package.json`의 허용 범위는 `>=22.14 <25`이며, 문서 점검을 포함한 `npm run check`에는 Python 3도 필요합니다.

저장소 루트에서 실행합니다.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

[http://localhost:3000/login](http://localhost:3000/login)을 열고 합성 계정 카드를 선택하면 됩니다. `npm run dev`는 `.env.local`의 모드 값과 관계없이 개발 프로세스에 `API_MODE=mock`을 지정합니다. Back·DB·LLM 키는 필요하지 않습니다.

### 환경변수

개인 실행 설정은 Git에 포함되지 않는 `.env.local`에 둡니다. 기준 파일은 [.env.example](.env.example)입니다.

| 변수                    | 용도                                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `API_MODE`              | `mock` 또는 `api`. `npm run dev`·`dev:api`는 각 모드를 명시적으로 선택하고, `npm run start`·컨테이너 실행은 환경 설정을 사용 |
| `INSTITUTION_NAME`      | 설치할 운영 기관의 표시 이름. 기본 예제는 합성 기관                                                                          |
| `INSTITUTION_CODE`      | 설치할 운영 기관의 코드                                                                                                      |
| `API_BASE_URL`          | 실제 Back의 origin. 예: `http://localhost:8080`. 브라우저에 공개하지 않는 서버 설정                                          |
| `DEMO_ACCOUNT_PASSWORD` | 선택 사항. 합성 계정을 아이디·비밀번호 방식으로도 사용할 때 개인 실행 환경에 설정                                            |

운영 기관은 **설치당 한 곳**입니다. 기관명·코드는 환경변수에서 읽으며 기관 테이블·기관 선택·다중 기관 전환 기능을 두지 않습니다. 저장소와 시연 데이터에는 실제 내부 IP·시스템명·개인정보·비밀값을 넣지 않습니다.

### 합성 계정으로 살펴보기

모의 로그인 화면은 다음 계정 카드를 제공합니다. 카드 로그인에는 비밀번호가 필요하지 않으며 실제 API 모드에서는 사용할 수 없습니다.

| 카드           | 아이디       | 역할·확인할 흐름                                        |
| -------------- | ------------ | ------------------------------------------------------- |
| 신청자 가      | `applicant`  | 사업·신청 작성, 공통 인터뷰, 보완 답변, 최종 제출       |
| 신청자 나      | `applicant2` | 다른 신청자의 조회 범위 분리                            |
| 인프라 담당 가 | `infra`      | 자원 할당, 담당 분야 협의, 제출본 최종 확인             |
| 보안 담당 가   | `security`   | INFRA 선행 이후 검토, 보완·반환, 최종 확인·서류 확정    |
| 관리자 가      | `admin`      | 계정 역할·활성 상태, 담당자 재배정, 설정 기준·감사 이력 |

아이디·비밀번호 방식이 필요하면 `.env.local`의 `DEMO_ACCOUNT_PASSWORD`에 개인 시연용 값을 설정하고 개발 서버를 다시 시작합니다. 공용 기본 비밀번호는 코드에 넣지 않습니다. `/signup`에서 만든 계정에는 서버가 신청자 역할을 부여합니다.

모의 계정·세션·업무 데이터는 서버 프로세스 메모리에 있으며 서버 재시작 시 초기화됩니다. 새 신청·인터뷰·분석·답변 작성 중 입력과 선택 파일은 계정별 탭 메모리에 임시 보존하며, 새로고침·탭 종료 후 복원을 보장하지 않습니다.

## 실제 Back 연결

Back의 확정 OpenAPI와 인수인계 문서를 기준으로 Docker에서 **Front·실제 Back·PostgreSQL을 함께 실행**하는 방법은 [실제 연결 테스트 서버](docs/BACKEND_TEST_SERVER.md)를 참고합니다. Windows에서는 Front 폴더에서 다음 명령으로 준비할 수 있습니다.

```powershell
npm run test:server -- --backend "$env:USERPROFILE\Desktop\repo\Security-Advisor-Back-main"
```

기본 주소는 `http://localhost:3001/login`이며 기존 모의 서버와 구분합니다. 이 구성은 인증·기관 조회·기본 API 연결 검사에 사용할 수 있습니다. **사업·신청·답변·협의·제출 등 업무 화면 전체가 실제 Back에 연동된 상태는 아닙니다.**

Back을 별도로 실행하고 Front 개발 서버를 연결할 경우에는 다음 설정을 사용합니다.

`.env.local`에 Back 주소를 지정합니다.

```dotenv
API_MODE=api
API_BASE_URL=http://localhost:8080
```

```bash
npm run dev:api
```

브라우저는 동일 출처의 `/api/...`만 호출하고 Next.js 서버가 Back으로 전달합니다. 실제 모드에서 요청이 실패해도 합성 성공 응답으로 바꾸지 않습니다.

Back의 확정 OpenAPI와 `FRONTEND_HANDOFF.md`가 제공되었으며, 인증 응답과 기관 정보에 맞춘 어댑터를 제공합니다. 사업·신청·검토·문서의 업무 DTO와 mutation 경로는 현재 Front 모의 계약과 차이가 있어 후속 연결이 필요합니다. 현행 인증 경로의 REST 명명 예외, 응답 변환, 실제와 모의 API 차이는 [API 계약 연결 상태](contract/README.md)에 정리했습니다.

## 주요 화면과 업무 흐름

| 경로                         | 화면                                                          |
| ---------------------------- | ------------------------------------------------------------- |
| `/login`, `/signup`          | 로그인·모의 계정 진입·회원가입                                |
| `/requests`                  | 역할별 신청 현황·협의 요청함, 검색·기간·상태 필터             |
| `/requests/new`              | 사업 정보와 신청 서류 선택, 파일 선택 또는 직접 작성 시작     |
| `/cases/[id]`                | 사업 공통 인터뷰, 합성 분석 제안, 출처·확인 상태, 연결된 신청 |
| `/requests/[id]`             | 개별 신청의 답변·협의·보완·반환·제출본·최종 확인·처리 이력    |
| `/supplements`, `/documents` | 보완 요청 목록, 문서 데이터 미리보기·JSON 내려받기            |
| `/network`, `/history`       | ICT인프라 통신 정보, 권한 범위의 처리·검토·감사 이력          |
| `/members`, `/settings`      | 관리자 계정·담당자 관리, 읽기 전용 설정 기준 안내             |
| `/policies`                  | 정책 수명주기 구현 예정 안내                                  |

한 **사업 건(BusinessCase)** 에서 방화벽신청서와 보안성검토 신청서를 함께 만들 수 있습니다. 공통 정보는 사업 건에 한 번 수집하고, 각 **신청(SecurityRequest)** 의 단계·상태·반환·제출은 독립적으로 진행합니다.

1. **작성:** 신청자가 사업·서류별 정보를 입력합니다. 모의 분석 제안에는 출처·근거와 미확정 상태를 표시합니다.
2. **담당자 협의:** 분야별 담당자를 배정하고 INFRA 자원 할당 후 SECURITY 검토를 진행합니다. 할당 완료와 각 분야 협의 완료는 별개입니다.
3. **사용자 최종 검토:** 부족한 값·미확정 제안·보완 요청을 확인한 뒤 신청별로 제출합니다. 제출 당시 답변과 설정 버전을 스냅샷으로 보존합니다.
4. **확정·관리:** 제출본의 INFRA 최종 확인, SECURITY 최종 확인을 거쳐 SECURITY가 서류를 확정합니다. **서류 확정은 실제 방화벽 적용이 아닙니다.**

차수 반환·종결·철회에는 사유가 필요하고 기존 값·이력을 보존합니다. 반환한 보완 항목만 강조하며 공통 답변 변경이 이미 제출한 스냅샷을 바꾸지 않습니다. UI의 역할·버튼 표시와 별개로 모의 API도 권한·배정·업무 조건·revision을 검사합니다.

## 기술과 개발 명령

| 항목              | 현재 버전·구성                                                     |
| ----------------- | ------------------------------------------------------------------ |
| Next.js           | 16.4.5 · App Router · standalone 출력                              |
| React / React DOM | 19.3.1                                                             |
| TypeScript        | 5.9.3                                                              |
| TanStack Query    | 5.107.1                                                            |
| 입력·응답 검증    | Zod 4.6.7                                                          |
| UI                | 최신 시안 CSS·로고, 로컬 Pretendard GOV·KRDS 자산, 공통 React UI   |
| 개발 검사         | ESLint, Prettier, Vitest, Testing Library, 문서 버전 점검 스크립트 |

의존성은 [package.json](package.json)과 [package-lock.json](package-lock.json)에 고정합니다. 선택 이유는 [ADR 0001](docs/adr/0001-frontend-foundation.md)에 있습니다.

```bash
# 자동 형식 정리
npm run format

# 형식·타입·린트·테스트·문서 기준 점검
npm run check

# 프로덕션 빌드와 로컬 실행
npm run build
npm run start
```

필요한 항목만 실행할 때는 `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run check:docs`를 사용합니다. 이 목록은 실행 방법이며 검사 결과 보고가 아닙니다. 결과와 환경·미검증 항목은 [VALIDATION.md](docs/VALIDATION.md)를 확인합니다.

### Front 단독 컨테이너

[Dockerfile](Dockerfile)은 Node 24 기반 다단계 빌드와 Next.js standalone 실행을 정의합니다. 아래는 합성 시연용 실행 예시입니다.

```bash
docker build -t security-advisor-front:local .
docker run --rm --name security-advisor-front -p 3000:3000 -e API_MODE=mock security-advisor-front:local
```

컨테이너 기본 모드는 `api`입니다. 실제 연결에는 컨테이너에서 접근 가능한 `API_BASE_URL`을 런타임 환경변수로 지정해야 합니다. Docker 실행 환경이 제공되지 않아 이 Dockerfile의 이미지 빌드·컨테이너 구동은 아직 검증하지 않았습니다. Front 단독 컨테이너와 Back·DB를 포함한 전체 서비스 배포 검증은 구분합니다.

## 폴더와 개발 가이드

| 위치                 | 책임                                                           |
| -------------------- | -------------------------------------------------------------- |
| `app/`               | 페이지·레이아웃·Provider·동일 출처 API 라우트                  |
| `components/`        | 서비스 셸·공통 UI·아이콘                                       |
| `features/`          | auth·request·assignment·document·audit·configuration 화면과 훅 |
| `lib/`               | HTTP·ProblemDetail·프록시·공통 타입·일시적인 입력 보존         |
| `mocks/`             | 서버 모의 API와 합성 seed                                      |
| `styles/`, `public/` | 시안 기반 스타일·로고·로컬 글꼴·KRDS 자산                      |
| `tests/`, `tools/`   | 업무·HTTP 경계 검사, 실행·문서 점검 도구                       |
| `contract/`, `docs/` | API 연결 상태, 구조·디자인 차이·ADR·검증·한계·출처 기록        |

- [프론트 구조와 개발 시작점](docs/FRONTEND_ARCHITECTURE.md)
- [디자인 시안 반영 기록](docs/DESIGN_PARITY.md)
- [API 계약 연결 상태](contract/README.md)
- [개발 기반 결정 ADR](docs/adr/0001-frontend-foundation.md)
- [검증 기록](docs/VALIDATION.md)
- [현재 구현의 한계](docs/KNOWN_LIMITATIONS.md)
- [규칙 문서 원본과 공개본 출처](docs/SOURCE_PROVENANCE.md)

정식 문서 파싱·LLM 인터뷰·RAG, HWP·PDF 출력, 확정 OpenAPI에 따른 전체 Back 연동은 후속 작업입니다. 현재 내려받는 파일은 **미리보기 데이터 JSON**입니다. 정책 수명주기·업무 지표·화면 안 알림·설정 편집·게시 관리 등 P2 범위는 구현 예정으로 표시합니다.

## 작업 기준과 출처

공식 기준 버전은 [PROJECT_CONTEXT.md 5장](PROJECT_CONTEXT.md#5-기준-버전-표-공식)입니다. 아래는 이번 구현이 확인한 기준이며, 후속 작업 전에는 공식 표와 각 문서 머리말을 다시 확인합니다.

| 문서                                     | 기준 버전 | 개정일     |
| ---------------------------------------- | --------- | ---------- |
| [요약 지침](claude/INSTRUCTIONS.md)      | v1.13     | 2026-11-07 |
| [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) | v3.4      | 2026-11-07 |
| [FUNCTIONAL_SPEC.md](FUNCTIONAL_SPEC.md) | v1.11     | 2026-11-07 |
| [AGENTS.md](AGENTS.md)                   | v1.16     | 2026-11-07 |
| [PROJECT_RULES.md](PROJECT_RULES.md)     | v1.14     | 2026-11-07 |
| [CONTRIBUTING.md](CONTRIBUTING.md)       | v0.16     | 2026-11-07 |
| [CODING_STYLE.md](CODING_STYLE.md)       | v0.5      | 2026-11-07 |
| [SECURE_CODING.md](SECURE_CODING.md)     | v1.4      | 2026-11-07 |
| [design.md](design.md)                   | v3.1      | 2026-11-06 |

공개 저장소의 규칙 문서는 제공된 최신 원본에서 팀 실명을 역할명으로, 개인 이메일을 비공개 표기로 치환한 **비식별 공개본**입니다. 업무 규칙·버전·개정일은 유지했으며 원본과 공개본의 해시·변환 범위는 [SOURCE_PROVENANCE.md](docs/SOURCE_PROVENANCE.md)에 기록했습니다. 요약 지침은 `claude/INSTRUCTIONS.md` 한 경로에 둡니다.

디자인은 [`prototype-soo` 커밋 `1af32fb424ea79a1a4ce60484a83f9d1935fef25`](https://github.com/team-khfc/prototype-soo/tree/1af32fb424ea79a1a4ce60484a83f9d1935fef25)와 해당 MERGE_NOTES를 참조했습니다. 개별 화면 구성은 시안을 따르고, 시안과 다른 업무 의미는 FUNCTIONAL_SPEC을 우선했습니다. 본문 축소 배율은 design.md 기준에 맞춰 17px로 보정했습니다. 디자인 원본 저장소는 수정하지 않았습니다.

| 저장소                                                                        | 역할                                                                       |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [Security-Advisor-Front](https://github.com/team-khfc/Security-Advisor-Front) | 이 저장소. 화면·모의 API 독립 개발                                         |
| [Security-Advisor-Back](https://github.com/team-khfc/Security-Advisor-Back)   | 실제 서버·DB·OpenAPI 계약 소유                                             |
| [Security-Advisor](https://github.com/team-khfc/Security-Advisor)             | Back·Front 릴리스 스냅샷과 전체 실행 Compose를 관리하는 완성본·배포 저장소 |
| [prototype-soo](https://github.com/team-khfc/prototype-soo)                   | 디자인 담당의 최신 시안 원본                                               |

기능 변경은 개발 저장소의 브랜치와 PR에서 진행하고, [CONTRIBUTING.md](CONTRIBUTING.md)의 검토·승인 절차를 따릅니다. 다른 개발 저장소나 디자인 저장소를 이 작업에서 함께 수정한 것으로 간주하지 않습니다.
