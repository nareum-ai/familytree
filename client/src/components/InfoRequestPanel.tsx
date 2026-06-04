import { useState } from 'react';
import { useFamilyStore } from '../store/familyStore';
import './InfoRequestPanel.css';

interface Props {
  personId: string;
  onClose: () => void;
}

export function InfoRequestPanel({ personId, onClose }: Props) {
  const { createInfoRequest } = useFamilyStore();
  const [sent, setSent]     = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRequest = async () => {
    setLoading(true);
    const autoApproved = await createInfoRequest(personId);
    if (autoApproved) {
      onClose(); // 즉시 패널 닫기 → 트리에서 바로 열람 가능
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="detail-panel irp-panel">
      <div className="detail-header">
        <div className="irp-lock-icon">🔒</div>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      {sent ? (
        <div className="irp-sent">
          <div className="irp-sent-icon">✅</div>
          <p>정보공개 요청이 전송됐습니다.<br />권한자가 승인하면 열람할 수 있습니다.</p>
          <button className="irp-close-btn" onClick={onClose}>닫기</button>
        </div>
      ) : (
        <>
          <p className="irp-desc">
            이 인물의 정보는 <strong>비공개</strong>입니다.<br />
            정보공개를 요청하면 권한자에게 알림이 전송됩니다.
          </p>
          <p className="irp-notice">
            ℹ️ <strong>권한자</strong>의 정보를 공유받으면,<br />
            나의 정보도 <strong>권한자</strong>에게 공유됩니다.
          </p>
          <button
            className="irp-request-btn"
            onClick={handleRequest}
            disabled={loading}
          >
            {loading ? '요청 중...' : '정보공개 요청하기'}
          </button>
        </>
      )}
    </div>
  );
}
