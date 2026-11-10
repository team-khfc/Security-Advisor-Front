import { FIELD_LABELS, type SecurityRequest } from './types';
import { pendingReviews, reviewFields } from './readiness';

/**
 * 내 차례가 아닐 때 담당자·관리자 목록에 보이는 진행 안내(시안의 상태 아래 회색 줄).
 * 현재 신청 상태와 검토·최종 확인 기록만 읽어 글자로 옮긴다.
 */
export function waitingLine(request: SecurityRequest) {
  const fields = request.listOverview?.fields;
  if (fields) {
    if (request.status === 'SUBMITTED') {
      const pending = fields.filter((field) => !field.confirmed);
      return pending.length ? `${FIELD_LABELS[pending[0].field]} 최종 확인 대기` : '서류 확정 대기';
    }
    if (request.status === 'CONSULTING')
      return fields
        .filter((field) => field.reviewStatus !== 'COMPLETED')
        .map(
          (field) =>
            `${FIELD_LABELS[field.field]} ${field.field === 'INFRA' && !field.allocated ? '통신 정보 할당 중' : '협의 중'}`,
        )
        .join(', ');
    if (request.status === 'FINAL_REVIEW')
      return fields.some((field) => field.reviewStatus !== 'COMPLETED')
        ? '담당자 재검토 대기'
        : '신청자 최종 제출 대기';
  }
  switch (request.status) {
    case 'DRAFT':
      return '신청자 작성 중';
    case 'SUPPLEMENT_REQUESTED':
      return '신청자 보완 답변 대기';
    case 'FINAL_REVIEW':
      return (request.requiredReviewFields || request.reviews.length) &&
        pendingReviews(request).length
        ? '담당자 재검토 대기'
        : '신청자 최종 제출 대기';
    case 'CONSULTING': {
      const infra = request.reviews.find((review) => review.field === 'INFRA');
      const security = request.reviews.find((review) => review.field === 'SECURITY');
      const parts: string[] = [];
      const required = reviewFields(request);
      if (required.includes('INFRA') && !infra?.allocationCompleted)
        parts.push(`${FIELD_LABELS.INFRA} 통신 정보 할당 중`);
      else if (required.includes('INFRA') && infra?.status !== 'COMPLETE')
        parts.push(`${FIELD_LABELS.INFRA} 협의 중`);
      if (
        required.includes('SECURITY') &&
        (!required.includes('INFRA') || infra?.allocationCompleted) &&
        security?.status !== 'COMPLETE'
      )
        parts.push(`${FIELD_LABELS.SECURITY} 검토 중`);
      return parts.join(', ');
    }
    case 'SUBMITTED': {
      const required = reviewFields(request);
      const pending = required.filter(
        (field) =>
          !request.finalConfirmations.some(
            (confirmation) =>
              confirmation.field === field &&
              confirmation.submissionId === request.currentSubmissionId,
          ),
      );
      return pending.length
        ? `${FIELD_LABELS[pending[0]]} 최종 확인 대기`
        : `${FIELD_LABELS[required.includes('SECURITY') ? 'SECURITY' : 'INFRA']} 서류 확정 대기`;
    }
    default:
      return '';
  }
}
