import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { setAdminPWAMode, SS } from './lib/storageKeys.ts'
import { initInstallPromptListener } from './lib/installPrompt.ts'
import { syncAuthSession } from './lib/authSession.ts'

initInstallPromptListener();

// URL 파라미터 → sessionStorage 플래그 (React 렌더링 전, URL 정리 전에 실행)
if (new URLSearchParams(window.location.search).get('admin_pwa') === '1') {
  sessionStorage.setItem(SS.ADMIN_PWA, '1');
}

// React 렌더링 전에 스토리지 모드 확정 — 이후 모든 LS.* 접근에 적용됨
if (sessionStorage.getItem(SS.ADMIN_PWA) === '1') {
  setAdminPWAMode(true);
}

// 로그인 세션 확인이 끝난 뒤 렌더 — 첫 Firestore 요청부터 보안 규칙을 통과하도록
syncAuthSession().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
