import { useEffect, useState } from 'react';
import type { Member } from '../../types';
import { startImpersonation } from '../../lib/session';
import { mapMemberToPerson } from '../../services/authService';
import {
  deleteMember, loadLoginLogs, searchPersonsByName,
  type FamilyInfo, type LoginLog, type PersonSearchResult,
} from '../../services/adminService';
import { formatCompactDateTime } from '../../utils/date';
import { describeUserAgent, isMobileUserAgent } from '../../utils/userAgent';
import { AdminModal, ConfirmDeleteModal } from './AdminModal';
import { AdminPager } from './AdminPager';
import { paginate } from '../../utils/paginate';

const PAGE_SIZE = 25;

interface Props {
  members: Member[];
  families: FamilyInfo[];
  loading: boolean;
  flash: (msg: string) => void;
  reload: () => void;
}

// 최종 접속일 내림차순 (미접속은 뒤로)
function byLastLoginDesc(a: Member, b: Member) {
  if (!a.last_login_at && !b.last_login_at) return 0;
  if (!a.last_login_at) return 1;
  if (!b.last_login_at) return -1;
  return b.last_login_at.localeCompare(a.last_login_at);
}

export function MemberSection({ members, families, loading, flash, reload }: Props) {
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const [mappingMember, setMappingMember] = useState<Member | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Member | null>(null);
  const [logMember, setLogMember] = useState<Member | null>(null);

  const googleEmails = members.filter(m => m.google_email).map(m => m.google_email!);

  const handleCopyEmails = async () => {
    if (!googleEmails.length) { flash('이메일 정보가 없습니다.'); return; }
    await navigator.clipboard.writeText(googleEmails.join('\n'));
    flash(`📋 이메일 ${googleEmails.length}개 복사됨`);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteMember(confirmDelete.id);
    flash(`🗑️ "${confirmDelete.username}" 계정 삭제됨`);
    setConfirmDelete(null);
    reload();
  };

  const handleLoginAs = (m: Member) => {
    if (!m.family_id || !m.person_id) {
      flash('⚠️ 가족 또는 인물이 매핑되지 않은 계정입니다.');
      return;
    }
    startImpersonation({
      userName: m.person_name ?? m.username,
      familyId: m.family_id,
      personId: m.person_id,
      memberId: m.id,
      accountName: m.username,
    });
    window.location.reload();
  };

  const q = filter.toLowerCase();
  const filtered = members
    .filter(m => !filter || m.username.toLowerCase().includes(q) || (m.person_name ?? '').includes(filter))
    .sort(byLastLoginDesc);
  const { current, pageItems, totalPages } = paginate(filtered, page, PAGE_SIZE);

  return (
    <section className="admin-section">
      <div className="member-header">
        <h2>👤 회원 관리 ({members.length}명)</h2>
        <div className="member-header-right">
          <button className="btn-copy-emails" onClick={handleCopyEmails}
            title="Google 계정 이메일 목록을 클립보드에 복사">
            📋 이메일 복사 ({googleEmails.length})
          </button>
          <input
            className="member-search"
            type="text"
            value={filter}
            onChange={e => { setFilter(e.target.value); setPage(0); }}
            placeholder="아이디 / 이름 검색"
          />
        </div>
      </div>

      {loading ? <p className="admin-empty">불러오는 중...</p> :
       members.length === 0 ? <p className="admin-empty">가입된 회원이 없습니다.</p> : (
        <>
          <div className="member-table-head">
            <span className="col-idx">#</span>
            <span className="col-id">아이디</span>
            <span className="col-map">매핑 인물</span>
            <span className="col-login">최종 접속</span>
            <span className="col-actions">관리</span>
          </div>

          <div className="admin-list member-list">
            {pageItems.map((m, idx) => (
              <div key={m.id} className="admin-member-row">
                <span className="col-idx">{current * PAGE_SIZE + idx + 1}</span>
                <span className="col-id member-id">{m.username}</span>
                <span className="col-map">
                  {m.person_name
                    ? <span className="member-mapped">✓ {m.person_name}</span>
                    : <span className="member-unmapped">미매핑</span>}
                </span>
                <span className="col-login member-date">
                  {m.last_login_at
                    ? <button className="btn-log" onClick={() => setLogMember(m)}>
                        {formatCompactDateTime(m.last_login_at)}
                      </button>
                    : <span style={{ color: '#ccc' }}>미접속</span>}
                </span>
                <span className="col-actions">
                  {m.family_id && m.person_id && (
                    <button className="btn-login-as" onClick={() => handleLoginAs(m)}>접속</button>
                  )}
                  <button className="btn-map-sm" onClick={() => setMappingMember(m)}>
                    {m.person_name ? '재매핑' : '매핑'}
                  </button>
                  <button className="btn-del-member" onClick={() => setConfirmDelete(m)}>삭제</button>
                </span>
              </div>
            ))}
          </div>

          <AdminPager current={current} total={totalPages} onChange={setPage} />
        </>
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          title="⚠️ 계정 삭제"
          confirmLabel="삭제"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        >
          <strong>{confirmDelete.username}</strong> 계정을 삭제합니다.
          <span className="confirm-warn">로그인 기록이 영구 삭제됩니다.</span>
        </ConfirmDeleteModal>
      )}

      {mappingMember && (
        <MemberMappingModal
          member={mappingMember}
          members={members}
          families={families}
          onMapped={(person) => {
            flash(`✅ "${mappingMember.username}" → "${person.name}" 매핑 완료`);
            setMappingMember(null);
            reload();
          }}
          onClose={() => setMappingMember(null)}
        />
      )}

      {logMember && <LoginLogModal member={logMember} onClose={() => setLogMember(null)} />}
    </section>
  );
}

