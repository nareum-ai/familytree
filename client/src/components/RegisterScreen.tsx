import { useState } from 'react';
import { useFamilyStore } from '../store/familyStore';
import './LoginScreen.css';
import './RegisterScreen.css';

interface Props {
  onBack: () => void;
  onSuccess: (username: string) => void;
}

export function RegisterScreen({ onBack, onSuccess }: Props) {
  const { registerMember } = useFamilyStore();
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (username.trim().length < 2) { setError('아이디는 2자 이상이어야 합니다.'); return; }
    if (password.length < 6)        { setError('비밀번호는 6자 이상이어야 합니다.'); return; }
    if (password !== confirm)        { setError('비밀번호가 일치하지 않습니다.'); return; }

    setLoading(true);
    const result = await registerMember(username.trim(), password);
    setLoading(false);
    if (result.ok) {
      onSuccess(username.trim());
    } else {
      setError(result.error ?? '회원가입에 실패했습니다.');
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1 className="login-title">회원가입</h1>
        <p className="login-desc">지금 가입하시면 자신만의 가계도를 시작할 수 있습니다.</p>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            className="login-input"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="아이디 (2자 이상)"
            autoFocus
            maxLength={30}
          />
          <input
            className="login-input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="비밀번호 (6자 이상)"
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
            {loading ? '처리 중...' : '가입하기'}
          </button>
          <button type="button" className="reg-back-btn" onClick={onBack}>
            로그인으로 돌아가기
          </button>
        </form>
      </div>
    </div>
  );
}
