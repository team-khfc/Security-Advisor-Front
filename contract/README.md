# Back API 계약 동기화

기준일: 2026-11-09

- Back 커밋: `74cbdfb5ef0896b2628d243e3bec7f01b183eaac`
- 원본: https://github.com/team-khfc/Security-Advisor-Back/blob/74cbdfb5ef0896b2628d243e3bec7f01b183eaac/docs/api/openapi.yaml
- 요청서: https://github.com/team-khfc/Security-Advisor-Back/blob/74cbdfb5ef0896b2628d243e3bec7f01b183eaac/docs/FRONT_CHANGE_REQUEST_20261109.md
- `openapi.yaml`은 Back 원본의 사본이며 Front에서 계약을 임의 개정하지 않는다.

## 응답과 화면의 경계

`features/request/apiTypes.ts`는 실제 HTTP 응답을 검증한다. 숫자 ID, 답변의 fieldKey/valueSource/revision, Back 열거형, 게시본 질문, 독립된 하위 자원 DTO를 사용한다. `features/request/adapters/backend.ts`는 기존 화면 모델로 변환한다. 화면 내부의 문자열 id·상태 별칭은 HTTP 응답 타입이 아니다.

상세 화면은 신청 본체와 사업 건, 협의, 배정, 보완, 반환, 기한, 제출본, 최종 확인을 독립 Query로 읽는다. 게시본은 사업 건의 publicationId로 조회하여 기존 신청에 새 질문을 섞지 않는다. 제출본은 별도 상세의 snapshot을 표시한다. allowedActions는 버튼 노출 후보일 뿐이며 제출 차단 사유를 클라이언트에서 계산하지 않는다. 업무 API의 422 detail이 최종 안내다.

모의 서버는 기존 합성 도메인 모델을 `mocks/contractMapper.ts`에서 같은 HTTP DTO로 직렬화한다. 로그인과 일반 API는 동일 스키마를 사용하며 모의 세션에만 mock 표시를 덧붙인다.

## 요청서와 실제 구현의 차이

1. 6절 제출: 실제 SubmissionController와 SubmitCommand는 `{ expectedRevision }` 본문을 필수로 요구한다. 이를 유지하고 멱등 키는 헤더로만 보낸다.
2. 1절 페이지: OpenAPI의 명시적 PageResponse는 평탄한 메타데이터다. Spring Page의 중첩 page 객체도 함께 검증·정규화한다.
3. 2절 게시본 질문: 실제 필드는 `fieldSchema.fields`다. current 대신 사업 건에 연결된 게시본 ID를 사용한다.
4. 8절 회원 목록: `GET /api/members`는 Page가 아닌 MemberDetail 배열이며 active가 포함된다. 로그인/내 정보의 MemberResponse와 구분한다. 활성 상태만 바꾸면 PUT activation을 사용한다.
5. 답변 확인: Answer 구현상 사용자 직접 입력은 저장 시 확정되고 confirmedBy는 null이다. 사용자 confirmation API는 AI_INFERRED에만 적용한다. 같은 AI 값을 확인할 때 다시 저장하여 USER_ANSWER로 바꾸지 않는다. 담당자 입력·확인은 `/api/reviews/{id}/answers/{fieldKey}` 경로를 사용한다.

## 검증

실행 결과와 남은 환경 제약은 `docs/API_ALIGNMENT_20261109.md`에 기록한다. 로컬 수정만 수행하며 Back 저장소·PR·이슈는 변경하지 않았다.
