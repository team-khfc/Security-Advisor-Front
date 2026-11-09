import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewRequest } from '@/features/request/NewRequest';
import { clearInputDraft } from '@/lib/inputDrafts';
import { forgetUpload, getUpload } from '@/lib/uploadDraft';
import type { Session } from '@/lib/types';
import { MOCK_MEMBERS } from '@/mocks/seed';

const controls = vi.hoisted(() => ({
  session: null as Session | null,
  create: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: controls.push }) }));
vi.mock('@/features/auth', () => ({
  useSession: () => ({ data: controls.session, isPending: false }),
}));
vi.mock('@/features/request/useRequests', () => ({
  useCreateCase: () => ({ mutateAsync: controls.create, isPending: false }),
}));

const applicant = MOCK_MEMBERS[0];

beforeEach(() => {
  controls.session = { member: applicant, mock: true, expiresAt: null };
  controls.create.mockReset().mockResolvedValue({ id: 'synthetic-case-stage3' });
  controls.push.mockReset();
});

afterEach(() => {
  clearInputDraft(applicant.id, 'new-case');
  forgetUpload(applicant.id, 'synthetic-case-stage3');
});

function fileInput() {
  return screen.getByLabelText('기획서 파일') as HTMLInputElement;
}

test('지원하지 않는 형식과 10MB 초과 파일은 파일 영역 안의 오류로 거부하고 선택하지 않는다', async () => {
  const user = userEvent.setup({ applyAccept: false });
  render(<NewRequest />);
  await user.upload(fileInput(), new File(['x'], 'synthetic.exe'));
  expect(screen.getByRole('alert').textContent).toBe(
    'PDF, HWPX, DOCX, TXT 파일을 10MB 이하로 선택해 주세요.',
  );
  expect(screen.queryByRole('list', { name: '분석 전 파일' })).toBeNull();
  const big = new File(['x'], 'synthetic.pdf');
  Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 });
  await user.upload(fileInput(), big);
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.queryByRole('list', { name: '분석 전 파일' })).toBeNull();
});

test('현재 API 허용 형식에 따라 HWP는 거부하고 TXT는 분석 전 파일로 선택한다', async () => {
  const user = userEvent.setup({ applyAccept: false });
  render(<NewRequest />);

  await user.upload(fileInput(), new File(['synthetic'], '합성기획서.hwp'));
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.queryByRole('list', { name: '분석 전 파일' })).toBeNull();

  await user.upload(fileInput(), new File(['synthetic'], '합성기획서.txt', { type: 'text/plain' }));
  expect(screen.queryByRole('alert')).toBeNull();
  expect(
    within(screen.getByRole('list', { name: '분석 전 파일' })).getByText('합성기획서.txt'),
  ).toBeTruthy();
});

test('끌어다 놓은 파일을 분석 전 목록에 표시하고 선택 취소 시 파일 선택 버튼으로 초점을 옮긴다', async () => {
  const user = userEvent.setup();
  render(<NewRequest />);
  const zone = screen.getByRole('heading', { name: '기획서를 끌어다 놓으세요' }).parentElement!;
  const file = new File([new Uint8Array(2048)], '합성기획서.pdf', { type: 'application/pdf' });
  fireEvent.dragOver(zone, { dataTransfer: { files: [file] } });
  expect(zone.classList.contains('drag')).toBe(true);
  fireEvent.drop(zone, { dataTransfer: { files: [file] } });
  expect(zone.classList.contains('drag')).toBe(false);
  const list = screen.getByRole('list', { name: '분석 전 파일' });
  expect(within(list).getByText('합성기획서.pdf')).toBeTruthy();
  expect(within(list).getByText('PDF, 2.0KB')).toBeTruthy();
  expect(screen.getByRole('button', { name: /기획서와 함께 작성 시작/ })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: '합성기획서.pdf 선택 취소' }));
  expect(screen.queryByRole('list', { name: '분석 전 파일' })).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '파일 선택' }));
});

test('선택한 서류만 생성 요청에 담고 성공하면 선택 파일을 사업 건에 넘긴 뒤 사업 건 화면으로 이동한다', async () => {
  const user = userEvent.setup();
  render(<NewRequest />);
  await user.type(screen.getByLabelText('사업명 (필수)'), '합성 방화벽 사업');
  await user.click(screen.getByRole('checkbox', { name: /보안성검토 신청서/ }));
  await user.upload(fileInput(), new File(['x'], '합성기획서.hwpx'));
  await user.click(screen.getByRole('button', { name: /기획서와 함께 작성 시작/ }));
  await waitFor(() =>
    expect(controls.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: '합성 방화벽 사업', docTypes: ['FIREWALL'] }),
    ),
  );
  expect(controls.push).toHaveBeenCalledWith('/cases/synthetic-case-stage3');
  expect(getUpload(applicant.id, 'synthetic-case-stage3')?.name).toBe('합성기획서.hwpx');
});

test('생성이 실패하면 오류를 보여 주고 입력한 사업명·부서·서류·파일을 그대로 유지한다', async () => {
  controls.create.mockRejectedValueOnce(new Error('합성 서버 오류로 사업 건을 만들지 못했습니다.'));
  const user = userEvent.setup();
  render(<NewRequest />);
  await user.type(screen.getByLabelText('사업명 (필수)'), '실패 검증 합성 사업');
  await user.click(screen.getByRole('checkbox', { name: /방화벽신청서/ }));
  await user.upload(fileInput(), new File(['x'], '유지할기획서.pdf'));
  await user.click(screen.getByRole('button', { name: /기획서와 함께 작성 시작/ }));
  expect(await screen.findByText('합성 서버 오류로 사업 건을 만들지 못했습니다.')).toBeTruthy();
  expect(controls.push).not.toHaveBeenCalled();
  expect((screen.getByLabelText('사업명 (필수)') as HTMLInputElement).value).toBe(
    '실패 검증 합성 사업',
  );
  expect((screen.getByLabelText('담당 부서 (필수)') as HTMLInputElement).value).toBe(
    applicant.department,
  );
  expect((screen.getByRole('checkbox', { name: /방화벽신청서/ }) as HTMLInputElement).checked).toBe(
    false,
  );
  expect(
    (screen.getByRole('checkbox', { name: /보안성검토 신청서/ }) as HTMLInputElement).checked,
  ).toBe(true);
  expect(screen.getByText('유지할기획서.pdf')).toBeTruthy();
});
