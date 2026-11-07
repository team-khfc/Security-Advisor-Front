'use client';

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import {
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  Notice,
  PageHeading,
  Badge,
} from '@/components/ui';
import { useSession } from '@/features/auth';
import { useInputDraft } from '@/lib/inputDrafts';
import { forgetUpload, getUpload } from '@/lib/uploadDraft';
import { AnswerEditor, AnswerView } from './AnswerEditor';
import { DOCUMENT_LABELS, STATUS_LABELS, type BusinessCase, type Answer } from './types';
import { useAnalysis, useApplyAnalysis, useCase, useRequests, useSaveCase } from './useRequests';

/** 명시적 분석 요청과 제안 적용을 구분하고 실패 시 직접 입력을 유지한다. */
export function AnalysisPanel({ businessCase }: { businessCase: BusinessCase }) {
  const session = useSession();
  const actorId = session.data?.member.id ?? '';
  const { draft, saveDraft, clearDraft } = useInputDraft<{ text: string; file?: File }>(
    actorId,
    `case:${businessCase.id}:analysis`,
  );
  const file = draft?.file ?? getUpload(actorId, businessCase.id);
  const text = draft?.text ?? businessCase.description;
  const [fileError, setFileError] = useState('');
  const analysis = useAnalysis();
  const apply = useApplyAnalysis();
  const [applied, setApplied] = useState(false);

  return (
    <section className="analysis-panel" aria-labelledby="analysis-title">
      <h3 className="h-panel" id="analysis-title">
        <Icon name="sparkles" /> 기획서·개요에서 정보 찾기
      </h3>
      <p className="help">
        {session.data?.mock
          ? '모의 분석은 합성 후보를 반환합니다. 실제 파일 파싱·LLM 호출은 Back 연동 후 지원합니다.'
          : '분석 결과는 제안입니다. 출처와 내용을 읽고 사람이 확인해 주세요.'}
      </p>
      <div className="field">
        <label htmlFor="analysis-text">분석할 사업 개요</label>
        <textarea
          id="analysis-text"
          className="input"
          rows={3}
          value={text}
          maxLength={4000}
          onChange={(e) => {
            saveDraft({ text: e.target.value, file });
            setApplied(false);
            analysis.reset();
          }}
          placeholder="업무 목적과 다루는 정보를 적어 주세요."
        />
      </div>
      <div className="field">
        <label htmlFor="analysis-file">문서 첨부 (선택)</label>
        <input
          id="analysis-file"
          type="file"
          accept=".pdf,.hwp,.hwpx,.docx"
          onChange={(e) => {
            const selected = e.target.files?.[0];
            setFileError('');
            analysis.reset();
            setApplied(false);
            if (
              selected &&
              (!/\.(pdf|hwp|hwpx|docx)$/i.test(selected.name) || selected.size > 10 * 1024 * 1024)
            ) {
              setFileError('허용된 문서 형식으로 10MB 이하의 파일을 선택해 주세요.');
              return;
            }
            if (!selected) forgetUpload(actorId, businessCase.id);
            saveDraft({ text, file: selected });
          }}
        />
        {file && (
          <p className="help file-name">
            {file.name} · 선택됨, 분석 요청 전에는 전송하지 않습니다.
          </p>
        )}
      </div>
      {fileError && <Notice tone="danger">{fileError}</Notice>}
      <button
        className="btn"
        type="button"
        disabled={analysis.isPending || (!text.trim() && !file) || Boolean(fileError)}
        onClick={async () => {
          analysis.reset();
          apply.reset();
          setApplied(false);
          try {
            await analysis.mutateAsync({
              caseId: businessCase.id,
              expectedRevision: businessCase.revision,
              text,
              file,
            });
            forgetUpload(actorId, businessCase.id);
          } catch {
            /* mutation 오류 영역에서 재시도 수단과 함께 설명한다. */
          }
        }}
      >
        <Icon name="sparkles" />
        {analysis.isPending ? '분석 요청 중…' : '분석 요청'}
      </button>
      {analysis.isPending && (
        <p role="status">
          파일을 전송하고 분석 결과를 기다리고 있습니다. 입력한 개요는 유지됩니다.
        </p>
      )}
      {analysis.error && (
        <Notice tone="danger">
          {analysis.error.message} 직접 입력을 계속하거나 다시 분석을 요청할 수 있습니다.
        </Notice>
      )}
      {analysis.data && !analysis.error && (
        <div className="analysis-result">
          <Badge tone="warning">
            {analysis.data.mode === 'EXAMPLE' ? '모의 AI 제안' : 'AI 제안'} · 미확정
          </Badge>
          <p className="help">이 제안을 적용해도 확인 완료로 바뀌지 않습니다.</p>
          {analysis.data.suggestions.map((suggestion) => (
            <div className="candidate" key={suggestion.key}>
              <p>{suggestion.value}</p>
              <small>근거: {suggestion.evidence}</small>
            </div>
          ))}
          {analysis.data.revision !== businessCase.revision && !applied && (
            <Notice tone="warning">
              분석 이후 사업 정보가 변경되었습니다. 최신 내용으로 다시 분석해 주세요.
            </Notice>
          )}
          {apply.error && <Notice tone="danger">{apply.error.message}</Notice>}
          {applied ? (
            <p role="status" className="save-success">
              제안을 미확정 상태로 적용했습니다. 아래 답변에서 확인해 주세요.
            </p>
          ) : (
            <button
              type="button"
              className="btn"
              disabled={apply.isPending || analysis.data.revision !== businessCase.revision}
              onClick={async () => {
                if (!analysis.data) return;
                try {
                  await apply.mutateAsync({
                    id: analysis.data.id,
                    expectedRevision: businessCase.revision,
                  });
                  clearDraft();
                  setApplied(true);
                } catch {
                  /* 적용 실패는 위 오류 영역에 표시한다. */
                }
              }}
            >
              {apply.isPending ? '적용 중…' : '제안을 미확정 답변으로 적용'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/** 공통 질문을 한 번 답하고 서류별 독립 신청으로 이어 준다. */
export function CaseInterview({ id }: { id: string }) {
  const query = useCase(id);
  const requests = useRequests();
  const session = useSession();
  if (query.isPending || requests.isPending || session.isPending) return <LoadingState />;
  if (query.error || requests.error)
    return (
      <ErrorState
        error={query.error || requests.error}
        onRetry={() => {
          void query.refetch();
          void requests.refetch();
        }}
      />
    );
  if (!query.data || !session.data) return <EmptyState title="사업 건을 찾을 수 없습니다" />;
  return (
    <InterviewWorkspace
      key={`${query.data.id}:${session.data.member.id}`}
      businessCase={query.data}
      requests={(requests.data ?? []).filter((request) => request.caseId === id)}
      actor={session.data.member}
    />
  );
}

function InterviewWorkspace({
  businessCase,
  requests,
  actor,
}: {
  businessCase: BusinessCase;
  requests: NonNullable<ReturnType<typeof useRequests>['data']>;
  actor: NonNullable<ReturnType<typeof useSession>['data']>['member'];
}) {
  const save = useSaveCase(businessCase.id);
  const questions = businessCase.answers.filter((answer) => answer.ownerRole === 'APPLICANT');
  const { draft, saveDraft, clearDraft } = useInputDraft<{
    questionIndex: number;
    answers: Record<string, { value: string; revision: number }>;
  }>(actor.id, `case:${businessCase.id}:interview`);
  const [questionIndex, setQuestionIndex] = useState(() => draft?.questionIndex ?? 0);
  const [chat, setChat] = useState<{ question: string; answer: string }[]>([]);
  const [panelWidth, setPanelWidth] = useState(380);
  const [error, setError] = useState('');
  const question = questions[questionIndex];
  const draftAnswer = question ? draft?.answers[question.key] : undefined;
  const answerText = draftAnswer?.value ?? question?.value ?? '';
  const answerRevision = draftAnswer?.revision ?? businessCase.revision;
  const conflict = Boolean(draftAnswer && answerRevision !== businessCase.revision);
  const goToQuestion = (next: number) => {
    setQuestionIndex(next);
    if (draft) saveDraft({ ...draft, questionIndex: next });
  };
  const commonComplete = questions.filter(
    (answer) => (answer.value || answer.notApplicable) && answer.confirmed,
  ).length;
  const editable =
    actor.role === 'APPLICANT' &&
    actor.id === businessCase.ownerId &&
    requests.some(
      (request) =>
        request.stage < 4 && !['CLOSED', 'WITHDRAWN', 'FINALIZED'].includes(request.status),
    );
  const viewStyle = { '--info-w': `${panelWidth}px` } as CSSProperties;

  return (
    <>
      <nav className="crumb" aria-label="현재 위치">
        <Link href="/requests">신청 현황</Link>
        <Icon name="chevronRight" size={14} />
        <span>공통 정보 작성</span>
      </nav>
      <PageHeading
        title={businessCase.title}
        description={
          <>
            {businessCase.id} · 공통 인터뷰 한 번으로 {requests.length}종 서류 작성
          </>
        }
      />
      <div className="case-document-tabs" aria-label="이 사업의 신청 서류">
        {requests.map((request) => (
          <Link className="case-document-link" key={request.id} href={`/requests/${request.id}`}>
            <Icon name="file" />
            <strong>{DOCUMENT_LABELS[request.docType]}</strong>
            <Badge>{STATUS_LABELS[request.status]}</Badge>
            <Icon name="arrowRight" size={18} />
          </Link>
        ))}
      </div>
      <div className="interview-workspace" style={viewStyle}>
        <section className="conversation-panel">
          <div className="conversation-heading">
            <span className="assistant-avatar">
              <Icon name="sparkles" />
            </span>
            <div>
              <h2 className="h-panel">보안정보 도우미</h2>
              <p className="help">업무를 설명해 주시면 필요한 보안정보를 함께 정리해요.</p>
            </div>
          </div>
          <div className="conversation-body">
            <div className="ai-message">
              <p>안녕하세요. 사업 목적과 처리하는 정보부터 살펴볼게요.</p>
              <p>서버·IP·포트처럼 확인이 필요한 정보는 ICT인프라 담당자에게 연결합니다.</p>
            </div>
            {chat.map((item, index) => (
              <div className="chat-pair" key={`${index}-${item.question}`}>
                <p className="chat-question">{item.question}</p>
                <p className="user-message">{item.answer}</p>
              </div>
            ))}
            {editable && (
              <details className="sub-block">
                <summary>기획서로 시작하거나 AI 제안 받기</summary>
                <AnalysisPanel businessCase={businessCase} />
              </details>
            )}
            {!editable && (
              <Notice>
                이 사업 건은 현재 읽기 전용입니다. 서류별 상세에서 진행 상황을 확인하세요.
              </Notice>
            )}
          </div>
          {editable && question && (
            <form
              className="interview-question"
              onSubmit={async (event) => {
                event.preventDefault();
                setError('');
                const value = answerText;
                try {
                  await save.mutateAsync({
                    expectedRevision: answerRevision,
                    answers: [
                      {
                        key: question.key,
                        value,
                        confirmed: Boolean(value.trim()),
                        notApplicable: false,
                      },
                    ],
                  });
                  setChat((old) => [
                    ...old,
                    { question: question.label, answer: value || '담당자 확인 필요' },
                  ]);
                  const remaining = { ...draft?.answers };
                  delete remaining[question.key];
                  if (Object.keys(remaining).length)
                    saveDraft({ questionIndex: questionIndex + 1, answers: remaining });
                  else clearDraft();
                  setQuestionIndex(questionIndex + 1);
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : '답변을 저장하지 못했습니다.');
                }
              }}
            >
              <div className="question-progress">
                <span>
                  공통 질문 {questionIndex + 1} / {questions.length}
                </span>
                <span>신청자 답변</span>
              </div>
              <label className="h-panel" htmlFor="interview-answer">
                {question.label}
              </label>
              <p className="help">{questionHelp(question)}</p>
              <textarea
                className="input"
                id="interview-answer"
                rows={3}
                maxLength={4000}
                value={answerText}
                disabled={save.isPending}
                onChange={(e) =>
                  saveDraft({
                    questionIndex,
                    answers: {
                      ...draft?.answers,
                      [question.key]: { value: e.target.value, revision: answerRevision },
                    },
                  })
                }
              />
              {draftAnswer && (
                <p className="help">
                  저장하지 않은 입력은 이 탭에서 같은 계정으로 돌아오면 복원됩니다. 새로고침하거나
                  탭을 닫으면 사라집니다.
                </p>
              )}
              {conflict && (
                <Notice tone="warning">
                  <p>서버에 새 내용이 있습니다. 작성한 답변은 유지했습니다.</p>
                  <p>서버 최신 값: {question.value || '입력 없음'}</p>
                  <button
                    className="btn btn-sm"
                    type="button"
                    onClick={() => {
                      if (draft)
                        saveDraft({
                          ...draft,
                          answers: {
                            ...draft.answers,
                            [question.key]: { value: answerText, revision: businessCase.revision },
                          },
                        });
                    }}
                  >
                    내 답변을 유지하고 최신 버전 기준으로 저장 준비
                  </button>
                </Notice>
              )}
              {error && <Notice tone="danger">{error}</Notice>}
              <div className="btn-row">
                <button className="btn btn-primary" disabled={save.isPending || conflict}>
                  {save.isPending
                    ? '저장 중…'
                    : questionIndex === questions.length - 1
                      ? '공통 답변 저장'
                      : '답변 저장하고 다음'}
                  <Icon name="arrowRight" />
                </button>
                <button
                  type="button"
                  className="btn btn-tertiary"
                  disabled={save.isPending}
                  onClick={() => {
                    goToQuestion(questionIndex + 1);
                  }}
                >
                  나중에 입력
                </button>
              </div>
            </form>
          )}
          {editable && !question && (
            <div className="interview-question">
              <h3 className="h-panel">공통 정보를 정리했습니다</h3>
              <p>서류별 상세 화면에서 추가 항목을 확인하고 담당자에게 협의를 요청해 주세요.</p>
              <div className="btn-row">
                {requests.map((request, index) => (
                  <Link
                    className={`btn ${index === 0 ? 'btn-primary' : ''}`}
                    key={request.id}
                    href={`/requests/${request.id}`}
                  >
                    {DOCUMENT_LABELS[request.docType]} 작성
                    <Icon name="arrowRight" />
                  </Link>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-tertiary"
                onClick={() => {
                  goToQuestion(0);
                }}
              >
                공통 질문 다시 보기
              </button>
            </div>
          )}
        </section>
        <div
          role="separator"
          tabIndex={0}
          aria-label="수집 정보 패널 너비"
          aria-orientation="vertical"
          aria-valuemin={320}
          aria-valuemax={560}
          aria-valuenow={panelWidth}
          className="panel-resizer"
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault();
              setPanelWidth((old) =>
                Math.max(320, Math.min(560, old + (event.key === 'ArrowLeft' ? 20 : -20))),
              );
            }
          }}
          onDoubleClick={() => setPanelWidth(380)}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              setPanelWidth((old) => Math.max(320, Math.min(560, old - event.movementX)));
          }}
          onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
        >
          <span />
        </div>
        <aside className="collected-panel">
          <div className="collected-head">
            <h2 className="h-panel">
              <Icon name="file" /> 수집된 보안정보
            </h2>
            <p>
              공통 필수정보{' '}
              <strong>
                {commonComplete} / {questions.length}
              </strong>
            </p>
            <progress
              value={commonComplete}
              max={Math.max(1, questions.length)}
              aria-label="확인한 공통 답변"
            />
          </div>
          <div className="collected-body">
            <h3 className="h-panel">사업 정보</h3>
            <p className="help">
              {businessCase.department} · 설정 게시본 v{businessCase.publicationVersion}
            </p>
            <AnswerView
              answers={businessCase.answers.filter((answer) => answer.ownerRole === 'APPLICANT')}
            />
            <h3 className="h-panel">담당자 확인 항목</h3>
            <p className="help">내부 시스템 정보는 담당자가 직접 입력합니다.</p>
            <AnswerView
              answers={businessCase.answers.filter((answer) => answer.ownerRole !== 'APPLICANT')}
            />
          </div>
        </aside>
      </div>
      {editable && (
        <details className="card manual-editor">
          <summary>공통 답변 전체 수정·AI 제안 확인</summary>
          <AnswerEditor
            key={`${businessCase.id}-${actor.id}`}
            draftKey={`case:${businessCase.id}:answers`}
            answers={businessCase.answers}
            actor={actor}
            revision={businessCase.revision}
            onSave={(expectedRevision, answers) => save.mutateAsync({ expectedRevision, answers })}
          />
        </details>
      )}
    </>
  );
}

function questionHelp(question: Answer) {
  const hints: Record<string, string> = {
    purpose: '어떤 업무를 위해 필요한 사업인가요? 전문 용어 없이 설명해도 괜찮아요.',
    dataTypes: '공개 자료, 개인정보 등 처리하는 정보의 종류를 알려주세요.',
    externalTransfer: '기관 밖으로 전달하거나 외부에서 가져오는 정보가 있나요?',
    dataFlow: '누가 어떤 서비스를 거쳐 정보를 주고받는지 순서대로 적어주세요.',
  };
  return (
    hints[question.key] || '알고 있는 사실을 적어주세요. 모르는 내용은 나중에 입력할 수 있습니다.'
  );
}
