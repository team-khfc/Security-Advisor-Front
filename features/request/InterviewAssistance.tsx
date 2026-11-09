'use client';

import { useState } from 'react';
import { Badge, Icon, Notice } from '@/components/ui';
import { useInputDraft } from '@/lib/inputDrafts';
import type { Answer, BusinessCase } from './types';
import {
  useInterviewApply,
  useInterviewAsk,
  useInterviewHelp,
  type InterviewTurn,
} from './useInterview';

/** 질문·설명은 답변을 바꾸지 않는다. 후보 적용과 사람의 확인은 서로 다른 행위다. */
export function InterviewAssistance({
  businessCase,
  question,
  actorId,
  answerText,
  turns,
  disabled,
  onApplied,
  onApplyingChange,
}: {
  businessCase: BusinessCase;
  question: Answer;
  actorId: string;
  answerText: string;
  turns: InterviewTurn[];
  disabled: boolean;
  onApplied: () => void;
  onApplyingChange?: (pending: boolean) => void;
}) {
  const ask = useInterviewAsk(businessCase.id);
  const apply = useInterviewApply(businessCase.id);
  const [showHelp, setShowHelp] = useState(false);
  const help = useInterviewHelp(question.key, businessCase.publicationId, showHelp);
  const { draft, saveDraft, clearDraft } = useInputDraft<string>(
    actorId,
    `case:${businessCase.id}:question:${question.key}`,
  );
  const [inputAtRequest, setInputAtRequest] = useState<string | undefined>();
  const candidate = ask.data ?? turns.filter((t) => t.fieldKey === question.key).at(-1);
  const changed = inputAtRequest !== undefined && inputAtRequest !== answerText;
  const stale =
    candidate &&
    (candidate.basedRevision !== businessCase.revision ||
      candidate.answerRevision !== (question.revision ?? null));
  const busy = ask.isPending || apply.isPending || disabled;
  const send = async (mode: 'ASK' | 'SUGGEST') => {
    setInputAtRequest(answerText);
    apply.reset();
    try {
      await ask.mutateAsync({
        fieldKey: question.key,
        mode,
        text:
          mode === 'ASK'
            ? (draft ?? '').trim()
            : '이 항목의 답변 초안을 추천해 주세요. 모르는 사실은 추가로 질문해 주세요.',
        draft: answerText,
        expectedRevision: businessCase.revision,
      });
      if (mode === 'ASK') clearDraft();
    } catch {
      /* 질문과 직접 입력은 그대로 보관한다. */
    }
  };
  return (
    <div className="interview-assistance">
      <div className="btn-row">
        <button
          type="button"
          className="btn btn-sm"
          aria-expanded={showHelp}
          onClick={() => setShowHelp(!showHelp)}
        >
          왜 필요한가요?
        </button>
        <button
          type="button"
          className="btn btn-sm"
          disabled={busy}
          onClick={() => void send('SUGGEST')}
        >
          <Icon name="sparkles" /> AI 추천답변 받기
        </button>
      </div>
      {showHelp && (
        <div className="interview-help">
          <p>
            {help.data?.whyAsked ||
              question.hint ||
              '담당자가 사업의 보안 검토 범위를 파악하는 데 필요한 항목입니다.'}
          </p>
          {help.isFetching && <p role="status">관련 자료를 찾고 있습니다…</p>}
          {help.error && (
            <Notice tone="warning">{help.error.message} 게시본의 작성 안내를 참고해 주세요.</Notice>
          )}
          {help.data?.snippets.map((s) => (
            <blockquote key={s.snippetId}>
              <p>{s.body}</p>
              <cite>{s.citation}</cite>
            </blockquote>
          ))}
          {help.data && !help.data.snippets.length && (
            <p className="help">이 항목에 연결된 공개자료 근거가 없습니다.</p>
          )}
        </div>
      )}
      <label htmlFor="interview-ai-prompt">이 항목을 AI에게 물어보기</label>
      <div className="interview-prompt-row">
        <textarea
          id="interview-ai-prompt"
          className="input"
          rows={2}
          maxLength={4000}
          placeholder="예: 어떤 정보가 개인정보에 해당하나요? 우리 사업에서 무엇을 확인해야 하나요?"
          value={draft ?? ''}
          disabled={ask.isPending}
          onChange={(e) => saveDraft(e.target.value)}
        />
        <button
          type="button"
          className="btn"
          disabled={busy || !draft?.trim()}
          onClick={() => void send('ASK')}
        >
          질문 보내기
        </button>
      </div>
      <p className="help">
        질문과 AI 설명은 신청서 답변에 자동 반영되지 않습니다. 서버·IP·포트는 담당자가 확인합니다.
      </p>
      {ask.isPending && (
        <p role="status">게시본과 사업 정보를 참고하고 있습니다. 작성 중인 답변은 유지됩니다…</p>
      )}
      {ask.error && (
        <Notice tone="danger">
          {ask.error.message} 질문과 답변을 유지했습니다. 다시 요청할 수 있습니다.
        </Notice>
      )}
      {candidate && (
        <div className="interview-proposal" aria-label="AI 설명과 추천답변" aria-live="polite">
          <Badge tone="warning">
            {candidate.modelReference.includes('fake') ? '모의 AI' : 'AI'} ·{' '}
            {candidate.mode === 'ASK' ? '설명' : '추천답변 미확정'}
          </Badge>
          <p className="interview-ai-text">{candidate.reply}</p>
          {candidate.proposedValue && (
            <>
              <strong>답변 후보</strong>
              <p className="interview-ai-text candidate">{candidate.proposedValue}</p>
            </>
          )}
          {candidate.evidence.length > 0 && (
            <ul className="help interview-evidence" aria-label="AI 답변 근거">
              {candidate.evidence.map((e) => (
                <li key={e.tag}>{e.label}</li>
              ))}
            </ul>
          )}
          {candidate.applied || apply.data?.interviewTurnId === candidate.interviewTurnId ? (
            <p role="status">
              미확정 답변으로 적용했습니다. 내용을 확인한 뒤 답변을 저장해 주세요.
            </p>
          ) : (
            candidate.proposedValue &&
            !candidate.flagged && (
              <>
                {question.confirmed && (
                  <p className="help">
                    이미 확인한 답변은 보호됩니다. 추천 내용을 참고해 직접 수정할 수 있습니다.
                  </p>
                )}
                {(stale || changed) && (
                  <Notice tone="warning">
                    추천 이후 입력이 변경되었습니다. 최신 내용으로 다시 추천받아 주세요.
                  </Notice>
                )}
                <button
                  type="button"
                  className="btn"
                  disabled={busy || question.confirmed || Boolean(stale) || changed}
                  onClick={async () => {
                    onApplyingChange?.(true);
                    try {
                      await apply.mutateAsync({
                        turnId: candidate.interviewTurnId,
                        expectedRevision: businessCase.revision,
                      });
                      onApplied();
                    } catch {
                      /* 실패 시 입력 보존 */
                    } finally {
                      onApplyingChange?.(false);
                    }
                  }}
                >
                  {apply.isPending ? '적용 중…' : '추천을 미확정 답변으로 적용'}
                </button>
              </>
            )
          )}
          {apply.error && <Notice tone="danger">{apply.error.message}</Notice>}
        </div>
      )}
    </div>
  );
}
