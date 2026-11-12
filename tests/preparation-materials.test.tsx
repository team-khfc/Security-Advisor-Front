import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from './queryRender';
import { PreparationMaterials } from '@/features/request/PreparationMaterials';
import * as http from '@/lib/httpClient';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const item = {
  key: 'plan',
  label: '사업계획서',
  reviewer: 'SECURITY',
  condition: '',
  description: '사업 범위',
  applicability: 'APPLICABLE',
  status: 'MISSING',
  fileIds: [],
  note: '',
  actor: null,
  at: null,
  stale: false,
  canAttach: true,
  canReview: false,
};
const base = {
  revision: 0,
  fingerprint: 'hash',
  extraConditions: {},
  editable: true,
  canSetConditions: true,
  items: [item],
};
test('신청자는 자료를 명시적으로 연결하며 확인 완료는 할 수 없다', async () => {
  const request = vi.spyOn(http, 'requestJson').mockImplementation(async (path, options) => {
    if (path.endsWith('uploaded-files'))
      return [{ uploadedFileId: 7, originalName: '합성 기획서.txt' }];
    if (options?.method === 'PUT')
      return { ...base, revision: 1, items: [{ ...item, fileIds: [7], status: 'IN_REVIEW' }] };
    return base;
  });
  render(<PreparationMaterials requestId="20" caseId="19" />);
  await userEvent.click(screen.getByText('사업 조건별 준비자료 · 첨부 및 검토 상태'));
  const card = await screen.findByRole('article', { name: '사업계획서' });
  expect(within(card).queryByRole('button', { name: '확인 완료로 저장' })).toBeNull();
  await userEvent.click(await within(card).findByRole('checkbox', { name: '합성 기획서.txt' }));
  expect(request.mock.calls.filter(([, o]) => o?.method === 'PUT')).toHaveLength(0);
  await userEvent.click(within(card).getByRole('button', { name: '선택 자료 연결·교체' }));
  expect(await within(card).findByText('사업계획서 · 검토 중')).toBeTruthy();
  expect(request).toHaveBeenCalledWith(
    '/api/security-requests/20/preparation-materials',
    expect.objectContaining({
      body: expect.objectContaining({
        action: 'ATTACH',
        fileIds: [7],
        expectedRevision: 0,
        expectedFingerprint: 'hash',
      }),
    }),
  );
});
test('담당자의 보완 사유가 필요하고 충돌 시 입력을 보존한다', async () => {
  vi.spyOn(http, 'requestJson').mockImplementation(async (path, options) => {
    if (path.endsWith('uploaded-files')) return [];
    if (options?.method === 'PUT') throw new Error('최신 목록을 확인해 주세요.');
    return {
      ...base,
      canSetConditions: false,
      items: [{ ...item, status: 'IN_REVIEW', fileIds: [7], canAttach: false, canReview: true }],
    };
  });
  render(<PreparationMaterials requestId="20" caseId="19" />);
  await userEvent.click(screen.getByText('사업 조건별 준비자료 · 첨부 및 검토 상태'));
  const button = await screen.findByRole('button', { name: '보완 필요로 저장' });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  const note = screen.getByRole('textbox', { name: '사업계획서 설명·보완 사유' });
  await userEvent.type(note, '보유기간을 보완해 주세요');
  await userEvent.click(button);
  expect(await screen.findByText('최신 목록을 확인해 주세요.')).toBeTruthy();
  expect((note as HTMLTextAreaElement).value).toBe('보유기간을 보완해 주세요');
});

test('업로드 후 실제 파일 입력을 비워 같은 이름의 보완본을 다시 선택할 수 있다', async () => {
  const request = vi.spyOn(http, 'requestJson').mockImplementation(async (path) => {
    if (path.endsWith('/files')) return { uploadedFileId: 8 };
    if (path.endsWith('uploaded-files')) return [];
    return base;
  });
  render(<PreparationMaterials requestId="20" caseId="19" />);
  await userEvent.click(screen.getByText('사업 조건별 준비자료 · 첨부 및 검토 상태'));
  const input = (await screen.findByLabelText('새 준비자료 파일')) as HTMLInputElement;
  const file = new File(['합성 내용'], '합성-보완.txt', { type: 'text/plain' });
  await userEvent.upload(input, file);
  await userEvent.click(screen.getByRole('button', { name: '선택한 자료 업로드' }));
  await screen.findByText('업로드했습니다. 아래 준비자료에서 파일을 선택해 연결해 주세요.');
  expect(input.value).toBe('');
  expect(input.files?.length).toBe(0);
  await userEvent.upload(input, file);
  expect(
    (screen.getByRole('button', { name: '선택한 자료 업로드' }) as HTMLButtonElement).disabled,
  ).toBe(false);
  await userEvent.click(screen.getByRole('button', { name: '선택한 자료 업로드' }));
  expect(request.mock.calls.filter(([path]) => path.endsWith('/files'))).toHaveLength(2);
});
