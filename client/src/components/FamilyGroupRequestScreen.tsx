import { useEffect, useState } from 'react';
import { useFamilyStore } from '../store/familyStore';
import { DateInput } from './DateInput';
import './LoginScreen.css';
import './FamilyGroupRequestScreen.css';

interface Props {
  memberUsername: string;
  onLogout: () => void;
}

type Step = 'checking' | 'pending' | 'ask' | 'form' | 'done';

export function FamilyGroupRequestScreen({ memberUsername, onLogout }: Props) {
  const { submitFamilyGroupRequest, checkPendingFamilyRequest, cancelFamilyGroupRequest } = useFamilyStore();
  const [step, setStep]                  = useState<Step>('checking');
  const [pendingRequestId, setPendingId] = useState<string | null>(null);
  const [pendingName, setPendingName]    = useState<string>('');
  const [pendingDate, setPendingDate]    = useState<string>('');
  const [realName, setRealName]   = useState('');
  const [gender, setGender]       = useState<'male' | 'female' | ''>('');
  const [birthDate, setBirthDate] = useState('');
  const [birthLunar, setBirthLunar] = useState(false);
  const [desc, setDesc]           = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  // 마운트 시 기존 신청 내역 확인
  useEffect(() => {
    checkPendingFamilyRequest().then(req => {
      if (req) {
        setPendingId(req.id);
        setPendingName(req.realName);
        setPendingDate(new Date(req.createdAt).toLocaleDateString('ko-KR'));
        setStep('pending');
      } else {
        setStep('ask');
      }
    });
  }, []);

  const handleCancel = async () => {
    if (!pendingRequestId) return;
    setLoading(true);
    await cancelFamilyGroupRequest(pendingRequestId);
    setLoading(false);
    setPendingId(null);
    setStep('ask');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!realName.trim()) { setError('실명을 입력해주세요.'); return; }
    if (!gender)          { setError('성별을 선택해주세요.'); return; }
    setLoading(true);
    await submitFamilyGroupRequest(
      realName.trim(), desc.trim(),
      gender, birthDate || null, birthLunar
    );
    setLoading(false);
    setStep('done');
  };

  return (
    <div className="login-screen">
      <div className="login-card fgr-card">
        <div className="login-icon">🌳</div>

        {step === 'checking' && (
          <p className="fgr-desc">확인 중...</p>
        )}

        {step === 'pending' && (
          <>
            <h1 className="login-title">신청 대기 중</h1>
            <div className="fgr-pending-box">
              <p className="fgr-pending-name">👤 {pendingName}</p>
              <p className="fgr-pending-date">신청일: {pendingDate}</p>
              <p className="fgr-pending-msg">관리자 승인을 기다리고 있습니다.</p>
            </div>
            <div className="fgr-btn-group">
              <button
                className="fgr-cancel-btn"
                onClick={handleCancel}
                disabled={loading}
              >
                {loading ? '취소 중...' : '신청 취소하기'}
              </button>
              <button className="login-register-btn" onClick={onLogout}>
                로그아웃
              </button>
            </div>
          </>
        )}

        {step === 'ask' && (
          <>
            <h1 className="login-title">가족 가계도 시작</h1>
            <p className="fgr-desc">
              안녕하세요, <strong>{memberUsername}</strong>님!<br />
              새로운 가족그룹을 생성 신청하시겠습니까?
            </p>
            <div className="fgr-btn-group">
              <button className="login-btn" onClick={() => setStep('form')}>예, 신청할게요</button>
              <button className="login-register-btn" onClick={onLogout}>아니오 (로그아웃)</button>
            </div>
          </>
        )}

        {step === 'form' && (
          <>
            <h1 className="login-title">가족그룹 생성 신청</h1>
            <p className="fgr-desc">관리자 검토 후 가족그룹이 생성됩니다.</p>
            <form onSubmit={handleSubmit} className="login-form">
              <div className="fgr-field">
                <label className="fgr-label">본인 실명 <span className="fgr-required">*</span></label>
                <input
                  className="login-input"
                  type="text"
                  value={realName}
                  onChange={e => { setRealName(e.target.value); setError(''); }}
                  placeholder="예: 홍길동"
                  autoFocus
                  maxLength={20}
                />
              </div>

              <div className="fgr-field">
                <label className="fgr-label">성별 <span className="fgr-required">*</span></label>
                <div className="fgr-gender-row">
                  <button
                    type="button"
                    className={`fgr-gender-btn ${gender === 'male' ? 'active-male' : ''}`}
                    onClick={() => { setGender('male'); setError(''); }}
                  >남성</button>
                  <button
                    type="button"
                    className={`fgr-gender-btn ${gender === 'female' ? 'active-female' : ''}`}
                    onClick={() => { setGender('female'); setError(''); }}
                  >여성</button>
                </div>
              </div>

              <div className="fgr-field">
                <label className="fgr-label">생년월일 (선택)</label>
                <DateInput
                  value={birthDate}
                  onChange={setBirthDate}
                  max={new Date().toISOString().split('T')[0]}
                />
                <label className="fgr-lunar-check">
                  <input type="checkbox" checked={birthLunar}
                    onChange={e => setBirthLunar(e.target.checked)} />
                  음력으로 입력
                </label>
              </div>

              <div className="fgr-field">
                <label className="fgr-label">간단한 설명 (선택)</label>
                <textarea
                  className="fgr-textarea"
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  placeholder="예: 홍씨 집안 가계도"
                  rows={2}
                  maxLength={100}
                />
              </div>

              {error && <p className="login-error">{error}</p>}
              <button className="login-btn" type="submit" disabled={loading || !realName.trim() || !gender}>
                {loading ? '신청 중...' : '신청하기'}
              </button>
              <button type="button" className="login-register-btn" onClick={() => setStep('ask')}>
                이전으로
              </button>
            </form>
          </>
        )}

        {step === 'done' && (
          <>
            <div className="fgr-done-icon">⏳</div>
            <h1 className="login-title">신청 완료</h1>
            <p className="fgr-desc">
              관리자가 승인하면 가족그룹이 생성됩니다.<br />
              승인 후 다시 로그인해주세요.
            </p>
            <button className="login-btn" onClick={onLogout}>확인 (로그아웃)</button>
          </>
        )}
      </div>
    </div>
  );
}
