import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { loadApiRequestList } from '@/features/request/requestListApi';
import { useRequestList } from '@/features/request/useRequestList';
import { ApiError } from '@/lib/httpClient';
import type { Role, Session } from '@/lib/types';
import { createMockState, MOCK_MEMBERS } from '@/mocks/seed';

const controls = vi.hoisted(() => ({ session: undefined as Session | null | undefined }));

vi.mock('@/features/auth/useAuth', () => ({
  useSession: () => ({ data: controls.session }),
}));

// Back 12d89eda의 DTO·컨트롤러를 기준으로 한 합성 응답이다. 실제 Back 실행 검사가 아니다.
type ApiStatus = 'DRAFTING' | 'IN_REVIEW' | 'SUBMITTED' | 'CONFIRMED';
type Field = 'INFRA' | 'SECURITY';
type ApiReviewStatus = 'WAITING' | 'ALLOCATED' | 'IN_PROGRESS' | 'COMPLETED';
type Fixture = { body: unknown; status?: number };
type Routes = Map<string, Fixture>;

const CASE_CREATED_AT = '2026-11-01T01:00:00Z';
const REQUEST_CREATED_AT = '2026-11-08T02:30:00Z';
const clients: QueryClient[] = [];
const unexpectedRequests: string[] = [];

function liveSession(
  role: Role = 'APPLICANT',
  username = `synthetic-${role.toLowerCase()}`,
): Session {
  return {
    member: {
      id: username,
      username,
      displayName: '합성 시험 사용자',
      department: '',
      role,
      active: true,
    },
    expiresAt: null,
    mock: false,
  };
}

function summary(securityRequestId: number, stage = 1, status: ApiStatus = 'DRAFTING') {
  return {
    securityRequestId,
    docType: 'FIREWALL',
    stage,
    status,
    statusLabel: {
      DRAFTING: '작성 중',
      IN_REVIEW: '협의 중',
      SUBMITTED: '제출됨',
      CONFIRMED: '확정',
    }[status],
    revision: 0,
  };
}

function detail(request = summary(101), businessCaseId = 11) {
  return {
    ...request,
    businessCaseId,
    answers: [],
    createdAt: REQUEST_CREATED_AT,
    updatedAt: REQUEST_CREATED_AT,
  };
}

function caseItem(businessCaseId = 11, requests = [summary(101)]) {
  return {
    businessCaseId,
    title: `합성 사업 ${businessCaseId}`,
    department: '합성 업무부',
    progressSummary: `신청 ${requests.length}건`,
    requests,
    createdAt: CASE_CREATED_AT,
  };
}

function caseDetail(businessCaseId: number, requests: ReturnType<typeof summary>[]) {
  return {
    ...caseItem(businessCaseId, requests),
    applicantUsername: 'synthetic-applicant',
    summary: '실제 내부 정보를 포함하지 않는 합성 사업 개요',
    publicationId: 1,
    revision: 0,
    caseAnswers: [],
    updatedAt: REQUEST_CREATED_AT,
  };
}

function review(
  securityRequestId: number,
  field: Field,
  status: ApiReviewStatus = 'WAITING',
  allocated = false,
) {
  return {
    reviewId: securityRequestId * 10 + (field === 'INFRA' ? 1 : 2),
    securityRequestId,
    field,
    status,
    statusLabel: {
      WAITING: '검토 대기',
      ALLOCATED: '할당 완료',
      IN_PROGRESS: '검토 중',
      COMPLETED: '협의 완료',
    }[status],
    allocated,
    allocatedBy: allocated ? 'synthetic-infra' : null,
    allocatedAt: allocated ? REQUEST_CREATED_AT : null,
    checklist: {},
    opinion: null,
    completedBy: status === 'COMPLETED' ? `synthetic-${field.toLowerCase()}` : null,
    completedAt: status === 'COMPLETED' ? REQUEST_CREATED_AT : null,
    revision: 0,
  };
}

function assignment(securityRequestId: number, field: Field, active = true) {
  return {
    assignmentId: securityRequestId * 10 + (field === 'INFRA' ? 1 : 2),
    securityRequestId,
    field,
    assigneeUsername: `synthetic-${field.toLowerCase()}`,
    active,
    reason: null,
    assignedBy: 'synthetic-admin',
    assignedAt: REQUEST_CREATED_AT,
    deactivatedAt: active ? null : REQUEST_CREATED_AT,
  };
}

function submission(
  submissionId: number,
  securityRequestId: number,
  latest: boolean,
  sequenceNo: number,
) {
  return {
    submissionId,
    securityRequestId,
    sequenceNo,
    latest,
    submittedBy: 'synthetic-applicant',
    submittedAt: '2026-11-08T03:00:00Z',
  };
}

