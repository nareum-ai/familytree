import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { setAdminPWAMode } from './lib/storageKeys.ts'
import { initInstallPromptListener } from './lib/installPrompt.ts'

initInstallPromptListener();

// URL 파라미터 → sessionStorage 플래그 (React 렌더링 전, URL 정리 전에 실행)
if (new URLSearchParams(window.location.search).get('admin_pwa') === '1') {
  sessionStorage.setItem('_admin_pwa', '1');
}

// React 렌더링 전에 스토리지 모드 확정 — 이후 모든 LS.* 접근에 적용됨
if (sessionStorage.getItem('_admin_pwa') === '1') {
  setAdminPWAMode(true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
