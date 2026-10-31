import { useEffect, useMemo, useState } from 'react';
import { useFamilyStore } from '../store/familyStore';
import { useVisiblePersons } from '../hooks/useVisiblePersons';
import { classifyBranch, getChusuBase } from '../utils/familyGraph';
import { buildAnniversaries, formatDate, type AnniversaryItem } from '../utils/anniversary';
import { LS } from '../lib/storageKeys';
import { getMemberId, getMyPersonId, isAdminContext as checkAdminContext } from '../lib/session';
import { getMemberData, updateMember } from '../lib/firestore';
import { enablePushOnDevice, isDeviceRegistered, notificationPermission, setPushEnabled } from '../lib/pushNotifications';
import { NotifBlockedModal } from './NotifBlockedModal';
import './AnniversaryView.css';
import './NotifBlockedModal.css';
import { Icon } from './Icon';
import type { Person } from '../types';

interface PushPrefs {
  enabled: boolean;
  offsets: number[];
  maxChusu: number;
  enableBirthday: boolean;
  enableDeathDay: boolean;
}
const DEFAULT_PUSH: PushPrefs = { enabled: true, offsets: [0, 1, 3, 7], maxChusu: 6, enableBirthday: true, enableDeathDay: true };

function toPushPrefs(pp: Partial<PushPrefs>): PushPrefs {
  return {
    enabled:        pp.enabled !== false,
    offsets:        Array.isArray(pp.offsets) ? pp.offsets : DEFAULT_PUSH.offsets,
    maxChusu:       typeof pp.maxChusu === 'number' ? pp.maxChusu : DEFAULT_PUSH.maxChusu,
    enableBirthday: pp.enableBirthday !== false,
    enableDeathDay: pp.enableDeathDay !== false,
  };
}

