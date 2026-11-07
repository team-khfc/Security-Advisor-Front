'use client';

import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { auditEventSchema } from '@/features/request';
import { requestJson } from './httpClient';
import type { Installation, PageResponse } from './types';

const installationSchema = z.object({
  institutionName: z.string(),
  institutionCode: z.string(),
  mode: z.enum(['mock', 'api']).default('api'),
});

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
export function useAudit() {
  return useQuery({
    queryKey: ['audit'],
    queryFn: async ({ signal }) => {
      const page = await requestJson<PageResponse<unknown>>('/api/audit-events?size=100', {
        signal,
      });
      return z.array(auditEventSchema).parse(page.content);
    },
    retry: false,
  });
}
