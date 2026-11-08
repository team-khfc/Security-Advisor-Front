import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { RequestList } from '@/features/request/RequestList';
import type { SecurityRequest } from '@/features/request/types';
import type { Session } from '@/lib/types';
import { createMockState, MOCK_MEMBERS } from '@/mocks/seed';

const controls = vi.hoisted(() => ({
  session: null as Session | null,
  requests: [] as SecurityRequest[],
  replace: vi.fn(),
  listeners: new Set<() => void>(),
}));

vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  const getSearch = () => window.location.search;
  const subscribe = (listener: () => void) => {
    controls.listeners.add(listener);
    return () => {
      controls.listeners.delete(listener);
    };
  };

  return {
    useRouter: () => ({ replace: controls.replace }),
    useSearchParams: () =>
      new URLSearchParams(useSyncExternalStore(subscribe, getSearch, getSearch)),
  };
});

vi.mock('@/features/auth', () => ({
  useSession: () => ({ data: controls.session, isPending: false }),
}));

vi.mock('@/features/request/useRequests', () => ({
  useRequests: () => ({ data: controls.requests, isPending: false, isError: false }),
}));

function searchInput() {
  return screen.getByRole('searchbox', { name: '사업명·신청번호 검색' }) as HTMLInputElement;
}

function searchParams() {
  return new URLSearchParams(window.location.search);
}

function composeInput(input: HTMLInputElement, value: string) {
  fireEvent.compositionUpdate(input, { data: value });
  fireEvent.input(input, {
    target: { value },
    data: value,
    inputType: 'insertCompositionText',
    isComposing: true,
  });
}

beforeEach(() => {
  const applicant = MOCK_MEMBERS[0];
  controls.session = { member: applicant, mock: true, expiresAt: null };
  controls.requests = createMockState().requests.filter(
    (request) => request.ownerId === applicant.id,
  );
  controls.listeners.clear();
  controls.replace.mockReset().mockImplementation((href: string) => {
    window.history.replaceState(null, '', href);
  });
  window.history.replaceState(null, '', '/requests');

  // Next의 history 연동처럼 URL 변경을 useSearchParams 구독자에게 전달한다.
  const replaceState = window.history.replaceState.bind(window.history);
  vi.spyOn(window.history, 'replaceState').mockImplementation((data, unused, url) => {
    replaceState(data, unused, url);
    for (const listener of controls.listeners) listener();
  });
});

test('버튼이나 Enter 없이 연속 입력과 삭제를 즉시 반영하며 입력 요소와 초점을 유지한다', async () => {
  const user = userEvent.setup();
  render(<RequestList />);
  const input = searchInput();
  expect(screen.getByRole('status').textContent).toContain('결과 6건');

  await user.type(input, '정책');
  expect(screen.getByRole('status').textContent).toContain('결과 1건');
  expect(screen.getByRole('link', { name: '정책정보 API 연계' })).toBeTruthy();
  expect(searchParams().get('q')).toBe('정책');
  expect(searchInput()).toBe(input);
  expect(document.activeElement).toBe(input);

  await user.type(input, '정보 API 연계 ');
  expect(input.value).toBe('정책정보 API 연계 ');
  expect(screen.getByRole('status').textContent).toContain('결과 1건');
  expect(searchParams().get('q')).toBe('정책정보 API 연계');
  expect(searchInput()).toBe(input);
  expect(document.activeElement).toBe(input);

  await user.clear(input);
  expect(screen.getByRole('status').textContent).toContain('결과 6건');
  expect(searchParams().has('q')).toBe(false);
  expect(searchInput()).toBe(input);
  expect(document.activeElement).toBe(input);
});

test('검색 결과가 두 페이지 이상이어도 새 검색어를 입력하면 첫 페이지로 돌아온다', async () => {
  window.history.replaceState(null, '', '/requests?page=2');
  const user = userEvent.setup();
  render(<RequestList />);
  const input = searchInput();
  expect(screen.getByRole('status').textContent).toContain('2 / 2페이지');
  expect(screen.queryByRole('link', { name: '합성 교육 통계 연계' })).toBeNull();

  await user.type(input, 'demo-request');
  expect(screen.getByRole('status').textContent).toContain('결과 6건');
  expect(screen.getByRole('status').textContent).toContain('1 / 2페이지');
  expect(screen.getByRole('link', { name: '합성 교육 통계 연계' })).toBeTruthy();
  expect(searchParams().get('q')).toBe('demo-request');
  expect(searchParams().has('page')).toBe(false);
  expect(searchInput()).toBe(input);
  expect(document.activeElement).toBe(input);
});

test('한글 조합 중인 마지막 글자와 삭제를 공백 없이 검색 조건에 즉시 반영한다', async () => {
  window.history.replaceState(null, '', '/requests?page=2');
  const user = userEvent.setup();
  render(<RequestList />);
  const input = searchInput();
  await user.click(input);

  fireEvent.compositionStart(input);
  for (const value of ['ㅅ', '시', '신', '신ㅊ', '신처', '신청', '신', '시', 'ㅅ']) {
    composeInput(input, value);
    expect(input.value).toBe(value);
    expect(searchParams().get('q')).toBe(value);
    expect(screen.getByRole('status').textContent).toContain(`검색어 “${value}”`);
    expect(searchParams().has('page')).toBe(false);
    expect(searchInput()).toBe(input);
    expect(document.activeElement).toBe(input);
  }

  composeInput(input, '');
  expect(input.value).toBe('');
  expect(searchParams().has('q')).toBe(false);
  expect(screen.getByRole('status').textContent).toContain('결과 6건');
  expect(screen.getByRole('status').textContent).not.toContain('검색어');
  fireEvent.compositionEnd(input, { data: '' });
  expect(searchParams().has('q')).toBe(false);
  expect(searchInput()).toBe(input);
  expect(document.activeElement).toBe(input);
  expect(controls.replace).not.toHaveBeenCalled();
});

