'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { Modal, Notice } from '@/components/ui';
import { requestJson } from '@/lib/httpClient';

const fileSchema = z.object({ uploadedFileId: z.number(), originalName: z.string() });
const sourceSchema = fileSchema.extend({
  text: z.string(),
  uploadedAt: z.string(),
  maximumCharacters: z.number(),
  possiblyTruncated: z.boolean(),
});

/** 원문은 열 때 조회하며 AI 요약을 원문이나 확정 근거로 바꾸지 않는다. */
export function SourceDocumentButton({ caseId, fileId }: { caseId: string; fileId: number }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const source = useQuery({
    queryKey: ['source-document', caseId, fileId],
    enabled: open,
    queryFn: async ({ signal }) =>
      sourceSchema.parse(
        await requestJson(
          `/api/business-cases/${encodeURIComponent(caseId)}/source-documents/${fileId}`,
          { signal },
        ),
      ),
    staleTime: 0,
    gcTime: 0,
  });
  return (
    <>
      <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>
        원문 근거 확인
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={source.data?.originalName ?? '첨부 원문 확인'}
      >
        <p className="help">
          AI 분석 요약과 구분되는 첨부 원문의 추출문입니다. 줄 번호는 추출문 기준이며 원본 페이지
          번호가 아닙니다. 원문 확인만으로 답변이 확정되지 않습니다.
        </p>
        {source.isFetching && <p role="status">원문을 읽고 있습니다…</p>}
        {source.error && <Notice tone="danger">{source.error.message}</Notice>}
        <a
          className="btn"
          href={`/api/business-cases/${encodeURIComponent(caseId)}/uploaded-files/${fileId}`}
          download
        >
          원본 파일 내려받기
        </a>
        {source.data && (
          <>
            {source.data.text.includes('[OCR 인식문') && (
              <Notice tone="warning">
                스캔 문서의 OCR 인식문입니다. 글자·숫자 오인식이 있을 수 있으므로 원본과 대조해
                주세요. 인식 결과는 확인된 사실이 아닙니다.
              </Notice>
            )}
            <p className="help">
              첨부 시각: {new Date(source.data.uploadedAt).toLocaleString('ko-KR')}
            </p>
            {source.data.possiblyTruncated && (
              <Notice tone="warning">
                앞 {source.data.maximumCharacters.toLocaleString()}자까지 표시합니다. 전체 내용은
                원본 파일에서 확인해 주세요.
              </Notice>
            )}
            {!source.data.text.trim() ? (
              <Notice tone="warning">
                추출할 수 있는 텍스트가 없습니다. 원본 파일을 확인해 주세요.
              </Notice>
            ) : (
              <>
                <label className="field">
                  원문에서 찾기
                  <input
                    className="input"
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <div className="source-document-text" tabIndex={0} aria-label="첨부 원문 추출문">
                  {source.data.text.split('\n').map((line, i) => (
                    <p key={i}>
                      <span className="help">{i + 1}. </span>
                      {search && line.toLocaleLowerCase().includes(search.toLocaleLowerCase()) ? (
                        <mark>{line}</mark>
                      ) : (
                        line || '\u00a0'
                      )}
                    </p>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </Modal>
    </>
  );
}

/** 저장된 파일 ID가 있는 근거만 직접 연결한다. 이전의 순번 근거는 추측해 연결하지 않는다. */
export function EvidenceSourceLink({ caseId, reference }: { caseId: string; reference: string }) {
  const ids = [
    ...new Set([...reference.matchAll(/파일\s+#(\d+)/g)].map((match) => Number(match[1]))),
  ];
  return (
    <>
      {ids.map((fileId) => (
        <SourceDocumentButton key={fileId} caseId={caseId} fileId={fileId} />
      ))}
    </>
  );
}

/** 기존 근거의 문서 연결 기록이 없더라도 첨부 목록을 명시적으로 탐색할 수 있다. */
export function SourceDocuments({ caseId }: { caseId: string }) {
  const [expanded, setExpanded] = useState(false);
  const files = useQuery({
    queryKey: ['source-files', caseId],
    enabled: expanded,
    queryFn: async ({ signal }) =>
      z.array(fileSchema).parse(
        await requestJson(`/api/business-cases/${encodeURIComponent(caseId)}/uploaded-files`, {
          signal,
        }),
      ),
  });
  return (
    <details className="card" onToggle={(e) => setExpanded(e.currentTarget.open)}>
      <summary>첨부 원문·근거 자료 확인</summary>
      <p className="help">
        연결 기록이 없는 이전 근거는 특정 파일의 내용이라고 추정하지 않습니다. 아래 자료를 직접
        대조해 주세요.
      </p>
      {files.isFetching && <p role="status">첨부 목록을 읽고 있습니다…</p>}
      {files.error && <Notice tone="danger">{files.error.message}</Notice>}
      {files.data?.length === 0 && <p>첨부된 원문이 없습니다.</p>}
      <ul>
        {files.data?.map((file) => (
          <li key={file.uploadedFileId}>
            {file.originalName}{' '}
            <SourceDocumentButton caseId={caseId} fileId={file.uploadedFileId} />
          </li>
        ))}
      </ul>
    </details>
  );
}
