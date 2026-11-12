import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from './queryRender';
import { ConsistencyHistory } from '@/features/request/ConsistencyHistory';
import * as http from '@/lib/httpClient';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const record = {
  id: 1,
  revision: 2,
  stale: false,
  canDecide: true,
  allowedFindings: [0],
  result: {
    fingerprint: 'hash',
    checkedAt: '2026-11-12T12:00:00Z',
    findings: [
      {
        fieldKey: 'data.personal_info',
        label: '개인정보',
        answer: 'false',
        fileId: 3,
        quote: '성명을 수집',
        explanation: '처리 여부 확인',
      },
    ],
  },
  decisions: [],
};
test('담당자가 사유와 버전을 함께 보내 처리한다', async () => {
  const call = vi
    .spyOn(http, 'requestJson')
    .mockImplementation(async (_path, options) => (options?.method === 'POST' ? record : [record]));
  render(<ConsistencyHistory requestId="1" caseId="2" />);
  await userEvent.click(await screen.findByText(/검사 #1/));
  await userEvent.type(
    screen.getByLabelText('판단 근거·보완 사유'),
    '합성 원문과 사업 범위를 대조함',
  );
  await userEvent.click(screen.getByRole('button', { name: '처리 결과 저장' }));
  expect(call).toHaveBeenCalledWith(
    '/api/security-requests/1/consistency-checks/1/decisions',
    expect.objectContaining({
      body: expect.objectContaining({
        expectedRevision: 2,
        expectedFingerprint: 'hash',
        reason: '합성 원문과 사업 범위를 대조함',
      }),
    }),
  );
});
test('제출본의 기록은 현재 API를 조회하지 않고 고정된 값만 보여준다', async () => {
  const call = vi.spyOn(http, 'requestJson');
  render(
    <ConsistencyHistory
      requestId="1"
      caseId="2"
      submitted
      snapshot={{ consistencyReviews: [record] }}
    />,
  );
  await userEvent.click(screen.getByText(/검사 #1/));
  expect(screen.getByText('성명을 수집')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '처리 결과 저장' })).toBeNull();
  expect(call).not.toHaveBeenCalled();
});
test('과거 제출본의 없는 검사 기록을 추정하지 않는다', () => {
  const call = vi.spyOn(http, 'requestJson');
  render(<ConsistencyHistory requestId="1" caseId="2" submitted snapshot={{}} />);
  expect(screen.getByText(/현재 기록으로 추정하지 않습니다/)).toBeTruthy();
  expect(call).not.toHaveBeenCalled();
});
