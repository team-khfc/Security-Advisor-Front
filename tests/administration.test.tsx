import { expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigurationPage } from '@/features/configuration';
import { PolicyLifecycle } from '@/features/policy';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

test('정책은 목록 조회 전 임의 건수를 표시하지 않고 장비 변경과 기록을 구분한다', () => {
  controls.session = null;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PolicyLifecycle />
    </QueryClientProvider>,
  );
  expect(screen.getByText('서류 확정과 실제 장비 적용은 별개입니다.')).toBeTruthy();
  expect(screen.getByText('내용을 불러오고 있습니다.')).toBeTruthy();
  expect(screen.queryByRole('table')).toBeNull();
  expect(screen.queryByText(/결과 \d+건/)).toBeNull();
});