function confirmation(submissionId: number, securityRequestId: number, field: Field) {
  return {
    finalConfirmationId: submissionId * 10 + (field === 'INFRA' ? 1 : 2),
    submissionId,
    securityRequestId,
    field,
    opinion: '합성 제출본 확인',
    confirmedBy: `synthetic-${field.toLowerCase()}`,
    confirmedAt: '2026-11-08T04:00:00Z',
  };
}

function applicantPage(
  routes: Routes,
  cases: ReturnType<typeof caseItem>[],
  page = 0,
  totalElements = cases.length,
) {
  routes.set(`/api/business-cases?page=${page}&size=100`, {
    body: { content: cases, page, size: 100, totalElements },
  });
}

function requestRoutes(
  routes: Routes,
  request = detail(),
  metadata: Partial<
    Record<'assignments' | 'reviews' | 'deadlines' | 'stage-returns' | 'submissions', unknown>
  > = {},
) {
  const base = `/api/security-requests/${request.securityRequestId}`;
  routes.set(base, { body: request });
  for (const name of ['assignments', 'reviews', 'deadlines', 'stage-returns'] as const) {
    routes.set(`${base}/${name}`, { body: metadata[name] ?? [] });
  }
  if (request.stage === 4) routes.set(`${base}/submissions`, { body: metadata.submissions ?? [] });
}

function staffRoutes(role: Field, request = summary(101, 2, 'IN_REVIEW')) {
  const routes: Routes = new Map();
  const sibling = { ...summary(102), docType: 'SECURITY_REVIEW' };
  const ownReview = review(
    request.securityRequestId,
    role,
    role === 'INFRA' ? 'ALLOCATED' : 'WAITING',
    role === 'INFRA',
  );
  const inbox = {
    review: ownReview,
    request,
    businessCaseId: 11,
    caseTitle: '합성 사업 11',
    applicantUsername: 'synthetic-applicant',
    reviewDueDate: '2026-11-10',
    openSupplementCount: 0,
    siblingRequests: [sibling],
  };
  // 담당자 요청함은 페이지 객체가 아닌 배열이며 같은 신청이 중복될 수 있다.
  routes.set('/api/reviews', { body: [inbox, inbox] });
  routes.set('/api/business-cases/11', { body: caseDetail(11, [request, sibling]) });
  requestRoutes(routes, detail(request), {
    assignments: [
      assignment(request.securityRequestId, 'INFRA'),
      assignment(request.securityRequestId, 'SECURITY'),
    ],
    reviews: [
      review(request.securityRequestId, 'INFRA', 'ALLOCATED', true),
      review(request.securityRequestId, 'SECURITY'),
    ],
  });
  return routes;
}

function strictApi(routes: Routes) {
  const paths: string[] = [];
  const fetcher = vi.fn<typeof fetch>(async (input, options) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, 'http://localhost:3000');
    const path = `${url.pathname}${url.search}`;
    paths.push(path);
    const fixture = routes.get(path);
    if (!fixture || (options?.method ?? 'GET') !== 'GET') {
      unexpectedRequests.push(`${options?.method ?? 'GET'} ${path}`);
      throw new Error(`등록하지 않은 합성 API 요청: ${path}`);
    }
    return Response.json(fixture.body, { status: fixture.status ?? 200 });
  });
  vi.stubGlobal('fetch', fetcher);
  return { fetcher, paths };
}

function load(session = liveSession()) {
  return loadApiRequestList(session, new AbortController().signal);
}

function renderList() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  const hook = renderHook(() => useRequestList(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  return { ...hook, client };
}

beforeEach(() => {
  controls.session = undefined;
  unexpectedRequests.length = 0;
});

afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
  vi.unstubAllGlobals();
  expect(unexpectedRequests).toEqual([]);
});

