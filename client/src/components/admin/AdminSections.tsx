import { useRef, useState, type ReactNode } from 'react';
import type { ApprovalRequest, Member, PasswordResetRequest } from '../../types';
import { useFamilyStore } from '../../store/familyStore';
import { callGemini } from '../../lib/gemini';
import {
  approvePasswordResetRequest, approveRequest, loadActivityLogs, rejectPasswordResetRequest, rejectRequest,
  sendBroadcastPush, type ActivityLog,
} from '../../services/adminService';
import { formatCompactDateTime } from '../../utils/date';
import { AdminPager } from './AdminPager';
import { paginate } from '../../utils/paginate';

type Msg = { ok: boolean; msg: string } | null;

/** 대기 건수 배지가 붙는 섹션 제목 */
function PendingHeading({ children, count }: { children: ReactNode; count: number }) {
  return (
    <h2>
      {children}
      {count > 0
        ? <span className="req-count-badge">{count}</span>
        : <span className="req-count-zero"> (없음)</span>}
    </h2>
  );
}

// ── 임시 권한 해제 ────────────────────────────────────────────────────────────
export function TempUnlockSection({ flash }: { flash: (msg: string) => void }) {
  const tempUnlockAll    = useFamilyStore(s => s.tempUnlockAll);
  const setTempUnlockAll = useFamilyStore(s => s.setTempUnlockAll);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      const next = !tempUnlockAll;
      await setTempUnlockAll(next);
      flash(next ? '🔓 임시 권한 해제 — 모든 정보공개·편집 권한이 전체 허용됩니다.' : '🔒 임시 권한 해제 종료 — 기존 권한 정책으로 복귀합니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={`admin-section ${tempUnlockAll ? 'section-urgent' : ''}`}>
      <h2>🔓 임시 권한 해제</h2>
      <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 12px' }}>
        켜면 전체 노드에 대한 모든 정보공개 요청이 자동 승인되고, 모든 인물의 편집 권한이 전체 회원에게 허용됩니다.
        끄면 기존 정보공개 요청 승인 정책과 편집 권한 부여 정책으로 돌아갑니다.
      </p>
      <button className={tempUnlockAll ? 'btn-disable' : 'btn-enable'} disabled={loading} onClick={handleToggle}>
        {loading ? '처리 중...' : tempUnlockAll ? '🔓 켜짐 — 끄기' : '🔒 꺼짐 — 켜기'}
      </button>
    </section>
  );
}

