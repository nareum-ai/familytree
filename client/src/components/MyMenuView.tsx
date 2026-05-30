import { useEffect, useState } from 'react';
import { useFamilyStore } from '../store/familyStore';
import { LS } from '../lib/storageKeys';
import './MyMenuView.css';

interface Props { onClose: () => void; }

type Tab = 'requests' | 'password';

interface RequestItem {
  id: string;
  requesterName: string;
  personId: string;
  createdAt: string;
}

export function MyMenuView({ onClose }: Props) {
  const { loadInfoRequestsForMe, approveInfoRequest, rejectInfoRequest,
          persons, loginMember } = useFamilyStore();
  const [tab, setTab]         = useState<Tab>('requests');
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [reqLoading, setReqLoading] = useState(true);

  // 비밀번호 변경
  const [oldPw, setOldPw]     = useState('');
  const [newPw, setNewPw]     = useState('');
  const [confirmPw, setConf]  = useState('');
  const [pwMsg, setPwMsg]     = useState<{ ok: boolean; msg: string } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  const username = localStorage.getItem(LS.ACCOUNT_NAME)
    ?? localStorage.getItem(LS.USER_NAME) ?? '';

  useEffect(() => {
    setReqLoading(true);
    loadInfoRequestsForMe()
      .then(setRequests)
      .catch(() => setRequests([]))
      .finally(() => setReqLoading(false));
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
      // 현재 비밀번호 확인
      const member = await loginMember(username, oldPw);
      if (!member) { setPwMsg({ ok: false, msg: '현재 비밀번호가 올바르지 않습니다.' }); return; }

      // 비밀번호 업데이트
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
            🔒 비밀번호 변경
          </button>
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
              {pwMsg && (
                <p className={`my-pw-msg ${pwMsg.ok ? 'ok' : 'err'}`}>{pwMsg.msg}</p>
              )}
              <button type="submit" className="my-pw-btn" disabled={pwLoading || !oldPw || !newPw || !confirmPw}>
                {pwLoading ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
