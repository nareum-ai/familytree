import type { PersonPermissions } from './permissions';

export interface Person {
  id: string;
  name: string;
  birth_year: number | null;
  birth_date: string | null;
  birth_lunar: boolean;
  gender: 'male' | 'female' | null;
  photo_url: string | null;
  is_root: number;
  is_deceased: boolean;
  death_date: string | null;
  death_lunar: boolean;
  created_by: string | null;
  permissions: PersonPermissions;
  family_id: string;   // 가족집단 식별자 ('main' 또는 UUID)
  last_name: string;   // 성 (자동 파싱)
  first_name: string;  // 이름 (자동 파싱)
  created_at: string;
  phone?: string | null;
  email?: string | null;
  memo?: string | null;
}

export type RelationshipType = 'spouse' | 'parent_child';

export interface Relationship {
  id: string;
  person1_id: string;
  person2_id: string;
  type: RelationshipType;
  family_id: string;   // 가족집단 식별자
  marriage_date?: string | null;   // "YYYY-MM-DD", spouse 관계에만 해당
  marriage_lunar?: boolean;
}

export type BranchType = '친가' | '외가' | '처가' | '처외가';

export type AddRelationType =
  | 'father'
  | 'mother'
  | 'spouse'
  | 'child'
  | 'sibling';

// 회원 계정
export interface Member {
  id: string;
  username: string;
  password_hash: string;
  person_id: string | null;
  family_id: string | null;
  person_name: string | null;
  is_admin: boolean;
  status: 'active' | 'suspended';
  created_at: string;
  google_uid?: string | null;
  google_email?: string | null;
  fcm_token?: string | null;
  last_login_at?: string | null;
}

// 비밀번호 초기화 토큰
export interface PasswordResetToken {
  id: string;
  member_id: string;
  token: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

// 관리자 경유 비밀번호 초기화 요청
export interface PasswordResetRequest {
  id: string;
  username: string;
  person_name: string | null;
  status: 'pending' | 'approved' | 'rejected';
  contact_email: string;
  message?: string | null;
  created_at: string;
  reviewed_at?: string;
}

// 새 가족집단 생성 승인 요청
export interface ApprovalRequest {
  id: string;
  requested_name: string;
  status: 'pending' | 'approved' | 'rejected';
  family_id?: string;
  // 계정 기반 신청 시 추가 필드
  member_id?: string;
  member_username?: string;
  description?: string;
  gender?: 'male' | 'female';
  birth_date?: string | null;
  birth_lunar?: boolean;
  created_at: string;
  reviewed_at?: string;
}
