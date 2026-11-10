import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaseInterview } from '@/features/request/CaseInterview';
import { clearInputDraft } from '@/lib/inputDrafts';
import type { Session } from '@/lib/types';
import type { BusinessCase, SecurityRequest } from '@/features/request/types';
import { createMockState, MOCK_MEMBERS } from '@/mocks/seed';

const controls = vi.hoisted(() => ({
  session: null as Session | null,
  businessCase: undefined as BusinessCase | undefined,
  requests: [] as SecurityRequest[],
  save: vi.fn(),
  analyze: vi.fn(),
}));

vi.mock('@/features/auth', () => ({
  useSession: () => ({ data: controls.session, isPending: false }),
}));
vi.mock('@/features/request/useRequests', () => ({
  useCase: () => ({ data: controls.businessCase, isPending: false }),
  useRelatedRequests: () => ({ data: controls.requests, isPending: false }),
  useSaveCase: () => ({ mutateAsync: controls.save, isPending: false }),
  useAnalysis: () => ({
    data: undefined,
    mutateAsync: controls.analyze,
    reset: vi.fn(),
    isPending: false,
  }),
  useApplyAnalysis: () => ({ mutateAsync: vi.fn(), reset: vi.fn(), isPending: false }),
}));

const applicant = MOCK_MEMBERS[0];

beforeEach(() => {
  const state = createMockState();
  const businessCase = structuredClone(state.cases[0]);
  controls.businessCase = businessCase;
  controls.requests = state.requests.filter((request) => request.caseId === businessCase.id);
  controls.session = { member: applicant, mock: true, expiresAt: null };
  controls.save.mockReset().mockResolvedValue({});
  controls.analyze
    .mockReset()
    .mockResolvedValue({ suggestions: [{ value: '합성 첨부문서 요약' }] });
});

afterEach(() => {
  const id = controls.businessCase?.id;
  for (const key of [`case:${id}:interview`, `case:${id}:analysis`, `case:${id}:answers`])
    clearInputDraft(applicant.id, key);
});

test('작업 영역은 대화 영역·질문 카드·수집 정보 영역과 서류별 신청 링크를 표시한다', () => {
  renderForEditing(controls.businessCase!.id);
  expect(screen.getByRole('heading', { name: '보안정보 도우미' })).toBeTruthy();
  expect(screen.getByRole('log', { name: '대화 내용' })).toBeTruthy();
  expect(screen.getByText(/공통 질문 1 \/ \d+/)).toBeTruthy();
  const info = screen.getByRole('complementary', { name: '수집된 보안정보' });
  expect(within(info).getByRole('heading', { name: '사업 정보' })).toBeTruthy();
  expect(within(info).getByRole('heading', { name: '담당자 확인 항목' })).toBeTruthy();
  expect(within(info).getByRole('progressbar', { name: '확인한 공통 답변' })).toBeTruthy();
  for (const request of controls.requests)
    expect(
      screen
        .getAllByRole('link')
        .some((link) => link.getAttribute('href') === `/requests/${request.id}`),
    ).toBe(true);
  expect(screen.queryByText('기획서로 시작하거나 AI 제안 받기')).toBeNull();
  const chat = screen.getByRole('region', { name: '보안정보 도우미' });
  expect(within(chat).getByRole('button', { name: '파일 첨부' })).toBeTruthy();
  expect(within(chat).queryByLabelText('분석할 사업 개요')).toBeNull();
});

test('답변을 저장하면 같은 저장 요청을 보내고 대화 영역에 내 답변을 남긴 뒤 다음 질문으로 넘어간다', async () => {
  const user = userEvent.setup();
  renderForEditing(controls.businessCase!.id);
  const firstLabel = screen.getByLabelText('사업 목적');
  await user.clear(firstLabel);
  await user.type(firstLabel, '작업 영역 검증용 합성 답변');
  await user.click(screen.getByRole('button', { name: '답변 저장하고 다음' }));
  await waitFor(() =>
    expect(controls.save).toHaveBeenCalledWith({
      expectedRevision: controls.businessCase!.revision,
      answers: [
        expect.objectContaining({
          key: 'purpose',
          value: '작업 영역 검증용 합성 답변',
          confirmed: true,
        }),
      ],
    }),
  );
  const log = screen.getByRole('log', { name: '대화 내용' });
  expect(within(log).getByText('작업 영역 검증용 합성 답변')).toBeTruthy();
  expect(screen.getByText(/공통 질문 2 \/ \d+/)).toBeTruthy();
});

