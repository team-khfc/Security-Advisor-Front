'use client';

import { useState } from 'react';
import { PdfDownloadButton } from './PdfDownloadButton';
import { FinalReportText } from './FinalReportText';
import { useFinalDraft } from '@/features/request/useFinalDraft';
import { Badge, Modal, Notice } from '@/components/ui';
import { AnswerView } from '@/features/request/AnswerEditor';
import {
  DOCUMENT_LABELS,
  type Answer,
  type SecurityRequest,
  type Submission,
} from '@/features/request/types';

const SOURCE_LABELS = {
  USER_ANSWER: '사용자 답변',
  AI_INFERRED: 'AI 추론',
  STAFF_INPUT: '담당자 입력',
  STAFF_CONFIRMED: '담당자 확인',
} as const;

function isConfirmed(answer: Answer) {
  return Boolean(
    answer.source &&
    answer.confirmed &&
    !answer.needsReview &&
    (answer.source === 'USER_ANSWER' || answer.confirmation) &&
    (answer.notApplicable || answer.value.trim()),
  );
}

function needsConfirmation(answer: Answer) {
  return (
    Boolean(answer.required || answer.value.trim() || answer.notApplicable) && !isConfirmed(answer)
  );
}

function documentLabel(request: SecurityRequest, submission?: Submission) {
  if (submission) {
    return `${request.status === 'FINALIZED' ? '확정본 · ' : ''}제출본 v${submission.number}`;
  }
  return `${request.stage === 1 ? '작성 초안' : '검토 초안'} · 수정본 ${request.revision}`;
}

function documentTitle(request: SecurityRequest, submission?: Submission) {
  const snapshot = submission?.snapshot;
  if (
    snapshot &&
    typeof snapshot === 'object' &&
    'caseTitle' in snapshot &&
    typeof snapshot.caseTitle === 'string'
  ) {
    return snapshot.caseTitle;
  }
  return request.caseTitle;
}

function documentText(request: SecurityRequest, answers: Answer[], submission?: Submission) {
  return [
    `[${DOCUMENT_LABELS[request.docType] ?? request.docType}] ${documentLabel(request, submission)}`,
    `사업명: ${documentTitle(request, submission)}`,
    `신청번호: ${request.id}`,
    `신청 부서·신청자: ${request.department} ${request.ownerName}`,
    `적용 설정: v${submission?.publicationVersion ?? request.publicationVersion}`,
    ...(submission ? [`제출 일시: ${formatTime(submission.createdAt)} (한국 시간)`] : []),
    '',
    ...(['CASE', 'REQUEST'] as const).flatMap((scope) => [
      scope === 'CASE' ? '--- 사업 공통 정보 ---' : '--- 신청 정보 ---',
      ...answers
        .filter((answer) => answer.scope === scope)
        .flatMap((answer) => [
          `${answer.label}: ${answer.notApplicable ? '미해당' : answer.value.trim() ? answer.value : '담당자 확인 필요'}`,
          `출처: ${answer.source ? SOURCE_LABELS[answer.source] : '담당자 확인 필요'}`,
          `확인 상태: ${isConfirmed(answer) ? '확인됨' : '담당자 확인 필요'}${answer.confirmation ? ` · ${answer.confirmation.actorName} (${formatTime(answer.confirmation.at)})` : ''}`,
          ...(answer.evidence ? [`근거: ${answer.evidence}`] : []),
          '',
        ]),
    ]),
    `미확정 항목: ${answers.filter(needsConfirmation).length}개`,
    '',
    '※ AI 추론은 사람이 확인하기 전까지 미확정입니다.',
    '※ 서류 확정은 실제 방화벽 적용을 의미하지 않습니다.',
  ].join('\n');
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul',
  }).format(new Date(value));
}

