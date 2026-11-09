'use client';

import { useState } from 'react';
import { Badge, Notice, PageHeading } from '@/components/ui';
import { useSession } from '@/features/auth';
import { useInstallation } from '@/lib/queries';

const tabs = ['인터뷰 질문', '검토 절차', '문서 양식', '점검 기준·기한', '설정 버전'];

/** 첫 범위의 게시본 운영 규칙을 읽기 전용으로 안내한다. 편집·게시 기능은 P2다. */
export function ConfigurationPage() {
  const session = useSession();
  const installation = useInstallation();
  const [active, setActive] = useState(0);
  if (session.data?.member.role !== 'ADMIN')
    return <Notice tone="warning">기관 관리자만 설정을 확인할 수 있습니다.</Notice>;
  return (
    <>
      <PageHeading title="기관 설정" />
      <div className="org-bar">
        <div className="verbar">
          <Badge tone="success">게시본 v1</Badge>
          <Badge>모의 seed 게시본 · 읽기 전용</Badge>
        </div>
        <p className="help">
          {installation.data?.institutionName ?? '운영 기관'}의 질문·양식·절차 기준(기능 명세 기준
          정보)입니다. 설정 편집·게시 관리는 P2 구현 예정이며 실제 게시 이력은 아직 연결되지
          않았습니다.
        </p>
      </div>
      <div className="tabs" role="tablist" aria-label="기관 설정 항목">
        {tabs.map((tab, index) => (
          <button
            type="button"
            role="tab"
            aria-selected={active === index}
            aria-controls={`setting-panel-${index}`}
            id={`setting-tab-${index}`}
            tabIndex={active === index ? 0 : -1}
            key={tab}
            onClick={() => setActive(index)}
            onKeyDown={(event) => {
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                const next =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? tabs.length - 1
                      : (active + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) %
                        tabs.length;
                setActive(next);
                document.getElementById(`setting-tab-${next}`)?.focus();
              }
            }}
          >
            {tab}
          </button>
        ))}
      </div>
      <section
        className="tabpanel card"
        role="tabpanel"
        tabIndex={0}
        aria-labelledby={`setting-tab-${active}`}
        id={`setting-panel-${active}`}
      >
        {active === 0 && (
          <>
            <h2 className="h-panel">공통 정보와 서류별 질문</h2>
            <div className="settings-two">
              <div>
                <h3 className="h-panel">사업 공통 정보 · CASE</h3>
                <ul>
                  <li>사업 목적·처리 정보·외부 전송·자료 흐름</li>
                  <li>서버·IP·프로토콜·포트·사용 기간</li>
                  <li>사업 건에서 한 번 수집하고 미제출 신청이 공유</li>
                </ul>
              </div>
              <div>
                <h3 className="h-panel">서류별 정보 · REQUEST</h3>
                <ul>
                  <li>방화벽: 연결 목적·접근 통제 방안</li>
                  <li>보안성검토: 검토 범위·보안 대책</li>
                  <li>출처 4종과 확인 기록을 항목별로 관리</li>
                </ul>
              </div>
            </div>
          </>
        )}
        {active === 1 && (
          <>
            <h2 className="h-panel">기관 검토 절차</h2>
            <p>
              <Badge tone="info">INFRA 선행 고정</Badge>
            </p>
            <h3 className="h-panel settings-flow-title">새 신청에 적용하는 흐름</h3>
            <ol className="flow">
              <li>작성</li>
              <li>ICT인프라 자원 할당</li>
              <li>분야별 협의 완료 (할당과 별도)</li>
              <li>사용자 최종 검토·제출</li>
              <li>INFRA 최종 확인 → SECURITY 최종 확인 → SECURITY 확정</li>
            </ol>
            <Notice>병렬 순서 설정과 부서장 확인 단계는 이번 범위에 포함되지 않습니다.</Notice>
          </>
        )}
        {active === 2 && (
          <>
            <h2 className="h-panel">신청 서류 2종</h2>
            <p>방화벽신청서 / 보안성검토 신청서</p>
            <p>
              프론트는 검토용 JSON과 제출 스냅샷을 제공합니다. 기관 양식에 맞춘 정식 HWP·PDF 출력은
              Back 문서 생성 API와 연결해야 합니다.
            </p>
            <Badge>양식 편집 · 구현 예정</Badge>
          </>
        )}
        {active === 3 && (
          <>
            <h2 className="h-panel">기한과 감사 기준</h2>
            <p>
              협의·보완 응답·최종 확정은 기본 5영업일입니다. 서버가 주말·게시본 공휴일을 제외하고
              기한을 계산합니다.
            </p>
            <p>
              기한 경과는 상태를 변경하지 않으며, 반환 시 기존 기한을 종료하고 새 기한을 생성합니다.
            </p>
            <p>업무 변경과 감사 이력은 함께 기록하고 이전 이력을 수정·삭제하지 않습니다.</p>
          </>
        )}
        {active === 4 && (
          <>
            <h2 className="h-panel">게시 이력</h2>
            <div className="tbl-wrap">
              <table className="tbl">
                <caption className="sr-only">설정 게시 이력</caption>
                <thead>
                  <tr>
                    <th scope="col">버전</th>
                    <th scope="col">상태</th>
                    <th scope="col">출처</th>
                    <th scope="col">비고</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>v1</strong>
                    </td>
                    <td>
                      <Badge tone="success">현재 게시본</Badge>
                    </td>
                    <td>모의 seed</td>
                    <td>실제 게시 이력 API 연결 전</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              사업 건 생성 시 게시본 버전을 고정합니다. 새 게시본은 새 신청에만 적용되며, 기존
              신청의 제출본은 바뀌지 않습니다.
            </p>
            <Notice tone="warning">
              게시본 변경·편집·LLM 구성 관리 기능은 아직 구현되지 않았습니다.
            </Notice>
          </>
        )}
      </section>
      {active !== 4 && (
        <div className="actions">
          <button
            type="button"
            className="btn btn-tertiary"
            disabled
            aria-describedby="settings-disabled"
          >
            초안 변경 취소
          </button>
          <span className="help" id="settings-disabled">
            설정 편집·초안 저장·게시는 P2 구현 예정이라 사용할 수 없습니다.
          </span>
          <div className="btn-row">
            <button type="button" className="btn" disabled aria-describedby="settings-disabled">
              설정 초안 저장
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled
              aria-describedby="settings-disabled"
            >
              변경 검토·게시
            </button>
          </div>
        </div>
      )}
    </>
  );
}
