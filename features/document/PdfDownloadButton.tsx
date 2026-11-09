'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { requestBlob, requestJson } from '@/lib/httpClient';
import { Notice } from '@/components/ui';

/** 현재 초안과 특정 제출본을 명시적으로 구분해 정식 PDF를 받는다. */
export function PdfDownloadButton({
  requestId,
  submissionId,
  disabled = false,
}: {
  requestId: string;
  submissionId?: string;
  disabled?: boolean;
}) {
  const [size, setSize] = useState('');
  const download = useMutation({
    mutationFn: async () => {
      const doc = await requestJson<{ generatedDocumentId: number }>(
        `/api/security-requests/${encodeURIComponent(requestId)}/generated-documents`,
        {
          method: 'POST',
          body: {
            ...(submissionId ? { submissionId: Number(submissionId) } : {}),
            aiSupplement: false,
          },
        },
      );
      return requestBlob(`/api/generated-documents/${doc.generatedDocumentId}/download?format=PDF`);
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `신청_${requestId.replace(/[^a-zA-Z0-9_-]/g, '_')}_${submissionId ? `제출본_${submissionId}` : '초안'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSize(`${(blob.size / 1024).toFixed(1)}KB`);
    },
  });
  return (
    <div className="pdf-download">
      <button
        type="button"
        className="btn btn-sm"
        disabled={disabled}
        aria-disabled={download.isPending || undefined}
        aria-busy={download.isPending || undefined}
        onClick={() => {
          // 파일 준비 중에도 키보드 초점을 유지하되 중복 생성은 막는다.
          if (!download.isPending) download.mutate();
        }}
      >
        {download.isPending ? 'PDF 준비 중…' : 'PDF 다운로드'}
        {size ? ` (${size})` : ''}
      </button>
      {download.error && <Notice tone="danger">{download.error.message}</Notice>}
      {download.isSuccess && (
        <span className="help" role="status">
          PDF 다운로드 준비 완료 · {size}
        </span>
      )}
    </div>
  );
}
