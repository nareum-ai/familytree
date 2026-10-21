import type { CSSProperties, ReactNode } from 'react';

/** 관리자 화면 공통 모달 (배경 클릭 시 닫힘) */
export function AdminModal({ onClose, className = '', style, children }: {
  onClose: () => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className="confirm-backdrop" onClick={onClose}>
      <div className={`confirm-box ${className}`} style={style} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/** 위험 작업 확인 모달 */
export function ConfirmDeleteModal({ title, children, confirmLabel, onConfirm, onCancel }: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AdminModal onClose={onCancel}>
      <h3>{title}</h3>
      <p>{children}</p>
      <div className="confirm-actions">
        <button className="btn-cancel-confirm" onClick={onCancel}>취소</button>
        <button className="btn-delete-confirm" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </AdminModal>
  );
}

export function StatusMessage({ msg, style }: { msg: { ok: boolean; msg: string } | null; style?: CSSProperties }) {
  if (!msg) return null;
  return <p style={{ fontSize: 13, ...style, color: msg.ok ? '#16a34a' : '#e53e3e' }}>{msg.msg}</p>;
}
