'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Notice } from '@/components/ui';
import { requestJson } from '@/lib/httpClient';
import { SourceDocumentButton } from './SourceDocuments';

const recordSchema = z.object({
  id: z.number(),
  revision: z.number(),
  stale: z.boolean(),
  canDecide: z.boolean(),
  allowedFindings: z.array(z.number()).default([]),
  result: z.object({
    fingerprint: z.string(),
    checkedAt: z.string(),
    findings: z.array(
      z.object({
        fieldKey: z.string(),
        label: z.string(),
        answer: z.string(),
        fileId: z.number(),
        quote: z.string(),
        explanation: z.string(),
      }),
    ),
  }),
  decisions: z.array(
    z.object({
      findingIndex: z.number(),
      status: z.string(),
      reason: z.string(),
      actor: z.string(),
      at: z.string(),
      supplementId: z.number().nullable(),
    }),
  ),
});
type Record = z.infer<typeof recordSchema>;
const labels: { [key: string]: string } = {
  OPEN: '확인 필요',
  RESOLVED: '확인·해소',
  DISMISSED: '모순 아님',
  SUPPLEMENT_REQUESTED: '보완 요청',
};

/** 검사 원본과 사람의 처리 이력을 함께 보여 주고 오래된 결과는 재검사를 안내한다. */
export function ConsistencyHistory({
  requestId,
  caseId,
  submitted = false,
  snapshot,
}: {
  requestId: string;
  caseId: string;
  submitted?: boolean;
  snapshot?: unknown;
}) {
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: ['consistency-history', requestId, page],
    enabled: !submitted,
    queryFn: async () =>
      z
        .array(recordSchema)
        .parse(
          await requestJson(`/api/security-requests/${requestId}/consistency-checks?page=${page}`),
        ),
  });
  const stored = z.object({ consistencyReviews: z.array(recordSchema) }).safeParse(snapshot);
  const records = submitted
    ? stored.success
      ? stored.data.consistencyReviews.map((r) => ({ ...r, canDecide: false }))
      : undefined
    : query.data;
  return (
    <section aria-label="모순 후보 처리 이력">
      <h4>{submitted ? '제출 당시 검사·처리 기록' : '검사·처리 이력'}</h4>
      {submitted && !records && (
        <p>이 제출본에는 모순 검사 기록이 없습니다. 현재 기록으로 추정하지 않습니다.</p>
      )}
      {!submitted && query.isPending && <p role="status">처리 이력을 불러오는 중…</p>}
      {!submitted && query.error && <Notice tone="danger">{query.error.message}</Notice>}
      {records?.length === 0 && <p>저장된 검사 기록이 없습니다.</p>}
      {records?.map((record) => (
        <RecordView key={record.id} record={record} requestId={requestId} caseId={caseId} />
      ))}
      {!submitted && (
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            이전 검사
          </button>
          <span>{page + 1}쪽</span>
          <button
            type="button"
            className="btn"
            disabled={!query.data || query.data.length < 10}
            onClick={() => setPage(page + 1)}
          >
            다음 검사
          </button>
        </div>
      )}
    </section>
  );
}
function RecordView({
  record,
  requestId,
  caseId,
}: {
  record: Record;
  requestId: string;
  caseId: string;
}) {
  return (
    <details className="sub-block">
      <summary>
        검사 #{record.id} · {new Date(record.result.checkedAt).toLocaleString('ko-KR')} · 후보{' '}
        {record.result.findings.length}건 {record.stale ? '· 자료 변경, 재검사 필요' : ''}
      </summary>
      {record.result.findings.length === 0 && (
        <p>검사한 범위에서 모순 후보를 찾지 못했습니다. 모든 사실의 정확성을 보장하지 않습니다.</p>
      )}
      {record.result.findings.map((finding, index) => {
        const decisions = record.decisions.filter((d) => d.findingIndex === index),
          latest = decisions.at(-1);
        return (
          <article key={index} className="sub-block">
            <h4>
              {finding.label} · {record.stale ? '재검사 필요' : labels[latest?.status ?? 'OPEN']}
            </h4>
            <p>검사 당시 값: {finding.answer}</p>
            <blockquote>{finding.quote}</blockquote>
            <p>{finding.explanation}</p>
            <SourceDocumentButton caseId={caseId} fileId={finding.fileId} />
            {decisions.map((d, i) => (
              <p key={i}>
                {labels[d.status]} · {d.actor} · {new Date(d.at).toLocaleString('ko-KR')} ·{' '}
                {d.reason}
                {d.supplementId ? ` · 보완 #${d.supplementId}` : ''}
              </p>
            ))}
            {record.canDecide && record.allowedFindings.includes(index) && (
              <DecisionForm record={record} requestId={requestId} index={index} />
            )}
          </article>
        );
      })}
    </details>
  );
}
function DecisionForm({
  record,
  requestId,
  index,
}: {
  record: Record;
  requestId: string;
  index: number;
}) {
  const [status, setStatus] = useState('RESOLVED'),
    [reason, setReason] = useState('');
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: () =>
      requestJson(`/api/security-requests/${requestId}/consistency-checks/${record.id}/decisions`, {
        method: 'POST',
        body: {
          expectedRevision: record.revision,
          expectedFingerprint: record.result.fingerprint,
          findingIndex: index,
          status,
          reason,
        },
      }),
    onSuccess: () => {
      setReason('');
      void client.invalidateQueries();
    },
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <label>
        처리 결과
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          {Object.entries(labels).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        판단 근거·보완 사유
        <textarea
          className="input"
          required
          maxLength={2000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <p className="help">
        해소·모순 아님은 담당자의 판단 기록입니다. 답변을 자동 수정하거나 서류를 확정하지 않습니다.
        보완 요청은 신청자의 처리할 일과 알림으로 연결됩니다.
      </p>
      {save.error && <Notice tone="danger">{save.error.message}</Notice>}
      <button className="btn" disabled={save.isPending || !reason.trim()}>
        {save.isPending ? '저장 중…' : '처리 결과 저장'}
      </button>
    </form>
  );
}
