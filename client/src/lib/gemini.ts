const GEMINI_KEY = 'REMOVED_SECRET';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

export async function callGemini(prompt: string, temperature?: number): Promise<string> {
  const resp = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      ...(temperature !== undefined ? { generationConfig: { temperature } } : {}),
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data?.error?.message ?? `HTTP ${resp.status}`);
  }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '결과를 받지 못했습니다.';
}
