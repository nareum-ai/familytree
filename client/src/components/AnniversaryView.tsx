import { useEffect, useMemo, useState } from 'react';
import { useFamilyStore } from '../store/familyStore';
import { classifyBranch, canSeeFull } from '../hooks/useTreeLayout';
import { buildAnniversaries, formatDate, type AnniversaryItem } from '../utils/anniversary';
import type { BranchType } from '../types';
import { LS } from '../lib/storageKeys';
import { NotifBlockedModal } from './NotifBlockedModal';
import { getInstallPrompt, triggerInstall } from '../lib/installPrompt';
import './AnniversaryView.css';
import './NotifBlockedModal.css';

interface PushPrefs {
  enabled: boolean;
  offsets: number[];
  maxChusu: number;
  enableBirthday: boolean;
  enableDeathDay: boolean;
}
const DEFAULT_PUSH: PushPrefs = { enabled: true, offsets: [0, 1, 3, 7], maxChusu: 6, enableBirthday: true, enableDeathDay: true };

interface Props {
  onClose: () => void;
}

function DayChip({ days }: { days: number }) {
  if (days === 0) return <span className="day-chip today">오늘</span>;
  if (days <= 7)  return <span className="day-chip soon">D-{days}</span>;
  if (days <= 30) return <span className="day-chip near">D-{days}</span>;
  return <span className="day-chip far">D-{days}</span>;
}

function AnniversaryRow({
  item, onClick,
}: {
  item: AnniversaryItem;
  onClick: () => void;
}) {
  const countLabel = item.type === '생일'
    ? `만 ${item.count}세`
    : item.type === '결혼기념일'
      ? `${item.count}주년`
      : `${item.count}주기`;
  const chusuLabel = item.type === '결혼기념일'
    ? ''
    : (item.relationLabel ?? (item.chusu != null ? `${item.chusu}촌` : ''));

  return (
    <div
      className={`ann-row clickable ${item.type === '기일' ? 'memorial' : ''} ${item.type === '결혼기념일' ? 'wedding' : ''}`}
      onClick={onClick}
    >
      <DayChip days={item.daysUntil} />
      <div className="ann-info">
        <span className="ann-name">{item.personName}</span>
        {chusuLabel && <span className="ann-chusu">{chusuLabel}</span>}
        <span className={`ann-type ${item.type === '기일' ? 'memorial' : item.type === '결혼기념일' ? 'wedding' : 'birthday'}`}>
          {item.type}
        </span>
      </div>
      <div className="ann-date">
        <span className="ann-date-main">
          {item.isLunar && item.solarConverted
            ? `${formatDate(item.nextSolarDate)} (음 ${item.lunarMonthDay})`
            : item.isLunar
              ? `음 ${item.lunarMonthDay}`
              : formatDate(item.nextSolarDate)
          }
        </span>
        <span className="ann-count">{countLabel}</span>
      </div>
    </div>
  );
}

