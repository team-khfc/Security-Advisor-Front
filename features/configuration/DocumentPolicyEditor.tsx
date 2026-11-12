import { Field } from '@/components/ui';
import type { Settings } from './types';

/** 게시본의 서류 정의를 편집하며 기존 신청의 양식·협의 분야는 보존한다. */
export function DocumentPolicyEditor({
  draft,
  onChange,
  mode,
}: {
  draft: Settings;
  onChange: (draft: Settings) => void;
  mode: 'review' | 'document';
}) {
  const update = (index: number, change: Partial<Settings['docTypes'][number]>) =>
    onChange({
      ...draft,
      docTypes: draft.docTypes.map((doc, i) => (i === index ? { ...doc, ...change } : doc)),
    });
  return (
    <div className="card">
      <h2 className="h-panel">{mode === 'review' ? '서류별 검토 분야' : '기관 문서 출력 설정'}</h2>
      <p className="help">
        저장·비교 후 게시하면 새 사업부터 적용됩니다. 기존 사업과 제출본은 당시 게시본을 유지합니다.
      </p>
      {draft.docTypes.map((doc, index) => (
        <fieldset className="sub-block" key={doc.code}>
          <legend>{doc.name}</legend>
          {mode === 'review' ? (
            <>
              <p>
                두 분야를 선택하면 ICT인프라 협의가 먼저 진행됩니다. 필수 담당자 항목이 있는 분야는
                제외할 수 없습니다.
              </p>
              {(['INFRA', 'SECURITY'] as const).map((role) => (
                <label key={role}>
                  <input
                    type="checkbox"
                    checked={doc.reviewFields.includes(role)}
                    onChange={(e) =>
                      update(index, {
                        reviewFields: e.target.checked
                          ? [...doc.reviewFields, role]
                          : doc.reviewFields.filter((r) => r !== role),
                      })
                    }
                  />
                  {role === 'INFRA' ? 'ICT인프라' : '정보보안'} 협의
                </label>
              ))}
            </>
          ) : (
            <>
              <Field label="서류 표시 이름" htmlFor={`doc-name-${index}`}>
                <input
                  className="input"
                  id={`doc-name-${index}`}
                  maxLength={200}
                  value={doc.name}
                  onChange={(e) => update(index, { name: e.target.value })}
                />
              </Field>
              <Field label="서류 설명" htmlFor={`doc-description-${index}`}>
                <textarea
                  className="input"
                  id={`doc-description-${index}`}
                  maxLength={2000}
                  value={doc.description ?? ''}
                  onChange={(e) => update(index, { description: e.target.value })}
                />
              </Field>
              <label>
                <input
                  type="checkbox"
                  checked={doc.active}
                  onChange={(e) => update(index, { active: e.target.checked })}
                />
                새 사업에서 신청 가능
              </label>
              <Field label="표시 순서" htmlFor={`doc-order-${index}`}>
                <input
                  className="input"
                  id={`doc-order-${index}`}
                  type="number"
                  min={0}
                  max={1000}
                  value={doc.sortOrder}
                  onChange={(e) => update(index, { sortOrder: Number(e.target.value) })}
                />
              </Field>
              <p>
                출력은 기존 서버 양식의 항목·검토 기록을 사용합니다. DOCX는 기관 검토용 표 문서이며
                외부 공식 양식 자동 매핑은 추후 지원합니다.
              </p>
              {(['PDF', 'DOCX', 'MARKDOWN'] as const).map((format) => (
                <label key={format}>
                  <input
                    type="checkbox"
                    checked={doc.exportFormats.includes(format)}
                    onChange={(e) =>
                      update(index, {
                        exportFormats: e.target.checked
                          ? [...doc.exportFormats, format]
                          : doc.exportFormats.filter((f) => f !== format),
                      })
                    }
                  />
                  {format === 'MARKDOWN' ? '마크다운' : format}
                </label>
              ))}
            </>
          )}
        </fieldset>
      ))}
    </div>
  );
}
