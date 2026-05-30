/** localStorage / sessionStorage 키 중앙 관리 */
export const LS = {
  USER_NAME:    'familyTreeUser',       // 매핑된 인물명 (표시/뷰포인트)
  FAMILY_ID:    'familyTreeFamilyId',
  IS_ADMIN:     'familyTreeIsAdmin',
  ADMIN_RETURN: 'familyTreeAdminReturn',
  MEMBER_ID:    'familyTreeMemberId',
  ACCOUNT_NAME: 'familyTreeAccountName', // 계정 아이디 (created_by 비교용)
} as const;

export const SS = {
  VIEWPOINT_PERSON_ID: 'viewpointPersonId',
  INVITE_TOKEN:        'inviteToken',
  INVITE_PERSON_ID:    'invitePersonId',
  INVITE_PERSON_NAME:  'invitePersonName',
  INVITE_FAMILY_ID:    'inviteFamilyId',
} as const;
