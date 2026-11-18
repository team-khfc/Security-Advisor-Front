'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { requestJson } from '@/lib/httpClient';
import { Notice } from '@/components/ui';
import { useApplyAnalysis } from './useRequests';

const jobsSchema = z.array(
  z.object({
    analysisJobId: z.number(),
    uploadedFileId: z.number(),
    status: z.string(),
    statusLabel: z.string(),
    summary: z.string().nullable(),
    errorMessage: z.string().nullable(),
  }),
);

/** 화면 재진입 후에도 서버 작업을 조회하고 새 파일 업로드 없이 재요청한다. */
export function AnalysisJobs({ caseId, revision }: { caseId: string; revision: number }) {
  const cache = useQueryClient(),
    apply = useApplyAnalysis();
  const jobs = useQuery({
    queryKey: ['analysis-jobs', caseId],
    queryFn: async () =>
      jobsSchema.parse(await requestJson(`/api/business-cases/${caseId}/analysis-jobs`)),
    refetchInterval: 10000,
  });
  const retry = useMutation({
    mutationFn: async (fileId: number) =>
      requestJson(`/api/business-cases/${caseId}/analysis-jobs`, {
        method: 'POST',
        body: { uploadedFileId: fileId },
      }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['analysis-jobs', caseId] });
    },
  });
  return (
    <details className="sub-block">
      <summary>문서 분석 작업과 복구</summary>
      <p>
        서버 재시작 후에도 접수한 작업을 다시 확인합니다. 중단된 실행은 최대 15분 후 복구하며 반복
        중단은 3회까지 시도합니다. 결과는 자동으로 답변에 반영하지 않습니다.
      </p>
      {[jobs.error, retry.error, apply.error].filter(Boolean).map((e, i) => (
        <Notice key={i} tone="danger">
          {e?.message}
        </Notice>
      ))}
      {jobs.isPending && <p role="status">작업을 불러오는 중…</p>}
      {jobs.data?.length === 0 && <p>분석 작업이 없습니다.</p>}
      {jobs.data?.map((j) => (
        <article className="sub-block" key={j.analysisJobId}>
          <h4>
            분석 #{j.analysisJobId} · {j.statusLabel}
          </h4>
          {j.summary && <p>{j.summary}</p>}
          {j.errorMessage && <p>{j.errorMessage}</p>}
          {j.status === 'FAILED' && (
            <button
              type="button"
              className="btn"
              disabled={retry.isPending}
              onClick={() => retry.mutate(j.uploadedFileId)}
            >
              같은 자료 다시 분석
            </button>
          )}
          {j.status === 'NEEDS_REVIEW' && (
            <button
              type="button"
              className="btn"
              disabled={apply.isPending}
              onClick={() =>
                apply.mutate({ id: String(j.analysisJobId), expectedRevision: revision })
              }
            >
              미확정 제안으로 적용
            </button>
          )}
        </article>
      ))}
      {apply.isSuccess && (
        <Notice tone="info">분석 결과를 미확정 제안으로 적용했습니다. 답변을 확인해 주세요.</Notice>
      )}
    </details>
  );
}