interface Props {
  onClose: () => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function annTitle(item: AnniversaryItem): string {
  return `${item.personName} ${item.type}`;
}

/** 관계, 음력 날짜, 나이·주년 — 있는 것만 쉼표로 잇는다 */
function annDetail(item: AnniversaryItem): string {
  const relation = item.type === '결혼기념일'
    ? ''
    : (item.relationLabel ?? (item.chusu != null ? `${item.chusu}촌` : ''));
  let lunar = '';
  if (item.isLunar && item.lunarMonthDay) {
    const [m, d] = item.lunarMonthDay.split('.');
    lunar = d ? `음력 ${m}월 ${d}일` : `음력 ${item.lunarMonthDay}`;
  }
  const count = item.count == null ? ''
    : item.type === '생일' ? `만 ${item.count}세`
    : item.type === '결혼기념일' ? `${item.count}주년`
    : `${item.count}주기`;
  return [relation, lunar, count].filter(Boolean).join(', ');
}

function AnnAvatar({ person, size }: { person?: Person; size: 'md' | 'lg' }) {
  const tone = !person ? '' : person.is_deceased ? 'deceased' : person.gender === 'male' ? 'male' : 'female';
  return (
    <span className={`ann-avatar ${size} ${tone}`}>
      {person?.photo_url
        ? <img src={person.photo_url} alt="" />
        : <span className="ann-avatar-initial">{person?.name?.[0] ?? '?'}</span>}
    </span>
  );
}

function AnniversaryRow({
  item, person, onClick,
}: {
  item: AnniversaryItem;
  person?: Person;
  onClick: () => void;
}) {
  const d = item.nextSolarDate;
  const wd = WEEKDAYS[d.getDay()];
  return (
    <button
      type="button"
      className={`ann-row ${item.type === '기일' ? 'memorial' : ''}`}
      onClick={onClick}
    >
      <span className={`ann-day ${d.getDay() === 0 ? 'sun' : ''}`}>
        <span className="ann-day-num">{d.getDate()}</span>
        <span className="ann-day-wd">{wd}</span>
      </span>
      <AnnAvatar person={person} size="md" />
      <span className="ann-info">
        <span className="ann-name">{annTitle(item)}</span>
        <span className="ann-detail">{annDetail(item)}</span>
      </span>
      <span className="ann-dday">D-{item.daysUntil}</span>
    </button>
  );
}

function TodayCard({ item, person, onClick }: { item: AnniversaryItem; person?: Person; onClick: () => void }) {
  const d = item.nextSolarDate;
  return (
    <button type="button" className="ann-today-card" onClick={onClick}>
      <AnnAvatar person={person} size="lg" />
      <span className="ann-info">
        <span className="ann-today-label">오늘, {formatDate(d)} {WEEKDAYS[d.getDay()]}요일</span>
        <span className="ann-today-title">{annTitle(item)}</span>
        <span className="ann-detail">{annDetail(item)}</span>
      </span>
    </button>
  );
}

/** 오늘 이후 항목을 양력 날짜의 연·월로 묶는다 (items는 가까운 순) */
function groupByMonth(items: AnniversaryItem[]) {
  const thisYear = new Date().getFullYear();
  const groups: { key: string; label: string; items: AnniversaryItem[] }[] = [];
  for (const item of items) {
    const d = item.nextSolarDate;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      const label = d.getFullYear() === thisYear ? `${d.getMonth() + 1}월` : `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
      g = { key, label, items: [] };
      groups.push(g);
    }
    g.items.push(item);
  }
  return groups;
}

export function AnniversaryView({ onClose }: Props) {
  const { persons, relationships, viewpointPersonId, accessibleBranches, visiblePersons } = useVisiblePersons();
  const requestFocus = useFamilyStore(s => s.requestFocus);

  const isAdminContext = checkAdminContext();
  const hasPersonId = !!getMyPersonId();
  const memberId = getMemberId();
  const canUsePush = !!memberId && !isAdminContext && hasPersonId;

  const [mode, setMode] = useState<'list' | 'settings'>('list');
  const [pushPrefs, setPushPrefs]     = useState<PushPrefs>(DEFAULT_PUSH);
  const [pushLoading, setPushLoading] = useState(canUsePush);
  const [pushSaving, setPushSaving]   = useState(false);
  const [pushSaveMsg, setPushSaveMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showNotifBlocked, setShowNotifBlocked] = useState(false);
  const [notifTestPrompt, setNotifTestPrompt] = useState(false);
  const [pushToggleLoading, setPushToggleLoading] = useState(false);
  // 설정값(enabled)이 켜져 있어도 이 기기에 권한·토큰이 없으면 실제로는 못 받는다 → 화면에는 OFF로 보여준다
  const [deviceReady, setDeviceReady] = useState(isDeviceRegistered);
  const pushOn = pushPrefs.enabled && deviceReady;
  const [confirmedBlocked, setConfirmedBlocked] = useState(
    localStorage.getItem(LS.NOTIF_CONFIRMED_BLOCKED) === 'true'
  );
  const notifDenied = confirmedBlocked
    || (typeof Notification !== 'undefined' && Notification.permission === 'denied');

  // 촌수 계산 기준: 뷰포인트 인물 (없으면 root)
  const chusuBaseId = getChusuBase(persons, viewpointPersonId)?.id;

  // 기념일 목록은 비동기(음력 변환)로 계산 — 입력이 바뀌면 이전 결과는 버린다
  const annInput = useMemo(
    () => ({ visiblePersons, relationships, chusuBaseId }),
    [visiblePersons, relationships, chusuBaseId]
  );
  const [annResult, setAnnResult] = useState<{ input: typeof annInput; items: AnniversaryItem[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const base = persons.find(p => p.id === annInput.chusuBaseId);
    buildAnniversaries(annInput.visiblePersons, annInput.relationships, base).then(items => {
      if (!cancelled) setAnnResult({ input: annInput, items });
    });
    return () => { cancelled = true; };
  }, [annInput, persons]);
  const loading = annResult?.input !== annInput;
  const items = annResult?.items ?? [];

  useEffect(() => {
    if (!canUsePush || !memberId) return;
    getMemberData(memberId).then(data => {
      const pp = data?.push_prefs as Partial<PushPrefs> | undefined;
      if (pp) setPushPrefs(toPushPrefs(pp));
      setPushLoading(false);
    });
  }, [canUsePush, memberId]);

  const savePushPrefs = async () => {
    setPushSaving(true);
    setPushSaveMsg(null);
    try {
      if (!memberId) return;
      await updateMember(memberId, { push_prefs: pushPrefs });
      setPushSaveMsg({ ok: true, msg: '저장됐습니다.' });
    } catch {
      setPushSaveMsg({ ok: false, msg: '저장 중 오류가 발생했습니다.' });
    } finally {
      setPushSaving(false);
      setTimeout(() => setPushSaveMsg(null), 2000);
    }
  };

  const handlePushToggle = async () => {
    if (pushToggleLoading) return;
    if (pushOn) {
      setPushPrefs(p => ({ ...p, enabled: false }));
      return;
    }
    // iOS 브라우저(홈 화면 미추가)는 Notification API 자체가 없다 → 설치 안내
    if (typeof Notification === 'undefined' || Notification.permission === 'denied') {
      setShowNotifBlocked(true);
      return;
    }
    setPushToggleLoading(true);
    try {
      const { granted, testShown } = await enablePushOnDevice(memberId);
      if (!granted) {
        if (notificationPermission() === 'denied') setShowNotifBlocked(true);
        return;
      }
      setDeviceReady(isDeviceRegistered());
      if (testShown) setNotifTestPrompt(true);
      setPushPrefs(p => ({ ...p, enabled: true }));
      if (memberId) await setPushEnabled(memberId, true).catch(() => {});
    } finally {
      setPushToggleLoading(false);
    }
  };

  // 테스트 알림이 실제로는 안 보였다고 답한 경우 — 꺼진 게 사실이므로 토글도 OFF로 되돌리고 차단 상태를 기억해 둔다
  const handleNotifTestFailed = async () => {
    setNotifTestPrompt(false);
    setConfirmedBlocked(true);
    localStorage.setItem(LS.NOTIF_CONFIRMED_BLOCKED, 'true');
    setShowNotifBlocked(true);
    setPushPrefs(p => ({ ...p, enabled: false }));
    if (!memberId) return;
    await setPushEnabled(memberId, false).catch(() => {});
  };

  // 항목 클릭 → 트리에서 포커스
  const handleClick = (item: AnniversaryItem) => {
    const branches = classifyBranch(item.personId, persons, relationships);
    const targetBranch = branches.find(b => accessibleBranches.includes(b)) ?? branches[0];
    if (targetBranch) {
      requestFocus(item.personId, targetBranch);
      onClose();
    }
  };

  const personById = useMemo(() => new Map(persons.map(p => [p.id, p])), [persons]);
  const todayItems = items.filter(i => i.daysUntil === 0);
  const monthGroups = groupByMonth(items.filter(i => i.daysUntil > 0));
  const itemKey = (item: AnniversaryItem) => `${item.relationshipId ?? item.personId}-${item.type}`;

  return (
    <>
    <div className="ann-backdrop" onClick={onClose}>
      <div className="ann-panel" onClick={e => e.stopPropagation()}>
        <div className="ann-header">
          <h2>{mode === 'settings' ? '알림 설정' : '다가오는 기념일'}</h2>
          <div className="ann-header-actions">
            {!isAdminContext && hasPersonId && mode === 'list' && (
              // 아이콘만 있으면 무엇인지 알아보기 어려워 상태를 글자로 함께 보여준다
              // (꺼짐: 강조색 "알림 받기" / 켜짐: 차분한 "알림 켜짐" / 차단: 빨간 "알림 차단됨")
              <button
                className={`ann-settings-btn ${notifDenied ? 'blocked' : pushOn ? 'on' : 'off'}`}
                onClick={() => notifDenied ? setShowNotifBlocked(true) : setMode('settings')}
                title={notifDenied ? '알림이 차단되어 있어요' : '알림 설정'}
              >
                {notifDenied ? <Icon name="bell-off" /> : <Icon name="bell" />}
                <span>{notifDenied ? '알림 차단됨' : pushLoading ? '알림' : pushOn ? '알림 켜짐' : '알림 받기'}</span>
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
                  className={`ann-push-toggle ${pushOn ? 'on' : ''}`}
                  onClick={handlePushToggle}
                  disabled={pushToggleLoading}>
                  {pushToggleLoading ? '...' : pushOn ? 'ON' : 'OFF'}
                </button>
              </div>
              {notifTestPrompt && (
                <div className="ann-notif-test-prompt">
                  <p className="ann-notif-test-q">방금 테스트 알림이 화면에 떴나요?</p>
                  <div className="ann-notif-test-actions">
                    <button
                      type="button"
                      className="ann-notif-test-yes"
                      onClick={() => {
                        setNotifTestPrompt(false);
                        setConfirmedBlocked(false);
                        localStorage.removeItem(LS.NOTIF_CONFIRMED_BLOCKED);
                      }}
                    >
                      네, 보였어요
                    </button>
                    <button
                      type="button"
                      className="ann-notif-test-no"
                      onClick={handleNotifTestFailed}
                    >
                      아니요, 안 보여요
                    </button>
                  </div>
                </div>
              )}

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
                    <Icon name="cake" /> 생일
                  </label>
                  <label className={`ann-push-chip ${pushPrefs.enableDeathDay ? 'on' : ''} ${!pushPrefs.enabled ? 'dim' : ''}`}>
                    <input type="checkbox" disabled={!pushPrefs.enabled}
                      checked={pushPrefs.enableDeathDay}
                      onChange={e => setPushPrefs(p => ({ ...p, enableDeathDay: e.target.checked }))} />
                    <Icon name="candle" /> 기일
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
              {todayItems.map(item => (
                <TodayCard key={itemKey(item)} item={item} person={personById.get(item.personId)} onClick={() => handleClick(item)} />
              ))}
              {monthGroups.map(g => (
                <section key={g.key} className="ann-month">
                  <h3 className="ann-month-title">{g.label}<span className="ann-month-count">{g.items.length}건</span></h3>
                  <div className="ann-group">
                    {g.items.map(item => (
                      <AnniversaryRow key={itemKey(item)} item={item} person={personById.get(item.personId)} onClick={() => handleClick(item)} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )
        )}
      </div>
    </div>
    {showNotifBlocked && <NotifBlockedModal onClose={() => setShowNotifBlocked(false)} />}
    </>
  );
}
