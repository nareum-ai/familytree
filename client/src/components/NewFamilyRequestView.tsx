import { useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import './NewFamilyRequestView.css';

interface Props {
  requestedName: string;
  onBack: () => void;
}

type State = 'confirm' | 'sending' | 'done';

export function NewFamilyRequestView({ requestedName, onBack }: Props) {
  const [state, setState] = useState<State>('confirm');

  const handleRequest = async () => {
    setState('sending');
    try {
      await addDoc(collection(db, 'approval_requests'), {
        requested_name: requestedName,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
      setState('done');
    } catch {
      setState('confirm');
      alert('요청 전송에 실패했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <div className="nfr-screen">
      <div className="nfr-card">
        <div className="nfr-icon">🌳</div>

        {state === 'confirm' && (
          <>
            <h1 className="nfr-title">새로운 가족집단 생성</h1>
            <p className="nfr-name">"{requestedName}"</p>
            <p className="nfr-desc">
              현재 등록된 가족 구성원이 아닙니다.<br />
              새로운 가족집단을 생성하시겠습니까?<br />
              <span className="nfr-hint">관리자 승인 후 이용 가능합니다.</span>
            </p>
            <div className="nfr-actions">
              <button className="nfr-btn-back" onClick={onBack}>돌아가기</button>
              <button className="nfr-btn-ok" onClick={handleRequest}>승인 요청</button>
            </div>
          </>
        )}

        {state === 'sending' && (
          <>
            <p className="nfr-desc">요청을 전송하는 중...</p>
            <div className="nfr-spinner" />
          </>
        )}

        {state === 'done' && (
          <>
            <h1 className="nfr-title">요청이 전송됐습니다</h1>
            <p className="nfr-desc">
              관리자가 승인하면 <strong>{requestedName}</strong>으로<br />
              로그인하여 새 가족트리를 시작할 수 있습니다.
            </p>
            <button className="nfr-btn-ok" onClick={onBack}>확인</button>
          </>
        )}
      </div>
    </div>
  );
}
