import { z } from 'zod';
import type { SecurityRequest } from '@/features/request';
import type { Actor } from '@/lib/types';
import { DomainError } from '@/lib/problem';
import { preparationCatalog } from './preparationCatalog';

const inputSchema = z.object({
  expectedRevision: z.number(),
  expectedFingerprint: z.string(),
  action: z.enum(['CONDITIONS', 'ATTACH', 'REVIEW']),
  key: z.string().optional(),
  status: z.enum(['IN_REVIEW', 'NEEDS_SUPPLEMENT', 'CONFIRMED']).optional(),
  fileIds: z.array(z.number().positive()).max(10).optional(),
  note: z.string().max(2000).optional(),
  conditions: z.record(z.string(), z.boolean()).optional(),
});
type Entry = {
  fileIds: number[];
  status: string;
  note: string;
  actor: string;
  at: string;
  fingerprint: string;
};
/** 모의 화면도 조회 권한 확인 뒤 같은 상태 전이와 충돌 규칙을 적용한다. */
export class MockPreparation {
  private values = new Map<
    string,
    {
      revision: number;
      conditionsRevision: number;
      conditions: Record<string, boolean>;
      entries: Record<string, Entry>;
    }
  >();
  get(request: SecurityRequest, actor: Actor) {
    const stored = this.values.get(request.id) ?? {
      revision: 0,
      conditionsRevision: 0,
      conditions: {},
      entries: {},
    };
    const answers = [...request.commonAnswers, ...request.answers].filter((a) =>
      preparationCatalog.some((c) => c.condition === a.key),
    );
    const fingerprint = JSON.stringify([answers, stored.conditions, stored.conditionsRevision]);
    const editable =
      request.stage < 4 && !['CLOSED', 'WITHDRAWN', 'CONFIRMED'].includes(request.status);
    return {
      revision: stored.revision,
      fingerprint,
      extraConditions: stored.conditions,
      editable,
      canSetConditions: editable && actor.role === 'APPLICANT',
      items: preparationCatalog.map((c) => {
        const answer = answers.find((a) => a.key === c.condition);
        const enabled = !c.condition
          ? true
          : ['cloud', 'ai'].includes(c.condition)
            ? stored.conditions[c.condition]
            : answer?.confirmed && !answer.needsReview
              ? answer.value === 'true'
                ? true
                : answer.value === 'false'
                  ? false
                  : undefined
              : undefined;
        const entry = stored.entries[c.key];
        const stale = !!entry && entry.fingerprint !== fingerprint;
        return {
          ...c,
          applicability:
            enabled === undefined ? 'UNKNOWN' : enabled ? 'APPLICABLE' : 'NOT_APPLICABLE',
          fileIds: entry?.fileIds ?? [],
          status: !entry ? 'MISSING' : stale ? 'IN_REVIEW' : entry.status,
          note: entry?.note ?? '',
          actor: entry?.actor ?? null,
          at: entry?.at ?? null,
          stale,
          canAttach:
            editable &&
            (actor.role === 'APPLICANT' || actor.role === c.reviewer) &&
            enabled !== false,
          canReview:
            editable && request.stage >= 2 && actor.role === c.reviewer && enabled === true,
        };
      }),
    };
  }
  finalReview(request: SecurityRequest, actor: Actor, name: (id: number) => string, at: string) {
    const current = this.get(request, actor);
    return {
      format: 1,
      revision: current.revision,
      fingerprint: current.fingerprint,
      capturedAt: at,
      extraConditions: current.extraConditions,
      items: current.items.map((i) => ({
        ...i,
        reviewedAt: i.at,
        files: i.fileIds.map((fileId) => ({ fileId, name: name(fileId), uploadedAt: at })),
      })),
    };
  }
  update(
    request: SecurityRequest,
    actor: Actor,
    raw: unknown,
    validFile: (id: number) => boolean,
    at: string,
  ) {
    const input = inputSchema.parse(raw),
      current = this.get(request, actor);
    const fail = (status: number, message: string): never => {
      throw new DomainError(status, 'PREPARATION_ERROR', message);
    };
    if (
      input.expectedRevision !== current.revision ||
      input.expectedFingerprint !== current.fingerprint
    )
      fail(409, '최신 목록을 확인해 주세요.');
    if (!current.editable) fail(422, '제출·종료된 신청은 변경할 수 없습니다.');
    const stored = this.values.get(request.id) ?? {
      revision: 0,
      conditionsRevision: 0,
      conditions: {},
      entries: {},
    };
    if (input.action === 'CONDITIONS') {
      if (!current.canSetConditions) fail(403, '신청자만 조건을 변경할 수 있습니다.');
      if (
        !input.conditions ||
        Object.keys(input.conditions).some((k) => !['cloud', 'ai'].includes(k))
      )
        fail(422, '허용되지 않는 조건입니다.');
      stored.conditions = input.conditions!;
      stored.conditionsRevision++;
    } else {
      const item = current.items.find((i) => i.key === input.key);
      if (!item) return fail(404, '준비자료가 없습니다.');
      if (input.action === 'ATTACH' ? !item.canAttach : !item.canReview)
        fail(403, '자료 변경 권한이 없습니다.');
      const ids = input.action === 'ATTACH' ? (input.fileIds ?? []) : item.fileIds;
      if (!ids.length) fail(422, '자료를 먼저 연결해 주세요.');
      if (ids.some((id) => !validFile(id))) fail(404, '파일을 찾을 수 없습니다.');
      const status = input.action === 'ATTACH' ? 'IN_REVIEW' : input.status;
      if (!status || (status === 'NEEDS_SUPPLEMENT' && !input.note?.trim()))
        fail(422, '상태와 보완 사유를 확인해 주세요.');
      stored.entries[item.key] = {
        fileIds: ids,
        status: status!,
        note: input.note ?? '',
        actor: actor.displayName,
        at,
        fingerprint: current.fingerprint,
      };
    }
    stored.revision++;
    this.values.set(request.id, stored);
    return this.get(request, actor);
  }
}
