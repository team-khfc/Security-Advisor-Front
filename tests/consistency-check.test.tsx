import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from './queryRender';
import { ConsistencyCheck } from '@/features/request/ConsistencyCheck';
import * as http from '@/lib/httpClient';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const base = {
  fingerprint: 'hash',
  checkedAt: '2026-11-12T12:00:00Z',
  model: 'synthetic/test',
  answerCount: 1,
  totalFiles: 1,
  sources: [{ fileId: 2, name: '합성 기획서.txt', truncated: false, empty: false }],
};
test('명시적으로 검사한 뒤 답변·실제 인용·원문 연결과 후보 안내를 표시한다', async () => {
  const result = {
    ...base,
    findings: [
      {
        fieldKey: 'data.personal_info',
        label: '개인정보 처리',
        answer: 'false',
        confirmed: true,
        fileId: 2,
        quote: '성명을 수집합니다.',
        explanation: '처리 여부를 확인해 주세요.',
      },
    ],
  };
  const request = vi.spyOn(http, 'requestJson').mockImplementation(async (path, options) => {
    if (String(path).includes('uploaded-files'))
      return [{ uploadedFileId: 2, originalName: '합성 기획서.txt' }];
    return options?.method === 'POST' ? result : [];
  });
  render(<ConsistencyCheck requestId="17" caseId="16" />);
  expect(request.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
  await screen.findByText('합성 기획서.txt');
  await userEvent.click(screen.getByRole('button', { name: 'AI 모순 확인' }));
  expect(await screen.findByText('확인 필요 후보 1건')).toBeTruthy();
  expect(screen.getByText('성명을 수집합니다.')).toBeTruthy();
  expect(screen.getByRole('button', { name: '원문 근거 확인' })).toBeTruthy();
  expect(request.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
});
test('실패를 모순 없음으로 표시하지 않고 재검사를 허용한다', async () => {
  vi.spyOn(http, 'requestJson').mockImplementation(async (path, options) => {
    if (String(path).includes('uploaded-files'))
      return [{ uploadedFileId: 2, originalName: '합성 기획서.txt' }];
    if (options?.method === 'POST') throw new Error('원문 검증 실패');
    return [];
  });
  render(<ConsistencyCheck requestId="17" caseId="16" />);
  await screen.findByText('합성 기획서.txt');
  await userEvent.click(screen.getByRole('button', { name: 'AI 모순 확인' }));
  expect(await screen.findByText('원문 검증 실패')).toBeTruthy();
  expect(screen.queryByText(/모순 후보를 찾지 못했습니다/)).toBeNull();
});
