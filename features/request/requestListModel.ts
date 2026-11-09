import type { Actor } from '@/lib/types';
import type {
  Assignment,
  Deadline,
  DocumentType,
  RequestStatus,
  Review,
  SecurityRequest,
  Stage,
} from './types';

/** 목록 표시에 필요한 조회 결과만 담으며 상세 답변이나 실행 권한을 만들어 채우지 않는다. */
export interface RequestListItem {
  id: string;
  caseTitle: string;
  department: string;
  ownerName: string;
  docType: DocumentType;
  stage: Stage;
  status: RequestStatus;
  createdAt: string;
  assignments: Pick<Assignment, 'field' | 'assigneeName' | 'active'>[];
  reviews: Pick<Review, 'field' | 'status' | 'allocationCompleted'>[];
  deadlines: (Pick<Deadline, 'field' | 'dueAt' | 'active' | 'timing'> & { paused?: boolean })[];
  finalConfirmations: Pick<
    SecurityRequest['finalConfirmations'][number],
    'field' | 'submissionId'
  >[];
  currentSubmissionId: string | null;
  returnNotice: string | null;
  // 목록에서 보여 주는 다음 업무 안내이며 수정 API의 허용 여부는 서버가 판단한다.
  nextAction: string | null;
}

function mockNextAction(request: SecurityRequest, actor: Actor): string | null {
  if (['FINALIZED', 'CLOSED', 'WITHDRAWN'].includes(request.status)) return null;
  if (actor.role === 'APPLICANT') {
    if (request.ownerId !== actor.id) return null;
    if (request.status === 'DRAFT') return '인터뷰 이어서 작성';
    if (request.status === 'SUPPLEMENT_REQUESTED') return '보완 답변 등록';
    if (request.status === 'FINAL_REVIEW') return '최종 초안 확인·제출';
    return null;
  }
  if (actor.role === 'ADMIN') {
    return request.stage >= 2 &&
      ['INFRA', 'SECURITY'].some(
        (field) =>
          !request.assignments.some(
            (assignment) => assignment.active && assignment.field === field,
          ),
      )
      ? '담당자 배정 확인'
      : null;
  }
  const actions = request.allowedActions;
  if (actions.includes('FINALIZE')) return '서류 확정';
  if (actions.includes('FINAL_CONFIRM')) return '제출본 최종 확인';
  if (actions.includes('COMPLETE_ALLOCATION')) return '통신 정보 할당';
  if (actions.includes('RESOLVE_SUPPLEMENT')) return '보완 답변 재검토';
  return actions.includes('COMPLETE_REVIEW') ? '담당 분야 협의' : null;
}

/** 기존 모의 서버의 상세 응답도 같은 목록 표시 모델로 변환한다. */
export function toMockRequestListItem(request: SecurityRequest, actor: Actor): RequestListItem {
  return {
    id: request.id,
    caseTitle: request.caseTitle,
    department: request.department,
    ownerName: request.ownerName,
    docType: request.docType,
    stage: request.stage,
    status: request.status,
    createdAt: request.createdAt,
    assignments: request.assignments,
    reviews: request.reviews,
    deadlines: request.deadlines,
    finalConfirmations: request.finalConfirmations,
    currentSubmissionId: request.currentSubmissionId,
    returnNotice:
      request.returns.length > 0 && request.highlightedFields.length > 0
        ? '반환됨 · 보완 항목 확인'
        : null,
    nextAction: mockNextAction(request, actor),
  };
}
