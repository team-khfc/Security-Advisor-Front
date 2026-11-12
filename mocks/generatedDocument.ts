import type { GeneratedDocument } from '@/features/document/types';
import type { SecurityRequest, Submission, Answer } from '@/features/request/types';
import type { FinalDraft } from '@/features/request/useFinalDraft';
import { z } from 'zod';

const snapshotDraftSchema = z.object({
  text: z.string(),
  valueSource: z.string().optional(),
  confirmed: z.boolean().optional(),
  stale: z.boolean().optional(),
});

/** 모의 서버도 계약상의 문서 자원을 반환한다. PDF 바이트는 실제 Back에서만 제공한다. */
export function mockGeneratedDocument(
  request: SecurityRequest,
  submission: Submission | undefined,
  draft: FinalDraft | undefined,
  metadata: Pick<
    GeneratedDocument,
    | 'generatedDocumentId'
    | 'securityRequestId'
    | 'submissionId'
    | 'version'
    | 'generatedBy'
    | 'generatedAt'
  >,
  currentPreparation?: unknown,
): GeneratedDocument {
  const snapshot = submission?.snapshot as { caseTitle?: string; finalDraft?: unknown } | undefined;
  const frozenDraft = snapshotDraftSchema.safeParse(snapshot?.finalDraft);
  const final = submission ? (frozenDraft.success ? frozenDraft.data : undefined) : draft;
  const answers = submission
    ? [...submission.commonAnswers, ...submission.answers]
    : [...request.commonAnswers, ...request.answers];
  const field = (answer: Answer) => ({
    fieldKey: answer.key,
    label: answer.label,
    scope: answer.scope,
    value: answer.value || null,
    valueSource: answer.source,
    confirmed: answer.confirmed,
    needsReview: answer.needsReview ?? false,
    display: answer.notApplicable
      ? '미해당'
      : answer.value === 'true'
        ? '예'
        : answer.value === 'false'
          ? '아니요'
          : answer.value || '담당자 확인 필요',
    status: answer.confirmed && !answer.needsReview ? '확인됨' : '담당자 확인 필요',
  });
  const sections: GeneratedDocument['sections'] = (['CASE', 'REQUEST'] as const).map((scope) => ({
    title: scope === 'CASE' ? '사업 공통 정보' : '신청 정보',
    values: answers.filter((a) => a.scope === scope).map(field),
  }));
  if (final?.text)
    sections.push({
      title: '최종 보고서',
      values: [
        {
          fieldKey: 'finalSummary',
          label: '최종 보고서',
          scope: 'REQUEST',
          value: final.text,
          display: final.text,
          valueSource: final.valueSource ?? null,
          confirmed: !!final.confirmed,
          needsReview: !!final.stale,
          status: final.confirmed && !final.stale ? '확인됨' : '담당자 확인 필요',
        },
      ],
    });
  const kind = !submission
    ? 'DRAFT'
    : request.status === 'FINALIZED' && submission.id === request.currentSubmissionId
      ? 'CONFIRMED'
      : 'SUBMITTED';
  const prepared = z
    .object({
      items: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          status: z.string(),
          applicability: z.string(),
          stale: z.boolean(),
          note: z.string(),
          actor: z.string().nullable(),
          files: z.array(z.object({ fileId: z.number(), name: z.string() })),
        }),
      ),
    })
    .safeParse(
      submission
        ? (submission.snapshot as { preparationReview?: unknown } | undefined)?.preparationReview
        : currentPreparation,
    );
  const statuses: Record<string, string> = {
    MISSING: '미첨부',
    IN_REVIEW: '검토 중',
    NEEDS_SUPPLEMENT: '보완 필요',
    CONFIRMED: '확인 완료',
  };
  const records = prepared.success
    ? prepared.data.items.map((i) => ({
        key: i.key,
        label: i.label,
        text: `${i.applicability === 'NOT_APPLICABLE' ? '현재 조건 미해당' : i.applicability === 'UNKNOWN' ? '사업 조건 확인 필요' : statuses[i.status]}${i.stale ? ' · 조건 변경 후 재검토 필요' : ''}\n첨부: ${i.files.map((f) => `${f.name} (#${f.fileId})`).join(', ') || '없음'}\n최근 기록: ${i.actor ?? '없음'}\n사유: ${i.note}`,
      }))
    : [
        {
          key: 'legacy',
          label: '기록 범위',
          text: '이 제출본에는 준비자료 검토 기록이 없습니다. 현재 자료로 과거 기록을 추정하지 않습니다.',
        },
      ];
  sections.push({
    title: '준비자료 및 검토 결과',
    values: records.map((i) => ({
      fieldKey: `preparation.${i.key}`,
      label: i.label,
      scope: 'REQUEST',
      value: i.text,
      display: i.text,
      valueSource: null,
      confirmed: true,
      needsReview: false,
      status: '자료 현황 기록 · 승인 아님',
    })),
  });
  return {
    ...metadata,
    kind,
    kindLabel: { DRAFT: '초안', SUBMITTED: '제출본', CONFIRMED: '확정본' }[kind],
    title: snapshot?.caseTitle ?? request.caseTitle,
    sections,
    markdown: sections
      .map((s) => s.title + '\n' + s.values.map((v) => v.label + ': ' + v.display).join('\n'))
      .join('\n\n'),
    aiSupplement: null,
    modelReference: null,
    unconfirmedCount: sections.flatMap((s) => s.values).filter((v) => !v.confirmed || v.needsReview)
      .length,
  };
}
