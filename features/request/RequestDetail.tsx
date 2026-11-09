'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Badge,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  Modal,
  Notice,
  PageHeading,
} from '@/components/ui';
import { useMembers, useSession } from '@/features/auth';
import { auditActionLabel } from '@/features/audit/labels';
import { useAudit } from '@/lib/queries';
import type { Actor } from '@/lib/types';
import { AnswerEditor, AnswerView } from './AnswerEditor';
import {
  DOCUMENT_LABELS,
  FIELD_LABELS,
  STAGE_LABELS,
  STATUS_LABELS,
  type CommandAction,
  type CommandInput,
  type ReviewField,
  type SecurityRequest,
} from './types';
import { useCase, useRequest, useRequestCommand, useRequests, useSaveCase } from './useRequests';

/** URL을 직접 열어도 실제 조회 권한은 API가 판단한다. */
export function RequestDetail({ id }: { id: string }) {
  const query = useRequest(id);
  const session = useSession();
  if (query.isPending || session.isPending) return <LoadingState />;
  if (query.error)
    return (
      <ErrorState
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  if (!query.data || !session.data)
    return (
      <EmptyState
        title="신청을 찾을 수 없습니다"
        description="신청 현황에서 접근 가능한 신청을 선택해 주세요."
      />
    );
  return (
    <RequestWorkspace
      key={`${query.data.id}-${session.data.member.id}`}
      request={query.data}
      actor={session.data.member}
    />
  );
}

function RequestWorkspace({ request, actor }: { request: SecurityRequest; actor: Actor }) {
  const canViewCase =
    actor.role === 'ADMIN' ||
    actor.id === request.ownerId ||
    request.allowedActions.includes('EDIT_CASE');
  const caseQuery = useCase(request.caseId, canViewCase);
  const allRequests = useRequests();
  const command = useRequestCommand(request);
  const saveCase = useSaveCase(request.caseId, request);
  const [dialogAction, setDialogAction] = useState<CommandAction | null>(null);
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');
  const [comment, setComment] = useState('');
  const terminal = ['FINALIZED', 'CLOSED', 'WITHDRAWN'].includes(request.status);
  const has = (action: string) => request.allowedActions.includes(action);
  const fields = [...request.commonAnswers, ...request.answers];
  const pendingCount = fields.filter(
    (answer) =>
      (answer.required || answer.value || answer.notApplicable) &&
      !(
        answer.source &&
        answer.confirmed &&
        (answer.source === 'USER_ANSWER' || answer.confirmation) &&
        (answer.notApplicable || answer.value.trim())
      ),
  ).length;
  const latestReturn = request.returns.at(-1);
  const siblings = (allRequests.data ?? []).filter(
    (item) => item.caseId === request.caseId && item.id !== request.id,
  );
  const roleField = actor.role === 'INFRA' || actor.role === 'SECURITY' ? actor.role : undefined;
  const invoke = async (action: CommandAction, extra: Partial<CommandInput> = {}) => {
    setFailure('');
    setMessage('');
    try {
      await command.mutateAsync({
        action,
        expectedRevision: request.revision,
        field: roleField,
        comment,
        ...extra,
      });
      setMessage(
        action === 'GENERATE_DRAFT'
          ? 'AI 최종 초안을 생성했습니다. 미확정 값을 읽고 확인해 주세요.'
          : '요청한 업무 처리를 저장했습니다. 최신 진행 상황을 확인해 주세요.',
      );
      setDialogAction(null);
      setComment('');
    } catch (cause) {
      setFailure(
        cause instanceof Error ? cause.message : '업무를 처리하지 못했습니다. 입력값은 유지됩니다.',
      );
    }
  };

  return (
    <>
      <nav className="crumb" aria-label="현재 위치">
        <Link href="/requests">
          {actor.role === 'APPLICANT' || actor.role === 'ADMIN' ? '신청 현황' : '협의 요청함'}
        </Link>
        <Icon name="chevronRight" size={14} />
        <span>
          {canViewCase ? <Link href={`/cases/${request.caseId}`}>사업 건</Link> : '사업 건'}
        </span>
        <Icon name="chevronRight" size={14} />
        <span>신청 상세</span>
      </nav>
      <PageHeading
        title={request.caseTitle}
        description={
          <div className="request-meta">
            <span>{request.id}</span>
            <span>{DOCUMENT_LABELS[request.docType] ?? request.docType}</span>
            <span>
              {request.department} · {request.ownerName}
            </span>
            <span>설정 게시본 v{request.publicationVersion}</span>
            <Badge
              tone={
                request.status === 'FINALIZED'
                  ? 'success'
                  : request.status === 'SUPPLEMENT_REQUESTED'
                    ? 'warning'
                    : request.status === 'CLOSED'
                      ? 'danger'
                      : 'info'
              }
            >
              {request.statusLabel ?? STATUS_LABELS[request.status]}
            </Badge>
          </div>
        }
      />
      {siblings.length > 0 && (
        <div className="sibling-links">
          <span>함께 신청한 서류</span>
          {siblings.map((sibling) => (
            <Link key={sibling.id} href={`/requests/${sibling.id}`}>
              {DOCUMENT_LABELS[sibling.docType] ?? sibling.docType} ·{' '}
              {STATUS_LABELS[sibling.status]}
              <Icon name="chevronRight" size={14} />
            </Link>
          ))}
        </div>
      )}
      <ol className={`stage-stepper ${terminal ? 'is-terminal' : ''}`} aria-label="신청 진행 단계">
        {STAGE_LABELS.map((label, index) => (
          <li
            key={label}
            aria-current={request.stage === index + 1 ? 'step' : undefined}
            className={
              request.stage === index + 1 ? 'current' : request.stage > index + 1 ? 'done' : ''
            }
          >
            <span className={`step-number stage-${index + 1}`}>
              {request.stage > index + 1 ? <Icon name="check" size={18} /> : index + 1}
            </span>
            <span>{label}</span>
            {request.stage === index + 1 && latestReturn && !terminal && (
              <Badge tone="warning">반환 이력 있음</Badge>
            )}
          </li>
        ))}
      </ol>
      {terminal && (
        <Notice tone={request.status === 'FINALIZED' ? 'success' : 'warning'}>
          <strong>{request.statusLabel ?? STATUS_LABELS[request.status]}된 신청입니다.</strong>{' '}
          내용은 읽기 전용이며 기록과 제출본을 보존합니다.
          {request.status === 'FINALIZED' ? (
            <p>서류 확정은 방화벽 장비 적용을 의미하지 않습니다.</p>
          ) : (
            <TerminalReason requestId={request.id} status={request.status} />
          )}
        </Notice>
      )}
      {latestReturn && request.highlightedFields.length > 0 && (
        <Notice tone="warning">
          <strong>
            {latestReturn.fromStage}단계에서 {latestReturn.targetStage}단계로 반환되었습니다.
          </strong>
          <p>{latestReturn.reason}</p>
          {Object.entries(latestReturn.fieldReasons ?? {}).map(([key, reason]) => (
            <p key={key}>
              {key}: {reason}
            </p>
          ))}
          <p className="help">
            {latestReturn.actorName} · {formatTime(latestReturn.createdAt)} · 기존 값은
            보존했습니다.
          </p>
          <div className="btn-row">
            {request.highlightedFields.map((key) => (
              <a href={`#field-${key}`} key={key}>
                {fields.find((answer) => answer.key === key)?.label ?? key} 보완하기
              </a>
            ))}
          </div>
        </Notice>
      )}
      {request.changedCommonFields.length > 0 && (
        <Notice tone="warning">
          공통 정보가 변경되었습니다.{' '}
          {request.stage === 4 || terminal
            ? '이 신청의 제출본은 변경되지 않았습니다. 담당자는 반환 필요 여부를 확인해 주세요.'
            : '영향 항목을 다시 확인해 주세요.'}
        </Notice>
      )}
      {message && (
        <div role="status">
          <Notice tone="success">{message}</Notice>
        </div>
      )}
      {failure && !dialogAction && <Notice tone="danger">{failure}</Notice>}
      <div className="detail-layout">
        <div className="detail-content">
          <section className="card">
            <div className="section-heading">
              <h2 className="h-sec">사업 정보</h2>
              {canViewCase && (
                <Link className="btn btn-tertiary btn-sm" href={`/cases/${request.caseId}`}>
                  공통 인터뷰 보기
                  <Icon name="chevronRight" size={14} />
                </Link>
              )}
            </div>
            <AnswerView
              answers={request.commonAnswers.filter((answer) => answer.ownerRole === 'APPLICANT')}
              highlighted={request.highlightedFields}
            />
            {has('EDIT_CASE') && caseQuery.data && (
              <details className="sub-block">
                <summary>사업 공통 답변 수정·확인</summary>
                <p className="help">
                  변경 시 미제출 서류는 재검토 대상이 됩니다. 이미 제출한 서류는 보존됩니다.
                </p>
                <AnswerEditor
                  draftKey={`case:${request.caseId}:answers`}
                  answers={caseQuery.data.answers}
                  actor={actor}
                  revision={caseQuery.data.revision}
                  highlighted={request.highlightedFields}
                  onSave={(expectedRevision, answers) =>
                    saveCase.mutateAsync({ expectedRevision, answers })
                  }
                />
              </details>
            )}
            {caseQuery.error && (
              <ErrorState
                error={caseQuery.error}
                onRetry={() => {
                  void caseQuery.refetch();
                }}
              />
            )}
          </section>
          {request.supplements.length > 0 && (
            <section className="card" id="supplements">
              <h2 className="h-sec">보완 요청과 답변</h2>
              {request.supplements.map((supplement) => (
                <article className="supplement-card" key={supplement.id}>
                  <div className="section-heading">
                    <h3 className="h-panel">{FIELD_LABELS[supplement.field]} 담당자 요청</h3>
                    <Badge tone={supplement.status === 'RESOLVED' ? 'success' : 'warning'}>
                      {supplement.status === 'RESOLVED'
                        ? '확인 완료'
                        : supplement.status === 'ANSWERED'
                          ? '담당자 재검토'
                          : '답변 필요'}
                    </Badge>
                  </div>
                  <p>{supplement.reason}</p>
                  <p className="help">
                    대상:{' '}
                    {supplement.fieldKeys
                      .map((key) => fields.find((item) => item.key === key)?.label ?? key)
                      .join(', ')}
                  </p>
                  {supplement.answer && (
                    <div className="supplement-answer">
                      <strong>사용자 답변</strong>
                      <p>{supplement.answer}</p>
                    </div>
                  )}
                  {supplement.status === 'OPEN' && has('ANSWER_SUPPLEMENT') && (
                    <a className="text-link" href={`#supplement-answer-${supplement.id}`}>
                      답변 칸으로 이동 <Icon name="arrowRight" size={16} />
                    </a>
                  )}
                  {supplement.status === 'ANSWERED' &&
                    has('RESOLVE_SUPPLEMENT') &&
                    supplement.field === roleField && (
                      <button
                        className="btn btn-sm"
                        disabled={command.isPending}
                        onClick={() => {
                          void invoke('RESOLVE_SUPPLEMENT', { supplementId: supplement.id });
                        }}
                      >
                        보완 답변 확인 완료
                      </button>
                    )}
                </article>
              ))}
            </section>
          )}
          <section className="card" id="documents">
            <div className="section-heading">
              <h2 className="h-sec">신청 문서</h2>
              <Badge tone={request.currentSubmissionId ? 'info' : 'neutral'}>
                {request.status === 'FINALIZED'
                  ? '확정본'
                  : request.currentSubmissionId
                    ? '제출본'
                    : '작성 초안'}
              </Badge>
            </div>
            <div className="document-detail-card">
              <span className="doc-icon">
                <Icon name="file" size={32} />
              </span>
              <div>
                <h3 className="h-panel">{DOCUMENT_LABELS[request.docType] ?? request.docType}</h3>
                <p className="help">
                  {request.currentSubmissionId
                    ? `제출본 v${request.submissions.at(-1)?.number} · 제출 시점의 공통값·서류값·설정 버전 보존`
                    : `작성 수정본 ${request.revision} · ${pendingCount ? `미확정·미입력 ${pendingCount}개` : '입력 내용 확인됨'}`}
                </p>
                <a
                  className="btn btn-sm"
                  href={`/api/security-requests/${encodeURIComponent(request.id)}/documents`}
                >
                  <Icon name="download" size={16} />
                  검토용 JSON 다운로드
                </a>
                <p className="meta">정식 HWP·PDF 출력은 Back 문서 생성 API 연결 후 지원합니다.</p>
              </div>
            </div>
            {request.submissions.length > 0 && (
              <details className="sub-block">
                <summary>제출본 버전 {request.submissions.length}개 보기</summary>
                {request.submissions.map((submission) => (
                  <div className="submission-version" key={submission.id}>
                    <h3 className="h-panel">제출본 v{submission.number}</h3>
                    <p className="help">
                      {formatTime(submission.createdAt)} · 게시본 v{submission.publicationVersion}
                    </p>
                    <AnswerView answers={[...submission.commonAnswers, ...submission.answers]} />
                  </div>
                ))}
              </details>
            )}
          </section>
          <section className="card">
            <h2 className="h-sec">통신 정보</h2>
            <p className="help">
              ICT인프라 담당자가 확인한 사실만 표시합니다. AI가 내부 주소를 추측하지 않습니다.
            </p>
            <div className="data-flow" aria-label="등록된 시스템 간 데이터 흐름">
              <div>
                <Icon name="building" />
                <strong>{valueOf(request, 'sourceSystem')}</strong>
                <small>{valueOf(request, 'sourceIp')}</small>
              </div>
              <span>
                <Icon name="arrowRight" />
                <small>
                  {valueOf(request, 'protocol')} / {valueOf(request, 'port')}
                </small>
              </span>
              <div>
                <Icon name="building" />
                <strong>{valueOf(request, 'destinationSystem')}</strong>
                <small>{valueOf(request, 'destinationIp')}</small>
              </div>
            </div>
            <AnswerView
              answers={request.commonAnswers.filter((answer) => answer.ownerRole !== 'APPLICANT')}
              highlighted={request.highlightedFields}
            />
          </section>
          <section className="card">
            <h2 className="h-sec">
              {request.docType === 'FIREWALL' ? '방화벽 신청 정보' : '보안성검토 사항'}
            </h2>
            <AnswerView answers={request.answers} highlighted={request.highlightedFields} />
            {(has('EDIT_ANSWERS') || has('SAVE_ANSWERS')) && (
              <details className="sub-block" open={request.stage === 1}>
                <summary>서류별 답변 수정·확인</summary>
                <AnswerEditor
                  draftKey={`request:${request.id}:answers`}
                  answers={request.answers}
                  revision={request.revision}
                  actor={actor}
                  highlighted={request.highlightedFields}
                  onSave={(expectedRevision, answers) =>
                    command.mutateAsync({
                      action: 'SAVE_ANSWERS',
                      expectedRevision,
                      answers,
                      field: roleField,
                    })
                  }
                />
              </details>
            )}
          </section>
          <RequestHistory requestId={request.id} />
        </div>
        <aside className="review-panel">
          <section className="card">
            <h2 className="h-panel">담당자 협의 현황</h2>
            <div className="review-status-grid">
              {(['INFRA', 'SECURITY'] as const).map((field) => {
                const review = request.reviews.find((item) => item.field === field);
                const assignment = request.assignments.find(
                  (item) => item.active && item.field === field,
                );
                const status =
                  review?.status === 'COMPLETE'
                    ? '협의 완료'
                    : review?.status === 'ALLOCATED'
                      ? '할당 완료'
                      : review?.status === 'RECHECK'
                        ? '재검토'
                        : review?.status === 'SUPPLEMENT_REQUESTED'
                          ? '보완 요청'
                          : '검토 대기';
                return (
                  <div className="review-person" key={field}>
                    <strong>{FIELD_LABELS[field]}</strong>
                    <span>
                      {assignment?.assigneeName ??
                        (request.stage === 1 ? '협의 요청 후 배정' : '미배정')}
                    </span>
                    <Badge
                      tone={
                        review?.status === 'COMPLETE'
                          ? 'success'
                          : review?.allocationCompleted
                            ? 'info'
                            : 'neutral'
                      }
                    >
                      {status}
                    </Badge>
                  </div>
                );
              })}
            </div>
            <p className="help">
              INFRA 할당 후 SECURITY 검토를 시작합니다. 할당 완료와 협의 완료는 별개입니다.
            </p>
            {request.deadlines
              .filter((deadline) => deadline.active)
              .map((deadline) => (
                <div className="deadline-line" key={deadline.id}>
                  <Icon name="clock" size={16} />
                  <span>{deadline.field ? `${FIELD_LABELS[deadline.field]} ` : ''}처리 기한</span>
                  <strong>
                    {deadline.dueAt.slice(0, 10)}
                    {deadline.paused ? ' · 일시 중지' : ''}
                  </strong>
                </div>
              ))}
            {request.stage === 4 && (
              <div className="final-confirmations">
                <h3 className="h-panel">제출본 최종 확인</h3>
                {(['INFRA', 'SECURITY'] as const).map((field) => {
                  const confirmation = request.finalConfirmations.find(
                    (item) =>
                      item.submissionId === request.currentSubmissionId && item.field === field,
                  );
                  return (
                    <p key={field}>
                      <Icon name={confirmation ? 'check' : 'clock'} size={16} />
                      {FIELD_LABELS[field]}{' '}
                      <strong>{confirmation ? '최종 확인 완료' : '최종 확인 대기'}</strong>
                    </p>
                  );
                })}
              </div>
            )}
          </section>
          {!terminal && (
            <section className="card review-actions">
              <h2 className="h-panel">
                {actor.role === 'APPLICANT'
                  ? '다음 할 일'
                  : actor.role === 'ADMIN'
                    ? '담당자 배정 관리'
                    : '담당 분야 검토'}
              </h2>
              <p className="help">
                현재 {request.stage}단계 · {request.statusLabel ?? STATUS_LABELS[request.status]}
              </p>
              {actor.role === 'APPLICANT' && request.stage === 2 && (
                <Notice>담당자가 정보를 확인하고 있습니다. 보완 요청이 오면 답변해 주세요.</Notice>
              )}
              {request.blockers.length > 0 && (
                <Notice tone="warning">
                  <strong>제출 전 확인할 사항</strong>
                  <ul>
                    {request.blockers.map((blocker) => (
                      <li key={blocker}>{blocker}</li>
                    ))}
                  </ul>
                </Notice>
              )}
              {(has('COMPLETE_ALLOCATION') || has('COMPLETE_REVIEW') || has('FINAL_CONFIRM')) && (
                <div className="field">
                  <label htmlFor="review-comment">검토 의견</label>
                  <textarea
                    id="review-comment"
                    className="input"
                    rows={3}
                    value={comment}
                    maxLength={2000}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="확인한 내용을 기록해 주세요."
                  />
                </div>
              )}
              {has('REQUEST_REVIEW') && (
                <button
                  className="btn btn-primary full-width"
                  disabled={command.isPending}
                  onClick={() => setDialogAction('REQUEST_REVIEW')}
                >
                  담당자 협의 요청
                  <Icon name="arrowRight" />
                </button>
              )}
              {has('COMPLETE_ALLOCATION') && (
                <button
                  className="btn btn-primary full-width"
                  disabled={command.isPending}
                  onClick={() => {
                    void invoke('COMPLETE_ALLOCATION');
                  }}
                >
                  자원 할당 완료
                </button>
              )}
              {has('COMPLETE_REVIEW') && (
                <button
                  className={`btn full-width ${!has('COMPLETE_ALLOCATION') ? 'btn-primary' : ''}`}
                  disabled={command.isPending}
                  onClick={() => {
                    void invoke('COMPLETE_REVIEW');
                  }}
                >
                  담당 분야 협의 완료
                </button>
              )}
              {has('GENERATE_DRAFT') && (
                <button
                  className="btn full-width"
                  disabled={command.isPending}
                  onClick={() => {
                    void invoke('GENERATE_DRAFT');
                  }}
                >
                  <Icon name="sparkles" />
                  AI 최종 초안 제안
                </button>
              )}
              {has('SUBMIT') && (
                <>
                  <button
                    className="btn btn-primary full-width"
                    disabled={command.isPending || request.blockers.length > 0}
                    onClick={() => setDialogAction('SUBMIT')}
                  >
                    최종 제출
                    <Icon name="arrowRight" />
                  </button>
                  {request.blockers.length > 0 && (
                    <p className="help">위 확인 사항을 해결하면 최종 제출할 수 있습니다.</p>
                  )}
                </>
              )}
              {has('FINAL_CONFIRM') && (
                <button
                  className="btn btn-primary full-width"
                  disabled={command.isPending}
                  onClick={() => {
                    void invoke('FINAL_CONFIRM');
                  }}
                >
                  제출본 최종 확인
                </button>
              )}
              {has('FINALIZE') && (
                <button
                  className="btn btn-primary full-width"
                  disabled={command.isPending}
                  onClick={() => setDialogAction('FINALIZE')}
                >
                  서류 확정
                </button>
              )}
              {has('REASSIGN') && (
                <button className="btn full-width" onClick={() => setDialogAction('REASSIGN')}>
                  담당자 재배정
                </button>
              )}
              {request.supplements
                .filter((item) => item.status === 'OPEN' && has('ANSWER_SUPPLEMENT'))
                .map((supplement) => (
                  <SupplementAnswer
                    key={supplement.id}
                    id={supplement.id}
                    reason={supplement.reason}
                    pending={command.isPending}
                    onSave={(answer) =>
                      invoke('ANSWER_SUPPLEMENT', { supplementId: supplement.id, answer })
                    }
                  />
                ))}
              {(has('REQUEST_SUPPLEMENT') || has('RETURN') || has('CLOSE') || has('WITHDRAW')) && (
                <div className="review-secondary-actions">
                  {has('REQUEST_SUPPLEMENT') && (
                    <button
                      className="btn btn-tertiary"
                      onClick={() => setDialogAction('REQUEST_SUPPLEMENT')}
                    >
                      보완 요청하기
                    </button>
                  )}
                  {has('RETURN') && (
                    <button className="btn btn-tertiary" onClick={() => setDialogAction('RETURN')}>
                      이전 단계로 반환
                    </button>
                  )}
                  {has('CLOSE') && (
                    <button
                      className="btn btn-tertiary danger-text"
                      onClick={() => setDialogAction('CLOSE')}
                    >
                      종결(반려)
                    </button>
                  )}
                  {has('WITHDRAW') && (
                    <button
                      className="btn btn-tertiary danger-text"
                      onClick={() => setDialogAction('WITHDRAW')}
                    >
                      신청 철회
                    </button>
                  )}
                </div>
              )}
              {command.isPending && <p role="status">처리 중입니다. 잠시 기다려 주세요.</p>}
              {['INFRA', 'SECURITY'].includes(actor.role) &&
                !request.assignments.some(
                  (item) => item.active && item.assigneeId === actor.id,
                ) && <Notice>배정된 담당자만 검토할 수 있습니다. 현재 조회만 가능합니다.</Notice>}
            </section>
          )}
        </aside>
      </div>
      <CommandDialog
        action={dialogAction}
        request={request}
        actor={actor}
        pending={command.isPending}
        error={failure}
        onClose={() => {
          setDialogAction(null);
          setFailure('');
        }}
        onSubmit={(action, extra) => invoke(action, extra)}
      />
    </>
  );
}

function SupplementAnswer({
  id,
  reason,
  pending,
  onSave,
}: {
  id: string;
  reason: string;
  pending: boolean;
  onSave: (answer: string) => Promise<void>;
}) {
  const [answer, setAnswer] = useState('');
  return (
    <form
      className="supplement-answer-form"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(answer);
      }}
    >
      <label htmlFor={`supplement-answer-${id}`}>
        <strong>보완 답변</strong>
        <span>{reason}</span>
      </label>
      <textarea
        className="input"
        id={`supplement-answer-${id}`}
        value={answer}
        maxLength={4000}
        required
        rows={3}
        onChange={(e) => setAnswer(e.target.value)}
      />
      <button className="btn full-width" disabled={pending}>
        보완 답변 등록
      </button>
    </form>
  );
}

