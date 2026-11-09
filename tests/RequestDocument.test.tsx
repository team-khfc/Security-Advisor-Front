import * as http from '@/lib/httpClient';
import { render } from './queryRender';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest';
import { RequestDocument } from '@/features/document/RequestDocument';
import type { Answer, SecurityRequest, Submission } from '@/features/request/types';
import { createMockState } from '@/mocks/seed';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as renderView } from '@testing-library/react';

const dialogMethods = {
  showModal: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal'),
  close: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close'),
};

beforeAll(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = true;
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = false;
      },
    },
  });
});

afterAll(() => {
  for (const [name, descriptor] of Object.entries(dialogMethods)) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function answer(overrides: Partial<Answer> = {}): Answer {
  return {
    key: 'purpose',
    label: '사업 목적',
    scope: 'CASE',
    ownerRole: 'APPLICANT',
    required: true,
    value: '합성 문서 검증 내용',
    source: 'USER_ANSWER',
    evidence: null,
    confirmed: true,
    notApplicable: false,
    confirmation: null,
    ...overrides,
  };
}

function request(overrides: Partial<SecurityRequest> = {}): SecurityRequest {
  return {
    ...structuredClone(createMockState().requests[0]),
    caseTitle: '합성 문서 사업',
    stage: 2,
    status: 'CONSULTING',
    publicationVersion: 9,
    commonAnswers: [answer()],
    answers: [],
    currentSubmissionId: null,
    submissions: [],
    ...overrides,
  };
}

function submission(overrides: Partial<Submission> = {}): Submission {
  return {
    id: 'demo-frozen-submission',
    number: 2,
    requestRevision: 3,
    caseRevision: 2,
    publicationVersion: 4,
    commonAnswers: [answer({ value: '제출 당시 합성 답변' })],
    answers: [],
    idempotencyKey: 'demo-submission-key',
    createdAt: '2026-11-08T09:00:00+09:00',
    snapshot: { caseTitle: '제출 당시 합성 사업명' },
    ...overrides,
  };
}

async function openPreview() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '문서 미리보기' }));
  return within(screen.getByRole('dialog')).getByLabelText('문서 내용');
}