test('신청자는 모든 사업 건 페이지의 하위 신청을 펼치고 상세의 실제 생성일과 revision 0을 읽는다', async () => {
  const routes: Routes = new Map();
  const cases = Array.from({ length: 101 }, (_, index) =>
    caseItem(index + 1, [summary(1000 + index)]),
  );
  cases[0].requests.push({ ...summary(2000), docType: 'SECURITY_REVIEW' });
  applicantPage(routes, cases.slice(0, 100), 0, 101);
  applicantPage(routes, cases.slice(100), 1, 101);
  for (const businessCase of cases) {
    for (const request of businessCase.requests)
      requestRoutes(routes, detail(request, businessCase.businessCaseId));
  }
  const { fetcher, paths } = strictApi(routes);

  const items = await load();

  expect(items).toHaveLength(102);
  expect(new Set(items.map((item) => item.id)).size).toBe(102);
  expect(items.find((item) => item.id === '1000')).toMatchObject({
    caseTitle: '합성 사업 1',
    department: '합성 업무부',
    ownerName: '합성 시험 사용자',
    status: 'DRAFT',
    stage: 1,
    createdAt: REQUEST_CREATED_AT,
    nextAction: '인터뷰 이어서 작성',
  });
  expect(items.find((item) => item.id === '2000')?.docType).toBe('SECURITY_REVIEW');
  expect(items.find((item) => item.id === '1100')?.caseTitle).toBe('합성 사업 101');
  expect(paths.filter((path) => path.startsWith('/api/business-cases?'))).toEqual([
    '/api/business-cases?page=0&size=100',
    '/api/business-cases?page=1&size=100',
  ]);
  expect(paths.some((path) => /^\/api\/security-requests(?:\?|$)/.test(path))).toBe(false);
  expect(
    fetcher.mock.calls.every(
      ([, options]) =>
        options?.credentials === 'same-origin' && options.signal instanceof AbortSignal,
    ),
  ).toBe(true);
});

test('실제 상태·협의·기한을 구분하고 4단계는 최신 제출본의 최종 확인만 읽는다', async () => {
  const routes: Routes = new Map();
  const requests = [summary(101), summary(102, 2, 'IN_REVIEW'), summary(103, 4, 'CONFIRMED')];
  // 사업 건 요약이 갱신되기 전이어도 상세 응답의 단계·상태가 현재 표시를 결정한다.
  applicantPage(routes, [caseItem(11, [summary(101), summary(102), summary(103)])]);
  requestRoutes(routes, detail(requests[0]));
  requestRoutes(routes, detail(requests[1]), {
    assignments: [assignment(102, 'INFRA'), assignment(102, 'SECURITY')],
    reviews: [review(102, 'INFRA', 'ALLOCATED', true), review(102, 'SECURITY')],
    deadlines: [
      {
        deadlineId: 2001,
        securityRequestId: 102,
        field: 'SECURITY',
        kind: 'REVIEW',
        startedAt: REQUEST_CREATED_AT,
        dueDate: '2026-11-10',
        policyVersion: 1,
        active: true,
        endedAt: null,
        status: 'IMMINENT',
        statusLabel: '기한 임박',
        paused: false,
        remainingBusinessDays: null,
      },
      {
        deadlineId: 2002,
        securityRequestId: 102,
        field: 'INFRA',
        kind: 'REVIEW',
        startedAt: REQUEST_CREATED_AT,
        dueDate: '2026-11-11',
        policyVersion: 1,
        active: false,
        endedAt: '2026-11-08T03:00:00Z',
        status: 'ENDED',
        statusLabel: '종료',
        paused: true,
        remainingBusinessDays: 2,
      },
    ],
  });
  requestRoutes(routes, detail(requests[2]), {
    assignments: [assignment(103, 'INFRA'), assignment(103, 'SECURITY')],
    reviews: [review(103, 'INFRA', 'COMPLETED', true), review(103, 'SECURITY', 'COMPLETED')],
    submissions: [submission(5001, 103, false, 1), submission(5002, 103, true, 2)],
  });
  routes.set('/api/submissions/5002/final-confirmations', {
    body: [confirmation(5002, 103, 'INFRA'), confirmation(5002, 103, 'SECURITY')],
  });
  const { paths } = strictApi(routes);

  const items = await load();

  expect(items.map(({ id, status, stage }) => ({ id, status, stage }))).toEqual([
    { id: '101', status: 'DRAFT', stage: 1 },
    { id: '102', status: 'CONSULTING', stage: 2 },
    { id: '103', status: 'FINALIZED', stage: 4 },
  ]);
  expect(items[1].reviews).toEqual([
    { field: 'INFRA', status: 'ALLOCATED', allocationCompleted: true },
    { field: 'SECURITY', status: 'PENDING', allocationCompleted: false },
  ]);
  expect(items[1].reviews.some((item) => item.status === 'COMPLETE')).toBe(false);
  expect(items[1].assignments).toEqual([
    { field: 'INFRA', assigneeName: 'synthetic-infra', active: true },
    { field: 'SECURITY', assigneeName: 'synthetic-security', active: true },
  ]);
  expect(items[1].deadlines).toEqual([
    { field: 'SECURITY', dueAt: '2026-11-10', active: true, timing: 'DUE_SOON', paused: false },
    { field: 'INFRA', dueAt: '2026-11-11', active: false, timing: 'CLOSED', paused: true },
  ]);
  expect(items[2]).toMatchObject({ currentSubmissionId: '5002', nextAction: null });
  expect(items[2].finalConfirmations).toEqual([
    { field: 'INFRA', submissionId: '5002' },
    { field: 'SECURITY', submissionId: '5002' },
  ]);
  expect(paths).not.toContain('/api/submissions/5001/final-confirmations');
});

