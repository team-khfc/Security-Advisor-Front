import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
}));

vi.mock('@/features/auth', () => ({
  useSession: () => ({ data: controls.session, isPending: false }),
}));
vi.mock('@/features/request/useRequests', () => ({
  useCase: () => ({ data: controls.businessCase, isPending: false }),
  useRequests: () => ({ data: controls.requests, isPending: false }),
  useSaveCase: () => ({ mutateAsync: controls.save, isPending: false }),
  useAnalysis: () => ({ data: undefined, mutateAsync: vi.fn(), reset: vi.fn(), isPending: false }),
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
});

afterEach(() => {
  const id = controls.businessCase?.id;
  for (const key of [`case:${id}:interview`, `case:${id}:analysis`, `case:${id}:answers`])
    clearInputDraft(applicant.id, key);
});

test('작업 영역은 대화 영역·질문 카드·수집 정보 영역과 서류별 신청 링크를 표시한다', () => {
  render(<CaseInterview id={controls.businessCase!.id} />);
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
  expect(screen.getByText('기획서로 시작하거나 AI 제안 받기')).toBeTruthy();
});

test('답변을 저장하면 같은 저장 요청을 보내고 대화 영역에 내 답변을 남긴 뒤 다음 질문으로 넘어간다', async () => {
  const user = userEvent.setup();
  render(<CaseInterview id={controls.businessCase!.id} />);
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
  render(<CaseInterview id={controls.businessCase!.id} />);
  expect(screen.getByText(/이 사업 건은 현재 읽기 전용입니다/)).toBeTruthy();
  expect(screen.queryByText(/공통 질문 1 \//)).toBeNull();
  expect(screen.queryByText('기획서로 시작하거나 AI 제안 받기')).toBeNull();
});

test('시안처럼 질문 제목과 도움말을 분리하고 선택형 답변은 같은 항목에 저장한다', async () => {
  const user = userEvent.setup();
  render(<CaseInterview id={controls.businessCase!.id} />);
  const card = screen.getByRole('form', { name: '어떤 사업인가요?' });
  expect(within(card).getByText(/필수 항목|선택 항목/)).toBeTruthy();
  expect(
    within(card).getByText(
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
  render(<CaseInterview id={controls.businessCase!.id} />);
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
vi.mock('@/features/request/InterviewAssistance', () => ({ InterviewAssistance: () => null }));
