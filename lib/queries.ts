'use client';

import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { auditDto, pageDto } from '@/features/request/apiTypes';
import { adaptAudit } from '@/features/request/adapters/backend';
import { requestJson } from './httpClient';
import type { Installation } from './types';

const installationSchema = z.union([
  // Back InstallationController의 공개 계약은 name/code이며 실행 모드 값은 포함하지 않는다.
  z.object({ name: z.string().trim().min(1), code: z.string() }).transform((value) => ({
    institutionName: value.name,
    institutionCode: value.code,
    mode: 'api' as const,
  })),
  z.object({
    institutionName: z.string().trim().min(1),
    institutionCode: z.string(),
    mode: z.literal('mock'),
  }),
]);

/** 기관 정보는 설치값의 읽기 전용 표시이며 기관 선택 기능을 만들지 않는다. */
export function useInstallation() {
  return useQuery({
    queryKey: ['installation'],
    queryFn: async ({ signal }): Promise<Installation> =>
      installationSchema.parse(await requestJson<unknown>('/api/installation', { signal })),
    staleTime: Infinity,
    retry: false,
  });
}

/** 감사 내역은 읽기 전용이며 서버가 현재 계정의 조회 범위를 제한한다. */
export function useAudit(requestId?: string) {
  return useQuery({
    queryKey: ['audit', requestId],
    queryFn: async ({ signal }) => {
      const value = await requestJson<unknown>(
        requestId
          ? `/api/security-requests/${encodeURIComponent(requestId)}/audit-events?size=100`
          : '/api/audit-events?size=100',
        { signal },
      );
      const entries = Array.isArray(value)
        ? z.array(auditDto).parse(value)
        : pageDto(auditDto).parse(value).content;
      return entries.map(adaptAudit);
    },
    retry: false,
  });
}