test.each(['INFRA', 'SECURITY'] as const)(
  '%s 요청함은 배열에서 신청을 중복 제거하고 형제 신청으로 조회 범위를 넓히지 않는다',
  async (role) => {
    const { paths } = strictApi(staffRoutes(role));

    const items = await load(liveSession(role));

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: '101',
      caseTitle: '합성 사업 11',
      department: '합성 업무부',
      ownerName: 'synthetic-applicant',
      nextAction: '담당 분야 협의',
    });
    expect(paths.filter((path) => path === '/api/business-cases/11')).toHaveLength(1);
    expect(paths.filter((path) => path === '/api/security-requests/101')).toHaveLength(1);
    expect(paths.some((path) => path.startsWith('/api/security-requests/102'))).toBe(false);
    expect(paths.some((path) => path.startsWith('/api/business-cases?'))).toBe(false);
  },
);

test('정보보안의 협의 안내는 ICT인프라의 실제 할당 완료 전에는 나타나지 않는다', async () => {
  const routes = staffRoutes('SECURITY');
  routes.set('/api/security-requests/101/reviews', {
    body: [review(101, 'INFRA'), review(101, 'SECURITY')],
  });
  strictApi(routes);

  expect((await load(liveSession('SECURITY')))[0].nextAction).toBeNull();
});

test.each([
  [[], null],
  [['INFRA'], '제출본 최종 확인'],
  [['INFRA', 'SECURITY'], '서류 확정'],
] as const)(
  '정보보안의 4단계 안내는 현재 제출본의 최종 확인 %j를 기준으로 표시한다',
  async (fields, expected) => {
    const request = summary(101, 4, 'SUBMITTED');
    const routes = staffRoutes('SECURITY', request);
    requestRoutes(routes, detail(request), {
      assignments: [assignment(101, 'INFRA'), assignment(101, 'SECURITY')],
      reviews: [review(101, 'INFRA', 'COMPLETED', true), review(101, 'SECURITY', 'COMPLETED')],
      submissions: [submission(5001, 101, true, 1)],
    });
    routes.set('/api/submissions/5001/final-confirmations', {
      body: fields.map((field) => confirmation(5001, 101, field)),
    });
    strictApi(routes);

    expect((await load(liveSession('SECURITY')))[0].nextAction).toBe(expected);
  },
);

test.each([
  ['assignments', 404],
  ['reviews', 403],
  ['deadlines', 503],
  ['stage-returns', 503],
] as const)(
  '%s 메타데이터의 HTTP %s 실패를 빈 목록 성공으로 숨기지 않는다',
  async (resource, status) => {
    const routes: Routes = new Map();
    applicantPage(routes, [caseItem()]);
    requestRoutes(routes);
    routes.set(`/api/security-requests/101/${resource}`, {
      status,
      body: {
        type: 'about:blank',
        title: '합성 조회 실패',
        status,
        code: 'SYNTHETIC_API_FAILURE',
        detail: '합성 조회 실패를 그대로 전달합니다.',
      },
    });
    strictApi(routes);

    await expect(load()).rejects.toMatchObject({ status, code: 'SYNTHETIC_API_FAILURE' });
  },
);

test('최종 확인 API 실패도 제출됨 목록으로 조용히 대체하지 않는다', async () => {
  const request = summary(101, 4, 'SUBMITTED');
  const routes: Routes = new Map();
  applicantPage(routes, [caseItem(11, [request])]);
  requestRoutes(routes, detail(request), { submissions: [submission(5001, 101, true, 1)] });
  routes.set('/api/submissions/5001/final-confirmations', {
    status: 403,
    body: { status: 403, code: 'FORBIDDEN', detail: '합성 최종 확인 조회 거부' },
  });
  strictApi(routes);

  await expect(load()).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
});

test('계약에 맞지 않는 메타데이터는 담당자가 없는 정상 목록으로 바꾸지 않는다', async () => {
  const routes: Routes = new Map();
  applicantPage(routes, [caseItem()]);
  requestRoutes(routes);
  routes.set('/api/security-requests/101/assignments', { body: { content: [] } });
  strictApi(routes);

  await expect(load()).rejects.toMatchObject({
    status: 502,
    code: 'REQUEST_LIST_CONTRACT_MISMATCH',
  });
});

