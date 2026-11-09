'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, Notice, PageHeading } from '@/components/ui';
import { useSession } from '@/features/auth';
import { useInputDraft } from '@/lib/inputDrafts';
import type { Actor } from '@/lib/types';
import { rememberUpload } from '@/lib/uploadDraft';
import { DOCUMENT_LABELS, type DocumentType } from './types';
import { useCreateCase } from './useRequests';

/** 파일 선택과 사업 건 생성은 분석·전송과 분리한다. */
export function NewRequest() {
  const session = useSession();
  if (session.data?.member.role !== 'APPLICANT')
    return (
      <>
        <PageHeading title="새 신청" />
        <Notice tone="warning">일반 사용자로 로그인하면 새 사업을 신청할 수 있습니다.</Notice>
      </>
    );
  return (
    <NewRequestForm
      key={session.data.member.id}
      actor={session.data.member}
      mock={session.data.mock}
    />
  );
}

interface NewCaseDraft {
  file?: File;
  title: string;
  department: string;
  description: string;
  docTypes: DocumentType[];
}

function NewRequestForm({ actor, mock }: { actor: Actor; mock: boolean }) {
  const router = useRouter();
  const create = useCreateCase();
  const inputRef = useRef<HTMLInputElement>(null);
  const { draft, saveDraft, clearDraft } = useInputDraft<NewCaseDraft>(actor.id, 'new-case');
  const values: NewCaseDraft = draft ?? {
    title: '',
    department: mock ? actor.department : '',
    description: '',
    docTypes: ['FIREWALL', 'SECURITY_REVIEW'],
  };
  const { file, title, department, description, docTypes } = values;
  const update = (change: Partial<NewCaseDraft>) => saveDraft({ ...values, ...change });
  const [error, setError] = useState('');
  const [fileError, setFileError] = useState('');
  const [dragging, setDragging] = useState(false);
  const pickButton = useRef<HTMLButtonElement>(null);
  const selectFile = (next?: File) => {
    setFileError('');
    if (!next) return;
    if (!/\.(pdf|hwpx|docx|txt)$/i.test(next.name) || next.size > 10 * 1024 * 1024) {
      setFileError('PDF, HWPX, DOCX, TXT 파일을 10MB 이하로 선택해 주세요.');
      return;
    }
    update({ file: next });
  };

  return (
    <>
      <PageHeading title="새 신청" />
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setError('');
          if (!docTypes.length) {
            setError('신청할 서류를 한 가지 이상 선택해 주세요.');
            return;
          }
          if (!department.trim()) {
            setError('담당 부서를 입력해 주세요.');
            return;
          }
          try {
            const result = await create.mutateAsync({
              title,
              department: department.trim(),
              description,
              docTypes,
            });
            if (file) rememberUpload(actor.id, result.id, file);
            clearDraft();
            router.push(`/cases/${encodeURIComponent(result.id)}`);
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : '사업 건을 만들지 못했습니다. 다시 시도해 주세요.',
            );
          }
        }}
      >
        <section className="card new-case-basics" aria-labelledby="case-title">
          <h2 className="h-panel" id="case-title">
            어떤 사업의 서류를 작성하시나요?
          </h2>
          <div className="form-two">
            <div className="field">
              <label htmlFor="business-title">
                사업명 <span className="required">(필수)</span>
              </label>
              <input
                className="input"
                id="business-title"
                value={title}
                onChange={(e) => update({ title: e.target.value })}
                disabled={create.isPending}
                required
                maxLength={120}
                placeholder="예: 공공자료 안내 서비스 구축"
              />
            </div>
            <div className="field">
              <label htmlFor="business-department">
                담당 부서 <span className="required">(필수)</span>
              </label>
              <input
                className="input"
                id="business-department"
                value={department}
                onChange={(e) => update({ department: e.target.value })}
                required
                disabled={create.isPending}
                maxLength={80}
                placeholder="담당 부서명"
              />
            </div>
          </div>
          <fieldset className="document-choice">
            <legend>
              신청할 서류 <span className="required">(복수 선택 가능)</span>
            </legend>
            {(['FIREWALL', 'SECURITY_REVIEW'] as const).map((type) => (
              <label
                className={`document-option ${docTypes.includes(type) ? 'selected' : ''}`}
                key={type}
              >
                <input
                  type="checkbox"
                  checked={docTypes.includes(type)}
                  disabled={create.isPending}
                  onChange={(e) =>
                    update({
                      docTypes: e.target.checked
                        ? [...docTypes, type]
                        : docTypes.filter((item) => item !== type),
                    })
                  }
                />
                <Icon name={type === 'FIREWALL' ? 'shield' : 'file'} />
                <span>
                  <strong>{DOCUMENT_LABELS[type]}</strong>
                  <small>
                    {type === 'FIREWALL'
                      ? '시스템 간 통신 허용을 요청해요'
                      : '사업의 정보보안 사항을 검토해요'}
                  </small>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="help">
            공통 정보는 한 번만 작성합니다. 이후 협의·제출·확정은 서류마다 독립적으로 진행됩니다.
          </p>
        </section>
        {error && <Notice tone="danger">{error}</Notice>}
        {draft && (
          <p className="help" role="status">
            저장하지 않은 입력은 이 탭에서 같은 계정으로 돌아오면 복원됩니다. 새로고침하거나 탭을
            닫으면 사라집니다.
          </p>
        )}
        <section className="intake new-case-intake" aria-labelledby="intake-heading">
          <div
            className={`dropzone${dragging ? ' drag' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              if (!create.isPending) setDragging(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!create.isPending) selectFile(e.dataTransfer.files[0]);
            }}
          >
            <span className="dz-ic">
              <Icon name="upload" size={32} />
            </span>
            <h2 className="h-panel" id="intake-heading">
              기획서를 끌어다 놓으세요
            </h2>
            <p className="help">
              기획서·사업계획서·기능명세서가 있으면 필요한 정보를 함께 정리할 수 있어요.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.hwpx,.docx,.txt"
              className="sr-only"
              tabIndex={-1}
              aria-label="기획서 파일"
              onChange={(e) => selectFile(e.target.files?.[0])}
            />
            <button
              ref={pickButton}
              type="button"
              className="btn"
              aria-describedby="file-help"
              disabled={create.isPending}
              onClick={() => inputRef.current?.click()}
            >
              파일 선택
            </button>
            <p className="help" id="file-help">
              PDF, HWPX, DOCX, TXT 파일, 파일 1개, 최대 10MB
            </p>
            {fileError && (
              <p className="ferr" role="alert">
                {fileError}
              </p>
            )}
            {file && (
              <ul className="pend" aria-label="분석 전 파일">
                <li>
                  <Icon name="file" size={18} />
                  <span className="pn" title={file.name}>
                    {file.name}
                  </span>
                  <span className="help">
                    {(file.name.split('.').pop() ?? '').toUpperCase()},{' '}
                    {file.size >= 1024 * 1024
                      ? `${(file.size / 1024 / 1024).toFixed(1)}MB`
                      : `${(file.size / 1024).toFixed(1)}KB`}
                  </span>
                  <span className="badge b-neutral">분석 전</span>
                  <button
                    type="button"
                    className="iedit-btn"
                    aria-label={`${file.name} 선택 취소`}
                    title="선택 취소"
                    disabled={create.isPending}
                    onClick={() => {
                      update({ file: undefined });
                      if (inputRef.current) inputRef.current.value = '';
                      pickButton.current?.focus();
                    }}
                  >
                    <Icon name="x" size={18} />
                  </button>
                </li>
              </ul>
            )}
            <p className="help">
              선택한 파일은 아직 전송되지 않았습니다. 다음 화면에서 ‘분석 요청’을 누르면 전송합니다.
            </p>
          </div>
        </section>
        <details className="sub-block">
          <summary>기획서 없이 사업 개요 직접 입력</summary>
          <div className="field">
            <label htmlFor="business-description">사업 개요</label>
            <textarea
              className="input"
              id="business-description"
              value={description}
              onChange={(e) => update({ description: e.target.value })}
              disabled={create.isPending}
              maxLength={4000}
              rows={4}
              placeholder="어떤 업무를 위해 어떤 서비스를 만드는지 알려주세요."
            />
          </div>
        </details>
        <div className="intake-actions new-case-actions">
          <p className="help">AI는 초안을 제안하며 최종 판단은 사람이 합니다.</p>
          <button className="btn btn-primary" disabled={create.isPending}>
            {create.isPending
              ? '사업 건 생성 중…'
              : file
                ? '기획서와 함께 작성 시작'
                : '기획서 없이 대화로 시작'}
            <Icon name="arrowRight" />
          </button>
        </div>
      </form>
    </>
  );
}
