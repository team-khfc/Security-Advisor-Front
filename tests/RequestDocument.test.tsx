import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest';
import { RequestDocument } from '@/features/document/RequestDocument';
import type { Answer, SecurityRequest, Submission } from '@/features/request/types';
import { createMockState } from '@/mocks/seed';

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

test('제출본 본문이 누락되면 현재 초안으로 대신 내보내지 않는다', () => {
  render(<RequestDocument request={request({ currentSubmissionId: 'demo-missing-submission' })} />);
  expect(screen.getByText(/제출본 내용을 불러오지 못했습니다/)).toBeTruthy();
  expect(
    (screen.getByRole('button', { name: '문서 미리보기' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect((screen.getByRole('button', { name: 'TXT 다운로드' }) as HTMLButtonElement).disabled).toBe(
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
      (screen.getByRole('button', { name: 'TXT 다운로드' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.queryByText('모든 값 확인됨')).toBeNull();
    expect(screen.getByLabelText('문서 내용').textContent).not.toContain(
      '제출 이후 바뀐 합성 답변',
    );
  },
);

test('TXT 다운로드의 실제 UTF-8 바이트와 표시 크기가 미리보기 내용과 일치하고 임시 URL을 해제한다', async () => {
  render(
    <RequestDocument
      request={request({ commonAnswers: [answer({ value: '한글 합성 문서 내용 🎯' })] })}
    />,
  );
  const preview = await openPreview();
  const text = preview.textContent ?? '';
  const bytes = new TextEncoder().encode(text).length;
  const size = bytes > 1024 ? `${(bytes / 1024).toFixed(1)}KB` : `${bytes}B`;
  expect(screen.getByText(`TXT, ${size}`)).toBeTruthy();

  const createUrl = vi.fn<(blob: Blob) => string>(() => 'blob:demo-request-document');
  const revokeUrl = vi.fn();
  const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  Object.defineProperties(URL, {
    createObjectURL: { configurable: true, value: createUrl },
    revokeObjectURL: { configurable: true, value: revokeUrl },
  });
  const downloaded: { href: string; filename: string }[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloaded.push({ href: this.href, filename: this.download });
  });
  vi.useFakeTimers();
  try {
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'TXT 다운로드' }),
    );
    expect(createUrl).toHaveBeenCalledOnce();
    expect(createUrl.mock.calls[0][0].size).toBe(bytes);
    expect(createUrl.mock.calls[0][0].type).toBe('text/plain;charset=utf-8');
    expect(downloaded).toEqual([
      { href: 'blob:demo-request-document', filename: `${request().id}_초안.txt` },
    ]);
    expect(revokeUrl).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeUrl).toHaveBeenCalledWith('blob:demo-request-document');
    vi.useRealTimers();
    const downloadedText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('합성 다운로드 내용을 읽지 못했습니다.'));
      reader.readAsText(createUrl.mock.calls[0][0]);
    });
    expect(downloadedText).toBe(text);
  } finally {
    if (originalCreate) Object.defineProperty(URL, 'createObjectURL', originalCreate);
    else Reflect.deleteProperty(URL, 'createObjectURL');
    if (originalRevoke) Object.defineProperty(URL, 'revokeObjectURL', originalRevoke);
    else Reflect.deleteProperty(URL, 'revokeObjectURL');
  }
});
