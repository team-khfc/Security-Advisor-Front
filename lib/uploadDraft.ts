const selectedFiles = new Map<string, File>();

/** 파일 선택은 탭 메모리에만 보관하고 명시적 분석 시에만 전송한다. */
export function rememberUpload(actorId: string, caseId: string, file: File): void {
  selectedFiles.set(`${actorId}:${caseId}`, file);
}

/** 다른 로그인 사용자의 선택 파일은 복원하지 않는다. */
export function getUpload(actorId: string, caseId: string): File | undefined {
  return selectedFiles.get(`${actorId}:${caseId}`);
}

/** 분석을 마친 파일의 메모리 참조를 해제한다. */
export function forgetUpload(actorId: string, caseId: string): void {
  selectedFiles.delete(`${actorId}:${caseId}`);
}
