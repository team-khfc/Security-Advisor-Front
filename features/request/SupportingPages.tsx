'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Badge,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  Notice,
  PageHeading,
} from '@/components/ui';
import { useSession } from '@/features/auth';
import { DOCUMENT_LABELS, STATUS_LABELS } from './types';
import { useRequests } from './useRequests';

/** 보완 답변은 신청 상세의 한 입력 영역으로 모아 중복 수정을 피한다. */
export function SupplementList() {
  const query = useRequests();
  if (query.isPending) return <LoadingState />;
  if (query.error)
    return (
      <ErrorState
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  const items = (query.data ?? []).flatMap((request) =>
    request.supplements.map((supplement) => ({ request, supplement })),
  );
  const open = items.filter(({ supplement }) => supplement.status !== 'RESOLVED');
  return (
    <>
      <PageHeading
        title="보완 요청"
        description="담당자가 요청한 항목을 확인하고 신청별로 답변해 주세요."
      />
      <h2 className="h-sec">
        답변·확인이 필요한 요청 <span className="count">{open.length}</span>
      </h2>
      {!open.length ? (
        <EmptyState
          title="대기 중인 보완 요청이 없습니다"
          description="담당자가 추가 확인을 요청하면 이곳에서 확인할 수 있습니다."
          action={
            <Link className="btn" href="/requests">
              신청 현황 보기
            </Link>
          }
        />
      ) : (
        <div className="supplement-grid">
          {open.map(({ request, supplement }) => (
            <article className="card" key={supplement.id}>
              <div className="section-heading">
                <Badge tone="warning">
                  {supplement.status === 'OPEN' ? '답변 필요' : '담당자 재검토'}
                </Badge>
                <span className="meta">{request.id}</span>
              </div>
              <h3 className="h-panel">{request.caseTitle}</h3>
              <p className="help">{DOCUMENT_LABELS[request.docType]}</p>
              <p>{supplement.reason}</p>
              {supplement.answer && <p>등록한 답변: {supplement.answer}</p>}
              <Link
                className={`btn ${open.length === 1 ? 'btn-primary' : ''}`}
                href={`/requests/${request.id}#supplements`}
              >
                신청에서 보완하기 <Icon name="arrowRight" />
              </Link>
            </article>
          ))}
        </div>
      )}
      {items.some(({ supplement }) => supplement.status === 'RESOLVED') && (
        <section className="card">
          <h2 className="h-sec">확인한 요청</h2>
          {items
            .filter(({ supplement }) => supplement.status === 'RESOLVED')
            .map(({ request, supplement }) => (
              <p key={supplement.id}>
                <Link href={`/requests/${request.id}#supplements`}>{request.caseTitle}</Link> ·{' '}
                {supplement.reason} <Badge tone="success">확인 완료</Badge>
              </p>
            ))}
        </section>
      )}
    </>
  );
}

/** 기재된 통신 사실만 보여 주며 변경은 배정된 신청 상세에서 처리한다. */
export function NetworkList() {
  const query = useRequests();
  const session = useSession();
  const [search, setSearch] = useState('');
  if (query.isPending || session.isPending) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} />;
  if (session.data?.member.role !== 'INFRA')
    return (
      <Notice tone="warning">
        ICT인프라 담당자 메뉴입니다. 신청 상세에서 허용된 정보만 확인할 수 있습니다.
      </Notice>
    );
  const rows = (query.data ?? []).filter((request) => request.caseTitle.includes(search));
  return (
    <>
      <PageHeading
        title="통신 정보"
        description="신청에 등록된 서버·주소·포트와 자원 할당 상태를 확인합니다."
      />
      <div className="toolbar">
        <label className="sr-only" htmlFor="network-search">
          사업명 검색
        </label>
        <input
          id="network-search"
          className="input"
          placeholder="사업명 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <p className="help" role="status">
        결과 {rows.length}건
      </p>
      <div className="tbl-wrap">
        <table className="tbl">
          <caption className="sr-only">신청별 통신 정보</caption>
          <thead>
            <tr>
              <th>사업명</th>
              <th>출발지</th>
              <th>목적지</th>
              <th>통신 방식·포트</th>
              <th>할당 상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((request) => {
              const answer = (key: string) =>
                request.commonAnswers.find((item) => item.key === key)?.value || '담당자 확인 필요';
              return (
                <tr key={request.id}>
                  <td>
                    <span className="meta">{request.id}</span>
                    <p>
                      <Link href={`/requests/${request.id}`}>{request.caseTitle}</Link>
                    </p>
                    <small>{DOCUMENT_LABELS[request.docType]}</small>
                  </td>
                  <td>
                    {answer('sourceSystem')}
                    <p className="help">{answer('sourceIp')}</p>
                  </td>
                  <td>
                    {answer('destinationSystem')}
                    <p className="help">{answer('destinationIp')}</p>
                  </td>
                  <td>
                    {answer('protocol')} / {answer('port')}
                  </td>
                  <td>
                    <Badge
                      tone={
                        request.reviews.some(
                          (review) => review.field === 'INFRA' && review.allocationCompleted,
                        )
                          ? 'info'
                          : 'neutral'
                      }
                    >
                      {request.reviews.some(
                        (review) => review.field === 'INFRA' && review.allocationCompleted,
                      )
                        ? '할당 완료'
                        : '할당 대기'}
                    </Badge>
                    <p className="help">{STATUS_LABELS[request.status]}</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!rows.length && <EmptyState title="검색 결과가 없습니다" />}
    </>
  );
}
