import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SS } from '../lib/storageKeys';
import type { Person } from '../types';

interface Props { token: string; }

export function InvitePage({ token }: Props) {
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [senderName, setSenderName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const inviteSnap = await getDocs(
          query(collection(db, 'invites'), where('token', '==', token))
        );
        if (inviteSnap.empty) throw new Error('not found');
        const invite = inviteSnap.docs[0].data();

        setSenderName(invite.created_by ?? null);

        const personsAll = await getDocs(collection(db, 'persons'));
        const allPersons = personsAll.docs.map(d => ({
          ...(d.data() as Omit<Person, 'id'>), id: d.id,
        }));
        const person = allPersons.find(p => p.id === invite.person_id) ?? null;
        if (!person) throw new Error('person not found');

        // 초대 컨텍스트 sessionStorage에 저장 (로그인 후 검증에 사용)
        sessionStorage.setItem(SS.INVITE_TOKEN,       token);
        sessionStorage.setItem(SS.INVITE_PERSON_ID,   person.id);
        sessionStorage.setItem(SS.INVITE_PERSON_NAME, person.name);
        sessionStorage.setItem(SS.INVITE_FAMILY_ID,   person.family_id ?? 'main');

        // 기존 viewpoint 세션 초기화 (새 사용자가 링크를 따라온 것)
        sessionStorage.removeItem(SS.VIEWPOINT_PERSON_ID);
      } catch {
        setError('유효하지 않은 초대 링크입니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) return <div className="invite-loading">초대 정보를 불러오는 중...</div>;
  if (error)   return <div className="invite-error">{error}</div>;

  return (
    <div className="invite-landing">
      <div className="invite-card">
        <div className="invite-icon">👨‍👩‍👧‍👦</div>
        <h1 className="invite-title">가계도 초대</h1>
        <p className="invite-desc">
          <strong>{senderName ?? '누군가'}님</strong>이 가계도에 초대했습니다.<br />
          로그인 후 본인 확인 절차가 있습니다.
        </p>
        <div className="invite-btn-group">
          <button className="invite-view-btn" onClick={() => { window.location.href = '/'; }}>
            로그인 / 회원가입
          </button>
        </div>
        <p className="invite-note">
          계정이 없으면 회원가입 후 이름을 확인해주세요.
        </p>
      </div>
    </div>
  );
}