/** 시안의 문서 카드에서 실제 저장값과 불변 제출본을 구분해 미리보고 내려받는다. */
export function RequestDocument({ request }: { request: SecurityRequest }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const submission = request.submissions.find((item) => item.id === request.currentSubmissionId);
  const finalDraft = useFinalDraft(request.id, !submission && request.stage === 3);
  const finalPending = !!finalDraft.data && (!finalDraft.data.confirmed || finalDraft.data.stale);
  const unavailable = Boolean(
    (request.currentSubmissionId || request.stage === 4 || request.status === 'FINALIZED') &&
    !submission,
  );
  const answers = unavailable
    ? []
    : submission
      ? [...submission.commonAnswers, ...submission.answers]
      : [...request.commonAnswers, ...request.answers];
  const text = documentText(request, answers, submission);
  const aiPending =
    answers.filter((answer) => answer.source === 'AI_INFERRED' && needsConfirmation(answer))
      .length + (finalPending && finalDraft.data?.valueSource === 'AI_INFERRED' ? 1 : 0);
  const otherPending =
    answers.filter((answer) => answer.source !== 'AI_INFERRED' && needsConfirmation(answer))
      .length + (finalPending && finalDraft.data?.valueSource === 'USER_ANSWER' ? 1 : 0);
  const checkState = [
    otherPending > 0 ? `미확정 ${otherPending}개` : '',
    aiPending > 0 ? `AI 추론 미확인 ${aiPending}개` : '',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <section className="card" id="documents" aria-labelledby="d-docs">
      <h2 className="h-panel" id="d-docs">
        문서
      </h2>
      <div className="doc in">
        <div className="doc-h">
          <Badge
            tone={request.status === 'FINALIZED' ? 'success' : submission ? 'info' : 'neutral'}
          >
            {unavailable ? '제출본' : documentLabel(request, submission)}
          </Badge>
        </div>
        <h3 className="doc-t">{DOCUMENT_LABELS[request.docType] ?? request.docType}</h3>
        <dl className="doc-dl">
          <div>
            <dt>적용 설정</dt>
            <dd>
              {unavailable
                ? '확인 필요'
                : `v${submission?.publicationVersion ?? request.publicationVersion}`}
            </dd>
          </div>
          <div>
            <dt>확인 상태</dt>
            <dd>
              {unavailable ? (
                '확인 필요'
              ) : checkState ? (
                <span className="need-txt">{checkState}</span>
              ) : answers.some(
                  (answer) => answer.required || answer.value.trim() || answer.notApplicable,
                ) ? (
                '모든 값 확인됨'
              ) : (
                '작성한 값 없음'
              )}
            </dd>
          </div>
          <div>
            <dt>문서 형식</dt>
            <dd>{unavailable ? '확인 필요' : 'PDF · 생성 후 용량 표시'}</dd>
          </div>
        </dl>
        {unavailable && (
          <Notice tone="warning">
            제출본 내용을 불러오지 못했습니다. 화면을 새로고침해 다시 확인해 주세요.
          </Notice>
        )}
        {submission && (
          <p className="help document-readonly">
            <time dateTime={submission.createdAt}>{formatTime(submission.createdAt)}</time> 제출,
            읽기 전용
          </p>
        )}
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-sm"
            disabled={unavailable}
            onClick={() => setPreviewOpen(true)}
          >
            문서 미리보기
          </button>
          <PdfDownloadButton
            requestId={request.id}
            submissionId={submission?.id}
            disabled={unavailable}
          />
        </div>
      </div>
      {request.submissions.length > 0 && (
        <details className="sub-block">
          <summary>제출본 버전 {request.submissions.length}개 보기</summary>
          {request.submissions.map((version) => (
            <div className="submission-version" key={version.id}>
              <h3 className="h-panel">제출본 v{version.number}</h3>
              <p className="help">
                {formatTime(version.createdAt)} · 게시본 v{version.publicationVersion}
              </p>
              <AnswerView answers={[...version.commonAnswers, ...version.answers]} />
              <FinalReportText request={request} submission={version} />
              <PdfDownloadButton requestId={request.id} submissionId={version.id} />
            </div>
          ))}
        </details>
      )}
      <Modal
        open={previewOpen && !unavailable}
        onClose={() => setPreviewOpen(false)}
        title={`${documentTitle(request, submission)} ${documentLabel(request, submission)} 미리보기`}
      >
        <pre className="docpre" tabIndex={0} aria-label="문서 내용">
          {text}
        </pre>
        {!unavailable && <FinalReportText request={request} submission={submission} />}
        <div className="dlg-actions">
          <PdfDownloadButton
            requestId={request.id}
            submissionId={submission?.id}
            disabled={unavailable}
          />
          <button type="button" className="btn" onClick={() => setPreviewOpen(false)}>
            닫기
          </button>
        </div>
      </Modal>
    </section>
  );
}
