import { useState } from 'react';
import './LoginScreen.css';
import './InviteVerifyScreen.css';

interface Props {
  invitePersonName: string;   // 초대 링크에 해당하는 사람 이름 (예: 전현숙)
  memberUsername: string;     // 로그인한 회원 아이디
  onConfirm: (enteredName: string) => void;
  onCancel: () => void;
}

export function InviteVerifyScreen({ invitePersonName, onConfirm, onCancel }: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entered = name.trim();
    if (!entered) return;

    if (entered === invitePersonName) {
      onConfirm(entered);
    } else {
      setError('이름이 일치하지 않습니다. 관리자에게 문의하세요.');
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card verify-card">
        <div className="login-icon">🔑</div>
        <h1 className="login-title">본인 확인</h1>
        <p className="verify-desc">
          초대받은 본인임을 확인하기 위해<br />
          가계도에 등록된 <strong>본인의 이름</strong>을 입력해주세요.
        </p>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            className="login-input"
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
            placeholder="본인 이름 입력"
            autoFocus
            maxLength={20}
          />
          {error && <p className="login-error">{error}</p>}
          <button
            className="login-btn"
            type="submit"
            disabled={!name.trim()}
          >
            확인
          </button>
          <button type="button" className="login-register-btn" onClick={onCancel}>
            취소 (로그아웃)
          </button>
        </form>
        <p className="verify-hint">
          이름이 일치하지 않으면 가계도 소유자에게 문의하세요.
        </p>
      </div>
    </div>
  );
}
