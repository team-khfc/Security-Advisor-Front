import { render } from './queryRender';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import * as http from '@/lib/httpClient';
import { FinalDraftPanel } from '@/features/request/FinalDraftPanel';
import type { FinalDraft } from '@/features/request/useFinalDraft';
import { createMockState } from '@/mocks/seed';

afterEach(() => vi.restoreAllMocks());
const draft: FinalDraft = {
  finalDraftId: 21,
  securityRequestId: 42,
  text: '합성 AI 보고서',
  valueSource: 'AI_INFERRED',
  modelReference: 'fake/offline',
  confirmed: false,
  confirmedBy: null,
  confirmedAt: null,
  stale: false,
  revision: 0,
};
function props(actorId: string, current: FinalDraft | null = draft) {
  return {
    request: { ...createMockState().requests[0], id: '42', revision: 3 },
    actorId,
    draft: current,
    onDirtyChange: vi.fn(),
  };
}

test('AI 초안을 수정하면 미저장 표시와 제출 잠금이 생기고 명시적 확인 요청에 수정 내용을 보낸다', async () => {
  const json = vi
    .spyOn(http, 'requestJson')
    .mockResolvedValue({ ...draft, text: '직접 수정한 합성 내용', confirmed: true });
  const input = props('draft-editor');
  render(<FinalDraftPanel {...input} />);
  expect(screen.getByText('미확정')).toBeTruthy();
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText('최종 보고서 내용'));
  await user.type(screen.getByLabelText('최종 보고서 내용'), '직접 수정한 합성 내용');
  expect(input.onDirtyChange).toHaveBeenLastCalledWith(true);
  expect(json).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: '내용 확인·저장' }));
  await waitFor(() =>
    expect(json).toHaveBeenCalledWith('/api/final-drafts/21/confirmation', {
      method: 'PUT',
      body: { expectedRevision: 0, text: '직접 수정한 합성 내용' },
    }),
  );
});

test('확인 실패 시 편집 내용을 유지하며 재시도 안내를 표시한다', async () => {
  vi.spyOn(http, 'requestJson').mockRejectedValue(new Error('원본 답변이 변경되었습니다.'));
  render(<FinalDraftPanel {...props('draft-failure')} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('최종 보고서 내용'), ' 보충');
  await user.click(screen.getByRole('button', { name: '내용 확인·저장' }));
  await screen.findByText(/원본 답변이 변경되었습니다/);
  expect((screen.getByLabelText('최종 보고서 내용') as HTMLTextAreaElement).value).toBe(
    '합성 AI 보고서 보충',
  );
});

test('AI 없이 직접 작성해도 초안 생성과 명시적 확인을 차례로 요청한다', async () => {
  const json = vi
    .spyOn(http, 'requestJson')
    .mockResolvedValue({ ...draft, valueSource: 'USER_ANSWER' });
  render(<FinalDraftPanel {...props('draft-manual', null)} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('최종 보고서 내용'), '직접 작성한 합성 보고서');
  await user.click(screen.getByRole('button', { name: '내용 확인·저장' }));
  await waitFor(() => expect(json).toHaveBeenCalledTimes(2));
  expect(json.mock.calls.map(([path]) => path)).toEqual([
    '/api/security-requests/42/final-drafts',
    '/api/final-drafts/21/confirmation',
  ]);
});
