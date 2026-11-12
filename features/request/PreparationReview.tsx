'use client';

import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { Notice } from '@/components/ui';
import { requestJson } from '@/lib/httpClient';
import { SourceDocumentButton } from './SourceDocuments';

const snapshotSchema = z.object({
  capturedAt: z.string(),
  items: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      reviewer: z.string(),
      applicability: z.string(),
      status: z.string(),
      stale: z.boolean(),
      note: z.string(),
      actor: z.string().nullable(),
      reviewedAt: z.string().nullable(),
      files: z.array(z.object({ fileId: z.number(), name: z.string() })),
    }),
  ),
});
const labels: Record<string, string> = {
  MISSING: '미첨부',
  IN_REVIEW: '검토 중',
  NEEDS_SUPPLEMENT: '보완 필요',
  CONFIRMED: '확인 완료',
};

/** 제출 후에는 고정된 기록만 읽고 과거 제출본의 없는 기록을 현재값으로 보충하지 않는다. */
export function PreparationReview({
  requestId,
  caseId,
  submitted,
  snapshot,
}: {
  requestId: string;
  caseId: string;
  submitted: boolean;
  snapshot?: unknown;
}) {
  const query = useQuery({
    queryKey: ['preparation-final-review', requestId],
    enabled: !submitted,
    queryFn: async () =>
      snapshotSchema.parse(
        await requestJson(
          `/api/security-requests/${encodeURIComponent(requestId)}/preparation-materials/final-review`,
        ),
      ),
  });
  const stored = z.object({ preparationReview: snapshotSchema }).safeParse(snapshot);
  const data = submitted
    ? stored.success
      ? stored.data.preparationReview
      : undefined
    : query.data;
  const warnings =
    data?.items.filter(
      (i) =>
        i.applicability !== 'NOT_APPLICABLE' &&
        (i.applicability === 'UNKNOWN' || i.status !== 'CONFIRMED' || i.stale),
    ).length ?? 0;
  return (
    <section className="card" aria-label="준비자료 및 검토 결과">
      <h2 className="h-panel">
        {submitted ? '제출 당시 준비자료 및 검토 결과' : '최종 검토 · 준비자료 및 검토 결과'}
      </h2>
      <p className="help">
        자료 확인은 서류 승인과 다릅니다. 권고 자료의 미첨부만으로 제출을 차단하지 않습니다.
      </p>
      {!submitted && query.isPending && <p role="status">검토 결과를 불러오는 중…</p>}
      {!submitted && query.error && (
        <Notice tone="danger">
          {query.error.message}
          <button
            className="btn"
            onClick={() => {
              void query.refetch();
            }}
          >
            다시 확인
          </button>
        </Notice>
      )}
      {submitted && !data && (
        <p>
          이 제출본에는 준비자료 검토 기록이 없습니다. 현재 자료로 과거 기록을 추정하지 않습니다.
        </p>
      )}
      {data && (
        <>
          <p className="help">
            {submitted ? '제출 기록 기준' : '조회 기준'}:{' '}
            {new Date(data.capturedAt).toLocaleString('ko-KR')}
          </p>
          {warnings > 0 && (
            <Notice tone="warning">
              확인이 필요한 자료 {warnings}건입니다. 미첨부·보완 필요·재검토 사항과 담당자의 사유를
              확인해 주세요.
            </Notice>
          )}
          {data.items.map((item) => (
            <article className="sub-block" key={item.key}>
              <h3>
                {item.label} ·{' '}
                {item.applicability === 'NOT_APPLICABLE'
                  ? '현재 조건 미해당'
                  : item.applicability === 'UNKNOWN'
                    ? '사업 조건 확인 필요'
                    : (labels[item.status] ?? item.status)}
              </h3>
              <p>검토 분야: {item.reviewer === 'INFRA' ? 'ICT인프라' : '정보보안'}</p>
              {item.stale && <p>조건 변경 후 재검토 필요 · 아래 기록은 이전 조건 기준입니다.</p>}
              <p>
                {item.actor
                  ? `최근 기록: ${item.actor} · ${item.reviewedAt ? new Date(item.reviewedAt).toLocaleString('ko-KR') : '시각 기록 없음'}`
                  : '검토 기록 없음'}
              </p>
              {item.note && <p>설명·보완 사유: {item.note}</p>}
              {item.files.length ? (
                <ul>
                  {item.files.map((file) => (
                    <li key={file.fileId}>
                      {file.name} <SourceDocumentButton caseId={caseId} fileId={file.fileId} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p>연결된 자료 없음</p>
              )}
            </article>
          ))}
          {!submitted && (
            <button
              className="btn"
              onClick={() => {
                void query.refetch();
              }}
              disabled={query.isFetching}
            >
              최신 검토 결과 확인
            </button>
          )}
          {!submitted && (
            <a className="btn" href="#preparation-materials">
              준비자료 보완·검토하기
            </a>
          )}
        </>
      )}
    </section>
  );
}
