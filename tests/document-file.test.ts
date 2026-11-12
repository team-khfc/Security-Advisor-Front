// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';
import { requestDocumentFile } from '@/lib/httpClient';
afterEach(() => vi.restoreAllMocks());
test('DOCX 파일만 수신하며 경로 파일명과 오류 HTML을 저장하지 않는다', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch');
  fetcher.mockResolvedValueOnce(
    new Response('PK synthetic', {
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'content-disposition': "attachment; filename*=UTF-8''..%2Ffake.docx",
      },
    }),
  );
  const file = await requestDocumentFile('/api/generated-documents/1/download?format=DOCX', 'DOCX');
  expect(file.fileName).toBeUndefined();
  expect(file.blob.size).toBeGreaterThan(0);
  fetcher.mockResolvedValueOnce(
    new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } }),
  );
  await expect(
    requestDocumentFile('/api/generated-documents/1/download?format=DOCX', 'DOCX'),
  ).rejects.toThrow('DOCX 응답');
});