// ── 가족집단 생성 승인 대기 ──────────────────────────────────────────────────
export function ApprovalSection({ requests, loading, flash, reload }: {
  requests: ApprovalRequest[];
  loading: boolean;
  flash: (msg: string) => void;
  reload: () => void;
}) {
  const handleApprove = async (req: ApprovalRequest) => {
    await approveRequest(req.id, req.requested_name);
    flash(`✅ "${req.requested_name}" 승인됨`);
    reload();
  };
  const handleReject = async (req: ApprovalRequest) => {
    await rejectRequest(req.id);
    flash(`❌ "${req.requested_name}" 거절됨`);
    reload();
  };

  return (
    <section className={`admin-section ${requests.length > 0 ? 'section-urgent' : ''}`}>
      <PendingHeading count={requests.length}>📋 승인 대기</PendingHeading>
      {loading ? <p className="admin-empty">불러오는 중...</p> :
       requests.length === 0 ? <p className="admin-empty">현재 대기 중인 신청이 없습니다.</p> : (
        <div className="admin-list">
          {requests.map(r => (
            <div key={r.id} className="admin-req-row">
              <div className="req-info">
                <span className="req-name">{r.requested_name}</span>
                {r.member_username && <span className="req-member">계정: {r.member_username}</span>}
                {r.description && <span className="req-desc">"{r.description}"</span>}
                <span className="req-date">{formatCompactDateTime(r.created_at)}</span>
              </div>
              <div className="req-actions">
                <button className="btn-approve" onClick={() => handleApprove(r)}>승인</button>
                <button className="btn-reject"  onClick={() => handleReject(r)}>거절</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── 비밀번호 초기화 요청 ──────────────────────────────────────────────────────
export function PasswordResetSection({ requests, onResolved, loading, flash }: {
  requests: PasswordResetRequest[];
  onResolved: (requestId: string) => void;
  loading: boolean;
  flash: (msg: string) => void;
}) {
  const handleApprove = async (r: PasswordResetRequest) => {
    try {
      await approvePasswordResetRequest(r.id, r.username, r.contact_email);
      onResolved(r.id);
      flash('초기화 링크가 이메일로 발송됐습니다.');
    } catch {
      flash('승인 처리 중 오류가 발생했습니다.');
    }
  };
  const handleReject = async (r: PasswordResetRequest) => {
    await rejectPasswordResetRequest(r.id);
    onResolved(r.id);
  };

  return (
    <section className={`admin-section ${requests.length > 0 ? 'section-urgent' : ''}`}>
      <PendingHeading count={requests.length}>🔑 비밀번호 초기화 요청</PendingHeading>
      {loading ? <p className="admin-empty">불러오는 중...</p> :
       requests.length === 0 ? <p className="admin-empty">현재 대기 중인 요청이 없습니다.</p> : (
        <div className="admin-list">
          {requests.map(r => (
            <div key={r.id} className="admin-req-row">
              <div className="req-info">
                <span className="req-name">아이디: {r.username}</span>
                {r.person_name && <span className="req-meta">이름: {r.person_name}</span>}
                <span className="req-meta">연락 이메일: {r.contact_email}</span>
                {r.message && <span className="req-meta req-message">💬 {r.message}</span>}
                <span className="req-meta">{formatCompactDateTime(r.created_at)}</span>
              </div>
              <div className="req-btns">
                <button className="btn-approve" onClick={() => handleApprove(r)}>승인</button>
                <button className="btn-reject" onClick={() => handleReject(r)}>거절</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── 공지 푸시 발송 ────────────────────────────────────────────────────────────
export function BroadcastSection({ members }: { members: Member[] }) {
  const [title,   setTitle]   = useState('');
  const [body,    setBody]    = useState('');
  const [target,  setTarget]  = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState<Msg>(null);

  const recipients = members.filter(m => m.fcm_token && m.status === 'active');

  const handleSend = async () => {
    if (!title.trim()) return;
    setLoading(true);
    setMsg(null);
    try {
      await sendBroadcastPush(title.trim(), body.trim(), target === 'all' ? null : target);
      setMsg({ ok: true, msg: '✅ 발송 요청됐습니다. 수 초 내 전달됩니다.' });
      setTitle('');
      setBody('');
      setTarget('all');
    } catch {
      setMsg({ ok: false, msg: '❌ 발송 요청 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(null), 4000);
    }
  };

  return (
    <section className="admin-section">
      <h2>📢 공지 푸시 발송</h2>
      <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px' }}>
        앱을 설치한 회원에게만 전달됩니다.
      </p>
      <div className="push-settings">
        <div className="push-row">
          <label className="push-label">수신 대상</label>
          <select className="push-select" value={target} onChange={e => setTarget(e.target.value)}>
            <option value="all">전체 ({recipients.length}명)</option>
            {recipients.map(m => (
              <option key={m.id} value={m.id}>{m.person_name || m.username}</option>
            ))}
          </select>
        </div>
        <div className="push-row">
          <label className="push-label">제목</label>
          <input className="push-input" value={title}
            onChange={e => setTitle(e.target.value)} placeholder="알림 제목" maxLength={50} />
        </div>
        <div className="push-row">
          <label className="push-label">내용</label>
          <textarea className="push-textarea" value={body}
            onChange={e => setBody(e.target.value)} placeholder="알림 내용 (선택)" rows={2} maxLength={200} />
        </div>
        {msg && <p className={`push-save-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.msg}</p>}
        <button className="push-save-btn" onClick={handleSend} disabled={loading || !title.trim()}>
          {loading ? '발송 중...' : '발송'}
        </button>
      </div>
    </section>
  );
}

// ── 활동 로그 ─────────────────────────────────────────────────────────────────
const ACT_LOG_PAGE_SIZE = 30;

export function ActivityLogSection() {
  const [logs,    setLogs]    = useState<ActivityLog[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [page,    setPage]    = useState(0);

  const handleLoad = async () => {
    setLoading(true);
    try {
      setLogs(await loadActivityLogs());
    } finally {
      setLoading(false);
    }
  };

  const { current, pageItems, totalPages } = paginate(logs ?? [], page, ACT_LOG_PAGE_SIZE);

  return (
    <section className="admin-section">
      <div className="section-head">
        <h2>
          📝 활동 로그
          {logs && <span className="req-count-zero"> ({logs.length}건)</span>}
        </h2>
        <button className="btn-bulk-new" onClick={handleLoad} disabled={loading}>
          {loading ? '로딩...' : logs ? '새로고침' : '불러오기'}
        </button>
      </div>
      {!logs ? (
        <p className="admin-empty">버튼을 눌러 로그를 불러오세요.</p>
      ) : loading ? (
        <p className="admin-empty">불러오는 중...</p>
      ) : logs.length === 0 ? (
        <p className="admin-empty">활동 기록이 없습니다.</p>
      ) : (
        <>
          <div className="act-log-list">
            <div className="act-log-head">
              <span>시간</span><span>작업</span><span>작업자</span><span>대상</span>
            </div>
            {pageItems.map(l => (
              <div key={l.id} className="act-log-row">
                <span className="act-log-time">{formatCompactDateTime(l.at)}</span>
                <span className={`act-log-action ${l.action}`}>{l.action === 'add' ? '추가' : '삭제'}</span>
                <span className="act-log-actor">{l.actor_name}</span>
                <span className="act-log-target">{l.person_name}</span>
              </div>
            ))}
          </div>
          <AdminPager current={current} total={totalPages} onChange={setPage} />
        </>
      )}
    </section>
  );
}

// ── Gemini 채팅 ───────────────────────────────────────────────────────────────
export function AdminChatSection() {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      const text = await callGemini(msg);
      setMessages(prev => [...prev, { role: 'ai', text }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', text: `오류: ${e instanceof Error ? e.message : '알 수 없음'}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  return (
    <section className="admin-section admin-chat-section">
      <h2>🤖 AI 채팅 (Gemini)</h2>
      <div className="admin-chat-messages">
        {messages.length === 0 && <p className="admin-chat-empty">메시지를 입력하세요.</p>}
        {messages.map((m, i) => (
          <div key={i} className={`admin-chat-bubble ${m.role}`}>
            <pre className="admin-chat-text">{m.text}</pre>
          </div>
        ))}
        {loading && (
          <div className="admin-chat-bubble ai">
            <span className="admin-chat-typing">●●●</span>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="admin-chat-input-row">
        <textarea
          className="admin-chat-input"
          rows={2}
          placeholder="메시지 입력..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
          }}
        />
        <button className="admin-chat-send" onClick={handleSend} disabled={!input.trim() || loading}>전송</button>
      </div>
    </section>
  );
}
