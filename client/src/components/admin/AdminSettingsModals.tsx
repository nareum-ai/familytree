import { useEffect, useState } from 'react';
import { getMemberId } from '../../lib/session';
import { changePassword, linkGoogleAccount, unlinkGoogleFromMember } from '../../services/authService';
import { loadPushSendTime, savePushSendTime } from '../../services/adminService';
import { validateNewPassword } from '../../utils/password';
import { FcmDebugPanel } from '../FcmDebugPanel';
import { GoogleIcon } from '../GoogleIcon';
import { AdminModal, StatusMessage } from './AdminModal';
import { Icon } from '../Icon';

type Msg = { ok: boolean; msg: string } | null;

// ── 구글 연동 ─────────────────────────────────────────────────────────────────
export function GoogleLinkModal({ googleEmail, onChange, onClose }: {
  googleEmail: string | null | undefined;
  onChange: (email: string | null) => void;
  onClose: () => void;
}) {
  const [msg, setMsg] = useState<Msg>(null);
  const [loading, setLoading] = useState(false);

  const run = async (action: (memberId: string) => Promise<void>, errorMsg: string) => {
    const memberId = getMemberId();
    if (!memberId) return;
    setMsg(null);
    setLoading(true);
    try {
      await action(memberId);
    } catch {
      setMsg({ ok: false, msg: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleLink = () => run(async () => {
    const res = await linkGoogleAccount();
    if (!res) return; // 팝업 취소
    if (!res.ok) { setMsg({ ok: false, msg: res.error ?? '연결 실패' }); return; }
    onChange(res.email);
    setMsg({ ok: true, msg: '구글 계정이 연결됐습니다.' });
  }, '연결 중 오류가 발생했습니다.');

  const handleUnlink = () => run(async () => {
    await unlinkGoogleFromMember();
    onChange(null);
    setMsg({ ok: true, msg: '구글 연결이 해제됐습니다.' });
  }, '해제 중 오류가 발생했습니다.');

  return (
    <AdminModal onClose={onClose} style={{ width: 320 }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        <GoogleIcon size={40} />
      </div>
      <h3 style={{ fontSize: 16, marginBottom: 6 }}>구글 계정 연동</h3>
      {googleEmail ? (
        <>
          <p style={{ fontSize: 13, color: '#3F7D4F', fontWeight: 600, marginBottom: 4 }}>● 연결됨</p>
          <p style={{ fontSize: 13, color: '#5F5648', marginBottom: 16 }}>{googleEmail}</p>
          <StatusMessage msg={msg} style={{ marginBottom: 10 }} />
          <div className="confirm-actions">
            <button className="btn-cancel-confirm" onClick={onClose}>닫기</button>
            <button className="btn-delete-confirm" style={{ background: '#B3412E' }}
              disabled={loading} onClick={handleUnlink}>
              {loading ? '처리 중...' : '연결 해제'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, color: '#9C907C', marginBottom: 16 }}>
            구글 계정을 연결하면 비밀번호 없이 로그인할 수 있습니다.
          </p>
          <StatusMessage msg={msg} style={{ marginBottom: 10 }} />
          <div className="confirm-actions">
            <button className="btn-cancel-confirm" onClick={onClose}>취소</button>
            <button className="btn-approve" style={{ flex: 1 }} disabled={loading} onClick={handleLink}>
              {loading ? '처리 중...' : '구글로 연결'}
            </button>
          </div>
        </>
      )}
    </AdminModal>
  );
}

// ── 관리자 비밀번호 변경 ──────────────────────────────────────────────────────
export function AdminPasswordModal({ onClose }: { onClose: () => void }) {
  const [oldPw,  setOldPw]  = useState('');
  const [newPw,  setNewPw]  = useState('');
  const [confPw, setConfPw] = useState('');
  const [msg, setMsg] = useState<Msg>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = validateNewPassword(newPw, confPw);
    setMsg(invalid ? { ok: false, msg: invalid } : null);
    if (invalid) return;
    setLoading(true);
    try {
      if (await changePassword(oldPw, newPw) === 'wrong-password') {
        setMsg({ ok: false, msg: '현재 비밀번호가 올바르지 않습니다.' });
        return;
      }
      setMsg({ ok: true, msg: '비밀번호가 변경됐습니다.' });
      setOldPw(''); setNewPw(''); setConfPw('');
    } catch {
      setMsg({ ok: false, msg: '변경 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminModal onClose={onClose} style={{ width: 340 }}>
      <h3><Icon name="key" /> 관리자 비밀번호 변경</h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
        <input className="map-search-input" type="password" value={oldPw}
          onChange={e => setOldPw(e.target.value)} placeholder="현재 비밀번호" autoFocus />
        <input className="map-search-input" type="password" value={newPw}
          onChange={e => setNewPw(e.target.value)} placeholder="새 비밀번호 (6자 이상)" />
        <input className="map-search-input" type="password" value={confPw}
          onChange={e => setConfPw(e.target.value)} placeholder="새 비밀번호 확인" />
        <StatusMessage msg={msg} style={{ textAlign: 'center', margin: 0 }} />
        <div className="confirm-actions">
          <button type="button" className="btn-cancel-confirm" onClick={onClose}>취소</button>
          <button type="submit" className="btn-approve" style={{ flex: 1 }}
            disabled={loading || !oldPw || !newPw || !confPw}>
            {loading ? '변경 중...' : '변경'}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}

// ── 알림 진단 ─────────────────────────────────────────────────────────────────
export function AlarmDiagModal({ onClose }: { onClose: () => void }) {
  return (
    <AdminModal onClose={onClose}>
      <h3><Icon name="wrench" /> 관리자 알림 진단</h3>
      <p style={{ fontSize: 12, color: '#9C907C', margin: '0 0 16px' }}>
        관리자 앱(PWA)에서 알림을 받으려면 토큰을 등록하세요.
      </p>
      <FcmDebugPanel scope="admin" />
      <div className="confirm-actions" style={{ marginTop: 16 }}>
        <button className="btn-cancel-confirm" onClick={onClose}>닫기</button>
      </div>
    </AdminModal>
  );
}

// ── 알림 발송 시간 ────────────────────────────────────────────────────────────
const DEFAULT_SEND_HOUR = 8;

export function PushTimeModal({ onClose }: { onClose: () => void }) {
  const [sendHour, setSendHour] = useState(DEFAULT_SEND_HOUR);
  const [sendMinute, setSendMinute] = useState(0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    loadPushSendTime()
      .then(t => { if (t) { setSendHour(t.hour); setSendMinute(t.minute); } })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setMsg(null);
    try {
      await savePushSendTime(sendHour, sendMinute);
      setMsg({ ok: true, msg: '저장됐습니다.' });
    } catch {
      setMsg({ ok: false, msg: '저장 중 오류가 발생했습니다.' });
    }
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <AdminModal onClose={onClose}>
      <h3><Icon name="bell" /> 알림 발송 시간</h3>
      <p style={{ fontSize: 12, color: '#9C907C', margin: '0 0 16px' }}>
        알림 시기·범위·종류는 각 회원의 My 페이지에서 개별 설정합니다.
      </p>
      {loading ? <p className="admin-empty">불러오는 중...</p> : (
        <div className="push-settings">
          <div className="push-row">
            <label className="push-label">발송 시간 (KST)</label>
            <select className="push-select" value={sendHour} onChange={e => setSendHour(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{String(i).padStart(2, '0')}시</option>
              ))}
            </select>
            <select className="push-select" value={sendMinute} onChange={e => setSendMinute(Number(e.target.value))}>
              {Array.from({ length: 60 }, (_, i) => (
                <option key={i} value={i}>{String(i).padStart(2, '0')}분</option>
              ))}
            </select>
          </div>
          {msg && <p className={`push-save-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.msg}</p>}
          <button className="push-save-btn" onClick={handleSave}>저장</button>
        </div>
      )}
      <div className="confirm-actions" style={{ marginTop: 16 }}>
        <button className="btn-cancel-confirm" onClick={onClose}>닫기</button>
      </div>
    </AdminModal>
  );
}
