import { z } from 'zod';
import { ApiError, requestJson } from '@/lib/httpClient';
import type { Session } from '@/lib/types';
import type { RequestListItem } from './requestListModel';
import {
  documentTypeSchema,
  reviewFieldSchema,
  stageSchema,
  type DocumentType,
  type RequestStatus,
  type Review,
  type Deadline,
} from './types';

const PAGE_SIZE = 100;
const REQUEST_CONCURRENCY = 4;
const identifier = z.number().int().positive().refine(Number.isSafeInteger);
const revision = z.number().int().nonnegative().refine(Number.isSafeInteger);
const instant = z.string().datetime({ offset: true });
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  });
const requestStatus = z.enum([
  'DRAFTING',
  'IN_REVIEW',
  'SUPPLEMENT_REQUESTED',
  'FINAL_REVIEW',
  'SUBMITTED',
  'CONFIRMED',
  'CLOSED',
  'WITHDRAWN',
]);
const reviewStatus = z.enum([
  'WAITING',
  'ALLOCATED',
  'IN_PROGRESS',
  'SUPPLEMENT_REQUESTED',
  'COMPLETED',
  'RECHECK',
]);
const deadlineStatus = z.enum(['ON_TRACK', 'IMMINENT', 'OVERDUE', 'ENDED']);

const requestShape = {
  securityRequestId: identifier,
  docType: documentTypeSchema,
  stage: stageSchema,
  status: requestStatus,
  revision,
};
const summarySchema = z.object(requestShape);
const requestSchema = z.object({
  ...requestShape,
  businessCaseId: identifier,
  createdAt: instant,
  updatedAt: instant,
});
const caseListSchema = z.object({
  businessCaseId: identifier,
  title: z.string(),
  department: z.string().nullable(),
  requests: z.array(summarySchema),
  createdAt: instant,
});
const casePageSchema = z.object({
  content: z.array(caseListSchema),
  page: revision,
  size: z.number().int().min(1).max(PAGE_SIZE),
  totalElements: revision,
});
const caseSchema = z.object({
  businessCaseId: identifier,
  title: z.string(),
  department: z.string().nullable(),
  applicantUsername: z.string().min(1),
});
const assignmentSchema = z.object({
  assignmentId: identifier,
  securityRequestId: identifier,
  field: reviewFieldSchema,
  assigneeUsername: z.string().min(1),
  active: z.boolean(),
});
const reviewSchema = z.object({
  reviewId: identifier,
  securityRequestId: identifier,
  field: reviewFieldSchema,
  status: reviewStatus,
  allocated: z.boolean(),
  revision,
});
const inboxSchema = z.array(
  z.object({
    review: reviewSchema,
    request: summarySchema,
    businessCaseId: identifier,
    caseTitle: z.string(),
    applicantUsername: z.string().min(1),
    reviewDueDate: date.nullable(),
    openSupplementCount: revision,
    siblingRequests: z.array(summarySchema),
  }),
);
const deadlineSchema = z.object({
  deadlineId: identifier,
  securityRequestId: identifier,
  field: reviewFieldSchema.nullable(),
  kind: z.enum(['REVIEW', 'SUPPLEMENT_RESPONSE', 'FINAL_CONFIRMATION']),
  dueDate: date,
  active: z.boolean(),
  status: deadlineStatus,
  paused: z.boolean(),
});
const returnSchema = z.object({
  stageReturnId: identifier,
  securityRequestId: identifier,
  fromStage: stageSchema,
  toStage: stageSchema,
  returnedAt: instant,
});
const submissionSchema = z.object({
  submissionId: identifier,
  securityRequestId: identifier,
  sequenceNo: identifier,
  latest: z.boolean(),
  submittedAt: instant,
});
const confirmationSchema = z.object({
  finalConfirmationId: identifier,
  submissionId: identifier,
  securityRequestId: identifier,
  field: reviewFieldSchema,
  confirmedAt: instant,
});

type ApiRequest = z.infer<typeof requestSchema>;
type ApiCase = z.infer<typeof caseSchema>;
type ApiAssignment = z.infer<typeof assignmentSchema>;
type ApiReview = z.infer<typeof reviewSchema>;
type ApiConfirmation = z.infer<typeof confirmationSchema>;
type RequestSeed = {
  id: number;
  businessCaseId: number;
  docType: DocumentType;
  caseTitle: string;
  applicantUsername: string;
  department?: string | null;
};