test('문서 카드는 실제 답변·출처·근거를 안전한 텍스트로 미리본다', async () => {
  render(
    <RequestDocument
      request={request({
        commonAnswers: [
          answer({
            value: '<script>합성 입력</script>',
            source: 'AI_INFERRED',
            confirmed: false,
            evidence: '합성 첨부 문서 1쪽',
          }),
        ],
      })}
    />,
  );

  const preview = await openPreview();
  expect(preview.textContent).toContain('사업 목적: <script>합성 입력</script>');
  expect(preview.textContent).toContain('출처: AI 추론');
  expect(preview.textContent).toContain('확인 상태: 담당자 확인 필요');
  expect(preview.textContent).toContain('근거: 합성 첨부 문서 1쪽');
  expect(preview.querySelector('script')).toBeNull();
  expect(screen.getByText('AI 추론 미확인 1개')).toBeTruthy();
  await userEvent
    .setup()
    .click(within(screen.getByRole('dialog')).getByRole('button', { name: '닫기' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('제출본 ID로 고른 스냅샷의 답변과 제목·게시본을 표시하고 최신 수정값을 섞지 않는다', async () => {
  const frozen = submission();
  render(
    <RequestDocument
      request={request({
        status: 'FINALIZED',
        stage: 4,
        currentSubmissionId: frozen.id,
        commonAnswers: [answer({ value: '나중에 바뀐 합성 답변' })],
        submissions: [
          frozen,
          submission({
            id: 'demo-other-submission',
            number: 1,
            commonAnswers: [answer({ value: '다른 제출본의 합성 답변' })],
          }),
        ],
      })}
    />,
  );

  expect(screen.getByText('확정본 · 제출본 v2')).toBeTruthy();
  expect(screen.getByText('v4', { selector: '.doc-dl dd' })).toBeTruthy();
  expect(screen.getByText('제출본 버전 2개 보기')).toBeTruthy();
  const preview = await openPreview();
  expect(preview.textContent).toContain('사업명: 제출 당시 합성 사업명');
  expect(preview.textContent).toContain('사업 목적: 제출 당시 합성 답변');
  expect(preview.textContent).toContain('적용 설정: v4');
  expect(preview.textContent).not.toContain('나중에 바뀐 합성 답변');
  expect(preview.textContent).not.toContain('다른 제출본의 합성 답변');
  expect(preview.textContent).not.toContain('적용 설정: v9');
});

test('출처나 확인자가 없는 값은 confirmed=true여도 모두 확인됨으로 표시하지 않는다', async () => {
  render(
    <RequestDocument
      request={request({
        commonAnswers: [
          answer({ key: 'ai', source: 'AI_INFERRED', confirmed: true, confirmation: null }),
          answer({ key: 'staff', source: 'STAFF_INPUT', confirmed: true, confirmation: null }),
          answer({ key: 'unknown', source: null, confirmed: true }),
          answer({ key: 'user' }),
        ],
      })}
    />,
  );
  expect(screen.getByText('미확정 2개, AI 추론 미확인 1개')).toBeTruthy();
  expect(screen.queryByText('모든 값 확인됨')).toBeNull();
  const preview = await openPreview();
  expect(preview.textContent).toContain('미확정 항목: 3개');
});

test('제출 직후 캐시에 남은 이전 초안의 재확인 상태를 제출본에 섞지 않는다', async () => {
  const client = new QueryClient();
  client.setQueryData(['final-draft', '42'], {
    text: '현재 초안',
    valueSource: 'AI_INFERRED',
    confirmed: true,
    stale: true,
  });
  const frozen = submission({
    snapshot: {
      finalDraft: { text: '확인한 불변 보고서', valueSource: 'AI_INFERRED', confirmed: true },
    },
  });
  renderView(
    <QueryClientProvider client={client}>
      <RequestDocument
        request={request({
          id: '42',
          status: 'SUBMITTED',
          stage: 4,
          currentSubmissionId: frozen.id,
          submissions: [frozen],
        })}
      />
    </QueryClientProvider>,
  );
  expect(screen.getByText('모든 값 확인됨')).toBeTruthy();
  expect(screen.queryByText(/AI 추론 미확인/)).toBeNull();
  await openPreview();
  expect(within(screen.getByRole('dialog')).getByText('확인한 불변 보고서')).toBeTruthy();
  expect(within(screen.getByRole('dialog')).queryByText('현재 초안')).toBeNull();
});

test('제출본 본문이 누락되면 현재 초안으로 대신 내보내지 않는다', () => {
  render(<RequestDocument request={request({ currentSubmissionId: 'demo-missing-submission' })} />);
  expect(screen.getByText(/제출본 내용을 불러오지 못했습니다/)).toBeTruthy();
  expect(
    (screen.getByRole('button', { name: '문서 미리보기' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect((screen.getByRole('button', { name: 'PDF 다운로드' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect(screen.queryByText('모든 값 확인됨')).toBeNull();
});

test.each(['SUBMITTED', 'FINALIZED'] as const)(
  '%s의 제출본 식별자가 누락되어도 최신 답변을 초안으로 내보내지 않는다',
  (status) => {
    render(
      <RequestDocument
        request={request({
          stage: 4,
          status,
          currentSubmissionId: null,
          commonAnswers: [answer({ value: '제출 이후 바뀐 합성 답변' })],
        })}
      />,
    );

    expect(screen.getByText(/제출본 내용을 불러오지 못했습니다/)).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: '문서 미리보기' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'PDF 다운로드' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.queryByText('모든 값 확인됨')).toBeNull();
    expect(screen.getByLabelText('문서 내용').textContent).not.toContain(
      '제출 이후 바뀐 합성 답변',
    );
  },
);

test('PDF 다운로드는 지정한 제출본을 생성하고 서버의 파일 바이트·용량·임시 URL을 사용한다', async () => {
  const json = vi.spyOn(http, 'requestJson').mockResolvedValue({ generatedDocumentId: 88 });
  const blob = new Blob(['%PDF-1.7 합성 PDF 바이트'], { type: 'application/pdf' });
  const binary = vi.spyOn(http, 'requestBlob').mockResolvedValue(blob);
  const createUrl = vi.fn(() => 'blob:synthetic-pdf');
  const revokeUrl = vi.fn();
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: revokeUrl }),
  );
  const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const frozen = submission({ id: '123' });
  render(
    <RequestDocument
      request={request({ id: '42', currentSubmissionId: '123', submissions: [frozen] })}
    />,
  );
  const card = screen.getByRole('region', { name: '문서' });
  fireEvent.click(within(card).getAllByRole('button', { name: 'PDF 다운로드' })[0]);
  await waitFor(() => expect(clicked).toHaveBeenCalledOnce());
  expect(json).toHaveBeenCalledWith('/api/security-requests/42/generated-documents', {
    method: 'POST',
    body: { submissionId: 123, aiSupplement: false },
  });
  expect(binary).toHaveBeenCalledWith('/api/generated-documents/88/download?format=PDF');
  expect(createUrl).toHaveBeenCalledWith(blob);
  expect(screen.getByRole('status').textContent).toContain((blob.size / 1024).toFixed(1) + 'KB');
  await waitFor(() => expect(revokeUrl).toHaveBeenCalledWith('blob:synthetic-pdf'), {
    timeout: 2000,
  });
});

test('PDF 생성 실패는 오류를 표시하며 성공 다운로드를 만들지 않는다', async () => {
  vi.spyOn(http, 'requestJson').mockRejectedValue(new Error('출력 형식을 사용할 수 없습니다.'));
  const binary = vi.spyOn(http, 'requestBlob');
  render(<RequestDocument request={request({ stage: 1 })} />);
  fireEvent.click(screen.getByRole('button', { name: 'PDF 다운로드' }));
  await screen.findByText('출력 형식을 사용할 수 없습니다.');
  expect(binary).not.toHaveBeenCalled();
  expect(screen.queryByText(/다운로드 준비 완료/)).toBeNull();
});

test('PDF 준비 중 키보드 초점을 유지하고 Enter 반복으로 파일을 중복 생성하지 않는다', async () => {
  let complete!: (value: { generatedDocumentId: number }) => void;
  const json = vi.spyOn(http, 'requestJson').mockImplementation(
    () =>
      new Promise<{ generatedDocumentId: number }>((resolve) => {
        complete = resolve;
      }),
  );
  vi.spyOn(http, 'requestBlob').mockResolvedValue(
    new Blob(['%PDF 합성'], { type: 'application/pdf' }),
  );
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:keyboard-pdf'),
      revokeObjectURL: vi.fn(),
    }),
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<RequestDocument request={request({ stage: 1 })} />);
  const user = userEvent.setup();
  const button = screen.getByRole('button', { name: 'PDF 다운로드' });
  button.focus();
  await user.keyboard('{Enter}');
  expect(button.getAttribute('aria-disabled')).toBe('true');
  expect(document.activeElement).toBe(button);
  await user.keyboard('{Enter}');
  expect(json).toHaveBeenCalledOnce();
  complete({ generatedDocumentId: 91 });
  await screen.findByText(/PDF 다운로드 준비 완료/);
  expect(document.activeElement).toBe(button);
});