test.each(['APPLICANT', 'INFRA', 'SECURITY'] as const)(
  '%s의 실제 빈 조회 결과는 성공한 빈 목록으로 반환한다',
  async (role) => {
    const routes: Routes = new Map();
    if (role === 'APPLICANT') applicantPage(routes, []);
    else routes.set('/api/reviews', { body: [] });
    strictApi(routes);

    await expect(load(liveSession(role))).resolves.toEqual([]);
  },
);

test('세션이 아직 없거나 미인증이면 조회하지 않고 확인된 실제 세션으로만 목록을 읽는다', async () => {
  const routes: Routes = new Map();
  applicantPage(routes, []);
  const { fetcher } = strictApi(routes);
  const { result, rerender } = renderList();
  expect(result.current.fetchStatus).toBe('idle');
  expect(fetcher).not.toHaveBeenCalled();

  controls.session = null;
  rerender();
  expect(result.current.fetchStatus).toBe('idle');
  expect(fetcher).not.toHaveBeenCalled();

  controls.session = liveSession();
  rerender();
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(result.current.data).toEqual([]);
});

test('실제 ADMIN 목록 미지원은 명시적으로 표시하고 신청자나 담당자 API를 대신 조회하지 않는다', async () => {
  controls.session = liveSession('ADMIN');
  const { fetcher } = strictApi(new Map());
  const { result } = renderList();

  expect(result.current.unavailable).toBe(true);
  expect(result.current.fetchStatus).toBe('idle');
  expect(result.current.data).toBeUndefined();
  expect(fetcher).not.toHaveBeenCalled();
  await expect(load(controls.session)).rejects.toBeInstanceOf(ApiError);
  expect(fetcher).not.toHaveBeenCalled();
});

test('기존 모의 상세 목록도 마지막 페이지까지 읽고 표시 정보와 다음 업무를 보존한다', async () => {
  const member = MOCK_MEMBERS[0];
  controls.session = { member, mock: true, expiresAt: null };
  const source = createMockState().requests.find(
    (request) => request.ownerId === member.id && request.status === 'DRAFT',
  )!;
  const requests = Array.from({ length: 101 }, (_, index) => ({
    ...source,
    id: `synthetic-mock-${index}`,
  }));
  const routes: Routes = new Map([
    [
      '/api/security-requests?page=0&size=100',
      { body: { content: requests.slice(0, 100), page: 0, size: 100, totalElements: 101 } },
    ],
    [
      '/api/security-requests?page=1&size=100',
      { body: { content: requests.slice(100), page: 1, size: 100, totalElements: 101 } },
    ],
  ]);
  const { paths } = strictApi(routes);
  const { result } = renderList();

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toHaveLength(101);
  expect(result.current.data?.at(-1)).toMatchObject({
    id: 'synthetic-mock-100',
    caseTitle: source.caseTitle,
    status: 'DRAFT',
    createdAt: source.createdAt,
    nextAction: '인터뷰 이어서 작성',
  });
  expect(paths).toEqual([
    '/api/security-requests?page=0&size=100',
    '/api/security-requests?page=1&size=100',
  ]);
});

test('계정·역할·실행 모드가 바뀌면 이전 목록 캐시를 재사용하지 않는다', async () => {
  const routes: Routes = new Map();
  applicantPage(routes, []);
  routes.set('/api/reviews', { body: [] });
  routes.set('/api/security-requests?page=0&size=100', {
    body: { content: [], page: 0, size: 100, totalElements: 0 },
  });
  const { paths } = strictApi(routes);
  controls.session = liveSession('APPLICANT', 'synthetic-first');
  const { result, rerender, client } = renderList();
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  await act(async () => {
    controls.session = liveSession('APPLICANT', 'synthetic-second');
    rerender();
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  await act(async () => {
    controls.session = liveSession('INFRA', 'synthetic-second');
    rerender();
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  await act(async () => {
    controls.session = { ...liveSession('INFRA', 'synthetic-second'), mock: true };
    rerender();
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(paths).toEqual([
    '/api/business-cases?page=0&size=100',
    '/api/business-cases?page=0&size=100',
    '/api/reviews',
    '/api/security-requests?page=0&size=100',
  ]);
  expect(client.getQueryCache().findAll({ queryKey: ['requests', 'list'] })).toHaveLength(4);
  expect(client.getQueryData(['requests', 'list', 'api', 'synthetic-first', 'APPLICANT'])).toEqual(
    [],
  );
  expect(client.getQueryData(['requests', 'list', 'mock', 'synthetic-second', 'INFRA'])).toEqual(
    [],
  );
});
