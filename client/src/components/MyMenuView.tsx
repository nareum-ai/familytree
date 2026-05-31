import { useEffect, useState } from 'react';
import { useFamilyStore } from '../store/familyStore';
import { useAdminEmail } from '../hooks/useAdminEmail';
import { LS } from '../lib/storageKeys';
import './MyMenuView.css';

interface Props { onClose: () => void; }

type Tab = 'requests' | 'password' | 'google';

interface RequestItem {
  id: string;
  requesterName: string;
  personId: string;
  createdAt: string;
}

export function MyMenuView({ onClose }: Props) {
  const { loadInfoRequestsForMe, approveInfoRequest, rejectInfoRequest,
          persons, loginMember, linkGoogleToMember, unlinkGoogleFromMember } = useFamilyStore();
  const [tab, setTab]           = useState<Tab>('requests');
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [reqLoading, setReqLoading] = useState(true);

  // 비밀번호 변경
  const [oldPw, setOldPw]    = useState('');
  const [newPw, setNewPw]    = useState('');
  const [confirmPw, setConf] = useState('');
  const [pwMsg, setPwMsg]    = useState<{ ok: boolean; msg: string } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  // 구글 연결
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [googleMsg, setGoogleMsg]     = useState<{ ok: boolean; msg: string } | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const adminEmail = useAdminEmail();

  const username = localStorage.getItem(LS.ACCOUNT_NAME)
    ?? localStorage.getItem(LS.USER_NAME) ?? '';

  // 관리자 or 관리자 대리 접속 중에는 구글 탭 숨김
  const isAdminContext =
    localStorage.getItem(LS.IS_ADMIN) === 'true' ||
    localStorage.getItem(LS.ADMIN_RETURN) === 'true';

  useEffect(() => {
    setReqLoading(true);
    loadInfoRequestsForMe()
      .then(setRequests)
      .catch(() => setRequests([]))
      .finally(() => setReqLoading(false));

    // Firestore에서 google_email 로드
    const loadGoogleEmail = async () => {
      const memberId = localStorage.getItem(LS.MEMBER_ID);
      if (!memberId) return;
      const { getDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const snap = await getDoc(doc(db, 'members', memberId));
      setGoogleEmail((snap.data()?.google_email as string | null) ?? null);
    };
    loadGoogleEmail();
  }, []);

  const personName = (personId: string) =>
    persons.find(p => p.id === personId)?.name ?? '(비공개)';

  const handleApprove = async (req: RequestItem) => {
    const { getDocs, collection, query, where } = await import('firebase/firestore');
    const { db } = await import('../lib/firebase');
    const snap = await getDocs(query(collection(db, 'info_requests'),
      where('requester_name', '==', req.requesterName)));
    const memberId = snap.docs.find(d => d.id === req.id)?.data().requester_member_id ?? '';
    await approveInfoRequest(req.id, memberId, req.personId);
    setRequests(r => r.filter(x => x.id !== req.id));
  };

  const handleReject = async (req: RequestItem) => {
    await rejectInfoRequest(req.id);
    setRequests(r => r.filter(x => x.id !== req.id));
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPw.length < 6) { setPwMsg({ ok: false, msg: '새 비밀번호는 6자 이상이어야 합니다.' }); return; }
    if (newPw !== confirmPw) { setPwMsg({ ok: false, msg: '새 비밀번호가 일치하지 않습니다.' }); return; }
    setPwLoading(true);
    try {
      const member = await loginMember(username, oldPw);
      if (!member) { setPwMsg({ ok: false, msg: '현재 비밀번호가 올바르지 않습니다.' }); return; }
      const { hashPassword } = await import('../utils/crypto');
      const { updateDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const newHash = await hashPassword(newPw);
      await updateDoc(doc(db, 'members', member.id), { password_hash: newHash });
      setPwMsg({ ok: true, msg: '비밀번호가 변경됐습니다.' });
      setOldPw(''); setNewPw(''); setConf('');
    } catch {
      setPwMsg({ ok: false, msg: '변경 중 오류가 발생했습니다.' });
    } finally {
      setPwLoading(false);
    }
  };

  const handleLinkGoogle = async () => {
    setGoogleMsg(null);
    setGoogleLoading(true);
    try {
      const { signInWithPopup } = await import('firebase/auth');
      const { auth, googleProvider } = await import('../lib/firebase');
      const result = await signInWithPopup(auth, googleProvider);
      const uid   = result.user.uid;
      const email = result.user.email ?? '';
      const memberId = localStorage.getItem(LS.MEMBER_ID);
      if (!memberId) return;
      const res = await linkGoogleToMember(memberId, uid, email);
      if (!res.ok) {
        setGoogleMsg({ ok: false, msg: res.error ?? '구글 연결 중 오류가 발생했습니다.' });
        return;
      }
      localStorage.setItem(LS.GOOGLE_EMAIL, email);
      setGoogleEmail(email);
      setGoogleMsg({ ok: true, msg: '구글 계정이 연결됐습니다.' });
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'auth/popup-closed-by-user') return;
      setGoogleMsg({ ok: false, msg: '구글 연결 중 오류가 발생했습니다.' });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleUnlinkGoogle = async () => {
    setGoogleMsg(null);
    setGoogleLoading(true);
    try {
      const memberId = localStorage.getItem(LS.MEMBER_ID);
      if (!memberId) return;
      await unlinkGoogleFromMember(memberId);
      localStorage.removeItem(LS.GOOGLE_EMAIL);
      setGoogleEmail(null);
      setGoogleMsg({ ok: true, msg: '구글 연결이 해제됐습니다.' });
    } catch {
      setGoogleMsg({ ok: false, msg: '해제 중 오류가 발생했습니다.' });
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="my-backdrop" onClick={onClose}>
      <div className="my-panel" onClick={e => e.stopPropagation()}>
        <div className="my-header">
          <h2>👤 {username}</h2>
          <button className="my-close" onClick={onClose}>✕</button>
        </div>

        <div className="my-tabs">
          <button className={`my-tab ${tab === 'requests' ? 'active' : ''}`}
            onClick={() => setTab('requests')}>
            📬 정보공개 요청 {requests.length > 0 && <span className="my-badge">{requests.length}</span>}
          </button>
          <button className={`my-tab ${tab === 'password' ? 'active' : ''}`}
            onClick={() => setTab('password')}>
            🔒 비밀번호
          </button>
          {!isAdminContext && (
            <button className={`my-tab ${tab === 'google' ? 'active' : ''}`}
              onClick={() => setTab('google')}>
              🔗 구글{googleEmail === null && <span className="my-badge my-badge-warn">!</span>}
            </button>
          )}
        </div>

        <div className="my-body">
          {/* 정보공개 요청 */}
          {tab === 'requests' && (
            reqLoading ? <p className="my-empty">불러오는 중...</p> :
            requests.length === 0 ? <p className="my-empty">받은 정보공개 요청이 없습니다.</p> : (
              <div className="my-req-list">
                {requests.map(req => (
                  <div key={req.id} className="my-req-row">
                    <div className="my-req-info">
                      <span className="my-req-name">{req.requesterName}님</span>
                      <span className="my-req-person">→ {personName(req.personId)} 정보 요청</span>
                      <span className="my-req-date">{new Date(req.createdAt).toLocaleDateString('ko-KR')}</span>
                    </div>
                    <div className="my-req-btns">
                      <button className="my-approve" onClick={() => handleApprove(req)}>수락</button>
                      <button className="my-reject"  onClick={() => handleReject(req)}>거절</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* 비밀번호 변경 */}
          {tab === 'password' && (
            <form className="my-pw-form" onSubmit={handlePasswordChange}>
              <div className="my-field">
                <label>현재 비밀번호</label>
                <input type="password" value={oldPw}
                  onChange={e => setOldPw(e.target.value)} placeholder="현재 비밀번호" maxLength={50} />
              </div>
              <div className="my-field">
                <label>새 비밀번호</label>
                <input type="password" value={newPw}
                  onChange={e => setNewPw(e.target.value)} placeholder="6자 이상" maxLength={50} />
              </div>
              <div className="my-field">
                <label>새 비밀번호 확인</label>
                <input type="password" value={confirmPw}
                  onChange={e => setConf(e.target.value)} placeholder="비밀번호 재입력" maxLength={50} />
              </div>
              {pwMsg && <p className={`my-pw-msg ${pwMsg.ok ? 'ok' : 'err'}`}>{pwMsg.msg}</p>}
              <button type="submit" className="my-pw-btn" disabled={pwLoading || !oldPw || !newPw || !confirmPw}>
                {pwLoading ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>
          )}

          {/* 구글 연결 */}
          {tab === 'google' && (
            <div className="my-google-section">
              <div className="my-google-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="32" height="32">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
              </div>

              {googleEmail ? (
                <>
                  <p className="my-google-status linked">연결됨</p>
                  <p className="my-google-email">{googleEmail}</p>
                  <p className="my-google-desc">이 구글 계정으로 로그인할 수 있습니다.</p>
                  {googleMsg && <p className={`my-pw-msg ${googleMsg.ok ? 'ok' : 'err'}`}>{googleMsg.msg}</p>}
                  <button
                    className="my-google-unlink-btn"
                    onClick={handleUnlinkGoogle}
                    disabled={googleLoading}
                  >
                    {googleLoading ? '처리 중...' : '구글 연결 해제'}
                  </button>
                </>
              ) : (
                <>
                  <p className="my-google-status">연결 안 됨</p>
                  <p className="my-google-desc">
                    구글 계정을 연결해두면<br/>
                    <strong>비밀번호를 잊어버려도</strong> 구글로 로그인할 수 있어요.
                  </p>
                  {googleMsg && <p className={`my-pw-msg ${googleMsg.ok ? 'ok' : 'err'}`}>{googleMsg.msg}</p>}
                  <button
                    className="my-google-link-btn"
                    onClick={handleLinkGoogle}
                    disabled={googleLoading}
                  >
                    {googleLoading ? '처리 중...' : '구글 계정 연결하기'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* 문의 · 탈퇴 안내 */}
        <div className="my-contact-footer">
          <p className="my-contact-title">탈퇴 및 문의</p>
          <p className="my-contact-desc">
            계정 탈퇴는 관리자를 통해 처리됩니다.<br />
            탈퇴 요청 또는 문의사항은 아래 이메일로 연락주세요.
          </p>
          {adminEmail
            ? <a href={`mailto:${adminEmail}?subject=계정 탈퇴 요청`} className="my-contact-email">{adminEmail}</a>
            : <span className="my-contact-email" style={{ color: '#aaa' }}>이메일 불러오는 중...</span>
          }
        </div>
      </div>
    </div>
  );
}
