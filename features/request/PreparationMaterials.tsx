'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Notice } from '@/components/ui';
import { requestJson } from '@/lib/httpClient';
import { SourceDocumentButton } from './SourceDocuments';

const itemSchema = z.object({
  key: z.string(),
  label: z.string(),
  reviewer: z.string(),
  condition: z.string(),
  description: z.string(),
  applicability: z.enum(['APPLICABLE', 'UNKNOWN', 'NOT_APPLICABLE']),
  status: z.enum(['MISSING', 'IN_REVIEW', 'NEEDS_SUPPLEMENT', 'CONFIRMED']),
  fileIds: z.array(z.number()),
  note: z.string(),
  actor: z.string().nullable(),
  at: z.string().nullable(),
  stale: z.boolean(),
  canAttach: z.boolean(),
  canReview: z.boolean(),
});
const schema = z.object({
  revision: z.number(),
  fingerprint: z.string(),
  extraConditions: z.record(z.string(), z.boolean()),
  editable: z.boolean(),
  canSetConditions: z.boolean(),
  items: z.array(itemSchema),
});
const filesSchema = z.array(z.object({ uploadedFileId: z.number(), originalName: z.string() }));
type Item = z.infer<typeof itemSchema>;
type Command = {
  action: 'ATTACH' | 'REVIEW' | 'CONDITIONS';
  key?: string;
  fileIds?: number[];
  status?: string;
  note?: string;
  conditions?: Record<string, boolean>;
};
const labels = {
  MISSING: '미첨부',
  IN_REVIEW: '검토 중',
  NEEDS_SUPPLEMENT: '보완 필요',
  CONFIRMED: '확인 완료',
};

/** 사업 조건의 확인 여부와 자료의 검토 상태를 구분하고 서버가 허용한 동작만 제공한다. */
export function PreparationMaterials({ requestId, caseId }: { requestId: string; caseId: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const reveal = () => {
      if (window.location.hash === '#preparation-materials') setOpen(true);
    };
    reveal();
    window.addEventListener('hashchange', reveal);
    return () => window.removeEventListener('hashchange', reveal);
  }, []);
  const [file, setFile] = useState<File>();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();
  const path = `/api/security-requests/${encodeURIComponent(requestId)}/preparation-materials`;
  const data = useQuery({
    queryKey: ['preparation-materials', requestId],
    enabled: open,
    queryFn: async () => schema.parse(await requestJson(path)),
  });
  const files = useQuery({
    queryKey: ['source-files', caseId],
    enabled: open,
    queryFn: async () =>
      filesSchema.parse(
        await requestJson(`/api/business-cases/${encodeURIComponent(caseId)}/uploaded-files`),
      ),
  });
  const change = useMutation({
    mutationFn: async (command: Command) => {
      if (!data.data) throw new Error('목록을 먼저 불러와 주세요.');
      return schema.parse(
        await requestJson(path, {
          method: 'PUT',
          body: {
            ...command,
            expectedRevision: data.data.revision,
            expectedFingerprint: data.data.fingerprint,
          },
        }),
      );
    },
    onSuccess: (result) => {
      queryClient.setQueryData(['preparation-materials', requestId], result);
      setMessage('준비자료 변경을 저장했습니다.');
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
      void queryClient.invalidateQueries({ queryKey: ['preparation-final-review', requestId] });
      void queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });
  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('파일을 선택해 주세요.');
      const form = new FormData();
      form.append('file', file);
      await requestJson(`${path}/files`, { method: 'POST', body: form });
    },
    onSuccess: () => {
      setFile(undefined);
      // 실제 파일 입력도 비워야 같은 경로의 보완본을 다시 선택할 수 있다.
      if (fileInput.current) fileInput.current.value = '';
      setMessage('업로드했습니다. 아래 준비자료에서 파일을 선택해 연결해 주세요.');
      void files.refetch();
    },
  });
  const save = (command: Command) => {
    setMessage('');
    change.mutate(command);
  };
  return (
    <details
      id="preparation-materials"
      className="card"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>사업 조건별 준비자료 · 첨부 및 검토 상태</summary>
      <p className="help">
        저장·확인된 사업 답변에 따라 준비자료를 추천합니다. 조건 미확인은 미해당과 다릅니다. 법적
        필수서류 판정이나 협의·제출 완료를 대신하지 않습니다.
      </p>
      {data.isFetching && <p role="status">준비자료를 불러오는 중…</p>}
      {(data.error || files.error || change.error || upload.error) && (
        <Notice tone="danger">
          {(data.error || files.error || change.error || upload.error)?.message}
        </Notice>
      )}
      <button
        type="button"
        className="btn btn-sm"
        disabled={change.isPending || upload.isPending}
        onClick={() => {
          void data.refetch();
          void files.refetch();
        }}
      >
        최신 목록 확인
      </button>
      {message && <p role="status">{message}</p>}
      {data.data && (
        <>
          {!data.data.editable && (
            <p className="help">
              제출·종료된 신청은 조회만 가능합니다. 이 목록은 현재 준비자료 관리 현황이며 확정
              문서와 별도입니다.
            </p>
          )}
          <p>
            {Object.entries(labels)
              .map(
                ([key, label]) =>
                  `${label} ${data.data!.items.filter((i) => i.applicability !== 'NOT_APPLICABLE' && i.status === key).length}건`,
              )
              .join(' · ')}
          </p>
          {data.data.canSetConditions && (
            <fieldset className="sub-block" disabled={change.isPending}>
              <legend>추가 사업 조건</legend>
              <p className="help">
                개인정보·외부 연계·대외 서비스·외부 업체 조건은 인터뷰 답변에서 확인합니다. 아래
                조건은 준비자료 추천에만 사용합니다.
              </p>
              {(['cloud', 'ai'] as const).map((key) => (
                <label className="field" key={key}>
                  {key === 'cloud' ? '클라우드·SaaS 사용' : 'AI·외부 LLM 사용'}
                  <select
                    className="input"
                    value={String(data.data!.extraConditions[key] ?? '')}
                    onChange={(e) => {
                      const conditions = { ...data.data!.extraConditions };
                      if (e.target.value === '') delete conditions[key];
                      else conditions[key] = e.target.value === 'true';
                      save({ action: 'CONDITIONS', conditions });
                    }}
                  >
                    <option value="">확인 필요</option>
                    <option value="true">예</option>
                    <option value="false">아니요</option>
                  </select>
                </label>
              ))}
            </fieldset>
          )}
          {data.data.items.some((i) => i.canAttach) && (
            <section className="sub-block" aria-label="준비자료 업로드">
              <label className="field">
                새 준비자료 파일
                <input
                  ref={fileInput}
                  type="file"
                  disabled={upload.isPending}
                  onChange={(e) => setFile(e.target.files?.[0])}
                />
              </label>
              <p className="help">
                선택만으로 전송되지 않습니다. 업로드 후 해당 항목에 연결해 주세요. 기존 첨부 파일도
                재사용할 수 있습니다.
              </p>
              <button
                type="button"
                className="btn"
                disabled={!file || upload.isPending}
                onClick={() => upload.mutate()}
              >
                {upload.isPending ? '업로드 중…' : '선택한 자료 업로드'}
              </button>
            </section>
          )}
          {data.data.items.map((item) => (
            <Material
              key={item.key}
              item={item}
              files={files.data ?? []}
              caseId={caseId}
              pending={change.isPending}
              save={save}
            />
          ))}
          <p className="help">
            파일 연결·교체 후에는 검토 중으로 바뀝니다. 사업 조건이 바뀌면 다시 확인해야 합니다.
            담당자·시각과 변경 기록은 신청 이력에서도 확인할 수 있습니다.
          </p>
        </>
      )}
    </details>
  );
}

