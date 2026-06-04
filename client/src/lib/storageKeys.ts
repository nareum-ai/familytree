/** localStorage / sessionStorage 키 중앙 관리 */

// 관리자 PWA 모드: 'adm_' prefix로 일반 사용자 세션과 완전 분리
let _adminMode = false;
export function setAdminPWAMode(on: boolean) { _adminMode = on; }

const BASE_LS = {
  USER_NAME:    'familyTreeUser',
  FAMILY_ID:    'familyTreeFamilyId',
  IS_ADMIN:     'familyTreeIsAdmin',
  ADMIN_RETURN: 'familyTreeAdminReturn',
  MEMBER_ID:    'familyTreeMemberId',
  MY_PERSON_ID: 'familyTreeMyPersonId',
  ACCOUNT_NAME: 'familyTreeAccountName',
  GOOGLE_EMAIL:    'familyTreeGoogleEmail',
  FCM_TOKEN_SAVED:      'familyTreeFcmTokenSaved',
  PENDING_INVITE_TOKEN: 'familyTreePendingInviteToken',
} as const;

type LSKey = keyof typeof BASE_LS;

// Proxy: 접근 시점에 prefix 결정 → 기존 코드 변경 불필요
export const LS = new Proxy(BASE_LS as { [K in LSKey]: string }, {
  get(_, key: string) {
    const base = BASE_LS[key as LSKey];
    if (!base) return undefined;
    return _adminMode ? `adm_${base}` : base;
  },
});

export const SS = {
  VIEWPOINT_PERSON_ID: 'viewpointPersonId',
  INVITE_TOKEN:        'inviteToken',
  INVITE_PERSON_ID:    'invitePersonId',
  INVITE_PERSON_NAME:  'invitePersonName',
  INVITE_FAMILY_ID:    'inviteFamilyId',
} as const;
