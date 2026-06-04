import { useState } from 'react';
import { useFamilyStore } from '../store/familyStore';
import './LoginScreen.css';

interface Props {
  token: string;
}

export function ResetPasswordScreen({ token }: Props) {
  const { resetPasswordWithToken } = useFamilyStore();

  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6)    { setError('비밀번호는 6자 이상이어야 합니다.'); return; }
    if (password !== confirm)   { setError('비밀번호가 일치하지 않습니다.'); return; }

    setLoading(true);
    const result = await resetPasswordWithToken(token, password);
    setLoading(false);

    if (result.ok) {
      setDone(true);
    } else {
      setError(result.error ?? '오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  if (done) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1 className="login-title">비밀번호 변경 완료</h1>
          <p className="login-desc">새 비밀번호로 로그인해주세요.</p>
          <button className="login-btn" onClick={() => { window.location.href = '/'; }}>
            로그인하러 가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1 className="login-title">새 비밀번호 설정</h1>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            className="login-input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="새 비밀번호 (6자 이상)"
            autoFocus
            maxLength={50}
          />
          <input
            className="login-input"
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="비밀번호 확인"
            maxLength={50}
          />
          {error && <p className="login-error">{error}</p>}
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </div>
    </div>
  );
}
