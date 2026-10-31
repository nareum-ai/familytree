import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApprovalRequest, Member, PasswordResetRequest } from '../types';
import { getMemberId } from '../lib/session';
import { getMemberData } from '../lib/firestore';
import {
  listFamilies, listMembers, loadApprovalRequests, loadPasswordResetRequests, type FamilyInfo,
} from '../services/adminService';
import {
  ActivityLogSection, AdminChatSection, ApprovalSection, BroadcastSection, PasswordResetSection, TempUnlockSection,
} from './admin/AdminSections';
import { MemberSection } from './admin/MemberSection';
import { FamilySection } from './admin/FamilySection';
import { AdminPasswordModal, AlarmDiagModal, GoogleLinkModal, PushTimeModal } from './admin/AdminSettingsModals';
import './AdminView.css';
import { Icon } from './Icon';

const FLASH_MS = 3000;

type SettingsModal = 'google' | 'password' | 'alarm' | 'pushTime' | null;

interface AdminData {
  requests: ApprovalRequest[];
  families: FamilyInfo[];
  members: Member[];
  resetRequests: PasswordResetRequest[];
}

async function fetchAdminData(): Promise<AdminData> {
  const [requests, families, members, resetRequests] = await Promise.all([
    loadApprovalRequests(), listFamilies(), listMembers(), loadPasswordResetRequests(),
  ]);
  return { requests, families, members: members.filter(m => !m.is_admin), resetRequests };
}

interface Props { onLogout: () => void; }

export function AdminView({ onLogout }: Props) {
  const [requests, setRequests]           = useState<ApprovalRequest[]>([]);
  const [resetRequests, setResetRequests] = useState<PasswordResetRequest[]>([]);
  const [families, setFamilies] = useState<FamilyInfo[]>([]);
  const [members,  setMembers]  = useState<Member[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  const [settingsModal, setSettingsModal] = useState<SettingsModal>(null);
  const [adminGoogleEmail, setAdminGoogleEmail] = useState<string | null | undefined>(undefined);

  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showSettingsMenu) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node))
        setShowSettingsMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSettingsMenu]);

  const applyData = useCallback((data: AdminData) => {
    setRequests(data.requests);
    setFamilies(data.families);
    setMembers(data.members);
    setResetRequests(data.resetRequests);
    setLoading(false);
  }, []);

  const reload = useCallback(() => { fetchAdminData().then(applyData); }, [applyData]);

  useEffect(() => {
    fetchAdminData().then(applyData);
    // 관리자 구글 연동 상태 로드
    const memberId = getMemberId();
    if (memberId) {
      getMemberData(memberId).then(data => setAdminGoogleEmail((data?.google_email as string | null) ?? null));
    }
  }, [applyData]);

  const flash = useCallback((msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(''), FLASH_MS);
  }, []);

  return (
    <div className="admin-wrap">
      <div className="admin-header">
        <div className="admin-logo"><Icon name="shield" /> 관리자 패널</div>
        <div className="admin-header-right">
          {requests.length > 0 && (
            <span className="admin-pending-badge">{requests.length}건 승인 대기</span>
          )}
          <div className="admin-settings-wrap" ref={settingsRef}>
            <button className="admin-icon-btn" onClick={() => setShowSettingsMenu(v => !v)} title="설정"><Icon name="gear" /></button>
            {showSettingsMenu && (
              <div className="admin-settings-dropdown" onClick={() => setShowSettingsMenu(false)}>
                <button onClick={() => setSettingsModal('google')}>
                  <Icon name="link" /> 구글 연동{adminGoogleEmail ? ' ✓' : ''}
                </button>
                <button onClick={() => setSettingsModal('password')}><Icon name="key" /> 비밀번호 변경</button>
                <button onClick={() => setSettingsModal('alarm')}><Icon name="wrench" /> 알림 진단</button>
                <button onClick={() => setSettingsModal('pushTime')}><Icon name="bell" /> 알림 발송 시간</button>
              </div>
            )}
          </div>
          <button className="admin-logout" onClick={onLogout}>로그아웃</button>
        </div>
      </div>
      {actionMsg && <div className="admin-msg">{actionMsg}</div>}

      <div className="admin-body">
        <TempUnlockSection flash={flash} />
        {/* 승인 대기 — 최우선 */}
        <ApprovalSection requests={requests} loading={loading} flash={flash} reload={reload} />
        <MemberSection members={members} families={families} loading={loading} flash={flash} reload={reload} />
        <PasswordResetSection
          requests={resetRequests}
          onResolved={id => setResetRequests(prev => prev.filter(x => x.id !== id))}
          loading={loading}
          flash={flash}
        />
        <FamilySection families={families} loading={loading} flash={flash} reload={reload} />
        <BroadcastSection members={members} />
        <ActivityLogSection />
        <AdminChatSection />
      </div>

      {settingsModal === 'google' && (
        <GoogleLinkModal
          googleEmail={adminGoogleEmail}
          onChange={setAdminGoogleEmail}
          onClose={() => setSettingsModal(null)}
        />
      )}
      {settingsModal === 'password' && <AdminPasswordModal onClose={() => setSettingsModal(null)} />}
      {settingsModal === 'alarm'    && <AlarmDiagModal     onClose={() => setSettingsModal(null)} />}
      {settingsModal === 'pushTime' && <PushTimeModal      onClose={() => setSettingsModal(null)} />}
    </div>
  );
}
