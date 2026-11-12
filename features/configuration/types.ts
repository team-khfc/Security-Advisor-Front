import { z } from 'zod';
import { fieldConditionSchema } from '@/lib/fieldCondition';

export const questionSchema = z.object({
  condition: fieldConditionSchema.nullish(),
  key: z.string(),
  label: z.string(),
  scope: z.enum(['CASE', 'REQUEST']),
  docTypes: z.array(z.string()),
  type: z.enum([
    'TEXT',
    'LONG_TEXT',
    'BOOLEAN',
    'DATE_RANGE',
    'NUMBER',
    'IP_ADDRESS',
    'PORT',
    'PROTOCOL',
  ]),
  required: z.boolean(),
  askRole: z.enum(['APPLICANT', 'INFRA', 'SECURITY']),
  hint: z.string().nullable(),
});
export const settingsSchema = z.object({
  deadlinePolicy: z.object({
    reviewBusinessDays: z.number(),
    supplementBusinessDays: z.number(),
    finalConfirmationBusinessDays: z.number(),
    imminentBusinessDays: z.number(),
    holidays: z.array(z.string()),
  }),
  docTypes: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      active: z.boolean(),
      templateKey: z.string(),
      generatesFirewallRules: z.boolean(),
      reviewFields: z.array(z.enum(['INFRA', 'SECURITY'])),
      sortOrder: z.number(),
      exportFormats: z.array(z.enum(['MARKDOWN', 'PDF', 'DOCX'])),
    }),
  ),
  fields: z.array(questionSchema),
});
export const configurationSchema = z.object({
  configurationId: z.number(),
  draft: settingsSchema,
  basedOnVersion: z.number(),
  currentPublishedVersion: z.number(),
  note: z.string().nullable(),
  updatedBy: z.string(),
  updatedAt: z.string(),
  revision: z.number(),
  builtInFields: z.array(questionSchema),
});
export const publicationSchema = z.object({
  publicationId: z.number(),
  version: z.number(),
  publishedAt: z.string(),
  fieldSchema: settingsSchema,
});
export const comparisonSchema = z.object({
  fromVersion: z.number(),
  toVersion: z.number().nullable(),
  revision: z.number().nullable(),
  changes: z.array(
    z.object({
      path: z.string(),
      label: z.string(),
      before: z.string(),
      after: z.string(),
      dataContractChange: z.boolean(),
    }),
  ),
});
export const historySchema = z.object({
  content: z.array(
    z.object({
      publicationId: z.number(),
      version: z.number(),
      publishedAt: z.string(),
      publishedBy: z.string().nullable(),
      note: z.string().nullable(),
      previousVersion: z.number().nullable(),
    }),
  ),
  page: z.number(),
  size: z.number(),
  totalElements: z.number(),
});
export type Question = z.infer<typeof questionSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Configuration = z.infer<typeof configurationSchema>;
export type Comparison = z.infer<typeof comparisonSchema>;
export type Publication = z.infer<typeof publicationSchema>;

export const roleLabels = { APPLICANT: '신청자', INFRA: 'ICT인프라', SECURITY: '정보보안' };
export const typeLabels = {
  TEXT: '단답형',
  LONG_TEXT: '장문형',
  BOOLEAN: '선택형(예·아니요)',
  DATE_RANGE: '기간',
  NUMBER: '숫자',
  IP_ADDRESS: 'IP 주소 / CIDR',
  PORT: '포트 / 범위',
  PROTOCOL: '프로토콜',
};