const statusMap: Record<z.infer<typeof requestStatus>, RequestStatus> = {
  DRAFTING: 'DRAFT',
  IN_REVIEW: 'CONSULTING',
  SUPPLEMENT_REQUESTED: 'SUPPLEMENT_REQUESTED',
  FINAL_REVIEW: 'FINAL_REVIEW',
  SUBMITTED: 'SUBMITTED',
  CONFIRMED: 'FINALIZED',
  CLOSED: 'CLOSED',
  WITHDRAWN: 'WITHDRAWN',
};
const reviewStatusMap: Record<z.infer<typeof reviewStatus>, Review['status']> = {
  WAITING: 'PENDING',
  ALLOCATED: 'ALLOCATED',
  IN_PROGRESS: 'IN_REVIEW',
  SUPPLEMENT_REQUESTED: 'SUPPLEMENT_REQUESTED',
  COMPLETED: 'COMPLETE',
  RECHECK: 'RECHECK',
};
const deadlineStatusMap: Record<z.infer<typeof deadlineStatus>, Deadline['timing']> = {
  ON_TRACK: 'WITHIN',
  IMMINENT: 'DUE_SOON',
  OVERDUE: 'OVERDUE',
  ENDED: 'CLOSED',
};

function contractError(detail: string): ApiError {
  return new ApiError({
    type: 'about:blank',
    title: '신청 목록 응답 확인 필요',
    status: 502,
    code: 'REQUEST_LIST_CONTRACT_MISMATCH',
    detail,
  });
}

/** 읽은 자료만 검증하며, HTTP 오류나 취소를 빈 목록으로 바꾸지 않는다. */
async function readApi<T>(path: string, schema: z.ZodType<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  const response = await requestJson<unknown>(path, { signal });
  signal.throwIfAborted();
  const parsed = schema.safeParse(response);
  if (!parsed.success) {
    throw contractError('서버의 신청 목록 응답 형식을 확인할 수 없습니다. 다시 불러와 주세요.');
  }
  return parsed.data;
}

function checkStage(request: z.infer<typeof summarySchema>): void {
  const allowedStages: Record<z.infer<typeof requestStatus>, readonly number[]> = {
    DRAFTING: [1],
    IN_REVIEW: [2],
    SUPPLEMENT_REQUESTED: [2, 3],
    FINAL_REVIEW: [3],
    SUBMITTED: [4],
    CONFIRMED: [4],
    CLOSED: [1, 2, 3, 4],
    WITHDRAWN: [1, 2, 3, 4],
  };
  if (!allowedStages[request.status].includes(request.stage)) {
    throw contractError('신청 단계와 상태가 일치하지 않습니다. 다시 불러와 주세요.');
  }
}

function addSeed(seeds: Map<number, RequestSeed>, seed: RequestSeed): void {
  const previous = seeds.get(seed.id);
  if (
    previous &&
    (previous.businessCaseId !== seed.businessCaseId || previous.docType !== seed.docType)
  ) {
    throw contractError('같은 신청의 사업 건 또는 서류 정보가 일치하지 않습니다.');
  }
  if (!previous) seeds.set(seed.id, seed);
}

async function applicantSeeds(session: Session, signal: AbortSignal): Promise<RequestSeed[]> {
  const seeds = new Map<number, RequestSeed>();
  let page = 0;
  let size = PAGE_SIZE;
  let total: number | undefined;
  while (true) {
    const response = await readApi(
      `/api/business-cases?page=${page}&size=${size}`,
      casePageSchema,
      signal,
    );
    if (
      response.page !== page ||
      (page > 0 && response.size !== size) ||
      response.content.length > response.size
    ) {
      throw contractError('사업 건 목록의 페이지 정보가 일치하지 않습니다.');
    }
    if (total !== undefined && total !== response.totalElements) {
      throw contractError('조회 중 사업 건 수가 변경되었습니다. 목록을 다시 불러와 주세요.');
    }
    total = response.totalElements;
    size = response.size;
    const offset = page * size;
    const end = offset + response.content.length;
    if (
      !Number.isSafeInteger(end) ||
      end > total ||
      (response.content.length < size && end < total)
    ) {
      throw contractError('사업 건 목록의 전체 건수와 페이지 내용이 일치하지 않습니다.');
    }
    for (const businessCase of response.content) {
      for (const request of businessCase.requests) {
        checkStage(request);
        addSeed(seeds, {
          id: request.securityRequestId,
          businessCaseId: businessCase.businessCaseId,
          docType: request.docType,
          caseTitle: businessCase.title,
          department: businessCase.department,
          applicantUsername: session.member.username,
        });
      }
    }
    if (end >= total) return [...seeds.values()];
    page += 1;
  }
}

