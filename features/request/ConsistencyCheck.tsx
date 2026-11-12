'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { Notice } from '@/components/ui';
import { requestJson } from '@/lib/httpClient';
import { SourceDocumentButton } from './SourceDocuments';
import { ConsistencyHistory } from './ConsistencyHistory';

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
  const [selected, setSelected] = useState<number[]>([]);
  const [progress, setProgress] = useState('');
  const client = useQueryClient();
  const files = useQuery({
    queryKey: ['source-files', caseId],
    queryFn: async () =>
      z
        .array(z.object({ uploadedFileId: z.number(), originalName: z.string() }))
        .parse(await requestJson(`/api/business-cases/${caseId}/uploaded-files`)),
  });
  const check = useMutation({
    mutationFn: async () => {
      const ids = selected.length ? selected : (files.data?.map((f) => f.uploadedFileId) ?? []);
      if (!ids.length) throw new Error('검사할 문서를 첨부해 주세요.');
      let result: z.infer<typeof resultSchema> | undefined;
      for (const [index, fileId] of ids.entries()) {
        setProgress(`${index + 1}/${ids.length} 문서 검사 중`);
        result = resultSchema.parse(
          await requestJson(
            `/api/security-requests/${encodeURIComponent(requestId)}/consistency-checks`,
            { method: 'POST', body: { fileIds: [fileId] } },
          ),
        );
        await client.invalidateQueries({ queryKey: ['consistency-history', requestId] });
      }
      setProgress('선택 문서 검사 완료');
      return result!;
    },
  });
  return (
    <section className="sub-block" aria-label="문서와 답변 간 모순 확인">
      <h3>문서와 답변 간 모순 확인</h3>
      <p className="help">
        저장 답변·서버 구성표·최종 초안과 선택 문서를 하나씩 비교해 검사 기록을 남깁니다. 선택하지
        않으면 전체 첨부를 검사합니다. 각 문서의 추출문 최대 20,000자를 비교하며 잘린 범위는 별도
        표시합니다. 저장하지 않은 입력은 제외됩니다.
      </p>
      <fieldset disabled={check.isPending}>
        <legend>검사할 문서 선택</legend>
        {files.data?.map((file) => (
          <label key={file.uploadedFileId}>
            <input
              type="checkbox"
              checked={selected.includes(file.uploadedFileId)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, file.uploadedFileId]
                    : selected.filter((id) => id !== file.uploadedFileId),
                )
              }
            />
            {file.originalName}
          </label>
        ))}
      </fieldset>
      {files.error && <Notice tone="danger">{files.error.message}</Notice>}
      {progress && <p role="status">{progress}</p>}
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
      <ConsistencyHistory requestId={requestId} caseId={caseId} />
    </section>
  );
}
