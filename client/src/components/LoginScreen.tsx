import { useState } from 'react';
import './LoginScreen.css';

interface Props {
  onLogin: (username: string, password: string) => void;
  onRegister: () => void;
  error?: string;
  loading?: boolean;
}

export function LoginScreen({ onLogin, onRegister, error, loading }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.trim();
    if (!u || !password) return;
    onLogin(u, password);
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-icon">🌳</div>
        <h1 className="login-title">우리 가족 가계도</h1>
        <p className="login-desc">아이디와 비밀번호로 로그인하세요</p>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            className="login-input"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="아이디"
            autoFocus
            maxLength={30}
          />
          <input
            className="login-input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="비밀번호"
            maxLength={50}
          />
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
        </form>
      </div>
    </div>
  );
}
