// 백엔드 에러 응답 형식: { success: false, code: number, data: string | string[] }
const getErrorMessage = (error: any): string => {
  const data = error?.response?.data;
  if (!data) {
    return error?.message || '알 수 없는 오류가 발생했습니다.';
  }
  if (typeof data === 'string') {
    return data;
  }
  if (Array.isArray(data.data)) {
    return data.data.join('\n');
  }
  return String(data.data ?? data.message ?? '알 수 없는 오류가 발생했습니다.');
};

export default getErrorMessage;
