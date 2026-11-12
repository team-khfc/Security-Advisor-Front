import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { render } from './queryRender';
import { PreparationReview } from '@/features/request/PreparationReview';
import * as http from '@/lib/httpClient';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const bundle = {
  capturedAt: '2026-11-12T12:00:00Z',
  items: [
    {
      key: 'plan',
      label: '사업계획서',
      reviewer: 'SECURITY',
      applicability: 'APPLICABLE',
      status: 'IN_REVIEW',
      stale: true,
      note: '합성 범위 보완',
      actor: '합성 담당자',
      reviewedAt: '2026-11-12T11:00:00Z',
      files: [{ fileId: 9, name: '합성-보완.txt' }],
    },
  ],
};
test('최종 검토에서 미완료와 재검토 사유 및 원문 링크를 보여준다', async () => {
  vi.spyOn(http, 'requestJson').mockResolvedValue(bundle);
  render(<PreparationReview requestId="20" caseId="19" submitted={false} />);
  expect(await screen.findByText('사업계획서 · 검토 중')).toBeTruthy();
  expect(screen.getByText(/이전 조건 기준/)).toBeTruthy();
  expect(screen.getByText(/설명·보완 사유: 합성 범위 보완/)).toBeTruthy();
  expect(screen.getByRole('button', { name: '원문 근거 확인' })).toBeTruthy();
});
test('기존 제출본에는 현재 자료를 불러와 추정하지 않는다', () => {
  const request = vi.spyOn(http, 'requestJson');
  render(<PreparationReview requestId="20" caseId="19" submitted snapshot={{}} />);
  expect(screen.getByText(/이 제출본에는 준비자료 검토 기록이 없습니다/)).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
});
test('제출본은 저장된 파일과 담당자 기록만 보여준다', () => {
  const request = vi.spyOn(http, 'requestJson');
  render(
    <PreparationReview
      requestId="20"
      caseId="19"
      submitted
      snapshot={{ preparationReview: bundle }}
    />,
  );
  expect(screen.getByText('합성-보완.txt')).toBeTruthy();
  expect(screen.getByText(/최근 기록: 합성 담당자/)).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
});
