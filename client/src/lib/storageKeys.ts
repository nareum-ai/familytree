/** localStorage / sessionStorage 키 중앙 관리 */
export const LS = {
  USER_NAME:    'familyTreeUser',
  FAMILY_ID:    'familyTreeFamilyId',
  IS_ADMIN:     'familyTreeIsAdmin',
  ADMIN_RETURN: 'familyTreeAdminReturn',
  MEMBER_ID:    'familyTreeMemberId',
  ACCOUNT_NAME: 'familyTreeAccountName',
  GOOGLE_EMAIL: 'familyTreeGoogleEmail',
} as const;

export const SS = {
  VIEWPOINT_PERSON_ID: 'viewpointPersonId',
  INVITE_TOKEN:        'inviteToken',
  INVITE_PERSON_ID:    'invitePersonId',
  INVITE_PERSON_NAME:  'invitePersonName',
  INVITE_FAMILY_ID:    'inviteFamilyId',
} as const;
