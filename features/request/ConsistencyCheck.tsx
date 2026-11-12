'use client';

import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { Notice } from '@/components/ui';
import { requestJson } from '@/lib/httpClient';
import { SourceDocumentButton } from './SourceDocuments';

const resultSchema = z.object({
  fingerprint: z.string(),
  checkedAt: z.string(),
  model: z.string(),
  answerCount: z.number(),
  totalFiles: z.number(),
  sources: z.array(
    z.object({ fileId: z.number(), name: z.string(), truncated: z.boolean(), empty: z.boolean() }),
  ),
  findings: z.array(
    z.object({
      fieldKey: z.string(),
      label: z.string(),
      answer: z.string(),
      confirmed: z.boolean(),
      fileId: z.number(),
      quote: z.string(),
      explanation: z.string(),
    }),
  ),
});
const display = (value: string) => (value === 'true' ? '예' : value === 'false' ? '아니요' : value);

/** 검사 결과는 당시 자료의 확인 후보이며 자동 수정·확정으로 사용하지 않는다. */
export function ConsistencyCheck({ requestId, caseId }: { requestId: string; caseId: string }) {
  const check = useMutation({
    mutationFn: async () =>
      resultSchema.parse(
        await requestJson(
          `/api/security-requests/${encodeURIComponent(requestId)}/consistency-checks`,
          { method: 'POST' },
        ),
      ),
  });
  return (
    <section className="sub-block" aria-label="문서와 답변 간 모순 확인">
      <h3>문서와 답변 간 모순 확인</h3>
      <p className="help">
        현재 저장된 답변과 최근 첨부 문서 3개의 추출문(각 최대 20,000자)을 AI로 비교합니다. 저장하지
        않은 입력과 서버 구성표·최종 보고서 본문은 검사 대상에 포함되지 않습니다.
      </p>
      <p className="help">
        원문도 최신 사실과 다를 수 있습니다. 결과는 확인이 필요한 후보이며 답변이나 제출 상태를 자동
        변경하지 않습니다.
      </p>
      <button
        type="button"
        className="btn"
        disabled={check.isPending}
        onClick={() => {
          check.reset();
          check.mutate();
        }}
      >
        {check.isPending ? '문서와 답변 비교 중…' : 'AI 모순 확인'}
      </button>
      {check.isPending && <p role="status">문서의 근거와 저장된 답변을 비교하고 있습니다.</p>}
      {check.error && <Notice tone="danger">{check.error.message}</Notice>}
      {check.data && (
        <div aria-live="polite">
          <p className="help">
            검사 시각: {new Date(check.data.checkedAt).toLocaleString('ko-KR')} · 저장 답변{' '}
            {check.data.answerCount}개 · 첨부 {check.data.totalFiles}개 중{' '}
            {check.data.sources.length}개 · {check.data.model}
          </p>
          <Notice tone="warning">
            검사 당시 자료 기준입니다. 이후 답변·첨부가 바뀌면 다시 검사해 주세요. 모순 후보가
            없어도 모든 내용의 정확성을 보장하지 않습니다.
          </Notice>
          <ul>
            {check.data.sources.map((source) => (
              <li key={source.fileId}>
                {source.name}
                {source.truncated ? ' · 일부 추출문만 비교' : ''}
                {source.empty ? ' · 텍스트 없음, 비교 제외' : ''}
              </li>
            ))}
          </ul>
          {check.data.findings.length === 0 ? (
            <p>
              비교한 범위에서 모순 후보를 찾지 못했습니다. 원문과 중요 항목을 직접 확인해 주세요.
            </p>
          ) : (
            <>
              <h4>확인 필요 후보 {check.data.findings.length}건</h4>
              <p>
                아래 항목과 원문을 대조하고, 이 화면의 답변 수정 영역에서 본인에게 허용된 항목만
                수정해 주세요. 담당자 항목은 담당자에게 확인을 요청해 주세요.
              </p>
              {check.data.findings.map((finding, i) => (
                <article className="sub-block" key={`${finding.fieldKey}-${i}`}>
                  <h4>{finding.label}</h4>
                  <p>
                    <strong>저장 답변:</strong> {display(finding.answer)} ·{' '}
                    {finding.confirmed ? '확인된 답변' : '미확정 답변'}
                  </p>
                  <p>
                    <strong>원문 인용:</strong> {finding.quote}
                  </p>
                  <p>{finding.explanation}</p>
                  <SourceDocumentButton caseId={caseId} fileId={finding.fileId} />
                </article>
              ))}
            </>
          )}
        </div>
      )}
    </section>
  );
}