export function AnniversaryView({ onClose }: Props) {
  const { persons, relationships, viewpointPersonId, requestFocus, grantedPersonIds } = useFamilyStore();
  const root       = persons.find(p => p.is_root === 1);
  const mePersonId = viewpointPersonId ?? root?.id;
  const currentUserName = localStorage.getItem('familyTreeAccountName')
    ?? localStorage.getItem('familyTreeUser');
  const [items, setItems] = useState<AnniversaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdminContext =
    localStorage.getItem(LS.IS_ADMIN) === 'true' ||
    localStorage.getItem(LS.ADMIN_RETURN) === 'true';
  const hasPersonId = !!localStorage.getItem(LS.MY_PERSON_ID);

  const [mode, setMode] = useState<'list' | 'settings'>('list');
  const [pushPrefs, setPushPrefs]     = useState<PushPrefs>(DEFAULT_PUSH);
  const [pushLoading, setPushLoading] = useState(true);
  const [pushSaving, setPushSaving]   = useState(false);
  const [pushSaveMsg, setPushSaveMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showNotifBlocked, setShowNotifBlocked] = useState(false);
  const notifDenied = typeof Notification !== 'undefined' && Notification.permission === 'denied';

  const handleInstall = async () => {
    await triggerInstall();
  };

  // 뷰포인트 접근 가능 브랜치
  const accessibleBranches = useMemo((): BranchType[] => {
    const root = persons.find(p => p.is_root === 1);
    const viewpoint = viewpointPersonId ? persons.find(p => p.id === viewpointPersonId) : null;
    if (!root || !viewpoint || viewpoint.id === root.id) return ['친가', '외가', '처가', '처외가'];
    const hasSpouse = relationships.some(
      r => r.type === 'spouse' &&
        (r.person1_id === viewpoint.id || r.person2_id === viewpoint.id)
    );
    return hasSpouse ? ['친가', '외가', '처가', '처외가'] : ['친가', '외가'];
  }, [persons, relationships, viewpointPersonId]);

  // 볼 수 있는 사람만
  const visiblePersons = useMemo(() =>
    persons.filter(p => {
      const branches = classifyBranch(p.id, persons, relationships);
      if (!branches.some(b => (accessibleBranches as string[]).includes(b))) return false;
      // 비공개 노드는 기념일에서 제외
      return canSeeFull(p, currentUserName, viewpointPersonId, root, grantedPersonIds, relationships);
    }),
  [persons, relationships, accessibleBranches, currentUserName, viewpointPersonId, root, grantedPersonIds]);

  // 촌수 계산 기준: 뷰포인트 인물 (없으면 root)
  const chusuBasePerson = mePersonId ? persons.find(p => p.id === mePersonId) : root;

  useEffect(() => {
    setLoading(true);
    buildAnniversaries(visiblePersons, relationships, chusuBasePerson, persons).then(result => {
      setItems(result);
      setLoading(false);
    });
  }, [visiblePersons, relationships, chusuBasePerson?.id]);

  useEffect(() => {
    const memberId = localStorage.getItem(LS.MEMBER_ID);
    if (!memberId || isAdminContext || !hasPersonId) { setPushLoading(false); return; }
    (async () => {
      const { getDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const snap = await getDoc(doc(db, 'members', memberId));
      const pp = snap.data()?.push_prefs as Partial<PushPrefs> | undefined;
      if (pp) {
        setPushPrefs({
          enabled:        pp.enabled !== false,
          offsets:        Array.isArray(pp.offsets) ? pp.offsets : DEFAULT_PUSH.offsets,
          maxChusu:       typeof pp.maxChusu === 'number' ? pp.maxChusu : DEFAULT_PUSH.maxChusu,
          enableBirthday: pp.enableBirthday !== false,
          enableDeathDay: pp.enableDeathDay !== false,
        });
      }
      setPushLoading(false);
    })();
  }, []);

  const savePushPrefs = async () => {
    setPushSaving(true);
    setPushSaveMsg(null);
    try {
      const memberId = localStorage.getItem(LS.MEMBER_ID);
      if (!memberId) return;
      const { updateDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      await updateDoc(doc(db, 'members', memberId), { push_prefs: pushPrefs });
      setPushSaveMsg({ ok: true, msg: '저장됐습니다.' });
    } catch {
      setPushSaveMsg({ ok: false, msg: '저장 중 오류가 발생했습니다.' });
    } finally {
      setPushSaving(false);
      setTimeout(() => setPushSaveMsg(null), 2000);
    }
  };

  // 항목 클릭 → 트리에서 포커스
  const handleClick = (item: AnniversaryItem) => {
    const focusId = item.personId;
    const branches = classifyBranch(focusId, persons, relationships);
    const targetBranch =
      branches.find(b => (accessibleBranches as string[]).includes(b)) ??
      (branches[0] as BranchType);
    if (targetBranch) {
      requestFocus(focusId, targetBranch);
      onClose();
    }
  };

  const upcoming = items.filter(i => i.daysUntil <= 90);
  const later    = items.filter(i => i.daysUntil > 90);

  return (
    <>
    <div className="ann-backdrop" onClick={onClose}>
      <div className="ann-panel" onClick={e => e.stopPropagation()}>
        <div className="ann-header">
          <h2>{mode === 'settings' ? '🔔 알림 설정' : '📅 다가오는 기념일'}</h2>
          <div className="ann-header-actions">
            {!isAdminContext && hasPersonId && mode === 'list' && (
              <button
                className={`ann-settings-btn ${notifDenied ? 'blocked' : ''}`}
                onClick={() => notifDenied ? setShowNotifBlocked(true) : setMode('settings')}
                title={notifDenied ? '알림이 차단되어 있어요' : '알림 설정'}
              >
                {notifDenied ? '🔕' : '🔔'}
              </button>
            )}
            <button className="ann-close" onClick={mode === 'settings' ? () => setMode('list') : onClose}>
              {mode === 'settings' ? '←' : '✕'}
            </button>
          </div>
        </div>

        {mode === 'settings' ? (
          pushLoading ? <p className="ann-empty">불러오는 중...</p> : (
            <div className="ann-list ann-push-section">
              <div className="ann-push-row ann-push-toggle-row">
                <span className="ann-push-label">알림 사용</span>
                <button
                  className={`ann-push-toggle ${pushPrefs.enabled ? 'on' : ''}`}
                  onClick={async () => {
                    const turningOn = !pushPrefs.enabled;
                    if (turningOn && Notification.permission !== 'granted') {
                      if (Notification.permission === 'denied') {
                        setShowNotifBlocked(true);
                        return;
                      }
                      const result = await Notification.requestPermission();
                      if (result !== 'granted') return;
                    }
                    setPushPrefs(p => ({ ...p, enabled: !p.enabled }));
                  }}>
                  {pushPrefs.enabled ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="ann-push-group">
                <span className="ann-push-label">알림 시기</span>
                <div className="ann-push-chips">
                  {([0, 1, 3, 7] as const).map(day => (
                    <label key={day} className={`ann-push-chip ${pushPrefs.offsets.includes(day) ? 'on' : ''} ${!pushPrefs.enabled ? 'dim' : ''}`}>
                      <input type="checkbox" disabled={!pushPrefs.enabled}
                        checked={pushPrefs.offsets.includes(day)}
                        onChange={e => {
                          const next = e.target.checked
                            ? [...pushPrefs.offsets, day].sort((a, b) => a - b)
                            : pushPrefs.offsets.filter(d => d !== day);
                          setPushPrefs(p => ({ ...p, offsets: next }));
                        }} />
                      {day === 0 ? '당일' : `${day}일 전`}
                    </label>
                  ))}
                </div>
              </div>

              <div className="ann-push-row">
                <span className="ann-push-label">촌수 범위</span>
                <select className="ann-push-select" value={pushPrefs.maxChusu}
                  disabled={!pushPrefs.enabled}
                  onChange={e => setPushPrefs(p => ({ ...p, maxChusu: Number(e.target.value) }))}>
                  {[3,4,5,6,7,8].map(n => (
                    <option key={n} value={n}>{n}촌 이내</option>
                  ))}
                </select>
              </div>

              <div className="ann-push-group">
                <span className="ann-push-label">알림 종류</span>
                <div className="ann-push-chips">
                  <label className={`ann-push-chip ${pushPrefs.enableBirthday ? 'on' : ''} ${!pushPrefs.enabled ? 'dim' : ''}`}>
                    <input type="checkbox" disabled={!pushPrefs.enabled}
                      checked={pushPrefs.enableBirthday}
                      onChange={e => setPushPrefs(p => ({ ...p, enableBirthday: e.target.checked }))} />
                    🎂 생일
                  </label>
                  <label className={`ann-push-chip ${pushPrefs.enableDeathDay ? 'on' : ''} ${!pushPrefs.enabled ? 'dim' : ''}`}>
                    <input type="checkbox" disabled={!pushPrefs.enabled}
                      checked={pushPrefs.enableDeathDay}
                      onChange={e => setPushPrefs(p => ({ ...p, enableDeathDay: e.target.checked }))} />
                    🕯️ 기일
                  </label>
                </div>
              </div>

              {pushSaveMsg && (
                <p className={`ann-push-msg ${pushSaveMsg.ok ? 'ok' : 'err'}`}>{pushSaveMsg.msg}</p>
              )}
              <button className="ann-push-save-btn" onClick={savePushPrefs} disabled={pushSaving}>
                {pushSaving ? '저장 중...' : '저장'}
              </button>

            </div>
          )
        ) : (
          loading ? (
            <p className="ann-empty">불러오는 중...</p>
          ) : items.length === 0 ? (
            <p className="ann-empty">생년월일 또는 기일이 입력된 가족이 없습니다.</p>
          ) : (
            <div className="ann-list">
              {upcoming.length > 0 && (
                <>
                  <div className="ann-section-label">90일 이내</div>
                  {upcoming.map(item => (
                    <AnniversaryRow key={`${item.relationshipId ?? item.personId}-${item.type}`} item={item} onClick={() => handleClick(item)} />
                  ))}
                </>
              )}
              {later.length > 0 && (
                <>
                  <div className="ann-section-label">이후 ({later.length}건)</div>
                  {later.map(item => (
                    <AnniversaryRow key={`${item.relationshipId ?? item.personId}-${item.type}`} item={item} onClick={() => handleClick(item)} />
                  ))}
                </>
              )}
            </div>
          )
        )}
      </div>
    </div>
    {showNotifBlocked && <NotifBlockedModal onClose={() => setShowNotifBlocked(false)} onInstall={getInstallPrompt() ? handleInstall : undefined} />}
    </>
  );
}
