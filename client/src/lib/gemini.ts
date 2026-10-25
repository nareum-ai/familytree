const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// 앞에서부터 순서대로 시도. 혼잡(503/429)·응답 지연·모델 종료(404) 시 다음 모델로 넘어감.
// (gemini-3.8-flash는 2026-10 기준 혼잡으로 503 또는 1분 이상 무응답이 잦아 후순위로 둠)
const MODELS: { name: string; timeoutMs: number }[] = [
  { name: 'gemini-3.5-flash',      timeoutMs: 30_000 },
  { name: 'gemini-3.5-flash-lite', timeoutMs: 20_000 },
  { name: 'gemini-3.8-flash',      timeoutMs: 30_000 },
];

class RetryableError extends Error {}

async function callModel(model: string, timeoutMs: number, prompt: string, temperature?: number): Promise<string> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const resp = await fetch(`${BASE}/${model}:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        ...(temperature !== undefined ? { generationConfig: { temperature } } : {}),
      }),
      signal: ctl.signal,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = data?.error?.message ?? `HTTP ${resp.status}`;
      if ([404, 429, 500, 503, 504].includes(resp.status)) throw new RetryableError(msg);
      throw new Error(msg);
    }
    const text = data.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? '').join('').trim();
    if (!text) throw new RetryableError('빈 응답');
    return text;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new RetryableError(`응답 시간 초과(${timeoutMs / 1000}초)`);
    }
    if (e instanceof TypeError) throw new RetryableError(e.message); // 네트워크 오류
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function callGemini(prompt: string, temperature?: number): Promise<string> {
  let lastErr = '';
  for (const { name, timeoutMs } of MODELS) {
    try {
      return await callModel(name, timeoutMs, prompt, temperature);
    } catch (e) {
      if (!(e instanceof RetryableError)) throw e;
      lastErr = e.message;
      console.warn(`[gemini] ${name} 실패 → 다음 모델 시도:`, e.message);
    }
  }
  throw new Error(`AI 서버가 혼잡합니다. 잠시 후 다시 시도해주세요.\n(${lastErr})`);
}
