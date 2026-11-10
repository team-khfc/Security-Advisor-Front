'use client';

/** 기간을 달력으로 선택하되 기존 API의 문자열 답변 형식을 유지한다. */
export function DateRangeAnswer({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const parts = value.split('~').map((part) => part.trim());
  const start = /^\d{4}-\d{2}-\d{2}$/.test(parts[0] ?? '') ? parts[0] : '';
  const end = /^\d{4}-\d{2}-\d{2}$/.test(parts[1] ?? '') ? parts[1] : '';
  const ongoing =
    ['종료일 없음', '상시'].includes(parts[1] ?? '') ||
    (parts.length === 2 && Boolean(start) && parts[1] === '');
  // 편집 중 빈 종료일과 저장된 상시 값을 구분하기 위해 입력 중에는 명시적인 표시를 쓴다.
  const update = (nextStart: string, nextEnd: string, permanent: boolean) =>
    onChange(`${nextStart} ~ ${permanent ? '종료일 없음' : nextEnd || '종료일 선택'}`);
  return (
    <fieldset className="date-range-answer" disabled={disabled}>
      <legend className="sr-only">사업·서비스 기간</legend>
      <div className="date-range-fields">
        <label>
          시작일
          <input
            className="input"
            type="date"
            required
            value={start}
            max={end || undefined}
            onChange={(event) => update(event.target.value, end, ongoing)}
          />
        </label>
        <label>
          종료일
          <input
            className="input"
            type="date"
            required={!ongoing}
            disabled={disabled || ongoing}
            value={end}
            min={start || undefined}
            onChange={(event) => update(start, event.target.value, false)}
          />
        </label>
      </div>
      <label className="check-row">
        <input
          type="checkbox"
          checked={ongoing}
          onChange={(event) => update(start, end, event.target.checked)}
        />
        상시 운영 (종료일 없음)
      </label>
      {value && !start && !value.startsWith(' ~ ') && (
        <p className="help">기존 입력: {value}. 시작일과 종료일을 달력에서 선택해 주세요.</p>
      )}
    </fieldset>
  );
}
