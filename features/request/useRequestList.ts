'use client';

import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { useSession } from '@/features/auth/useAuth';
import { requestJson } from '@/lib/httpClient';
import type { Session } from '@/lib/types';
import { loadApiRequestList } from './requestListApi';
import { toMockRequestListItem, type RequestListItem } from './requestListModel';
import { securityRequestSchema } from './types';

const mockPageSchema = z.object({
  content: z.array(securityRequestSchema),
  page: z.number().int().nonnegative(),
  size: z.number().int().positive().max(100),
  totalElements: z.number().int().nonnegative(),
});

async function loadMockRequestList(session: Session, signal: AbortSignal) {
  const items = new Map<string, RequestListItem>();
  for (let pageNumber = 0; ; pageNumber += 1) {
    signal.throwIfAborted();
    const page = mockPageSchema.parse(
      await requestJson<unknown>(`/api/security-requests?page=${pageNumber}&size=100`, { signal }),
    );
    if (
      page.page !== pageNumber ||
      (page.content.length === 0 && pageNumber * page.size < page.totalElements)
    )
      throw new Error('신청 목록의 페이지 정보가 일치하지 않습니다. 다시 조회해 주세요.');
    for (const request of page.content)
      items.set(request.id, toMockRequestListItem(request, session.member));
    if ((pageNumber + 1) * page.size >= page.totalElements) return [...items.values()];
  }
}

/** 세션이 확인된 뒤 실제 역할별 조회와 모의 목록을 구분하고 계정별 캐시를 사용한다. */
export function useRequestList() {
  const session = useSession().data;
  const unavailable = session?.mock === false && session.member.role === 'ADMIN';
  const query = useQuery({
    queryKey: [
      'requests',
      'list',
      session ? (session.mock ? 'mock' : 'api') : 'pending',
      session?.member.username,
      session?.member.role,
    ],
    enabled: Boolean(session) && !unavailable,
    queryFn: ({ signal }) => {
      if (!session) throw new Error('로그인 정보를 확인해 주세요.');
      return session.mock
        ? loadMockRequestList(session, signal)
        : loadApiRequestList(session, signal);
    },
    retry: false,
  });
  return { ...query, unavailable };
}
