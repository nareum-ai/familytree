import { useState } from 'react';
import './LoginScreen.css';
import './InviteVerifyScreen.css';

interface Props {
  invitePersonName: string;   // 초대 링크에 해당하는 사람 이름 (예: 전현숙)
  memberUsername: string;     // 로그인한 회원 아이디
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

/** 초대받은 본인 확인 — 링크가 인물별로 발급되므로 이름 확인 버튼만으로 충분 */
export function InviteVerifyScreen({ invitePersonName, onConfirm, onCancel }: Props) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card verify-card">
        <div className="login-icon">🙋</div>
        <h1 className="login-title">본인 확인</h1>
        <p className="verify-desc">
          가계도에 아래 이름으로 등록되어 있어요.<br />
          본인이 맞으신가요?
        </p>
        <p className="verify-name">{invitePersonName}</p>
        <div className="login-form">
          <button className="login-btn" type="button" onClick={handleConfirm} disabled={loading}>
            {loading ? '연결 중...' : '네, 제가 맞아요'}
          </button>
          <button type="button" className="login-register-btn" onClick={onCancel} disabled={loading}>
            아니에요 (로그아웃)
          </button>
        </div>
        <p className="verify-hint">
          본인이 아니라면 링크를 보내준 가족에게 알려주세요.
        </p>
      </div>
    </div>
  );
}
