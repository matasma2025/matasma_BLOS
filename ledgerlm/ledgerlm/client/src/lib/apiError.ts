export async function responseError(response: Response) {
  const text = (await response.text()) || response.statusText;
  let payload: { code?: string; error?: string; retryAfter?: number } = {};
  try { payload = JSON.parse(text); } catch { /* Non-JSON errors retain their original text. */ }
  const throttled = response.status === 429 || response.status === 503;
  const error = new Error(throttled && typeof payload?.error === "string"
    ? payload.error : `${response.status}: ${text}`) as Error & {
      status: number; code?: string; retryAfter?: number;
    };
  error.status = response.status;
  error.code = payload?.code;
  error.retryAfter = payload?.retryAfter ?? Number(response.headers.get("Retry-After") || 0);
  return error;
}
