import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaseInterview } from '@/features/request/CaseInterview';
import type { BusinessCase, SecurityRequest } from '@/features/request/types';
import { clearInputDraft } from '@/lib/inputDrafts';
import type { Session } from '@/lib/types';
import { createMockState, MOCK_MEMBERS } from '@/mocks/seed';

const controls = vi.hoisted(() => ({
  session: null as Session | null,
  businessCase: undefined as BusinessCase | undefined,
  requests: [] as SecurityRequest[],
  save: vi.fn(),
  savePending: false,
}));

vi.mock('@/features/auth', () => ({
  useSession: () => ({ data: controls.session, isPending: false }),
}));
vi.mock('@/features/request/useInterview', () => ({
  useInterviewTurns: () => ({ data: [] }),
  useInterviewStaffCheck: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/features/request/InterviewAssistance', () => ({ InterviewAssistance: () => null }));
vi.mock('@/features/request/useRequests', () => ({
  useCase: () => ({ data: controls.businessCase, isPending: false }),
  useRequests: () => ({ data: controls.requests, isPending: false }),
  useSaveCase: () => ({ mutateAsync: controls.save, isPending: controls.savePending }),
  useAnalysis: () => ({ reset: vi.fn(), isPending: false }),
  useApplyAnalysis: () => ({ reset: vi.fn(), isPending: false }),
}));

const applicant = MOCK_MEMBERS[0];

beforeEach(() => {
  const state = createMockState();
  controls.session = { member: applicant, mock: true, expiresAt: null };
  controls.businessCase = state.cases.find((businessCase) => businessCase.id === 'demo-case-5');
  controls.requests = state.requests;
  controls.save.mockReset().mockResolvedValue({});
  controls.savePending = false;
});

afterEach(() => {
  clearInputDraft(applicant.id, `case:${controls.businessCase?.id}:interview`);
  clearInputDraft(applicant.id, `case:${controls.businessCase?.id}:analysis`);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
});

function conversation() {
  return screen.getByRole('region', { name: '인터뷰 대화' });
}

test('게시본의 질문·도움말·긴 답변 형식과 미완료 상태를 표시한다', async () => {
  const original = controls.businessCase!;
  controls.businessCase = {
    ...original,
    answers: [
      {
        ...original.answers[0],
        key: 'project.summary',
        label: '게시본 사업 개요',
        hint: '사업 목적과 대상 이용자를 적어 주세요.',
        inputType: 'LONG_TEXT',
        value: '',
        confirmed: false,
        required: true,
      },
    ],
  };
  const user = userEvent.setup();
  render(<CaseInterview id={original.id} />);
  expect(screen.getByRole('heading', { name: '게시본 사업 개요' })).toBeTruthy();
  expect(screen.getByText('사업 목적과 대상 이용자를 적어 주세요.')).toBeTruthy();
  expect(screen.getByRole('textbox', { name: '게시본 사업 개요' }).tagName).toBe('TEXTAREA');
  await user.click(screen.getByRole('button', { name: '나중에 입력' }));
  expect(
    screen.getByRole('heading', { name: '확인이 필요한 필수 항목이 1개 남았습니다' }),
  ).toBeTruthy();
  expect(controls.save).not.toHaveBeenCalled();
});

function mockConversationLayout(body: HTMLElement, { pairHeight = 240 } = {}) {
  const top = 120;
  const height = 360;
  const introHeight = 160;
  const gap = 24;
  let scrollTop = 0;
  const pairs = () => Array.from(body.querySelectorAll<HTMLElement>('.chat-pair'));
  const scrollHeight = () => introHeight + pairs().length * (pairHeight + gap) + 24;

  // jsdom에는 배치 엔진이 없어 저장된 대화 크기를 합성한다. 분석 패널은 대화 밖에 있다.
  body.style.paddingBottom = '24px';
  Object.defineProperties(body, {
    clientTop: { configurable: true, value: 0 },
    clientHeight: { configurable: true, value: height },
    scrollHeight: { configurable: true, get: scrollHeight },
    scrollTop: {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = Math.max(0, Math.min(value, Math.max(0, scrollHeight() - height)));
      },
    },
  });

  const measure = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this === body) return new DOMRect(40, top, 600, height);
    const index = pairs().indexOf(this);
    if (index >= 0)
      return new DOMRect(
        64,
        top + introHeight + index * (pairHeight + gap) - scrollTop,
        552,
        pairHeight,
      );
    return measure.call(this);
  });
}

