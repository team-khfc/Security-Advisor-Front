import { expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigurationPage } from '@/features/configuration';
import { PolicyLifecycle } from '@/features/policy';
import type { Role, Session } from '@/lib/types';
import { MOCK_MEMBERS } from '@/mocks/seed';

const controls = vi.hoisted(() => ({ session: null as Session | null }));

vi.mock('@/features/auth', () => ({
  useSession: () => ({ data: controls.session, isPending: false }),
}));
vi.mock('@/lib/queries', () => ({
  useInstallation: () => ({ data: { institutionName: '가상공공기관' }, isError: false }),
}));

function login(role: Role) {
  const member = MOCK_MEMBERS.find((item) => item.role === role)!;
  controls.session = { member, mock: true, expiresAt: null };
}

test.each(['APPLICANT', 'INFRA', 'SECURITY'] as const)(
  '%s 역할은 기관 설정 내용 대신 관리자 전용 안내만 본다',
  (role) => {
    login(role);
    render(<ConfigurationPage />);
    expect(screen.getByText('기관 관리자만 설정을 확인할 수 있습니다.')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
  },
);

test('관리자는 읽기 전용 게시본 표시와 탭을 보고, 편집·게시 버튼은 사유와 함께 비활성이다', async () => {
  login('ADMIN');
  const user = userEvent.setup();
  render(<ConfigurationPage />);
  expect(screen.getByText('게시본 v1')).toBeTruthy();
  expect(screen.getByText('모의 seed 게시본 · 읽기 전용')).toBeTruthy();
  for (const name of ['초안 변경 취소', '설정 초안 저장', '변경 검토·게시']) {
    const button = screen.getByRole('button', { name }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-describedby')).toBe('settings-disabled');
  }
  expect(document.getElementById('settings-disabled')?.textContent).toContain('P2 구현 예정');

  const first = screen.getByRole('tab', { name: '인터뷰 질문' });
  first.focus();
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', { name: '검토 절차' }).getAttribute('aria-selected')).toBe('true');
  expect(within(screen.getByRole('tabpanel')).getByText('INFRA 선행 고정')).toBeTruthy();
  await user.keyboard('{End}');
  expect(screen.getByRole('tab', { name: '설정 버전' }).getAttribute('aria-selected')).toBe('true');
  expect(within(screen.getByRole('tabpanel')).getByText('현재 게시본')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '변경 검토·게시' })).toBeNull();
});

test('정책 수명주기는 데이터 연결 전임을 알리고 건수·거르기를 동작하는 것처럼 보이지 않게 한다', () => {
  render(<PolicyLifecycle />);
  expect(screen.getByText('P2 구현 예정 기능입니다.')).toBeTruthy();
  const filters = within(screen.getByRole('group', { name: '정책 거르기' })).getAllByRole('button');
  expect(filters).toHaveLength(3);
  for (const filter of filters) expect((filter as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getAllByLabelText('데이터 연결 전')).toHaveLength(4);
  expect(screen.queryByText(/\d+건/)).toBeNull();
  expect(screen.getByText('연결된 정책이 없습니다')).toBeTruthy();
  expect(screen.getByRole('link', { name: '신청 현황으로' }).getAttribute('href')).toBe(
    '/requests',
  );
});