function Material({
  item,
  files,
  caseId,
  pending,
  save,
}: {
  item: Item;
  files: z.infer<typeof filesSchema>;
  caseId: string;
  pending: boolean;
  save: (command: Command) => void;
}) {
  const [selected, setSelected] = useState<number[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const chosen = selected ?? item.fileIds;
  return (
    <article className="sub-block" aria-label={item.label}>
      <h3>
        {item.label} ·{' '}
        {item.applicability === 'NOT_APPLICABLE' ? '현재 조건 미해당' : labels[item.status]}
      </h3>
      <p>{item.description}</p>
      <p className="help">
        검토: {item.reviewer === 'INFRA' ? 'ICT인프라 담당자' : '정보보안 담당자'}
        {item.applicability === 'UNKNOWN' ? ' · 사업 조건 확인 필요' : ''}
      </p>
      {item.stale && (
        <Notice tone="warning">
          사업 조건이 바뀌었습니다. 이전 확인은 현재 조건에 대한 확인이 아니므로 재검토해 주세요.
        </Notice>
      )}
      {item.note && <p>최근 기록: {item.note}</p>}
      {item.actor && (
        <p className="help">
          {item.actor} · {item.at ? new Date(item.at).toLocaleString('ko-KR') : ''}
          {item.stale ? ' · 이전 기록' : ''}
        </p>
      )}
      <ul>
        {item.fileIds.map((id) => (
          <li key={id}>
            {files.find((f) => f.uploadedFileId === id)?.originalName ?? `자료 #${id}`}{' '}
            <SourceDocumentButton caseId={caseId} fileId={id} />
          </li>
        ))}
      </ul>
      {(item.canAttach || item.canReview) && (
        <fieldset disabled={pending}>
          <legend>{item.label} 관리</legend>
          {item.canAttach && (
            <>
              <p className="help">
                연결할 파일을 선택해 주세요(최대 10개). 선택한 목록으로 교체되며 이전 기록은 이력에
                남습니다.
              </p>
              {files.length === 0 && <p>연결할 파일이 없습니다. 먼저 자료를 업로드해 주세요.</p>}
              {files.map((file) => (
                <label className="field" key={file.uploadedFileId}>
                  <span>
                    <input
                      type="checkbox"
                      checked={chosen.includes(file.uploadedFileId)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...chosen, file.uploadedFileId]
                            : chosen.filter((id) => id !== file.uploadedFileId),
                        )
                      }
                    />{' '}
                    {file.originalName}
                  </span>
                </label>
              ))}
            </>
          )}
          <label className="field">
            {item.label} 설명·보완 사유
            <textarea
              className="input"
              maxLength={2000}
              value={note ?? item.note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          {item.canAttach && (
            <button
              type="button"
              className="btn"
              disabled={chosen.length === 0 || chosen.length > 10}
              onClick={() =>
                save({ action: 'ATTACH', key: item.key, fileIds: chosen, note: note ?? item.note })
              }
            >
              선택 자료 연결·교체
            </button>
          )}
          {item.canReview && item.fileIds.length > 0 && (
            <div className="actions">
              {(['IN_REVIEW', 'NEEDS_SUPPLEMENT', 'CONFIRMED'] as const).map((status) => (
                <button
                  type="button"
                  className="btn"
                  key={status}
                  disabled={status === 'NEEDS_SUPPLEMENT' && !(note ?? item.note).trim()}
                  onClick={() =>
                    save({ action: 'REVIEW', key: item.key, status, note: note ?? item.note })
                  }
                >
                  {labels[status]}로 저장
                </button>
              ))}
            </div>
          )}
        </fieldset>
      )}
    </article>
  );
}