/** 비어 있는 입력도 보존하면서 전체 탭의 잘못된 값을 저장 전에 안내한다. 서버가 최종 검증한다. */
export function validateSettings(
  draft: Settings,
  note: string,
  existingKeys: string[] = [],
): string[] {
  const errors: string[] = [];
  if (!draft.docTypes.some((d) => d.active)) errors.push('활성 서류 유형이 하나 이상 필요합니다.');
  for (const doc of draft.docTypes) {
    if (!doc.name.trim() || doc.name.length > 200 || (doc.description?.length ?? 0) > 2000)
      errors.push('서류 이름은 1~200자, 설명은 2000자 이하로 입력해 주세요.');
    if (!doc.reviewFields.length || !doc.exportFormats.length)
      errors.push('검토 분야와 출력 형식을 하나 이상 선택해 주세요.');
    if (!Number.isInteger(doc.sortOrder) || doc.sortOrder < 0 || doc.sortOrder > 1000)
      errors.push('서류 표시 순서는 0~1000 정수입니다.');
  }
  if (
    !Number.isInteger(draft.deadlinePolicy.imminentBusinessDays) ||
    draft.deadlinePolicy.imminentBusinessDays < 1 ||
    draft.deadlinePolicy.imminentBusinessDays > 30
  )
    errors.push('기한 임박 알림은 1~30영업일 전으로 설정해 주세요.');
  const keys = new Set<string>();
  if (draft.fields.length > 200) errors.push('질문은 최대 200개입니다.');
  for (const [index, field] of draft.fields.entries()) {
    const name = `질문 ${index + 1}`;
    if (field.condition) {
      const parent = draft.fields.find((item) => item.key === field.condition?.fieldKey);
      if (
        !parent ||
        parent.key === field.key ||
        parent.scope !== 'CASE' ||
        parent.type !== 'BOOLEAN' ||
        !parent.required ||
        parent.askRole !== 'APPLICANT' ||
        parent.condition ||
        draft.docTypes.some(
          (d) =>
            (!field.docTypes.length || field.docTypes.includes(d.code)) &&
            parent.docTypes.length &&
            !parent.docTypes.includes(d.code),
        )
      ) {
        errors.push(
          `${name}: 사업 조건은 같은 서류에 적용되는 신청자 필수 사업 질문(예·아니요)을 선택해 주세요.`,
        );
      }
    }
    if (
      (!existingKeys.includes(field.key) &&
        !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(field.key)) ||
      field.key.length > 100
    )
      errors.push(
        `${name}: 저장 키는 custom.purpose처럼 영문 소문자와 점으로 구성해 주세요(100자 이하).`,
      );
    if (keys.has(field.key)) errors.push(`${name}: 저장 키가 중복됩니다.`);
    keys.add(field.key);
    if (!field.label.trim() || field.label.length > 200)
      errors.push(`${name}: 질문 문구를 1~200자로 입력해 주세요.`);
    if ((field.hint?.length ?? 0) > 2000)
      errors.push(`${name}: 도움말은 2000자 이하로 입력해 주세요.`);
    if (field.scope === 'REQUEST' && !field.docTypes.length)
      errors.push(`${name}: 적용 서류를 하나 이상 선택해 주세요.`);
    if (
      field.askRole !== 'APPLICANT' &&
      draft.docTypes.some(
        (d) =>
          (!field.docTypes.length || field.docTypes.includes(d.code)) &&
          !d.reviewFields.includes(field.askRole as 'INFRA' | 'SECURITY'),
      )
    )
      errors.push(`${name}: 작성 역할이 적용 서류의 검토 분야에 포함되어야 합니다.`);
  }
  for (const key of [
    'reviewBusinessDays',
    'supplementBusinessDays',
    'finalConfirmationBusinessDays',
  ] as const) {
    const days = draft.deadlinePolicy[key];
    if (!Number.isInteger(days) || days < 1 || days > 365)
      errors.push('처리 기한은 1~365 사이의 정수 영업일로 입력해 주세요.');
  }
  if (
    draft.deadlinePolicy.holidays.length > 366 ||
    draft.deadlinePolicy.holidays.some(
      (date) =>
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        date < '2000-01-01' ||
        date > '2100-12-31' ||
        !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date,
    )
  )
    errors.push('공휴일은 2000~2100년의 올바른 날짜로 최대 366개까지 입력해 주세요.');
  if (note.length > 500) errors.push('변경 메모는 500자 이하로 입력해 주세요.');
  return [...new Set(errors)];
}