async function reviewerSeeds(signal: AbortSignal): Promise<RequestSeed[]> {
  const inbox = await readApi('/api/reviews', inboxSchema, signal);
  const seeds = new Map<number, RequestSeed>();
  for (const item of inbox) {
    checkStage(item.request);
    if (item.review.securityRequestId !== item.request.securityRequestId) {
      throw contractError('요청함의 협의와 신청 정보가 일치하지 않습니다.');
    }
    // siblingRequests는 배정되지 않은 형제 신청도 포함하므로 목록 범위를 넓히지 않는다.
    addSeed(seeds, {
      id: item.request.securityRequestId,
      businessCaseId: item.businessCaseId,
      docType: item.request.docType,
      caseTitle: item.caseTitle,
      applicantUsername: item.applicantUsername,
    });
  }
  return [...seeds.values()];
}

function checkRequestIds(id: number, records: readonly { securityRequestId: number }[]): void {
  if (records.some((record) => record.securityRequestId !== id)) {
    throw contractError('신청과 관련 기록의 식별자가 일치하지 않습니다.');
  }
}

/** 목록 안내용 문구다. 실제 행위의 권한·상태 전이는 서버가 판단한다. */
function nextAction(
  session: Session,
  request: ApiRequest,
  assignments: ApiAssignment[],
  reviews: ApiReview[],
  confirmations: ApiConfirmation[],
): string | null {
  if (['CONFIRMED', 'CLOSED', 'WITHDRAWN'].includes(request.status)) return null;
  if (session.member.role === 'APPLICANT') {
    if (request.status === 'DRAFTING') return '인터뷰 이어서 작성';
    if (request.status === 'SUPPLEMENT_REQUESTED') return '보완 답변 등록';
    if (request.status === 'FINAL_REVIEW') return '최종 초안 확인·제출';
    return null;
  }
  const role = session.member.role;
  const assigned = assignments.some(
    (assignment) =>
      assignment.active &&
      assignment.field === role &&
      assignment.assigneeUsername === session.member.username,
  );
  const review = reviews.find((item) => item.field === role);
  if (!assigned || !review) return null;
  const infra = reviews.find((item) => item.field === 'INFRA');
  if (request.stage === 2) {
    if (['COMPLETED', 'SUPPLEMENT_REQUESTED'].includes(review.status)) return null;
    if (role === 'SECURITY' && infra && !infra.allocated) return null;
    if (role === 'INFRA' && !review.allocated) return '통신 정보 할당';
    return review.status === 'RECHECK' ? '담당 분야 재검토' : '담당 분야 협의';
  }
  if (request.status === 'SUBMITTED') {
    const confirmed = new Set(confirmations.map((item) => item.field));
    if (role === 'SECURITY' && infra && !confirmed.has('INFRA')) return null;
    if (!confirmed.has(review.field)) return '제출본 최종 확인';
    const confirmingField = reviews.some((item) => item.field === 'SECURITY')
      ? 'SECURITY'
      : 'INFRA';
    if (role === confirmingField && reviews.every((item) => confirmed.has(item.field))) {
      return '서류 확정';
    }
  }
  return null;
}

