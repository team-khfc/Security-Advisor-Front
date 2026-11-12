import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from './queryRender';
import { EvidenceSourceLink } from '@/features/request/SourceDocuments';
import * as http from '@/lib/httpClient';

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test('파일 식별자가 없는 과거 근거를 임의 원문으로 연결하지 않는다', () => {
  render(<EvidenceSourceLink caseId="16" reference="업로드 문서 분석 요약 1 (D1)" />);
  expect(screen.queryByRole('button', { name: '원문 근거 확인' })).toBeNull();
});

test('명시된 파일만 열고 추출문 안의 태그를 실행하지 않으며 원본 내려받기를 제공한다', async () => {
  const request = vi.spyOn(http, 'requestJson').mockResolvedValue({
    uploadedFileId: 2,
    originalName: '합성.txt',
    uploadedAt: '2026-11-12T10:00:00Z',
    text: '<script>합성 원문</script>\n매일 백업',
    maximumCharacters: 20000,
    possiblyTruncated: false,
  });
  render(
    <EvidenceSourceLink
      caseId="16"
      reference="업로드 문서 분석 요약 · 파일 #2 · 미확정 참고자료"
    />,
  );
  expect(request).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: '원문 근거 확인' }));
  expect(await screen.findByText('<script>합성 원문</script>')).toBeTruthy();
  expect(request).toHaveBeenCalledWith(
    '/api/business-cases/16/source-documents/2',
    expect.anything(),
  );
  expect(screen.getByRole('link', { name: '원본 파일 내려받기' }).getAttribute('href')).toBe(
    '/api/business-cases/16/uploaded-files/2',
  );
  expect(document.querySelector('.source-document-text script')).toBeNull();
  await userEvent.type(screen.getByRole('searchbox', { name: '원문에서 찾기' }), '백업');
  expect(document.querySelector('mark')?.textContent).toBe('매일 백업');
});