function expectLatestAnswerVisible(body: HTMLElement, wholePair = false) {
  const pair = body.querySelector<HTMLElement>('.chat-pair:last-of-type');
  expect(pair).not.toBeNull();
  const bounds = pair!.getBoundingClientRect();
  const viewportTop = body.getBoundingClientRect().top + body.clientTop;
  expect(bounds.bottom).toBeGreaterThan(viewportTop);
  expect(bounds.bottom).toBeLessThanOrEqual(viewportTop + body.clientHeight);
  if (wholePair) expect(bounds.top).toBeGreaterThanOrEqual(viewportTop);
}

async function fillAnswer(user: ReturnType<typeof userEvent.setup>, label: string, answer: string) {
  const input = screen.getByRole('textbox', { name: label });
  await user.clear(input);
  await user.type(input, answer);
}

test('답변 저장과 마지막 공통 답변 저장 후 새 답변의 끝을 보여 주고 페이지와 초점을 옮기지 않는다', async () => {
  const businessCase = controls.businessCase!;
  controls.businessCase = {
    ...businessCase,
    answers: businessCase.answers.filter((answer) => answer.ownerRole === 'APPLICANT').slice(0, 2),
  };
  const user = userEvent.setup();
  render(<CaseInterview id={businessCase.id} />);
  const body = conversation();
  mockConversationLayout(body, { pairHeight: 520 });
  const scrollPage = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  document.documentElement.scrollTop = 240;
  document.body.scrollTop = 240;

  await fillAnswer(user, '사업 목적', '공개 자료를 안내하는 합성 사업의 목적입니다.');
  const next = screen.getByRole('button', { name: '답변 저장하고 다음' });
  await user.click(next);
  await within(body).findByText('공개 자료를 안내하는 합성 사업의 목적입니다.');
  expect(body.scrollTop).toBeGreaterThan(0);
  expectLatestAnswerVisible(body);
  expect(document.activeElement).toBe(next);
  expect(document.documentElement.scrollTop).toBe(240);
  expect(document.body.scrollTop).toBe(240);
  expect(scrollPage).not.toHaveBeenCalled();

  body.scrollTop = 0;
  await fillAnswer(user, '처리하는 정보', '공개 정책 자료와 합성 시험 자료만 처리합니다.');
  await user.click(screen.getByRole('button', { name: '공통 답변 저장' }));
  await screen.findByRole('heading', { name: '공통 정보를 정리했습니다' });
  expect(within(body).getByText('공개 정책 자료와 합성 시험 자료만 처리합니다.')).toBeTruthy();
  expect(controls.save).toHaveBeenCalledTimes(2);
  expectLatestAnswerVisible(body);
  expect(document.documentElement.scrollTop).toBe(240);
  expect(document.body.scrollTop).toBe(240);
  expect(scrollPage).not.toHaveBeenCalled();
});

