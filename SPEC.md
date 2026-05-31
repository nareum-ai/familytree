# 우리 가족 가계도 — 프로그램 명세서

**버전**: 1.3.0  
**최초 작성**: 2026-05-31  
**플랫폼**: Firebase Hosting (SPA) + PWA  
**URL**: https://familytree-3221b.web.app  
**Firebase 프로젝트**: `familytree-3221b`

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [프로젝트 구조](#3-프로젝트-구조)
4. [데이터 모델](#4-데이터-모델)
5. [Firestore 컬렉션](#5-firestore-컬렉션)
6. [인증 및 권한 모델](#6-인증-및-권한-모델)
7. [핵심 알고리즘](#7-핵심-알고리즘)
8. [컴포넌트 구조](#8-컴포넌트-구조)
9. [상태 관리 (Zustand Store)](#9-상태-관리-zustand-store)
10. [유틸리티](#10-유틸리티)
11. [화면 흐름 (라우팅)](#11-화면-흐름-라우팅)
12. [CSV 대량 업로드 / 내보내기](#12-csv-대량-업로드--내보내기)
13. [배포 구성](#13-배포-구성)
14. [보안 고려사항](#14-보안-고려사항)
15. [알려진 제한 사항](#15-알려진-제한-사항)

---

## 1. 프로젝트 개요

**우리 가족 가계도**는 한국 가족 관계를 시각적으로 관리하는 웹 애플리케이션입니다.

### 핵심 목표

- 친가·외가·처가·처외가 4개 계통을 탭으로 구분하여 시각적으로 표현
- 가족 구성원별 계정 연결 및 프라이버시 보호
- 생일·기일 기념일 자동 알림 (음력 지원)
- 초대 링크를 통한 가족 온보딩
- CSV 기반 대량 데이터 등록 및 내보내기
- Google OAuth를 통한 소셜 로그인

### 주요 사용자 시나리오

| 시나리오 | 설명 |
|----------|------|
| 가족 트리 생성 | 관리자 승인 후 본인을 root로 트리 개설 |
| CSV 일괄 등록 | 관리자가 CSV 파일로 가족 트리 전체를 한번에 등록 |
| 가족 초대 | 인물 노드 → 초대 링크 생성 → 카카오톡 등 공유 |
| 비공개 정보 요청 | 잠긴 노드 클릭 → 권한자에게 요청 → 양방향 승인 |
| 1촌 자동 공개 | 부모·자녀(1촌)는 정보공개 요청 없이 자동 열람 |
| 기념일 확인 | 📅 버튼 → 가까운 순 생일/기일 목록 |
| 구글 로그인 | 구글 계정으로 간편 로그인 / 비밀번호 분실 대체 |
| 관리자 대리 접속 | 관리자가 특정 회원 계정으로 바로 접속 |

---

## 2. 기술 스택

### Frontend

| 분류 | 라이브러리 | 버전 | 용도 |
|------|-----------|------|------|
| UI 프레임워크 | React | 19.2.6 | 컴포넌트 기반 UI |
| 빌드 도구 | Vite | 8.0.12 | 번들링, 개발 서버 |
| 언어 | TypeScript | ~6.0.2 | 타입 안전성 |
| 상태 관리 | Zustand | 5.0.14 | 전역 상태 |
| 트리 렌더링 | @xyflow/react | 12.10.2 | 노드·엣지 그래프 |
| 레이아웃 | dagre | 0.8.5 | 방향성 그래프 배치 |
| 음력 변환 | solarlunar | 3.1.0 | 음력↔양력 날짜 변환 |

### Backend / 인프라

| 분류 | 서비스 | 용도 |
|------|--------|------|
| 데이터베이스 | Firebase Firestore | 실시간 NoSQL DB |
| 호스팅 | Firebase Hosting | SPA 정적 배포 |
| 인증 | Firebase Auth (Google OAuth) + 자체 구현 (Firestore + SHA-256) | 계정 관리 |

---

## 3. 프로젝트 구조

```
FamilyTree/
├── client/                         # React 프론트엔드
│   ├── src/
│   │   ├── components/             # UI 컴포넌트
│   │   │   ├── GoogleLinkScreen.tsx/css  # 구글 계정 연결 화면
│   │   │   └── ...
│   │   ├── hooks/
│   │   │   └── useTreeLayout.ts    # 트리 레이아웃 엔진 + canSeeFull
│   │   ├── store/
│   │   │   └── familyStore.ts      # Zustand 전역 스토어
│   │   ├── utils/
│   │   │   ├── anniversary.ts
│   │   │   ├── csvExport.ts
│   │   │   ├── csvImport.ts
│   │   │   ├── relationLabel.ts
│   │   │   ├── nameParser.ts
│   │   │   ├── crypto.ts
│   │   │   └── age.ts
│   │   ├── types/
│   │   │   ├── index.ts
│   │   │   └── permissions.ts
│   │   ├── lib/
│   │   │   ├── firebase.ts         # Firebase 초기화 (Auth 포함)
│   │   │   └── storageKeys.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   │   └── favicon.svg             # 나무 모양 파비콘
│   ├── index.html                  # 타이틀: 우리 가족 가계도
│   └── ...
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── .firebaserc                     # project: familytree-3221b
└── SPEC.md
```

---

## 4. 데이터 모델

### Person (인물)

```typescript
interface Person {
  id: string;
  name: string;
  last_name: string;
  first_name: string;
  gender: 'male' | 'female' | null;
  birth_date: string | null;
  birth_lunar: boolean;
  birth_year: number | null;
  is_root: number;
  is_deceased: boolean;
  death_date: string | null;
  death_lunar: boolean;
  photo_url: string | null;
  created_by: string | null;
  family_id: string;
  permissions: PersonPermissions;
  created_at: string;
  // 부가 연락처 정보
  phone?: string | null;
  email?: string | null;
  memo?: string | null;
}
```

### Relationship (관계)

```typescript
interface Relationship {
  id: string;
  person1_id: string;
  person2_id: string;
  type: 'spouse' | 'parent_child';
  family_id: string;
}
```

### Member (계정)

```typescript
interface Member {
  id: string;
  username: string;
  password_hash: string;       // SHA-256(salt + password), 구글 전용 계정은 ''
  person_id: string | null;
  family_id: string | null;
  person_name: string | null;
  is_admin: boolean;
  status: 'active' | 'suspended';
  created_at: string;
  google_uid?: string | null;   // Firebase Auth UID
  google_email?: string | null;
}
```

---

## 5. Firestore 컬렉션

| 컬렉션 | 설명 | 주요 쿼리 |
|--------|------|-----------|
| `persons` | 인물 데이터 | `where family_id ==` |
| `relationships` | 관계 엣지 | `where family_id ==` |
| `members` | 계정 | `where username ==`, `where google_uid ==` |
| `invites` | 초대 토큰 | `where token ==` |
| `approval_requests` | 트리 개설 신청 | `where status == 'pending'` |
| `info_requests` | 정보공개 요청 | `where holder_member_id ==` |
| `info_access` | 승인된 정보 접근권 | `where requester_member_id ==` |
| `person_access_pairs` | 양방향 접근 합의 | `where person_a_id ==` |

---

## 6. 인증 및 권한 모델

### 로그인 방식

| 방식 | 설명 |
|------|------|
| 아이디/비밀번호 | SHA-256 클라이언트 해싱, Firestore members 조회 |
| Google OAuth | Firebase Auth `signInWithPopup`, `google_uid`로 members 매칭 |

### Google 로그인 흐름

```
구글 팝업 → google_uid로 members 조회
  ↓ 계정 있음 → 바로 로그인
  ↓ 계정 없음 (초대 컨텍스트 있음) → 새 계정 생성 → InviteVerifyScreen
  ↓ 계정 없음 (초대 없음) → GoogleLinkScreen
      → "기존 계정 연결" (아이디+비밀번호 1회 입력) → google_uid 저장
      → "처음 시작하기" → 새 계정 생성 → 가족그룹 신청 플로우
```

### 세션 관리

| 키 | 저장소 | 내용 |
|----|--------|------|
| `familyTreeUser` | localStorage | 인물 이름 |
| `familyTreeFamilyId` | localStorage | 가족 UUID |
| `familyTreeMemberId` | localStorage | 계정 document ID |
| `familyTreeAccountName` | localStorage | 로그인 아이디 |
| `familyTreeIsAdmin` | localStorage | 관리자 플래그 |
| `familyTreeAdminReturn` | localStorage | 관리자 가족뷰 복귀 상태 |
| `familyTreeGoogleEmail` | localStorage | 연결된 구글 이메일 |
| `viewpointPersonId` | sessionStorage | 현재 뷰포인트 인물 ID |

### 가시성 규칙 (`canSeeFull`)

아래 조건 중 하나라도 충족하면 전체 정보 열람:

1. `person.created_by === currentUserAccountName`
2. `person.id === viewpointPersonId`
3. `person.id === root.id` (root 소유자)
4. `grantedPersonIds.has(person.id)`
5. **getChusu(person.id, viewpoint, relationships) === 1** ← 1촌 자동 공개

### 정보공개 요청 자동 승인 규칙

| 권한자 | 동작 |
|--------|------|
| 해당 인물 매핑 회원 | 대기 요청 생성 → 상대 승인 필요 |
| created_by = 일반 회원 | 대기 요청 생성 → 상대 승인 필요 |
| created_by = 관리자 | **즉시 자동 승인** |
| 권한자 없음 | **즉시 자동 승인** |

### 편집 권한 (`canEdit` in PersonDetail)

| 조건 | 편집 버튼 |
|------|-----------|
| 내 노드 (viewpointPersonId 일치) | 표시 |
| 내가 만든 노드 (created_by 일치) | 표시 |
| 관리자 생성 + 미매핑 | 표시 |
| 다른 사람에게 매핑된 노드 | 숨김 |

### 계정 역할

| 역할 | 조건 | 권한 |
|------|------|------|
| 관리자 | `is_admin: true` | AdminView 전체, 대리 접속, CSV 업로드/내보내기 |
| 일반 회원 | `person_id` 연결됨 | 가족 트리 편집, 초대, 기념일·검색 |
| 미매핑 회원 | `person_id: null` | 가족 트리 개설 신청만 가능 |

---

## 7. 핵심 알고리즘

### 7.1 가계 계통 분류 (`classifyBranch`)

Root 부부 기준 4개 계통 BFS 탐색.

```
친가 (paternal)   : root의 아버지 쪽
외가 (maternal)   : root의 어머니 쪽
처가 (spouse-pat) : root 배우자의 아버지 쪽
처외가(spouse-mat): root 배우자의 어머니 쪽
```

### 7.2 촌수 계산 (`getChusu`)

BFS 그래프 거리. **배우자 = 0 hop**.

### 7.3 세대 계산 (`getGeneration`)

부모-자녀 관계만 사용하는 방향성 BFS.

### 7.4 트리 레이아웃 (`useTreeLayout`)

1. 뷰포인트 기준 세대 필터링 (상 4대 / 하 3대)
2. 부부를 `CoupleNode`로 묶음
3. 서브트리 너비 재귀 계산 → X 좌표
4. 형제 정렬: 생년월일 오름차순

### 7.5 한국어 관계명 (`getRelationLabel`)

세대 거리 + 직계 여부 + 성별 조합.

### 7.6 인명 파싱 (`parseKoreanName`)

복성 처리 (남궁, 선우, 황보 등).

### 7.7 삭제 안전 검사

삭제 대상 제거 후 가상 그래프에서 root 도달 가능성 BFS 검사.

---

## 8. 컴포넌트 구조

```
App.tsx (라우팅·인증 허브)
├── LoginScreen              로그인 (아이디/비밀번호 + Google)
├── RegisterScreen           회원가입
├── GoogleLinkScreen         구글 계정 연결/새로 시작 선택 화면
├── InvitePage               /invite/:token 랜딩
│   └── InviteVerifyScreen   이름 검증
├── FamilyGroupRequestScreen 가족 트리 개설 신청
├── NewFamilyRequestView     개설 승인 대기
├── AdminView                관리자 대시보드 (대리 접속 포함)
│   └── BulkUploadView       CSV 일괄 업로드 (EUC-KR/UTF-8 자동 감지)
└── Main Layout
    ├── FamilyTreeView        트리 캔버스
    │   ├── CoupleNode
    │   │   └── PersonNode
    │   ├── PersonDetail      인물 상세·편집 (연락처 포함, canEdit 적용)
    │   │   └── DateInput
    │   ├── AddPersonModal
    │   └── InfoRequestPanel  정보공개 요청 (자동 승인 지원)
    ├── AnniversaryView       기념일 목록
    ├── SearchView            인물 검색
    ├── MyMenuView            My 메뉴 (정보공개 요청 / 비밀번호 / 구글 연결)
    └── HelpView              사용 안내
```

---

## 9. 상태 관리 (Zustand Store)

### 주요 함수 (인증 관련)

| 함수 | 설명 |
|------|------|
| `loginMember` | 아이디/비밀번호 로그인 |
| `registerMember` | 일반 회원가입 |
| `loginWithGoogle` | 구글 팝업 인증 → member 조회 |
| `registerWithGoogle` | 구글 전용 신규 계정 생성 |
| `linkGoogleToMember` | 기존 계정에 google_uid 연결 |
| `unlinkGoogleFromMember` | google_uid 연결 해제 |
| `createInfoRequest` | 정보공개 요청 (관리자 생성 노드 자동 승인) |

---

## 10. 유틸리티

### csvImport.ts

- 파일 인코딩 자동 감지: UTF-8(BOM 포함) → EUC-KR 폴백

### 기타

| 파일 | 주요 함수 |
|------|-----------|
| `crypto.ts` | `hashPassword(pw)` — SHA-256 |
| `age.ts` | `getManAge(birthDate)` |
| `nameParser.ts` | `parseKoreanName(name)` |
| `relationLabel.ts` | `getRelationLabel(...)` |

---

## 11. 화면 흐름 (라우팅)

```
접속
 ├─ /invite/:token  ──────────────────────────────► InvitePage
 │
 │   로그인 없음
 ├──────────────────────────────────────────────► LoginScreen
 │                                                  (아이디/비밀번호 or Google)
 │   구글 로그인 → 계정 없음 + 초대 컨텍스트
 ├──────────────────────────────────────────────► InviteVerifyScreen
 │
 │   구글 로그인 → 계정 없음 + 초대 없음
 ├──────────────────────────────────────────────► GoogleLinkScreen
 │
 │   isAdmin=true
 ├──────────────────────────────────────────────► AdminView
 │
 │   showFamilyGroupRequest=true
 ├──────────────────────────────────────────────► FamilyGroupRequestScreen
 │
 └── 정상 로그인 ────────────────────────────────► Main App
```

---

## 12. CSV 대량 업로드 / 내보내기

### 인코딩 처리

```
파일 읽기 시:
1. ArrayBuffer로 읽기
2. UTF-8 (fatal:true) 디코딩 시도
3. 실패 시 EUC-KR 폴백
→ 한국 Excel 기본 저장 형식 자동 지원
```

### CSV 포맷

```
ref, name, gender, birth_date, birth_lunar, is_root,
is_deceased, death_date, death_lunar, father_ref, mother_ref, spouse_ref
```

---

## 13. 배포 구성

### Firebase 프로젝트

- **Project ID**: `familytree-3221b`
- **Hosting URL**: https://familytree-3221b.web.app

### 배포 명령

```bash
npm run deploy
# 내부: cd client && npm run build && firebase deploy --only hosting
```

### Firebase Console 수동 설정 필요

- Authentication → Google 프로바이더 활성화

---

## 14. 보안 고려사항

| 항목 | 현황 |
|------|------|
| Firestore rules | `allow read, write: if true` (가족 내 신뢰 환경 가정) |
| 비밀번호 | SHA-256 클라이언트 해싱 |
| Google OAuth | Firebase Auth 표준 방식 |
| 초대 토큰 | UUID v4, 30일 만료 |
| 세션 | localStorage (영구) |
| HTTPS | Firebase Hosting 기본 제공 |

---

## 15. 알려진 제한 사항

| # | 항목 | 내용 |
|---|------|------|
| 1 | 권한 시스템 | `PersonPermissions` 정의 완료, role-based 편집 권한 미구현 |
| 2 | 사진 업로드 | `photo_url` 필드 존재, 업로드 UI 미구현 |
| 3 | 비밀번호 찾기 | 구글 계정 미연결 시 자체 리셋 불가 — 관리자 문의 필요 |
| 4 | 동시 편집 충돌 | 실시간 동기화로 기본 처리, 충돌 해결 로직 없음 |
| 5 | CSV 복수 배우자 | 배우자 1명만 지원 |
| 6 | 가족 병합 자동화 | 수동 CSV 편집으로 가능, 전용 merge UI 미구현 |

---

*v1.0.0 — 2026-05-31 최초 작성*  
*v1.1.0 — 2026-05-31 server/ 제거, CSV 업로드/내보내기 추가*  
*v1.2.0 — 2026-05-31 Google OAuth, 모바일 UX, 인물 연락처, 편집 권한, 1촌 자동 공개, 프로젝트 이전(familytree-3221b)*  
*v1.3.0 — 2026-05-31 PWA 설치, 웹 푸시 알림(PWA 전용), 기념일 알림(D-7/3/1/당일, 6촌이내, 양음력), 관리자 접속 로그, 디자인 전면 개편(인디고 테마, Pretendard)*
