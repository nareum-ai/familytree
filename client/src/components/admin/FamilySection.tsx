import { useState } from 'react';
import { startImpersonation } from '../../lib/session';
import { deleteFamily, loadFamilyData, toggleFamilyStatus, type FamilyInfo } from '../../services/adminService';
import { exportFamilyToCSV, downloadCSV } from '../../utils/csvExport';
import { BulkUploadView } from '../BulkUploadView';
import { ConfirmDeleteModal } from './AdminModal';
import { AdminPager } from './AdminPager';
import { paginate } from '../../utils/paginate';

const PAGE_SIZE = 20;

interface Props {
  families: FamilyInfo[];
  loading: boolean;
  flash: (msg: string) => void;
  reload: () => void;
}

export function FamilySection({ families, loading, flash, reload }: Props) {
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<FamilyInfo | null>(null);
  const [bulkTarget, setBulkTarget] = useState<{ id: string; rootName: string } | 'new' | null>(null);

  // 관리자 "가족 보기": 루트 인물 시점, 회원 권한 없이 전체 공개
  const handleEnter = (fam: FamilyInfo) => {
    startImpersonation({
      userName: fam.rootName,
      familyId: fam.familyId,
      personId: fam.rootPersonId,
      memberId: null,   // 관리자 MEMBER_ID 오염 방지
    });
    window.location.reload();
  };

  const handleToggle = async (fam: FamilyInfo) => {
    await toggleFamilyStatus(fam.rootPersonId, !fam.disabled);
    flash(fam.disabled ? `✅ "${fam.rootName}" 활성화` : `🚫 "${fam.rootName}" 비활성화`);
    reload();
  };

  const handleExport = async (fam: FamilyInfo) => {
    const { persons, relationships } = await loadFamilyData(fam.familyId);
    downloadCSV(`${fam.rootName}_가계도.csv`, exportFamilyToCSV(persons, relationships));
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteFamily(confirmDelete.familyId);
    flash(`🗑️ "${confirmDelete.rootName}" 삭제`);
    setConfirmDelete(null);
    reload();
  };

  const filtered = families.filter(f => !filter || f.rootName.includes(filter));
  const { current, pageItems, totalPages } = paginate(filtered, page, PAGE_SIZE);

  return (
    <section className="admin-section">
      <div className="member-header">
        <h2>👨‍👩‍👧‍👦 가족집단 ({families.length}개)</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="member-search"
            type="text"
            value={filter}
            onChange={e => { setFilter(e.target.value); setPage(0); }}
            placeholder="이름 검색"
            style={{ width: 120 }}
          />
          <button className="btn-bulk-new" onClick={() => setBulkTarget('new')}>⬆ 새 가족 일괄 등록</button>
        </div>
      </div>
      {loading ? <p className="admin-empty">불러오는 중...</p> :
       filtered.length === 0 ? <p className="admin-empty">없음</p> : (
        <>
          <div className="admin-list">
            {pageItems.map(f => (
              <div key={f.familyId} className={`admin-fam-row ${f.disabled ? 'disabled' : ''}`}>
                <div className="fam-info">
                  <span className="fam-root">👤 {f.rootName}</span>
                  {f.disabled && <span className="fam-badge disabled-badge">비활성</span>}
                  <span className="fam-id">{f.personCount}명</span>
                </div>
                <div className="fam-actions">
                  <button className="btn-enter"   onClick={() => handleEnter(f)} disabled={f.disabled}>보기</button>
                  <button className="btn-export"  onClick={() => handleExport(f)} title="CSV 내보내기">⬇</button>
                  <button className="btn-upload"  onClick={() => setBulkTarget({ id: f.familyId, rootName: f.rootName })} title="일괄 등록">⬆</button>
                  <button className={f.disabled ? 'btn-enable' : 'btn-disable'} onClick={() => handleToggle(f)}>
                    {f.disabled ? '활성화' : '비활성화'}
                  </button>
                  <button className="btn-delete" onClick={() => setConfirmDelete(f)}>삭제</button>
                </div>
              </div>
            ))}
          </div>
          <AdminPager current={current} total={totalPages} onChange={setPage} />
        </>
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          title="⚠️ 가족집단 완전 삭제"
          confirmLabel="완전 삭제"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        >
          <strong>{confirmDelete.rootName}</strong> 가족집단의 모든 데이터가 영구 삭제됩니다.
          <span className="confirm-warn">되돌릴 수 없습니다.</span>
        </ConfirmDeleteModal>
      )}

      {bulkTarget !== null && (
        <BulkUploadView
          targetFamily={bulkTarget === 'new' ? undefined : bulkTarget}
          onClose={() => setBulkTarget(null)}
          onDone={reload}
        />
      )}
    </section>
  );
}