test('대화 밖의 분석 패널이 열려 있어도 대화 영역에서 새로 저장한 답변을 보여 준다', async () => {
  const user = userEvent.setup();
  render(<CaseInterview id={controls.businessCase!.id} />);
  const body = conversation();
  mockConversationLayout(body);
  const analysisToggle = screen.getByText('기획서로 시작하거나 AI 제안 받기');
  const analysisPanel = analysisToggle.closest('details');
  await user.click(analysisToggle);
  expect(analysisPanel?.open).toBe(true);
  expect(body.contains(analysisPanel)).toBe(false);
  expect(screen.getByRole('textbox', { name: '분석할 사업 개요' })).toBeTruthy();

  await fillAnswer(user, '사업 목적', '첫 번째 합성 인터뷰 답변입니다.');
  await user.click(screen.getByRole('button', { name: '답변 저장하고 다음' }));
  await within(body).findByText('첫 번째 합성 인터뷰 답변입니다.');
  expectLatestAnswerVisible(body, true);
  expect(body.scrollTop).toBeLessThan(body.scrollHeight - body.clientHeight);

  // 앞선 대화를 읽으려고 위로 이동해도 다음 저장은 최신 답변으로 돌아온다.
  body.scrollTop = 0;
  await fillAnswer(user, '처리하는 정보', '두 번째 합성 인터뷰 답변입니다.');
  expect(body.scrollTop).toBe(0);
  await user.click(screen.getByRole('button', { name: '답변 저장하고 다음' }));
  await within(body).findByText('두 번째 합성 인터뷰 답변입니다.');
  expectLatestAnswerVisible(body, true);
  expect(body.scrollTop).toBeGreaterThan(0);
  expect(analysisPanel?.open).toBe(true);
});

test('입력 중이거나 저장 실패 또는 나중에 입력을 선택하면 읽던 대화 위치를 유지한다', async () => {
  const user = userEvent.setup();
  render(<CaseInterview id={controls.businessCase!.id} />);
  const body = conversation();
  mockConversationLayout(body, { pairHeight: 520 });
  await fillAnswer(user, '사업 목적', '저장을 마친 합성 답변입니다.');
  await user.click(screen.getByRole('button', { name: '답변 저장하고 다음' }));
  await within(body).findByText('저장을 마친 합성 답변입니다.');

  body.scrollTop = 40;
  await fillAnswer(user, '처리하는 정보', '저장하지 못한 합성 답변입니다.');
  expect(body.scrollTop).toBe(40);
  controls.save.mockRejectedValueOnce(new Error('합성 저장 오류입니다. 다시 시도해 주세요.'));
  await user.click(screen.getByRole('button', { name: '답변 저장하고 다음' }));
  await screen.findByText('합성 저장 오류입니다. 다시 시도해 주세요.');
  expect(within(body).queryByText('저장하지 못한 합성 답변입니다.')).toBeNull();
  expect(body.scrollTop).toBe(40);

  await user.click(screen.getByRole('button', { name: '나중에 입력' }));
  expect(screen.getByRole('textbox', { name: '외부 전송 여부' })).toBeTruthy();
  expect(body.scrollTop).toBe(40);
});

test('저장 응답을 기다리는 동안 위치를 유지하고 성공 응답 뒤에만 새 대화로 이동한다', async () => {
  const user = userEvent.setup();
  const id = controls.businessCase!.id;
  const view = render(<CaseInterview id={id} />);
  const body = conversation();
  mockConversationLayout(body, { pairHeight: 520 });
  await fillAnswer(user, '사업 목적', '이미 저장한 합성 답변입니다.');
  await user.click(screen.getByRole('button', { name: '답변 저장하고 다음' }));
  await within(body).findByText('이미 저장한 합성 답변입니다.');

  body.scrollTop = 40;
  await fillAnswer(user, '처리하는 정보', '응답을 기다리는 합성 답변입니다.');
  let resolveSave: (value: unknown) => void = () => {};
  controls.save.mockImplementationOnce(
    () =>
      new Promise<unknown>((resolve) => {
        resolveSave = resolve;
      }),
  );
  await user.click(screen.getByRole('button', { name: '답변 저장하고 다음' }));
  controls.savePending = true;
  view.rerender(<CaseInterview id={id} />);
  expect((screen.getByRole('button', { name: '저장 중…' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect(body.scrollTop).toBe(40);
  expect(within(body).queryByText('응답을 기다리는 합성 답변입니다.')).toBeNull();

  await act(async () => {
    controls.savePending = false;
    resolveSave({});
  });
  await within(body).findByText('응답을 기다리는 합성 답변입니다.');
  await waitFor(() => expectLatestAnswerVisible(body));
  expect(body.scrollTop).toBeGreaterThan(40);
});
