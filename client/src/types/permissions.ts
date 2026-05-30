// ─── 권한 역할 정의 ────────────────────────────────────────────────────────────
// anyone    : 누구나
// authorized: 권한획득자 (초대 링크 등으로 허가된 사람)
// self      : 본인 (해당 노드의 실제 인물)
// creator   : 노드 작성자 (처음 이 노드를 만든 사람)
// admin     : 어드민
export type PermissionRole = 'anyone' | 'authorized' | 'self' | 'creator' | 'admin';

export type PermissionAction = 'view' | 'update' | 'delete';

export interface PersonPermissions {
  view:   PermissionRole;
  update: PermissionRole;
  delete: PermissionRole;
}

// 현재 기본값: 전체 허용 (나중에 조정)
export const DEFAULT_PERMISSIONS: PersonPermissions = {
  view:   'anyone',
  update: 'anyone',
  delete: 'anyone',
};

// 역할 강도 순서 (낮을수록 더 넓은 허용) — 미래 canPerform 구현 시 사용
export const ROLE_RANK: Record<PermissionRole, number> = {
  anyone:     0,
  authorized: 1,
  self:       2,
  creator:    3,
  admin:      4,
};

export interface CurrentUser {
  name: string | null;         // localStorage 이름 (나중에 uid로 대체)
  isAdmin: boolean;
  viewpointPersonId: string | null; // 현재 보고 있는 인물 ID (본인 판별용)
}

/**
 * 현재 사용자가 특정 action을 수행할 수 있는지 확인.
 * 지금은 항상 true — 나중에 아래 주석 로직으로 교체.
 */
export function canPerform(
  _action: PermissionAction,
  _personCreatedBy: string | null,
  _personName: string,
  _required: PermissionRole,
  _currentUser: CurrentUser,
): boolean {
  // ── 현재: 전부 허용 ──────────────────────────────────────────────────────────
  return true;

  // ── 미래 구현 예시 (주석 해제 후 사용) ─────────────────────────────────────
  // if (_required === 'anyone') return true;
  // if (_currentUser.isAdmin) return true;  // admin은 항상 통과
  //
  // const userRank = getUserRank(_action, _personCreatedBy, _personName, _currentUser);
  // return userRank <= ROLE_RANK[_required];
}

// function getUserRank(...): number {
//   if (currentUser.isAdmin) return ROLE_RANK['admin'];
//   if (currentUser.name === personCreatedBy) return ROLE_RANK['creator'];
//   if (currentUser.viewpointPersonId && matchesSelf) return ROLE_RANK['self'];
//   if (hasAuthorization) return ROLE_RANK['authorized'];
//   return ROLE_RANK['anyone'];
// }
