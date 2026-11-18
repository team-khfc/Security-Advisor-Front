import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from './queryRender';
import * as http from '@/lib/httpClient';
import { AnalysisJobs } from '@/features/request/AnalysisJobs';
import { OperationsPanel } from '@/features/insight/OperationsPanel';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
test('실패한 분석은 파일을 재업로드하지 않고 같은 자료로 명시적으로 재요청한다', async () => {
  const request = vi.spyOn(http, 'requestJson').mockImplementation(async (path, options) =>
    options?.method === 'POST'
      ? {}
      : [
          {
            analysisJobId: 7,
            uploadedFileId: 8,
            status: 'FAILED',
            statusLabel: '분석 실패',
            summary: null,
            errorMessage: '합성 실패',
          },
        ],
  );
  render(<AnalysisJobs caseId="2" revision={3} />);
  await userEvent.click(await screen.findByRole('button', { name: '같은 자료 다시 분석' }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith('/api/business-cases/2/analysis-jobs', {
      method: 'POST',
      body: { uploadedFileId: 8 },
    }),
  );
  expect(request.mock.calls.some(([p]) => String(p).includes('uploaded-files'))).toBe(false);
});
test('경보 확인과 실패한 알림 재처리는 별개 명령으로 전송한다', async () => {
  const request = vi.spyOn(http, 'requestJson').mockImplementation(async (path, options) => {
    if (options?.method === 'POST') return null;
    if (String(path).includes('notification-deliveries'))
      return [{ id: 9, channel: 'EMAIL', status: 'FAILED', attempts: 5 }];
    return {
      retentionDays: 30,
      samples: [],
      alerts: [
        {
          operation_alert_id: 4,
          message: '합성 장애',
          opened_at: '2026-11-18T00:00:00Z',
          resolved_at: null,
          acknowledged_at: null,
        },
      ],
    };
  });
  render(<OperationsPanel />);
  await userEvent.click(await screen.findByRole('button', { name: '경보 확인' }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith('/api/operation-alerts/4/acknowledgements', {
      method: 'POST',
    }),
  );
  await userEvent.click(await screen.findByRole('button', { name: '다시 처리' }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith('/api/notification-deliveries/9/retries', {
      method: 'POST',
    }),
  );
  expect(screen.getByText(/발생 중/)).toBeTruthy();
});