test('다른 사용자가 열면 읽기 전용 안내만 보이고 질문 카드와 문서 분석 막대는 표시하지 않는다', () => {
  controls.session = { member: MOCK_MEMBERS[1], mock: true, expiresAt: null };
  renderForEditing(controls.businessCase!.id);
  expect(screen.getByText(/이 사업 건은 현재 읽기 전용입니다/)).toBeTruthy();
  expect(screen.queryByText(/공통 질문 1 \//)).toBeNull();
  expect(screen.queryByText('기획서로 시작하거나 AI 제안 받기')).toBeNull();
});

test('질문 안내는 대화창에 표시하고 입력 카드의 선택형 답변은 같은 항목에 저장한다', async () => {
  const user = userEvent.setup();
  renderForEditing(controls.businessCase!.id);
  const card = screen.getByRole('form', { name: '어떤 사업인가요?' });
  const conversation = screen.getByRole('region', { name: '인터뷰 대화' });
  expect(within(conversation).getByText(/필수 항목|선택 항목/)).toBeTruthy();
  expect(within(card).queryByText(/필수 항목|선택 항목/)).toBeNull();
  expect(
    within(conversation).getByText(
      '사업 목적을 한두 문장으로 적어 주세요. 신청서의 신청 사유로 들어갑니다.',
    ),
  ).toBeTruthy();
  expect(within(card).getByRole('textbox', { name: '사업 목적' }).tagName).toBe('INPUT');
  await user.click(screen.getByRole('button', { name: '나중에 입력' }));
  await user.click(screen.getByRole('button', { name: '개인정보가 포함돼요' }));
  await waitFor(() =>
    expect(controls.save).toHaveBeenCalledWith({
      expectedRevision: controls.businessCase!.revision,
      answers: [
        expect.objectContaining({
          key: 'dataTypes',
          value: '개인정보가 포함돼요',
          confirmed: true,
        }),
      ],
    }),
  );
  expect(screen.getByRole('heading', { name: '외부 기관이나 서비스와 연결되나요?' })).toBeTruthy();
  expect(
    within(screen.getByRole('log', { name: '대화 내용' })).getByText('개인정보가 포함돼요'),
  ).toBeTruthy();
});

test('선택형 저장 실패 시 선택한 답변을 입력란에 보존하고 직접 수정해 재시도한다', async () => {
  const user = userEvent.setup();
  controls.save.mockRejectedValueOnce(new Error('저장 실패. 다시 시도해 주세요.'));
  renderForEditing(controls.businessCase!.id);
  await user.click(screen.getByRole('button', { name: '나중에 입력' }));
  await user.click(screen.getByRole('button', { name: '공개 자료만 다뤄요' }));
  await screen.findByText('저장 실패. 다시 시도해 주세요.');
  const input = screen.getByRole('textbox', { name: '처리하는 정보' }) as HTMLInputElement;
  expect(input.value).toBe('공개 자료만 다뤄요');
  expect(
    within(screen.getByRole('log', { name: '대화 내용' })).queryByText('공개 자료만 다뤄요'),
  ).toBeNull();
  await user.clear(input);
  await user.type(input, '공개 통계 자료를 처리합니다.');
  await user.click(screen.getByRole('button', { name: '답변 저장하고 다음' }));
  await waitFor(() =>
    expect(controls.save).toHaveBeenLastCalledWith({
      expectedRevision: controls.businessCase!.revision,
      answers: [
        expect.objectContaining({ key: 'dataTypes', value: '공개 통계 자료를 처리합니다.' }),
      ],
    }),
  );
});
vi.mock('@/features/request/useInterview', () => ({
  useInterviewTurns: () => ({ data: [] }),
  useInterviewStaffCheck: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/features/request/useInterviewAssistance', () => ({
  useInterviewAssistance: () => ({
    history: [],
    ask: { isPending: false },
    apply: { isPending: false },
    mode: 'ANSWER',
    help: {},
    busy: false,
    showHelp: false,
    toggleHelp: vi.fn(),
    send: vi.fn(),
    setMode: vi.fn(),
    isStale: () => false,
  }),
}));

// 기존 합성 자료는 완료된 답변이다. 재작성 검사는 사용자가 다시 보기로 여는 흐름을 따른다.
function renderForEditing(id: string) {
  const view = render(<CaseInterview id={id} />);
  const restart = screen.queryByRole('button', { name: '공통 질문 다시 보기' });
  if (restart) fireEvent.click(restart);
  return view;
}

test('우측에서 저장한 항목은 대화 입력과 수집 정보에 갱신되고 기존 미저장 채팅 초안이 남지 않는다', async () => {
  const user = userEvent.setup();
  const id = controls.businessCase!.id;
  const view = renderForEditing(id);
  const composer = screen.getByRole('form', { name: '어떤 사업인가요?' });
  await user.clear(within(composer).getByLabelText('사업 목적'));
  await user.type(within(composer).getByLabelText('사업 목적'), '아직 저장하지 않은 초안');
  const info = screen.getByRole('complementary', { name: '수집된 보안정보' });
  await user.click(within(info).getByRole('button', { name: '사업 목적 수정' }));
  await user.clear(within(info).getByLabelText('사업 목적'));
  await user.type(within(info).getByLabelText('사업 목적'), '우측에서 저장한 합성 목적');
  controls.save.mockImplementationOnce(async ({ answers }) => {
    const old = controls.businessCase!;
    controls.businessCase = {
      ...old,
      revision: old.revision + 1,
      answers: old.answers.map((answer) =>
        answer.key === answers[0].key
          ? {
              ...answer,
              value: answers[0].value,
              confirmed: true,
              revision: (answer.revision ?? 0) + 1,
            }
          : answer,
      ),
    };
  });
  await user.click(within(info).getByRole('button', { name: '확인하고 저장' }));
  await waitFor(() => expect(controls.save).toHaveBeenCalledTimes(1));
  view.rerender(<CaseInterview id={id} />);
  await waitFor(() =>
    expect((within(composer).getByLabelText('사업 목적') as HTMLTextAreaElement).value).toBe(
      '우측에서 저장한 합성 목적',
    ),
  );
  expect(within(info).getByText('우측에서 저장한 합성 목적')).toBeTruthy();
  expect(
    within(screen.getByRole('log', { name: '대화 내용' })).getByText('우측에서 저장한 합성 목적'),
  ).toBeTruthy();
  expect(screen.queryByText('공통 답변 전체 수정·AI 제안 확인')).toBeNull();
});

test('채팅 파일 선택 즉시 분석하고 별도 분석 패널 없이 대화에 요약을 표시한다', async () => {
  const user = userEvent.setup();
  renderForEditing(controls.businessCase!.id);
  const file = new File(['synthetic'], '자동분석.txt');
  await user.upload(screen.getByLabelText('문서 첨부 (선택)'), file);
  await waitFor(() =>
    expect(controls.analyze).toHaveBeenCalledWith(expect.objectContaining({ file })),
  );
  const log = screen.getByRole('log', { name: '대화 내용' });
  expect(await within(log).findByText('합성 첨부문서 요약')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '문서 분석 요청' })).toBeNull();
  expect(screen.queryByRole('button', { name: '제안을 미확정 답변으로 적용' })).toBeNull();
  expect(controls.save).not.toHaveBeenCalled();
});

test('분석 실패는 채팅에 남기고 재시도하면 같은 메시지에 요약을 표시한다', async () => {
  controls.analyze.mockRejectedValueOnce(new Error('합성 분석 실패'));
  const user = userEvent.setup();
  renderForEditing(controls.businessCase!.id);
  await user.upload(
    screen.getByLabelText('문서 첨부 (선택)'),
    new File(['synthetic'], '재시도.txt'),
  );
  const retry = await screen.findByRole('button', { name: '다시 분석' });
  await user.click(retry);
  expect(await screen.findByText('합성 첨부문서 요약')).toBeTruthy();
  expect(screen.getAllByText('첨부: 재시도.txt')).toHaveLength(1);
  expect(controls.analyze).toHaveBeenCalledTimes(2);
});
