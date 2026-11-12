import { describe, expect, it } from 'vitest';
import { matchesFieldCondition } from '@/lib/fieldCondition';
import { securityReviewQuestions } from '@/features/configuration/securityReviewQuestions';
import { questionSchema } from '@/features/configuration/types';

describe('보안성검토 사업 조건', () => {
  it('미입력·미해당은 예로 추정하지 않고 확인된 값에 맞춰 질문을 선택한다', () => {
    const condition = { fieldKey: 'data.personal_info', expectedValue: true };
    expect(matchesFieldCondition(condition, [])).toBe(false);
    expect(matchesFieldCondition(condition, [{ key: condition.fieldKey, value: '미해당' }])).toBe(
      false,
    );
    expect(matchesFieldCondition(condition, [{ key: condition.fieldKey, value: 'false' }])).toBe(
      false,
    );
    expect(matchesFieldCondition(condition, [{ key: condition.fieldKey, value: '예' }])).toBe(true);
    expect(matchesFieldCondition(null, [])).toBe(true);
  });
  it('추가 질문은 보안성검토에만 적용되며 조건과 담당 역할이 게시 계약에 보존된다', () => {
    const parsed = securityReviewQuestions.map((question) => questionSchema.parse(question));
    expect(parsed.every((question) => question.docTypes.join() === 'SECURITY_REVIEW')).toBe(true);
    expect(
      parsed.find((question) => question.key === 'security.privacy_controls')?.condition,
    ).toEqual({ fieldKey: 'data.personal_info', expectedValue: true });
    expect(parsed.find((question) => question.key === 'security.recovery')?.askRole).toBe('INFRA');
  });
});