async function loadRequest(
  seed: RequestSeed,
  session: Session,
  signal: AbortSignal,
  getCase: (id: number) => Promise<ApiCase>,
): Promise<RequestListItem> {
  const path = `/api/security-requests/${seed.id}`;
  const businessCase =
    session.member.role === 'APPLICANT'
      ? Promise.resolve({
          businessCaseId: seed.businessCaseId,
          title: seed.caseTitle,
          department: seed.department ?? null,
          applicantUsername: seed.applicantUsername,
        })
      : getCase(seed.businessCaseId);
  const [request, assignments, reviews, deadlines, returns, caseInfo] = await Promise.all([
    readApi(path, requestSchema, signal),
    readApi(`${path}/assignments`, z.array(assignmentSchema), signal),
    readApi(`${path}/reviews`, z.array(reviewSchema), signal),
    readApi(`${path}/deadlines`, z.array(deadlineSchema), signal),
    readApi(`${path}/stage-returns`, z.array(returnSchema), signal),
    businessCase,
  ]);
  checkStage(request);
  if (
    request.securityRequestId !== seed.id ||
    request.businessCaseId !== seed.businessCaseId ||
    request.docType !== seed.docType ||
    caseInfo.businessCaseId !== seed.businessCaseId ||
    caseInfo.applicantUsername !== seed.applicantUsername
  ) {
    throw contractError('목록과 상세의 신청 또는 사업 건 정보가 일치하지 않습니다.');
  }
  checkRequestIds(seed.id, [...assignments, ...reviews, ...deadlines, ...returns]);

  let currentSubmissionId: string | null = null;
  let finalConfirmations: ApiConfirmation[] = [];
  if (request.stage === 4) {
    const submissions = await readApi(`${path}/submissions`, z.array(submissionSchema), signal);
    checkRequestIds(seed.id, submissions);
    const latest = submissions.filter((submission) => submission.latest);
    if (latest.length !== 1) {
      throw contractError('4단계 신청의 최신 제출본을 확인할 수 없습니다.');
    }
    currentSubmissionId = String(latest[0].submissionId);
    finalConfirmations = await readApi(
      `/api/submissions/${currentSubmissionId}/final-confirmations`,
      z.array(confirmationSchema),
      signal,
    );
    checkRequestIds(seed.id, finalConfirmations);
    if (finalConfirmations.some((item) => item.submissionId !== latest[0].submissionId)) {
      throw contractError('최신 제출본과 최종 확인 기록이 일치하지 않습니다.');
    }
  }
  signal.throwIfAborted();
  return {
    id: String(request.securityRequestId),
    caseTitle: caseInfo.title,
    department: caseInfo.department?.trim() || '부서 미입력',
    ownerName:
      session.member.role === 'APPLICANT' ? session.member.displayName : caseInfo.applicantUsername,
    docType: request.docType,
    stage: request.stage,
    status: statusMap[request.status],
    createdAt: request.createdAt,
    assignments: assignments.map((assignment) => ({
      field: assignment.field,
      assigneeName: assignment.assigneeUsername,
      active: assignment.active,
    })),
    reviews: reviews.map((review) => ({
      field: review.field,
      status: reviewStatusMap[review.status],
      allocationCompleted: review.allocated,
    })),
    deadlines: deadlines.map((deadline) => ({
      field: deadline.field,
      dueAt: deadline.dueDate,
      active: deadline.active,
      timing: deadlineStatusMap[deadline.status],
      paused: deadline.paused,
    })),
    finalConfirmations: finalConfirmations.map((confirmation) => ({
      field: confirmation.field,
      submissionId: String(confirmation.submissionId),
    })),
    currentSubmissionId,
    returnNotice: returns.length > 0 ? '반환 이력 있음' : null,
    nextAction: nextAction(session, request, assignments, reviews, finalConfirmations),
  };
}

/** Back 12d89eda 계약: 내 사업 건 또는 내 협의 요청함에서 목록을 조합한다. */
export async function loadApiRequestList(
  session: Session,
  signal: AbortSignal,
): Promise<RequestListItem[]> {
  signal.throwIfAborted();
  if (session.member.role === 'ADMIN') {
    throw new ApiError({
      type: 'about:blank',
      title: '기관 관리자 신청 목록 미지원',
      status: 501,
      code: 'REQUEST_LIST_NOT_SUPPORTED',
      detail: '현재 서버는 기관 관리자용 전체 신청 목록을 제공하지 않습니다.',
    });
  }
  const seeds =
    session.member.role === 'APPLICANT'
      ? await applicantSeeds(session, signal)
      : await reviewerSeeds(signal);
  const cases = new Map<number, Promise<ApiCase>>();
  const getCase = (id: number): Promise<ApiCase> => {
    let pending = cases.get(id);
    if (!pending) {
      pending = readApi(`/api/business-cases/${id}`, caseSchema, signal);
      cases.set(id, pending);
    }
    return pending;
  };
  const result: RequestListItem[] = new Array(seeds.length);
  let cursor = 0;
  let stopped = false;
  const worker = async () => {
    while (!stopped && cursor < seeds.length) {
      signal.throwIfAborted();
      const index = cursor++;
      try {
        result[index] = await loadRequest(seeds[index], session, signal, getCase);
      } catch (error) {
        stopped = true;
        throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(REQUEST_CONCURRENCY, seeds.length) }, worker));
  signal.throwIfAborted();
  return result;
}
