import { afterEach, expect, test, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InterviewAssistance } from '@/features/request/InterviewAssistance';
import { requestJson } from '@/lib/httpClient';
import { clearInputDraft } from '@/lib/inputDrafts';
import { createMockState } from '@/mocks/seed';

vi.mock('@/lib/httpClient', () => ({ requestJson: vi.fn() }));
const businessCase = { ...createMockState().cases[0], id: '601', publicationId: 42 };
const question = {
  ...businessCase.answers[0],
  key: 'project.summary',
  value: '',
  confirmed: false,
  revision: undefined,
};
const response = {
  interviewTurnId: 1,
  businessCaseId: 601,
  fieldKey: question.key,
  mode: 'SUGGEST',
  question: '합성 질문',
  reply: '사업 개요를 참고한 합성 설명',
  proposedValue: '합성 추천답변',
  evidence: [{ tag: 'B', label: '사용자가 작성한 사업 개요' }],
  basedRevision: businessCase.revision,
  answerRevision: null,
  modelReference: 'fake/offline',
  flagged: false,
  applied: false,
  createdAt: '2026-11-10T00:00:00Z',
};
function setup(answerText = '') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onApplied = vi.fn();
  const props = {
    businessCase,
    question,
    actorId: 'test',
    answerText,
    turns: [],
    disabled: false,
    onApplied,
  };
  const view = render(
    <QueryClientProvider client={client}>
      <InterviewAssistance {...props} />
    </QueryClientProvider>,
  );
  return {
    onApplied,
    rerender: (text: string) =>
      view.rerender(
        <QueryClientProvider client={client}>
          <InterviewAssistance {...props} answerText={text} />
        </QueryClientProvider>,
      ),
  };
}
afterEach(() => {
  vi.mocked(requestJson).mockReset();
  clearInputDraft('test', `case:601:question:${question.key}`);
});

test('추천은 별도 미리보기이며 명시적 적용 전까지 답변을 저장하지 않는다', async () => {
  vi.mocked(requestJson)
    .mockResolvedValueOnce(response)
    .mockResolvedValueOnce({ ...response, applied: true });
  const { onApplied } = setup('작성 중인 원문');
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'AI 추천답변 받기' }));
  await screen.findByText('합성 추천답변');
  expect(requestJson).toHaveBeenCalledTimes(1);
  expect(onApplied).not.toHaveBeenCalled();
  expect(requestJson).toHaveBeenLastCalledWith(
    '/api/business-cases/601/interview-turns',
    expect.objectContaining({
      body: expect.objectContaining({ mode: 'SUGGEST', draft: '작성 중인 원문' }),
    }),
  );
  await user.click(screen.getByRole('button', { name: '추천을 미확정 답변으로 적용' }));
  await screen.findByText(/미확정 답변으로 적용했습니다/);
  expect(onApplied).toHaveBeenCalledOnce();
  expect(requestJson).toHaveBeenLastCalledWith(
    '/api/business-cases/601/interview-turns/1/applications',
    expect.objectContaining({ method: 'POST' }),
  );
});
test('자유 질문은 공식 답변이나 다음 질문으로 넘어가는 행위를 만들지 않는다', async () => {
  vi.mocked(requestJson).mockResolvedValueOnce({ ...response, mode: 'ASK', proposedValue: null });
  const { onApplied } = setup();
  const user = userEvent.setup();
  await user.type(
    screen.getByRole('textbox', { name: '이 항목을 AI에게 물어보기' }),
    '개인정보란 무엇인가요?',
  );
  await user.click(screen.getByRole('button', { name: '질문 보내기' }));
  await screen.findByText(response.reply);
  expect(requestJson).toHaveBeenCalledOnce();
  expect(requestJson).toHaveBeenLastCalledWith(
    expect.any(String),
    expect.objectContaining({
      body: expect.objectContaining({ mode: 'ASK', text: '개인정보란 무엇인가요?' }),
    }),
  );
  expect(screen.queryByRole('button', { name: '추천을 미확정 답변으로 적용' })).toBeNull();
  expect(onApplied).not.toHaveBeenCalled();
});
test('실패한 자유 질문은 다시 보낼 수 있도록 원문을 유지한다', async () => {
  vi.mocked(requestJson).mockRejectedValueOnce(new Error('합성 AI 연결 오류'));
  setup();
  const user = userEvent.setup();
  const prompt = screen.getByRole('textbox', { name: '이 항목을 AI에게 물어보기' });
  await user.type(prompt, '다시 보낼 질문');
  await user.click(screen.getByRole('button', { name: '질문 보내기' }));
  await screen.findByText(/합성 AI 연결 오류/);
  expect((prompt as HTMLTextAreaElement).value).toBe('다시 보낼 질문');
});
test('AI 응답을 기다리는 동안 직접 답변이 바뀌면 늦게 도착한 제안을 적용하지 않는다', async () => {
  let finish: (value: unknown) => void = () => {};
  vi.mocked(requestJson).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { rerender, onApplied } = setup('이전 초안');
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'AI 추천답변 받기' }));
  rerender('새로 작성한 초안');
  await act(async () => finish(response));
  await screen.findByText('합성 추천답변');
  expect(
    (screen.getByRole('button', { name: '추천을 미확정 답변으로 적용' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(onApplied).not.toHaveBeenCalled();
});