test('한글 조합 중에도 결과를 좁혀 검색하되 확정용 Enter는 폼을 제출하지 않는다', async () => {
  window.history.replaceState(null, '', '/requests?q=%EA%B3%B5%EA%B3%B5');
  const user = userEvent.setup();
  render(<RequestList />);
  const input = searchInput();
  await user.click(input);
  expect(screen.getByRole('status').textContent).toContain('결과 3건');

  fireEvent.compositionStart(input);
  composeInput(input, '교');
  expect(input.value).toBe('교');
  expect(screen.getByRole('status').textContent).toContain('결과 2건');
  expect(searchParams().get('q')).toBe('교');
  expect(screen.getByRole('link', { name: '교육지원 포털 개선' })).toBeTruthy();
  expect(screen.getByRole('link', { name: '합성 교육 통계 연계' })).toBeTruthy();

  composeInput(input, '교육');
  expect(searchParams().get('q')).toBe('교육');
  expect(screen.getByRole('status').textContent).toContain('결과 2건');
  expect(
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', isComposing: true, keyCode: 229 }),
  ).toBe(false);
  fireEvent.submit(input.form!);
  expect(input.value).toBe('교육');
  expect(searchParams().get('q')).toBe('교육');
  expect(controls.replace).not.toHaveBeenCalled();

  composeInput(input, '교육지원');
  expect(screen.getByRole('status').textContent).toContain('결과 1건');
  expect(searchParams().get('q')).toBe('교육지원');
  expect(screen.getByRole('link', { name: '교육지원 포털 개선' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: '합성 교육 통계 연계' })).toBeNull();

  fireEvent.compositionEnd(input, { data: '교육지원' });
  expect(screen.getByRole('status').textContent).toContain('결과 1건');
  expect(searchParams().get('q')).toBe('교육지원');
  expect(searchInput()).toBe(input);
  expect(document.activeElement).toBe(input);
});

test('입력 중인 조회 기간을 보존하고 기존 상태 조건과 실시간 검색을 함께 적용한다', async () => {
  window.history.replaceState(null, '', '/requests?filter=mine');
  const user = userEvent.setup();
  render(<RequestList />);
  await user.selectOptions(screen.getByLabelText('접수 기간'), 'custom');
  const from = screen.getByLabelText('시작일') as HTMLInputElement;
  const to = screen.getByLabelText('종료일') as HTMLInputElement;
  fireEvent.change(from, { target: { value: '2026-11-02' } });
  fireEvent.change(to, { target: { value: '2026-11-04' } });

  await user.type(searchInput(), '정책');
  expect(screen.getByRole('status').textContent).toContain('내가 할 일 결과 1건');
  expect(screen.getByRole('link', { name: '정책정보 API 연계' })).toBeTruthy();
  expect((screen.getByLabelText('접수 기간') as HTMLSelectElement).value).toBe('custom');
  expect(screen.getByLabelText('시작일')).toBe(from);
  expect(screen.getByLabelText('종료일')).toBe(to);
  expect(from.value).toBe('2026-11-02');
  expect(to.value).toBe('2026-11-04');
  expect(searchParams().get('filter')).toBe('mine');
  expect(searchParams().get('q')).toBe('정책');
  expect(searchParams().has('period')).toBe(false);

  await user.click(screen.getByRole('button', { name: /^담당자 확인 중$/ }));
  expect(screen.getByRole('status').textContent).toContain('담당자 확인 중 결과 0건');
  expect(screen.getByRole('heading', { name: '조건에 맞는 신청이 없습니다' })).toBeTruthy();
  expect(searchParams().get('filter')).toBe('staff');
  expect(searchParams().get('q')).toBe('정책');
});

test('외부 URL의 검색어 변경과 조건 초기화를 입력창 및 결과에 동기화한다', async () => {
  window.history.replaceState(null, '', '/requests?q=%EC%A0%95%EC%B1%85');
  const user = userEvent.setup();
  render(<RequestList />);
  const input = searchInput();
  expect(input.value).toBe('정책');
  expect(screen.getByRole('status').textContent).toContain('결과 1건');

  act(() => {
    window.history.replaceState(null, '', '/requests?q=%EA%B3%B5%EA%B3%B5');
  });
  expect(searchInput()).toBe(input);
  expect(input.value).toBe('공공');
  expect(screen.getByRole('status').textContent).toContain('결과 3건');
  expect(screen.queryByRole('link', { name: '정책정보 API 연계' })).toBeNull();

  await user.click(screen.getByRole('button', { name: /^조건 초기화$/ }));
  expect(input.value).toBe('');
  expect(screen.getByRole('status').textContent).toContain('결과 6건');
  expect(window.location.search).toBe('');
  expect(searchInput()).toBe(input);
});
