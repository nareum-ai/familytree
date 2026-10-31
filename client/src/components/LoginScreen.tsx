import { useState } from 'react';
import InAppBrowserBanner from './InAppBrowserBanner';
import { isInAppBrowser } from '../lib/device';
import { GoogleIcon } from './GoogleIcon';
import './LoginScreen.css';

const SAVED_ID_KEY = 'familyTreeSavedUsername';

interface Props {
  onLogin: (username: string, password: string) => void;
  onGoogleLogin: () => void;
  onRegister: () => void;
  onForgotPassword: () => void;
  error?: string;
  success?: string;
  loading?: boolean;
}

export function LoginScreen({ onLogin, onGoogleLogin, onRegister, onForgotPassword, error, success, loading }: Props) {
  const savedId = localStorage.getItem(SAVED_ID_KEY) ?? '';
  const [username, setUsername] = useState(savedId);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(!!savedId);
  const inApp = isInAppBrowser();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.trim();
    if (!u || !password) return;
    if (rememberMe) {
      localStorage.setItem(SAVED_ID_KEY, u);
    } else {
      localStorage.removeItem(SAVED_ID_KEY);
    }
    onLogin(u, password);
  };

  return (
    <div className="login-screen">
      <div className="login-card">

        <h1 className="login-title">우리 가족 가계도</h1>

        {inApp && <InAppBrowserBanner />}

        {success && <div className="login-success">{success}</div>}

        {!inApp && (
          <>
            <button className="google-login-btn" onClick={onGoogleLogin} disabled={loading}>
              <GoogleIcon size={20} />
              Google로 로그인
            </button>
            <div className="login-divider"><span>또는</span></div>
          </>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <input
            className="login-input"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="아이디"
            autoComplete="username"
            maxLength={30}
          />
          <input
            className="login-input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="비밀번호"
            autoComplete="current-password"
            maxLength={50}
          />

          <label className="remember-me">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
            />
            <span>아이디 기억하기</span>
          </label>

          {error && <p className="login-error">{error}</p>}

          <button
            className="login-btn"
            type="submit"
            disabled={!username.trim() || !password || loading}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
          <button type="button" className="login-register-btn" onClick={onRegister}>
            처음이신가요? 회원가입
          </button>
          <button type="button" className="login-forgot-btn" onClick={onForgotPassword}>
            비밀번호를 잊으셨나요?
          </button>
        </form>
      </div>
    </div>
  );
}
