import { z } from 'zod';

export const fieldConditionSchema = z.object({ fieldKey: z.string(), expectedValue: z.boolean() });

/** 서버와 같은 사업 조건을 사용한다. 미입력 조건은 해당으로 추정하지 않는다. */
export function matchesFieldCondition(
  condition: z.infer<typeof fieldConditionSchema> | null | undefined,
  values: { key: string; value: string }[],
) {
  if (!condition) return true;
  const value = values.find((answer) => answer.key === condition.fieldKey)?.value;
  return condition.expectedValue
    ? value === 'true' || value === '예'
    : value === 'false' || value === '아니요';
}
