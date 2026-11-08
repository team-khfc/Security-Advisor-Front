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
