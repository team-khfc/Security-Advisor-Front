# API 계약 연결 상태

기록일: 2026-11-07. **API 계약의 소유자는 Security-Advisor-Back이다.** 이 디렉터리는 Front가 확인한 실제 서버 경로와 아직 제안 단계인 모의 계약의 차이를 기록한다. 확정되지 않은 모의 명세를 공식 OpenAPI처럼 게시하지 않는다.

## 확인한 실제 Back 기준

참조한 Back 커밋은 [`6253f9c7bf0d8862be1d93a32062de6bd887f68d`](https://github.com/team-khfc/Security-Advisor-Back/tree/6253f9c7bf0d8862be1d93a32062de6bd887f68d)이다. 이 기준에서 Front가 가져올 확정 OpenAPI 계약 파일은 확인되지 않았다. 다음은 컨트롤러 소스로 확인한 경로이며, 실제 환경에서 연동 실행을 완료했다는 의미는 아니다.

| 실제 Back 경로 | 소스에서 확인한 의미 | 이번 Front 사용 |
| --- | --- | --- |
| `POST /api/auth/login` | 세션 생성, 사용자 응답 | 로그인 훅과 응답 어댑터 |
| `POST /api/auth/logout` | 세션 무효화, 204 | 로그아웃 훅 |
| `GET /api/auth/me` | 현재 사용자, 인증 없으면 401 | 세션 조회 및 CSRF 쿠키 초기화 요청 |
| `POST /api/members` | 회원가입, 생성 시 201·Location | 가입 훅 |
| `GET /api/procedures` | 신청 가능한 절차 목록 | 현재 Front에서는 사용하지 않음 |
| `GET /api/procedures/{code}` | 절차 한 건 | 현재 Front에서는 사용하지 않음 |

원본 소스: [AuthController](https://github.com/team-khfc/Security-Advisor-Back/blob/6253f9c7bf0d8862be1d93a32062de6bd887f68d/src/main/java/kr/securityadvisor/auth/controller/AuthController.java), [MemberController](https://github.com/team-khfc/Security-Advisor-Back/blob/6253f9c7bf0d8862be1d93a32062de6bd887f68d/src/main/java/kr/securityadvisor/auth/controller/MemberController.java), [ProcedureController](https://github.com/team-khfc/Security-Advisor-Back/blob/6253f9c7bf0d8862be1d93a32062de6bd887f68d/src/main/java/kr/securityadvisor/procedure/controller/ProcedureController.java), [SecurityConfig](https://github.com/team-khfc/Security-Advisor-Back/blob/6253f9c7bf0d8862be1d93a32062de6bd887f68d/src/main/java/kr/securityadvisor/common/config/SecurityConfig.java).

### 현행 인증 경로의 예외

현재 `/auth/login`·`/auth/logout`·`/auth/me`는 [AGENTS.md](../AGENTS.md)의 복수형 자원 명사 중심 REST 규칙과 다르다. Front는 현행 서버와의 연결을 위해 이 예외를 [useAuth.ts](../features/auth/useAuth.ts)에 한정해 유지한다. 새 업무 API를 동사 경로로 설계하는 근거로 사용하지 않는다. 세션 자원 경로로 정리하는 변경은 Back 계약 PR이 먼저이며, Front만 `/sessions`로 바꿔 실제 지원을 가정하지 않는다.

[MemberResponse](https://github.com/team-khfc/Security-Advisor-Back/blob/6253f9c7bf0d8862be1d93a32062de6bd887f68d/src/main/java/kr/securityadvisor/auth/dto/MemberResponse.java)는 `username`, `displayName`, `role`을 반환한다. Front의 임시 어댑터는 이를 `Session`으로 감싸고 화면용 `id=username`, `department=''`, `active=true`, `expiresAt=null`, `mock=false`로 대응한다. 서버가 회원 ID·부서·활성 상태·만료시각을 보장했다는 뜻이 아니며, 이 값으로 서버 권한을 대체하지 않는다.

## Front 모의 API의 제안 경로

아래 경로는 [useRequests.ts](../features/request/useRequests.ts), [useAuth.ts](../features/auth/useAuth.ts), [queries.ts](../lib/queries.ts), [mocks/server.ts](../mocks/server.ts)의 현재 동작을 정리한 것이다. **실제 Back 승인 계약이 아니다.** `GET /api/members`는 위의 실제 회원가입 `POST /api/members`와도 구분해야 한다.

| 자원 | 메서드·경로 | 용도 |
| --- | --- | --- |
| 설치 정보 | `GET /api/installation` | 설치 환경의 운영 기관명·코드·모드 |
| 모의 세션 | `POST /api/demo-sessions` | 합성 계정 진입. 실제 API 모드에서는 차단 |
| 세션 연장 | `POST /api/sessions/current/renewals` | 만료시각을 제공하는 모의 세션 연장 |
| 계정 | `GET /api/members`, `POST /api/members/{id}/role-assignments` | 관리자 목록, 역할·활성 상태 변경과 사유 |
| 사업 건 | `GET, POST /api/business-cases`, `GET, PATCH /api/business-cases/{id}` | 사업 생성·조회·공통 답변 수정 |
| 분석 작업 | `POST /api/business-cases/{id}/analysis-jobs`, `GET /api/analysis-jobs/{id}` | 파일·개요 분석 요청과 작업 조회 |
| 제안 적용 | `POST /api/analysis-jobs/{id}/applications` | 저장된 제안을 revision 확인 후 공통 답변에 반영 |
| 신청 | `GET /api/security-requests`, `GET /api/security-requests/{id}` | 접근 가능한 신청 목록·상세 |
| 신청 답변 | `PATCH /api/security-requests/{id}/answers` | 해당 서류 답변 저장·확인 |
| 협의 요청 | `POST /api/security-requests/{id}/reviews` | 협의 진입 및 분야별 배정 |
| 할당·협의 완료 | `PUT /api/reviews/{id}/allocation-completion`, `PUT /api/reviews/{id}/completion` | 두 업무를 독립 처리 |
| 보완 | `POST /api/security-requests/{id}/supplements`, `POST /api/supplements/{id}/answers`, `PUT /api/supplements/{id}/resolution` | 요청·답변·담당자 확인 |
| 차수 반환 | `POST /api/security-requests/{id}/stage-returns` | 대상 단계·사유·보완 항목 기록 |
| 최종 초안 | `POST /api/security-requests/{id}/draft-generations` | 모의 미확정 제안 생성 |
| 제출 | `POST /api/security-requests/{id}/submissions` | 멱등 키를 포함한 제출 스냅샷 생성 |
| 최종 확인·확정 | `POST /api/submissions/{id}/final-confirmations`, `PUT /api/submissions/{id}/confirmation` | 분야별 확인과 서류 확정 |
| 종결·철회 | `PUT /api/security-requests/{id}/closure`, `PUT /api/security-requests/{id}/withdrawal` | 사유 필수, 기존 값 보존 |
| 재배정 | `POST /api/security-requests/{id}/assignments` | 관리자 재배정과 이력 |
| 문서 데이터 | `GET /api/security-requests/{id}/documents` | 초안 또는 제출본의 JSON 다운로드. 선택적으로 `submissionId` 지정 |
| 감사 | `GET /api/audit-events` | 읽기 전용 감사 목록 |

상태를 직접 PATCH하는 API는 두지 않고 하위 자원 생성·설정으로 업무 메서드를 실행한다. `installation` 등 제안 경로의 이름·응답은 Back 계약 검토에서 확정해야 한다. 공식 계약으로 전환할 때는 이름뿐 아니라 실제 HTTP 의미와 멱등성도 함께 확인한다.

## 현재 DTO·오류 경계

| 항목 | 현재 Front 기대 |
| --- | --- |
| 사용자·설치 | [lib/types.ts](../lib/types.ts)의 `Actor`, `Session`, `Installation`. 모든 계정은 설치 기관 하나에 속하며 기관 ID를 입력받지 않음 |
| 사업·신청 | [features/request/types.ts](../features/request/types.ts)의 Zod 스키마와 타입. BusinessCase 1:N SecurityRequest |
| 답변 출처 | `source`, `evidence`, `confirmed`, `confirmation`, CASE/REQUEST scope. 근거·사람의 확인 없는 AI 값은 미확정 |
| 응답 권한 표시 | 서버가 `allowedActions`·`blockers`를 계산. 클라이언트 표시와 별개로 mutation 시 서버가 다시 검사 |
| 수정 충돌 | 변경 요청의 `expectedRevision`, 충돌 시 409와 최신 revision 정보. 입력 보존 후 사용자가 갱신 판단 |
| 제출 중복 | `Idempotency-Key`와 제출 스냅샷. 답변·설정 게시본 버전을 당시 값으로 고정 |
| 목록 | `{content, page, size, totalElements}`. 현재 훅은 첫 최대 100건을 받아 화면에서 필터·페이지 처리 |
| 오류 | [ProblemDetail 처리](../lib/problem.ts)와 [HTTP 클라이언트](../lib/httpClient.ts). 400·401·403·404·409·422를 구분 |
| 다운로드 | `application/json`, `Content-Disposition: attachment`, `.json` 파일명. 정식 HWP·PDF 파일이 아님 |

인증·CSRF의 기준은 서버다. 브라우저는 동일 출처 쿠키와 `X-XSRF-TOKEN`을 사용하고 상태 변경 요청에 `X-Requested-With`를 보낸다. [프록시](../lib/serverProxy.ts)는 서버 환경변수의 고정 API origin만 사용하며 허용 헤더·쿠키를 전달한다. 외부 임의 URL, 리다이렉트 추종, 사용자 입력 기반 Back 주소 변경을 허용하지 않는다.

## 확정 계약을 반영하는 순서

1. Back PR에서 OpenAPI와 필요한 DTO·상태·오류·권한·revision·멱등성 의미를 먼저 확정한다. 현행 인증 경로의 예외와 설치 정보 계약도 함께 확인한다.
2. Front 작업에 Back의 참조 커밋 또는 릴리스 태그와 계약 파일 경로를 기록한다. 계약 사본을 두는 경우 원본 위치와 동기화 방법을 함께 남긴다.
3. Front 타입·Zod 응답 검증·Query 훅·모의 API를 계약에 맞춰 변경한다. 모의 성공만으로 실제 서버 지원을 판정하지 않는다.
4. 실제 Back으로 인증·권한·충돌·업무 전이·문서 응답을 검증하고 실행 결과를 PR에 기록한다. 미연결 경로는 [KNOWN_LIMITATIONS](../docs/KNOWN_LIMITATIONS.md)에 남긴다.

Front가 Back 코드를 복사해 별도 업무 서버를 만들거나, 배포 저장소에서 계약·업무 기능을 수정하지 않는다.
