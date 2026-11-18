'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { requestJson } from '@/lib/httpClient';
import { Notice } from '@/components/ui';

const historySchema = z.object({
  retentionDays: z.number(),
  samples: z.array(
    z.object({
      operation_sample_id: z.number(),
      recorded_at: z.string(),
      instance_id: z.string(),
      metrics: z.string(),
    }),
  ),
  alerts: z.array(
    z.object({
      operation_alert_id: z.number(),
      message: z.string(),
      opened_at: z.string(),
      resolved_at: z.string().nullable(),
      acknowledged_at: z.string().nullable(),
    }),
  ),
});
const deliveriesSchema = z.array(
  z.object({ id: z.number(), channel: z.string(), status: z.string(), attempts: z.number() }),
);
const labels: Record<string, string> = {
  PENDING: '재처리 대기',
  RUNNING: '처리 중',
  SENT: '처리 완료',
  FAILED: '재처리 필요',
  SKIPPED: '수신 권한 없음',
  SCREEN: '화면 알림',
  EMAIL: '이메일',
  WEBHOOK: '웹훅',
};

/** 업무 지표와 운영 장애를 구분하고 경보 확인을 실제 장애 해소로 취급하지 않는다. */
export function OperationsPanel() {
  const [page, setPage] = useState(0),
    [deliveryPage, setDeliveryPage] = useState(0);
  const cache = useQueryClient();
  const history = useQuery({
    queryKey: ['operation-history', page],
    queryFn: async () =>
      historySchema.parse(await requestJson(`/api/operation-history?page=${page}`)),
    refetchInterval: 60000,
  });
  const deliveries = useQuery({
    queryKey: ['notification-deliveries', deliveryPage],
    queryFn: async () =>
      deliveriesSchema.parse(
        await requestJson(`/api/notification-deliveries?page=${deliveryPage}`),
      ),
    refetchInterval: 30000,
  });
  const action = useMutation({
    mutationFn: async (path: string) => requestJson(path, { method: 'POST' }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['operation-history'] });
      await cache.invalidateQueries({ queryKey: ['notification-deliveries'] });
    },
  });
  return (
    <section className="card" aria-label="서비스 운영 상태">
      <h2>서비스 운영 상태</h2>
      <p>
        운영 지표는 분 단위로 {history.data?.retentionDays ?? 30}일 보존합니다. 경보 확인은 장애
        해소와 다릅니다. 외부 모니터링이 없어 서버 전체 중단 중에는 새 경보를 만들 수 없습니다.
      </p>
      {history.isPending && <p role="status">운영 기록을 불러오는 중…</p>}
      {[history.error, deliveries.error, action.error].filter(Boolean).map((e, i) => (
        <Notice key={i} tone="danger">
          {e?.message}
        </Notice>
      ))}
      <h3>장애 경보</h3>
      {history.data?.alerts.length === 0 && <p>기록된 경보가 없습니다.</p>}
      {history.data?.alerts.map((a) => (
        <article className="sub-block" key={a.operation_alert_id}>
          <p>
            {a.message} · {a.resolved_at ? '해소됨' : '발생 중'} ·{' '}
            {new Date(a.opened_at).toLocaleString('ko-KR')}
          </p>
          {a.acknowledged_at ? (
            <span>관리자 확인 완료</span>
          ) : (
            <button
              className="btn"
              type="button"
              disabled={action.isPending}
              onClick={() =>
                action.mutate(`/api/operation-alerts/${a.operation_alert_id}/acknowledgements`)
              }
            >
              경보 확인
            </button>
          )}
        </article>
      ))}
      <h3>알림 처리 기록</h3>
      {deliveries.data?.length === 0 && <p>발송 기록이 없습니다.</p>}
      {deliveries.data?.map((d) => (
        <p key={d.id}>
          #{d.id} · {labels[d.channel] ?? d.channel} · {labels[d.status] ?? d.status} · {d.attempts}
          회 시도{' '}
          {d.status === 'FAILED' && (
            <button
              type="button"
              className="btn"
              disabled={action.isPending}
              onClick={() => action.mutate(`/api/notification-deliveries/${d.id}/retries`)}
            >
              다시 처리
            </button>
          )}
        </p>
      ))}
      <div className="btn-row">
        <button
          className="btn"
          disabled={deliveryPage === 0}
          onClick={() => setDeliveryPage((p) => p - 1)}
        >
          이전 알림
        </button>
        <span>{deliveryPage + 1}쪽</span>
        <button
          className="btn"
          disabled={deliveries.data?.length !== 50}
          onClick={() => setDeliveryPage((p) => p + 1)}
        >
          다음 알림
        </button>
      </div>
      <h3>보존된 실행 지표</h3>
      <p>
        누적 실행 수·초 단위 소요 시간입니다. 서버 실행 식별자가 다르면 누적값을 직접 빼지 않습니다.
      </p>
      {history.data?.samples.map((s) => (
        <details key={s.operation_sample_id}>
          <summary>
            {new Date(s.recorded_at).toLocaleString('ko-KR')} · 실행 {s.instance_id.slice(0, 8)}
          </summary>
          <MetricValues raw={s.metrics} />
        </details>
      ))}
      <div className="btn-row">
        <button className="btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          이전 지표
        </button>
        <span>{page + 1}쪽</span>
        <button
          className="btn"
          disabled={history.data?.samples.length !== 60}
          onClick={() => setPage((p) => p + 1)}
        >
          다음 지표
        </button>
      </div>
    </section>
  );
}

function MetricValues({ raw }: { raw: string }) {
  const values = z.record(z.string(), z.number()).safeParse(JSON.parse(raw));
  if (!values.success) return <p>지표를 읽을 수 없습니다.</p>;
  const names: Record<string, string> = {
    http: 'API',
    llm: 'AI',
    notification: '알림',
    reminder: '기한 알림 실행',
  };
  return (
    <dl>
      {Object.entries(values.data).map(([key, value]) => {
        const [kind, unit] = key.split('.');
        return (
          <div key={key}>
            <dt>
              {names[kind] ?? kind}{' '}
              {unit === 'count' ? '실행 수' : unit === 'errors' ? '오류 수' : '누적 소요 시간(초)'}
            </dt>
            <dd>{value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}</dd>
          </div>
        );
      })}
    </dl>
  );
}