const ACTION_LABELS: Partial<Record<CommandAction, string>> = {
  REQUEST_REVIEW: '담당자 협의 요청',
  RETURN: '이전 단계로 반환',
  REQUEST_SUPPLEMENT: '보완 요청',
  CLOSE: '신청 종결(반려)',
  WITHDRAW: '신청 철회',
  REASSIGN: '담당자 재배정',
  SUBMIT: '최종 제출',
  FINALIZE: '서류 확정',
};

function CommandDialog(props: {
  action: CommandAction | null;
  request: SecurityRequest;
  actor: Actor;
  pending: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (action: CommandAction, extra: Partial<CommandInput>) => Promise<void>;
}) {
  return (
    <Modal
      open={props.action !== null}
      title={props.action ? (ACTION_LABELS[props.action] ?? '업무 처리') : '업무 처리'}
      onClose={props.onClose}
    >
      {props.action && <CommandForm key={props.action} {...props} action={props.action} />}
    </Modal>
  );
}

function CommandForm({
  action,
  request,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  action: CommandAction;
  request: SecurityRequest;
  actor: Actor;
  pending: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (action: CommandAction, extra: Partial<CommandInput>) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [fieldKeys, setFieldKeys] = useState<string[]>([]);
  const targets = request.stage === 2 ? [1] : request.stage === 3 ? [2, 1] : [3];
  const [targetStage, setTargetStage] = useState(targets[0]);
  const [field, setField] = useState<ReviewField>('INFRA');
  const [assigneeId, setAssigneeId] = useState('');
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [localError, setLocalError] = useState('');
  const reasonRequired = ['RETURN', 'CLOSE', 'WITHDRAW', 'REASSIGN', 'REQUEST_SUPPLEMENT'].includes(
    action,
  );
  const fieldsRequired = action === 'RETURN' || action === 'REQUEST_SUPPLEMENT';
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (fieldsRequired && !fieldKeys.length) {
          setLocalError('보완할 항목을 한 개 이상 선택해 주세요.');
          return;
        }
        setLocalError('');
        void onSubmit(action, {
          reason,
          fieldKeys,
          targetStage,
          ...(action === 'REASSIGN' ? { field, assigneeId } : {}),
          ...(action === 'SUBMIT' ? { idempotencyKey } : {}),
        });
      }}
    >
      <p>
        <strong>{DOCUMENT_LABELS[request.docType] ?? request.docType}</strong> · {request.caseTitle}
      </p>
      {action === 'REQUEST_REVIEW' && (
        <Notice>
          이 서류를 2단계로 보내고 ICT인프라·정보보안 담당자를 자동 배정합니다. 같은 사업의 다른
          서류는 현재 단계에 남습니다.
        </Notice>
      )}
      {action === 'SUBMIT' && (
        <Notice>
          현재 답변과 설정 버전을 제출본으로 고정합니다. 제출 후 수정은 담당자의 4→3 반환을 통해
          진행합니다.
        </Notice>
      )}
      {action === 'FINALIZE' && (
        <Notice>
          두 분야의 최종 확인이 완료된 이 제출본을 확정합니다. 방화벽 장비 적용은 별도 업무입니다.
        </Notice>
      )}
      {(action === 'CLOSE' || action === 'WITHDRAW') && (
        <Notice tone="warning">
          {action === 'CLOSE' ? '종결' : '철회'} 후에는 신청 내용을 고치거나 다시 진행할 수
          없습니다. 기존 값과 이력은 보존됩니다.
        </Notice>
      )}
      {action === 'RETURN' && (
        <div className="field">
          <label htmlFor="return-stage">반환할 단계</label>
          <select
            id="return-stage"
            className="input"
            value={targetStage}
            onChange={(event) => setTargetStage(Number(event.target.value))}
          >
            {targets.map((stage) => (
              <option key={stage} value={stage}>
                {stage}단계 · {STAGE_LABELS[stage - 1]}
              </option>
            ))}
          </select>
        </div>
      )}
      {fieldsRequired && (
        <fieldset className="return-fields">
          <legend>보완 필요 항목 (필수)</legend>
          {[...request.commonAnswers, ...request.answers].map((answer) => (
            <label className="check-row" key={`${answer.scope}-${answer.key}`}>
              <input
                type="checkbox"
                checked={fieldKeys.includes(answer.key)}
                onChange={(event) =>
                  setFieldKeys((old) =>
                    event.target.checked
                      ? [...old, answer.key]
                      : old.filter((key) => key !== answer.key),
                  )
                }
              />
              {answer.label}
            </label>
          ))}
          <p className="help">선택한 항목만 강조합니다. 기존 값은 지우지 않습니다.</p>
        </fieldset>
      )}
      {action === 'REASSIGN' && (
        <AssigneeSelector
          field={field}
          assigneeId={assigneeId}
          onField={(next) => {
            setField(next);
            setAssigneeId('');
          }}
          onAssignee={setAssigneeId}
          ownerId={request.ownerId}
        />
      )}
      {reasonRequired && (
        <div className="field">
          <label htmlFor="action-reason">사유 (필수)</label>
          <textarea
            id="action-reason"
            className="input"
            required
            rows={3}
            maxLength={2000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      )}
      {(error || localError) && <Notice tone="danger">{error || localError}</Notice>}
      <div className="dlg-actions">
        <button type="button" className="btn" onClick={onClose} disabled={pending}>
          되돌아가기
        </button>
        <button
          className={`btn ${action === 'CLOSE' || action === 'WITHDRAW' ? 'btn-danger' : 'btn-primary'}`}
          disabled={pending}
        >
          {pending
            ? '처리 중…'
            : action === 'RETURN'
              ? `${targetStage}단계로 반환`
              : ACTION_LABELS[action]}
        </button>
      </div>
    </form>
  );
}

