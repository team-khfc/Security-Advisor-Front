'use client';

import Link from 'next/link';
import { Icon, Notice, PageHeading } from '@/components/ui';

const summaries = [
  { label: '관리 중인 정책', icon: 'file' },
  { label: '만료 임박', icon: 'clock' },
  { label: '만료 후 남은 정책', icon: 'alert' },
  { label: '장기 미사용', icon: 'users' },
] as const;

const filters = ['전체', '정리 필요', '회수 예정·완료'];

/**
 * 시안의 정책 수명주기 배치를 따르되, 정책 데이터·API가 없는 P2 범위이므로 건수·목록·처리 버튼을
 * 동작하는 것처럼 보이지 않게 비활성과 사유로 표시한다.
 */
export function PolicyLifecycle() {
  return (
    <>
      <PageHeading title="정책 수명주기" />
      <Notice tone="warning">
        <strong>P2 구현 예정 기능입니다.</strong>
        <p>
          방화벽 정책의 생성·적용 기록·연장 문의·회수·만료 관리는 필수 업무 흐름 검증 뒤 착수합니다.
          현재 정책 데이터와 API가 연결되지 않아 아래 건수·목록·처리 버튼은 사용할 수 없습니다.
        </p>
        <p>서류 확정과 실제 방화벽 적용은 별개입니다.</p>
      </Notice>
      <section aria-labelledby="policy-summary-heading">
        <h2 className="sr-only" id="policy-summary-heading">
          요약
        </h2>
        <div className="stats">
          {summaries.map((item) => (
            <div className="stat stat-disabled" key={item.label}>
              <span className="stat-l">
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </span>
              <span className="stat-num" aria-label="데이터 연결 전">
                –
              </span>
            </div>
          ))}
        </div>
      </section>
      <section aria-labelledby="policy-list-heading">
        <div className="sec-head">
          <h2 className="h-sec" id="policy-list-heading">
            정책 목록
          </h2>
        </div>
        <div className="toolbar">
          <div className="pills" role="group" aria-label="정책 거르기">
            {filters.map((label, index) => (
              <button
                type="button"
                className="pill"
                key={label}
                aria-pressed={index === 0}
                disabled
                aria-describedby="policy-disabled"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="filter-state" id="policy-disabled">
          정책 데이터 연결 전이라 거르기와 처리 버튼(연장 여부 묻기·회수 예정 표시·회수 완료 기록)을
          사용할 수 없습니다.
        </p>
        <div className="empty-box">
          <h2>연결된 정책이 없습니다</h2>
          <p>서류가 확정되면 생성될 방화벽 정책의 목록·만료일·트래픽·상태가 이곳에 표시됩니다.</p>
          <div className="empty-actions">
            <Link className="btn" href="/requests">
              신청 현황으로
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
