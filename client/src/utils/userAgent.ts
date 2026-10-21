/** UA → "OS · 브라우저" 요약 */
export function describeUserAgent(ua: string): string {
  if (!ua) return '알 수 없음';
  let os = '';
  if      (/Android/i.test(ua))   os = '안드로이드';
  else if (/iPhone/i.test(ua))    os = '아이폰';
  else if (/iPad/i.test(ua))      os = '아이패드';
  else if (/Windows/i.test(ua))   os = 'Windows';
  else if (/Macintosh/i.test(ua)) os = 'Mac';
  else if (/Linux/i.test(ua))     os = 'Linux';
  let br = '';
  if      (/SamsungBrowser/i.test(ua))                   br = '삼성 브라우저';
  else if (/Whale/i.test(ua))                            br = '네이버 웨일';
  else if (/OPR|Opera/i.test(ua))                        br = 'Opera';
  else if (/Edg/i.test(ua))                              br = 'Edge';
  else if (/Chrome/i.test(ua) && !/Chromium/i.test(ua)) br = 'Chrome';
  else if (/Firefox/i.test(ua))                          br = 'Firefox';
  else if (/Safari/i.test(ua))                           br = 'Safari';
  return [os, br].filter(Boolean).join(' · ') || '알 수 없음';
}

export function isMobileUserAgent(ua: string): boolean {
  return /Android|iPhone|iPad/i.test(ua);
}
