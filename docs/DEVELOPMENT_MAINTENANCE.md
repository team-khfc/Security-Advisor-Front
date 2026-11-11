# Front 개발·유지보수 가이드

먼저 [적용 규칙](RULES_GUIDE.md)을 읽는다. 화면·입력·프론트 API 연결과 모의 API는 여기서 개발한다. 업무 권한의 최종 검증·DB·LLM 호출은 Back의 책임이다.

## 설치·모의 실행

Node.js 24 권장(프로젝트 허용 범위 `>=22.14 <25`), npm과 문서 검사용 Python 3을 준비한다.

```bash
npm ci
npm run dev
```

`http://localhost:3000/login`에서 모의 역할 카드를 선택한다. `dev`는 모의 모드를 명시적으로 지정하므로 `.env.local`만 api로 바꿔도 실제 Back에 연결되지 않는다. 모의 상태는 프로세스 메모리이며 재시작 시 초기화된다. 실제 AI·PDF·서버 권한 검증은 실제 Back 연결에서 수행한다.

## 실제 Back 연결

최초에 `.env.example`을 `.env.local`로 복사한다(PowerShell: `Copy-Item .env.example .env.local`). 기존 개인 설정은 보존한다.

```dotenv
API_MODE=api
API_BASE_URL=http://localhost:8080
```

```bash
npm run dev:api
```

Next 서버가 동일 출처 `/api/*`를 Back으로 중계한다. 브라우저는 DB나 LLM에 직접 접속하지 않는다. 백엔드 주소·키를 `NEXT_PUBLIC_*`에 넣지 않는다. 호스트 Next는 localhost:8080을 사용할 수 있지만 컨테이너 안 localhost는 그 컨테이너 자신이다. 통합 compose는 `http://app:8080`을 사용한다. 호스트 Back을 컨테이너에서 연결할 때는 환경이 지원하는 호스트 주소를 사용한다.

## 설정과 빌드

| 설정 | 적용 |
|---|---|
| `.env.local` | Next 로컬 개인 설정(변경 후 개발 서버 재시작) |
| `API_MODE`, `API_BASE_URL` | 실행 방식·서버 측 중계 주소 |
| `INSTITUTION_NAME/CODE` | 모의 화면 기관 표시. 실제 기관 정보는 Back 설치 설정 |
| `DEMO_ACCOUNT_PASSWORD` | 선택적인 모의 비밀번호 로그인. 실제 Back 계정 비밀번호와 별개 |

```bash
npm run check
npm run build
npm run start
```

`start` 전에는 원하는 API_MODE를 실행 환경에 설정한다. 전체 서비스를 Docker로 실행하려면 통합 배포 저장소를 사용한다. 같은 3000 포트의 개발 서버와 배포 컨테이너는 동시에 시작하지 않는다.

## 구조와 API 계약

`app/`은 페이지·서버 중계, `features/`는 업무별 화면·상태·연결, `components/`는 공통 UI, `lib/`는 공통 기능, `mocks/`는 모의 API, `contract/`는 Back 계약 사본이다.

API가 바뀌면 Back `docs/api/openapi.yaml`의 확정 커밋을 가져와 `contract/openapi.yaml`·`contract/README.md`의 출처를 함께 갱신한다. 응답 타입·변환기·모의 응답·검사를 같은 변경에서 맞춘다. 계약을 Front에서 독자적으로 개정하지 않는다. 서버 데이터 접근·파일명·레이어 규칙은 AGENTS와 CODING_STYLE을 따른다.

UI는 로딩·오류·빈 상태·충돌·키보드·좁은 화면을 확인한다. 버튼 숨김은 권한 검사를 대신하지 않는다. 같은 브라우저 프로필의 탭은 로그인 세션을 공유하므로 역할별 동시 시연은 프로필을 나눈다.

## DB와 LLM 관리

Front에는 DB 연결 문자열·스키마·마이그레이션을 설정하지 않는다. 실제 DB 구성은 Back 또는 통합 배포 가이드에서 변경한다. 모의 데이터를 바꾸는 것과 실제 DB를 바꾸는 것은 다르다.

기관관리자의 `/models` 화면이 실제 Back의 LLM 관리 API를 사용한다. [LLM 설정·연결 시험·이력 복원](LLM_CONFIGURATION.md)을 따른다. 키·호스트 허용 목록은 Back 환경에 설정하며 모델명·우선순위·용도는 관리자 화면에서 변경한다. AI 대기 시간 오류는 `lib/serverProxy.ts`와 관련 대기 시간 정책, Back 모델 설정, 외부 프록시를 함께 확인한다. 로그인 세션 제한을 늘리는 것으로 AI 응답 제한이 해결된다고 가정하지 않는다.

## 문제 해결·배포

| 문제 | 확인 |
|---|---|
| 모의 카드만 보임 | 실행 명령이 `dev:api`인지 확인 |
| API 연결 실패 | Back health·API_BASE_URL·컨테이너 주소·포트 |
| 401/403/404 | 로그인 상태·현재 역할·활성 배정·본인 신청. 모의 성공으로 우회하지 않음 |
| 409 | 최신 상태를 다시 조회해 사용자 변경과 비교 |
| 502/504 | Back·모델 오류와 각 구간 대기 시간 |

수정 후 `npm run format`, `npm run check`, `npm run build`와 변경한 사용자 흐름을 확인한다. 검토 후 원본 태그를 만들고 통합 저장소 `front/` 스냅샷과 출처를 갱신한다. 양쪽 호스트의 main은 자동 동기화되지 않으므로 GitHub PR·GitLab MR 반영을 각각 확인한다.
