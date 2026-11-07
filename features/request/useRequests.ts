'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { ApiError, requestJson } from '@/lib/httpClient';
import type { PageResponse } from '@/lib/types';
import {
  businessCaseSchema,
  securityRequestSchema,
  type AnswerInput,
  type AnalysisInput,
  type BusinessCase,
  type CaseAnalysis,
  type CommandInput,
  type CreateCaseInput,
  type SecurityRequest,
} from './types';

/** 모의와 실제 API 모두 같은 목록 DTO 경계에서 검증한다. */
export function useRequests() {
  return useQuery({
    queryKey: ['requests'],
    queryFn: async ({ signal }) => {
      const page = await requestJson<PageResponse<unknown>>('/api/security-requests?size=100', {
        signal,
      });
      return z.array(securityRequestSchema).parse(page.content);
    },
  });
}

/** 공통 정보는 사업 건 단위로 한 번만 읽는다. */
export function useCases() {
  return useQuery({
    queryKey: ['cases'],
    queryFn: async ({ signal }) => {
      const page = await requestJson<PageResponse<unknown>>('/api/business-cases?size=100', {
        signal,
      });
      return z.array(businessCaseSchema).parse(page.content);
    },
  });
}

/** 신청은 형제 서류와 별도 캐시 키 및 revision을 가진다. */
export function useRequest(id: string) {
  return useQuery({
    queryKey: ['requests', id],
    queryFn: async ({ signal }) =>
      securityRequestSchema.parse(
        await requestJson<unknown>(`/api/security-requests/${encodeURIComponent(id)}`, { signal }),
      ),
  });
}

/** 사업 건을 다시 불러와도 편집 컴포넌트의 미저장 값은 별도로 유지한다. */
export function useCase(id: string, enabled = true) {
  return useQuery({
    queryKey: ['cases', id],
    enabled,
    queryFn: async ({ signal }) =>
      businessCaseSchema.parse(
        await requestJson<unknown>(`/api/business-cases/${encodeURIComponent(id)}`, { signal }),
      ),
  });
}

/** 생성 응답의 식별자로 새 사업 건의 공통 인터뷰를 연다. */
export function useCreateCase() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCaseInput) =>
      requestJson<BusinessCase>('/api/business-cases', { method: 'POST', body }),
    onSuccess: () => client.invalidateQueries(),
  });
}

/** 공통 답변 변경은 서버가 미제출 신청에만 전파한다. */
export function useSaveCase(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { expectedRevision: number; answers: AnswerInput[] }) =>
      requestJson<BusinessCase>(`/api/business-cases/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body,
      }),
    onSuccess: () => client.invalidateQueries(),
    onError: (error) =>
      error instanceof ApiError && error.status === 409 ? client.invalidateQueries() : undefined,
  });
}

function commandResource(request: SecurityRequest, command: CommandInput): [string, string] {
  const base = `/api/security-requests/${encodeURIComponent(request.id)}`;
  const review = request.reviews.find((item) => item.field === command.field);
  switch (command.action) {
    case 'REQUEST_REVIEW':
      return [`${base}/reviews`, 'POST'];
    case 'SAVE_ANSWERS':
      return [`${base}/answers`, 'PATCH'];
    case 'COMPLETE_ALLOCATION':
    case 'COMPLETE_REVIEW':
      if (!review) throw new Error('담당 분야의 협의 정보를 다시 불러와 주세요.');
      return [
        `/api/reviews/${encodeURIComponent(review.id)}/${command.action === 'COMPLETE_ALLOCATION' ? 'allocation-completion' : 'completion'}`,
        'PUT',
      ];
    case 'REQUEST_SUPPLEMENT':
      return [`${base}/supplements`, 'POST'];
    case 'ANSWER_SUPPLEMENT':
      return [`/api/supplements/${encodeURIComponent(command.supplementId ?? '')}/answers`, 'POST'];
    case 'RESOLVE_SUPPLEMENT':
      return [
        `/api/supplements/${encodeURIComponent(command.supplementId ?? '')}/resolution`,
        'PUT',
      ];
    case 'RETURN':
      return [`${base}/stage-returns`, 'POST'];
    case 'SUBMIT':
      return [`${base}/submissions`, 'POST'];
    case 'FINAL_CONFIRM':
      return [
        `/api/submissions/${encodeURIComponent(request.currentSubmissionId ?? '')}/final-confirmations`,
        'POST',
      ];
    case 'FINALIZE':
      return [
        `/api/submissions/${encodeURIComponent(request.currentSubmissionId ?? '')}/confirmation`,
        'PUT',
      ];
    case 'CLOSE':
      return [`${base}/closure`, 'PUT'];
    case 'WITHDRAW':
      return [`${base}/withdrawal`, 'PUT'];
    case 'REASSIGN':
      return [`${base}/assignments`, 'POST'];
    case 'GENERATE_DRAFT':
      return [`${base}/draft-generations`, 'POST'];
  }
}

/** 상태 값을 직접 PATCH하지 않고 업무 기록 자원으로 전이를 요청한다. */
export function useRequestCommand(request: SecurityRequest) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (command: CommandInput) => {
      const [path, method] = commandResource(request, command);
      const { action: _action, idempotencyKey, ...body } = command;
      void _action;
      return requestJson<SecurityRequest>(path, {
        method,
        body,
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      });
    },
    onSuccess: () => client.invalidateQueries(),
    onError: (error) =>
      error instanceof ApiError && error.status === 409 ? client.invalidateQueries() : undefined,
  });
}

/** 파일은 명시적 분석 버튼의 mutation이 실행될 때만 전송한다. */
export function useAnalysis() {
  return useMutation({
    mutationFn: (input: AnalysisInput) => {
      const form = new FormData();
      form.set('text', input.text);
      form.set('expectedRevision', String(input.expectedRevision));
      if (input.file) form.set('file', input.file);
      return requestJson<CaseAnalysis>(
        `/api/business-cases/${encodeURIComponent(input.caseId)}/analysis-jobs`,
        { method: 'POST', body: form },
      );
    },
  });
}

/** 서버에 보관된 분석 후보만 적용하며 오래된 입력을 덮어쓰지 않는다. */
export function useApplyAnalysis() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, expectedRevision }: { id: string; expectedRevision: number }) =>
      requestJson<BusinessCase>(`/api/analysis-jobs/${encodeURIComponent(id)}/applications`, {
        method: 'POST',
        body: { expectedRevision },
      }),
    onSuccess: () => client.invalidateQueries(),
  });
}