function AssigneeSelector({
  field,
  assigneeId,
  onField,
  onAssignee,
  ownerId,
}: {
  field: ReviewField;
  assigneeId: string;
  onField: (value: ReviewField) => void;
  onAssignee: (value: string) => void;
  ownerId: string;
}) {
  const query = useMembers();
  return (
    <>
      <div className="field">
        <label htmlFor="assignment-field">분야</label>
        <select
          id="assignment-field"
          className="input"
          value={field}
          onChange={(event) => onField(event.target.value as ReviewField)}
        >
          <option value="INFRA">ICT인프라</option>
          <option value="SECURITY">정보보안</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="assignment-person">새 담당자</label>
        <select
          id="assignment-person"
          className="input"
          required
          value={assigneeId}
          onChange={(event) => onAssignee(event.target.value)}
        >
          <option value="">담당자를 선택해 주세요</option>
          {query.data
            ?.filter((member) => member.role === field && member.active && member.id !== ownerId)
            .map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
        </select>
      </div>
      {query.error && <ErrorState error={query.error} />}
    </>
  );
}

function TerminalReason({ requestId, status }: { requestId: string; status: string }) {
  const audit = useAudit(requestId);
  const event = audit.data?.find(
    (item) =>
      item.targetId === requestId &&
      [
        status === 'CLOSED' ? 'REQUEST_CLOSED' : 'REQUEST_WITHDRAWN',
        status === 'CLOSED' ? 'CLOSE' : 'WITHDRAW',
      ].includes(item.action),
  );
  return event ? (
    <p>
      사유: {event.reason} · {event.actorName} · {formatTime(event.createdAt)}
    </p>
  ) : audit.error ? (
    <p>처리 사유를 불러오지 못했습니다. 처리 이력에서 다시 확인해 주세요.</p>
  ) : null;
}

function RequestHistory({ requestId }: { requestId: string }) {
  const audit = useAudit(requestId);
  const events = (audit.data ?? []).filter((event) => event.targetId === requestId);
  return (
    <section className="card">
      <h2 className="h-sec">처리 이력</h2>
      {audit.isPending ? (
        <LoadingState />
      ) : audit.error ? (
        <ErrorState
          error={audit.error}
          onRetry={() => {
            void audit.refetch();
          }}
        />
      ) : events.length ? (
        <ol className="history-timeline">
          {events
            .slice()
            .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
            .slice(0, 12)
            .map((event) => (
              <li key={event.id}>
                <Icon name="clock" size={16} />
                <div>
                  <strong>{auditActionLabel(event.action)}</strong>
                  <p className="help">
                    {event.actorName} · {formatTime(event.createdAt)} · 수정본{' '}
                    {event.targetRevision}
                  </p>
                  {event.reason && <p>{event.reason}</p>}
                </div>
              </li>
            ))}
        </ol>
      ) : (
        <p className="help">이 신청의 처리 이력이 아직 없습니다.</p>
      )}
    </section>
  );
}

function valueOf(request: SecurityRequest, key: string) {
  return request.commonAnswers.find((answer) => answer.key === key)?.value || '담당자 확인 필요';
}
function formatTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul',
  }).format(new Date(value));
}
