// anyone    : 누구나
// authorized: 권한획득자 (초대 링크 등으로 허가된 사람)
// self      : 본인 (해당 노드의 실제 인물)
// creator   : 노드 작성자 (처음 이 노드를 만든 사람)
// admin     : 어드민
export type PermissionRole = 'anyone' | 'authorized' | 'self' | 'creator' | 'admin';

export interface PersonPermissions {
  view:   PermissionRole;
  update: PermissionRole;
  delete: PermissionRole;
}

export const DEFAULT_PERMISSIONS: PersonPermissions = {
  view:   'anyone',
  update: 'anyone',
  delete: 'anyone',
};