// ── 회원 ↔ 인물 매핑 ─────────────────────────────────────────────────────────
function MemberMappingModal({ member, members, families, onMapped, onClose }: {
  member: Member;
  members: Member[];
  families: FamilyInfo[];
  onMapped: (person: PersonSearchResult) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonSearchResult[]>([]);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    // 이미 다른 계정에 매핑된 인물은 제외 (매핑 중인 회원 자신 제외)
    const mappedPersonIds = new Set(
      members
        .filter(m => m.id !== member.id)
        .map(m => m.person_id)
        .filter((id): id is string => id !== null)
    );
    try {
      setResults(await searchPersonsByName(q, mappedPersonIds));
    } catch { /* silent */ }
  };

  const handleMap = async (person: PersonSearchResult) => {
    await mapMemberToPerson(member.id, person.id, person.familyId, person.name);
    onMapped(person);
  };

  return (
    <AdminModal onClose={onClose} className="mapping-box">
      <h3>👤 사람 매핑</h3>
      <p><strong>{member.username}</strong> 회원을 트리의 누구와 연결할까요?</p>
      <div className="map-search-row">
        <input
          className="map-search-input"
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="이름으로 검색"
          autoFocus
        />
        <button className="map-search-btn" onClick={handleSearch}>검색</button>
      </div>
      {results.length > 0 && (
        <div className="map-results">
          {results.map(p => {
            const famName = families.find(f => f.familyId === p.familyId)?.rootName;
            return (
              <div
                key={p.id}
                className={`map-result-row ${p.deceased ? 'map-result-deceased' : ''}`}
                onClick={() => !p.deceased && handleMap(p)}
                title={p.deceased ? '사망자는 매핑할 수 없습니다' : ''}
              >
                <span className="map-result-name">
                  {p.name}
                  {p.deceased && <span className="deceased-tag"> (고인)</span>}
                </span>
                <span className="map-result-fid">
                  {famName ? `${famName} 가족` : p.familyId.slice(0, 8)}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {results.length === 0 && query && <p className="admin-empty">검색 결과 없음</p>}
      <button className="btn-cancel-confirm" style={{ marginTop: 12, width: '100%' }} onClick={onClose}>취소</button>
    </AdminModal>
  );
}

// ── 접속 로그 ─────────────────────────────────────────────────────────────────
function LoginLogModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const [logs, setLogs] = useState<LoginLog[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLoginLogs(member.id)
      .catch(() => [])
      .then(result => { if (!cancelled) setLogs(result); });
    return () => { cancelled = true; };
  }, [member.id]);

  return (
    <AdminModal onClose={onClose} className="log-box">
      <div className="log-header">
        <h3>📋 {member.username} 접속 로그</h3>
        <button className="log-close-btn" onClick={onClose}>✕</button>
      </div>
      {logs === null ? (
        <p className="admin-empty">불러오는 중...</p>
      ) : logs.length === 0 ? (
        <p className="admin-empty">접속 기록이 없습니다.</p>
      ) : (
        <div className="log-list">
          {logs.map((l, i) => (
            <div key={l.id} className="log-row">
              <span className="log-num">{i + 1}</span>
              <span className="log-date">{formatCompactDateTime(l.logged_in_at)}</span>
              <span className="log-device">
                {isMobileUserAgent(l.user_agent) ? '📱' : '💻'} {describeUserAgent(l.user_agent)}
              </span>
            </div>
          ))}
        </div>
      )}
    </AdminModal>
  );
}
