import { useState } from 'react';
import { requestPasswordReset, requestAdminPasswordReset } from '../services/authService';
import { DateInput } from './DateInput';
import { todayStr } from '../utils/date';
import './LoginScreen.css';

interface Props {
  onBack: () => void;
}

type Step = 'form' | 'sent' | 'fallback' | 'fallback_sent';

export function ForgotPasswordScreen({ onBack }: Props) {

  const [step,          setStep]          = useState<Step>('form');
  const [username,      setUsername]      = useState('');
  const [personName,    setPersonName]    = useState('');
  const [birthDate,     setBirthDate]     = useState('');
  const [email,         setEmail]         = useState('');
  const [contactEmail,  setContactEmail]  = useState('');
  const [message,       setMessage]       = useState('');
  const [error,         setError]         = useState('');
  const [loading,       setLoading]       = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim())   { setError('아이디를 입력해주세요.'); return; }
    if (!personName.trim()) { setError('이름을 입력해주세요.'); return; }
    // 생년월일은 가계도에 등록한 경우에만 확인 — 비워두면 미등록과 일치하는지로 판단
    if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      setError('생년월일을 YYYY-MM-DD 형식으로 입력해주세요.'); return;
    }
    if (!email.trim())      { setError('이메일을 입력해주세요.'); return; }

    setLoading(true);
    let result: { ok: boolean };
    try {
      result = await requestPasswordReset(username.trim(), personName.trim(), birthDate, email.trim());
    } catch {
      setError('요청 중 오류가 발생했습니다. 인터넷 연결을 확인한 뒤 다시 시도해주세요.');
      return;
    } finally {
      setLoading(false);
    }

    if (result.ok) {
      setStep('sent');
    } else {
      setError('입력된 정보가 일치하지 않습니다.');
    }
  };

  const handleAdminRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!contactEmail.trim()) { setError('이메일을 입력해주세요.'); return; }
    setLoading(true);
    try {
      await requestAdminPasswordReset(username.trim(), personName.trim(), contactEmail.trim(), message.trim() || undefined);
    } catch {
      setError('요청 중 오류가 발생했습니다. 다시 시도해주세요.');
      return;
    } finally {
      setLoading(false);
    }
    setStep('fallback_sent');
  };

  if (step === 'sent') {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1 className="login-title">이메일 발송 완료</h1>
          <p className="login-desc">
            입력하신 이메일로 비밀번호 초기화 링크를 보냈습니다.<br />
            링크는 <strong>1시간</strong> 동안 유효합니다.
          </p>
          <button className="login-btn" onClick={onBack}>로그인으로 돌아가기</button>
        </div>
      </div>
    );
  }

  if (step === 'fallback') {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1 className="login-title">관리자에게 요청</h1>
          <p className="login-desc">
            초기화 링크를 받을 이메일 주소를 입력해주세요.<br />
            관리자 승인 후 해당 이메일로 링크가 발송됩니다.
          </p>
          <form onSubmit={handleAdminRequest} className="login-form">
            <input
              className="login-input"
              type="email"
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              placeholder="연락받을 이메일"
              autoFocus
              maxLength={100}
            />
            <textarea
              className="login-input"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="관리자에게 전달할 메시지 (선택) — 예: 홍재억의 딸입니다."
              maxLength={300}
              rows={3}
              style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 'var(--fs-14)' }}
            />
            {error && <p className="login-error">{error}</p>}
            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? '요청 중...' : '요청 보내기'}
            </button>
            <button type="button" className="reg-back-btn" onClick={onBack}>
              로그인으로 돌아가기
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (step === 'fallback_sent') {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1 className="login-title">요청 완료</h1>
          <p className="login-desc">
            관리자에게 초기화 요청이 전달됐습니다.<br />
            승인 후 입력하신 이메일로 링크가 발송됩니다.
          </p>
          <button className="login-btn" onClick={onBack}>로그인으로 돌아가기</button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1 className="login-title">비밀번호 찾기</h1>
        <p className="login-desc">가입 시 등록한 정보를 입력해주세요.</p>
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
            type="text"
            value={personName}
            onChange={e => setPersonName(e.target.value)}
            placeholder="이름 (가계도에 등록된 이름)"
            maxLength={30}
          />
          <p className="reg-optional-label">생년월일 (가계도에 등록한 경우만 입력, 없으면 비워두세요)</p>
          <DateInput value={birthDate} onChange={setBirthDate} max={todayStr()} placeholder="생년월일 YYYY-MM-DD" />
          <p className="reg-optional-label">이메일 (가계도 내 정보에 등록한 이메일)</p>
          <input
            className="login-input"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="이메일"
            maxLength={100}
          />
          {error && (
            <div>
              <p className="login-error">{error}</p>
              <button
                type="button"
                className="login-register-btn"
                onClick={() => { setError(''); setStep('fallback'); }}
              >
                이 정보로 관리자에게 초기화 요청
              </button>
            </div>
          )}
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? '확인 중...' : '비밀번호 초기화 링크 받기'}
          </button>
          {!error && (
            <button
              type="button"
              className="login-forgot-btn"
              onClick={() => setStep('fallback')}
            >
              이메일을 등록하지 않았다면? 관리자에게 초기화 요청
            </button>
          )}
          <button type="button" className="reg-back-btn" onClick={onBack}>
            로그인으로 돌아가기
          </button>
        </form>
      </div>
    </div>
  );
}
