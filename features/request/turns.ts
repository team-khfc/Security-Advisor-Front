import { FIELD_LABELS, type SecurityRequest } from './types';

/**
 * 내 차례가 아닐 때 담당자·관리자 목록에 보이는 진행 안내(시안의 상태 아래 회색 줄).
 * 현재 신청 상태와 검토·최종 확인 기록만 읽어 글자로 옮긴다.
 */
export function waitingLine(request: SecurityRequest) {
  switch (request.status) {
    case 'DRAFT':
      return '신청자 작성 중';
    case 'SUPPLEMENT_REQUESTED':
      return '신청자 보완 답변 대기';
    case 'FINAL_REVIEW':
      return '신청자 최종 제출 대기';
    case 'CONSULTING': {
      const infra = request.reviews.find((review) => review.field === 'INFRA');
      const security = request.reviews.find((review) => review.field === 'SECURITY');
      const parts: string[] = [];
      if (!infra?.allocationCompleted) parts.push(`${FIELD_LABELS.INFRA} 통신 정보 할당 중`);
      else if (infra.status !== 'COMPLETE') parts.push(`${FIELD_LABELS.INFRA} 협의 중`);
      if (infra?.allocationCompleted && security?.status !== 'COMPLETE')
        parts.push(`${FIELD_LABELS.SECURITY} 검토 중`);
      return parts.join(', ');
    }
    case 'SUBMITTED': {
      const pending = (['INFRA', 'SECURITY'] as const).filter(
        (field) =>
          !request.finalConfirmations.some(
            (confirmation) =>
              confirmation.field === field &&
              confirmation.submissionId === request.currentSubmissionId,
          ),
      );
      return pending.length
        ? pending.map((field) => `${FIELD_LABELS[field]} 최종 확인 중`).join(', ')
        : `${FIELD_LABELS.SECURITY} 서류 확정 대기`;
    }
    default:
      return '';
  }
}
