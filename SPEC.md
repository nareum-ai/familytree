# 우리 가족 가계도 — 프로그램 명세서

**버전**: 1.0.0  
**최초 작성**: 2026-05-31  
**플랫폼**: Firebase Hosting (SPA)  
**URL**: https://famliytree-dfb80.web.app

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
12. [배포 구성](#12-배포-구성)
13. [보안 고려사항](#13-보안-고려사항)
14. [알려진 제한 사항](#14-알려진-제한-사항)

---

## 1. 프로젝트 개요

**우리 가족 가계도**는 한국 가족 관계를 시각적으로 관리하는 웹 애플리케이션입니다.

### 핵심 목표

- 친가·외가·처가·처외가 4개 계통을 탭으로 구분하여 시각적으로 표현
- 가족 구성원별 계정 연결 및 프라이버시 보호
- 생일·기일 기념일 자동 알림 (음력 지원)
- 초대 링크를 통한 가족 온보딩

### 주요 사용자 시나리오

| 시나리오 | 설명 |
|----------|------|
| 가족 트리 생성 | 관리자 승인 후 본인을 root로 트리 개설 |
| 가족 초대 | 인물 노드 → 초대 링크 생성 → 카카오톡 등 공유 |
| 비공개 정보 요청 | 잠긴 노드 클릭 → 권한자에게 요청 → 양방향 승인 |
| 기념일 확인 | 📅 버튼 → 가까운 순 생일/기일 목록 |
| 뷰포인트 전환 | 로그인한 구성원 기준으로 촌수·관계명 재계산 |

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
| 인증 | 자체 구현 (Firestore + SHA-256) | 계정 관리 |

> **Note**: `server/` 폴더(Express + SQLite)는 초기 프로토타입 잔재로, 현재 사용되지 않습니다.

---

## 3. 프로젝트 구조

```
FamilyTree/
├── client/                         # React 프론트엔드
│   ├── src/
│   │   ├── components/             # UI 컴포넌트 (18개)
│   │   ├── hooks/
│   │   │   └── useTreeLayout.ts    # 트리 레이아웃 엔진
│   │   ├── store/
│   │   │   └── familyStore.ts      # Zustand 전역 스토어
│   │   ├── utils/
│   │   │   ├── anniversary.ts      # 기념일 계산
│   │   │   ├── relationLabel.ts    # 한국어 관계명 생성
│   │   │   ├── nameParser.ts       # 한국 인명 파싱
│   │   │   ├── crypto.ts           # 비밀번호 해싱
│   │   │   └── age.ts              # 나이 계산
│   │   ├── types/
│   │   │   ├── index.ts            # 핵심 타입 정의
│   │   │   └── permissions.ts      # 권한 타입
│   │   ├── lib/
│   │   │   ├── firebase.ts         # Firebase 초기화
│   │   │   └── storageKeys.ts      # localStorage/sessionStorage 키 상수
│   │   ├── App.tsx                 # 루트 컴포넌트, 라우팅
│   │   └── main.tsx
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── server/                         # 미사용 (프로토타입 잔재)
├── firebase.json                   # Firebase 호스팅·Firestore 설정
├── firestore.rules                 # Firestore 보안 규칙
├── firestore.indexes.json          # 복합 인덱스 정의
├── .firebaserc                     # Firebase 프로젝트 연결
└── SPEC.md                         # 이 문서
```

---

## 4. 데이터 모델

### Person (인물)

```typescript
interface Person {
  id: string;               // Firestore document ID
  name: string;             // 전체 이름 (예: "홍길동")
  last_name: string;        // 자동 파싱 성 (예: "홍")
  first_name: string;       // 자동 파싱 이름 (예: "길동")
  gender: 'male' | 'female' | null;
  birth_date: string | null;  // "YYYY-MM-DD"
  birth_lunar: boolean;       // 음력 여부
  birth_year: number | null;  // 연도만 알 때
  is_root: number;            // 1 = 트리 기준인물, 0 = 일반
  is_deceased: boolean;
  death_date: string | null;  // "YYYY-MM-DD"
  death_lunar: boolean;
  photo_url: string | null;
  created_by: string | null;  // 생성자 계정 ID (username)
  family_id: string;          // UUID (또는 레거시 'main')
  permissions: PersonPermissions;
  created_at: string;         // ISO 8601
}
```

### Relationship (관계)

```typescript
interface Relationship {
  id: string;
  person1_id: string;
  person2_id: string;
  type: 'spouse' | 'parent_child';
  // parent_child: person1 = 부모, person2 = 자녀
  family_id: string;
}
```

### Member (계정)

```typescript
interface Member {
  id: string;
  username: string;           // 로그인 아이디
  password_hash: string;      // SHA-256(salt + password)
  person_id: string | null;   // 연결된 인물 노드 ID
  family_id: string | null;   // 소속 가족 ID
  person_name: string | null; // 캐시된 인물 이름
  is_admin: boolean;
  status: 'active' | 'suspended';
  created_at: string;
}
```

### ApprovalRequest (가족 트리 개설 신청)

```typescript
interface ApprovalRequest {
  id: string;
  requested_name: string;       // 신청자 실명
  member_id: string;            // 신청 계정 ID
  member_username: string;
  description: string;          // 자기소개
  gender: 'male' | 'female';
  birth_date: string | null;
  birth_lunar: boolean;
  status: 'pending' | 'approved' | 'rejected';
  family_id?: string;           // 승인 후 할당
  created_at: string;
  reviewed_at?: string;
}
```

---

## 5. Firestore 컬렉션

| 컬렉션 | 설명 | 주요 쿼리 |
|--------|------|-----------|
| `persons` | 인물 데이터 | `where family_id ==` |
| `relationships` | 관계 엣지 | `where family_id ==` |
| `members` | 계정 | `where username ==`, `where person_id ==` |
| `invites` | 초대 토큰 | `where token ==` |
| `approval_requests` | 트리 개설 신청 | `where status == 'pending'` |
| `info_requests` | 정보공개 요청 | `where holder_member_id ==`, `where status == 'pending'` |
| `info_access` | 승인된 정보 접근권 | `where requester_member_id ==` |
| `person_access_pairs` | 양방향 접근 합의 | `where person_a_id ==`, `where person_b_id ==` |

### 복합 인덱스

```json
[
  { "collection": "persons",           "fields": ["family_id ASC", "is_root ASC"] },
  { "collection": "approval_requests", "fields": ["status ASC", "created_at DESC"] }
]
```

### 정보공개 요청 흐름

```
[Joon 요청]
  → info_requests 생성
      requester_member_id: Joon's member ID
      requester_person_id: 홍준서's person ID   ← 양방향 핵심
      target_person_id:    전현숙's person ID
      holder_member_id:    Pibi's member ID

[Pibi 승인]
  → info_access 생성 (Joon → 전현숙)
  → person_access_pairs 생성 (홍준서 ↔ 전현숙)
  → 전현숙에 계정 있으면 즉시 info_access 생성 (전현숙 → 홍준서)

[Design이 전현숙에 매핑]
  → person_access_pairs 조회
  → 즉시 info_access 생성 (Design → 홍준서)
```

---

## 6. 인증 및 권한 모델

### 비밀번호 해싱

```
hash = SHA-256("famliytree-2024" + password)
```
> Web Crypto API(`SubtleCrypto`) 사용, 클라이언트 사이드 해싱

### 세션 관리 (localStorage / sessionStorage)

| 키 (LS.*) | 저장소 | 내용 |
|-----------|--------|------|
| `familyTreeUser` | localStorage | 인물 이름 (표시·뷰포인트) |
| `familyTreeFamilyId` | localStorage | 소속 가족 UUID |
| `familyTreeMemberId` | localStorage | 계정 document ID |
| `familyTreeAccountName` | localStorage | 로그인 아이디 (`created_by` 비교용) |
| `familyTreeIsAdmin` | localStorage | 관리자 플래그 |
| `familyTreeAdminReturn` | localStorage | 관리자가 가족 뷰로 전환한 상태 |
| `viewpointPersonId` | sessionStorage | 현재 뷰포인트 인물 ID |
| `invitePersonId/Name/FamilyId` | sessionStorage | 초대 링크 컨텍스트 (임시) |

### 가시성 규칙 (`canSeeFull`)

아래 조건 중 하나라도 충족하면 전체 정보 열람 가능:

1. `person.created_by === currentUserAccountName` — 본인이 생성한 노드
2. `person.id === viewpointPersonId` — 뷰포인트(본인) 노드
3. `person.id === root.id` — 트리 root 노드
4. `grantedPersonIds.has(person.id)` — 정보공개 승인을 받은 노드

충족하지 못하면 익명 처리 (이름만 표시, 🔒 아이콘).

### 계정 역할

| 역할 | 조건 | 권한 |
|------|------|------|
| 관리자 | `is_admin: true` | AdminView 전체 접근, 가족 삭제, 계정 관리 |
| 일반 회원 | `is_admin: false`, `person_id` 연결됨 | 본인 가족 트리 편집, 기념일·검색·초대 |
| 미매핑 회원 | `person_id: null` | 가족 트리 개설 신청만 가능 |

---

## 7. 핵심 알고리즘

### 7.1 가계 계통 분류 (`classifyBranch`)

Root 부부를 기준으로 4개 계통을 결정합니다.

```
친가 (paternal)   : root의 아버지 쪽
외가 (maternal)   : root의 어머니 쪽
처가 (spouse-pat) : root 배우자의 아버지 쪽
처외가(spouse-mat): root 배우자의 어머니 쪽
```

BFS로 각 계통 앵커에서 도달 가능한 인물을 탐색하되, **반대쪽 부모를 탐색 경계로 차단**하여 계통 오염을 방지합니다.

자녀 시점(뷰포인트가 root의 자녀인 경우):

```
친가 → 부계 (viewpoint의 아버지 쪽)
외가 → 모계 (viewpoint의 어머니 쪽)
처가 → 배우자 부계 (배우자의 아버지 쪽)
처외가 → 배우자 모계 (배우자의 어머니 쪽)
```

### 7.2 촌수 계산 (`getChusu`)

BFS를 이용한 그래프 거리 계산. **배우자 관계는 0 hop**으로 처리하여 부부가 같은 촌수로 계산됩니다.

```
나           = 0촌
부모/자녀    = 1촌
조부모/형제  = 2촌
증조부/삼촌  = 3촌
...
```

### 7.3 세대 계산 (`getGeneration`)

부모-자녀 관계만 사용하는 방향성 BFS. 양수 = 조상, 음수 = 후손.

```
할아버지 = +2
아버지   = +1
나       =  0
아들     = -1
손자     = -2
```

### 7.4 트리 레이아웃 (`useTreeLayout`)

1. 뷰포인트 기준 세대 필터링 (상 4대 / 하 3대)
2. 부부를 `CoupleNode`로 묶음
3. 서브트리 너비 재귀 계산으로 X 좌표 결정
4. 형제 정렬: 생년월일 오름차순
5. react-flow `Node[]` / `Edge[]` 반환

### 7.5 한국어 관계명 (`getRelationLabel`)

세대 거리 + 직계 여부 + 성별 조합으로 관계명 결정:

```
gen=0, self         → 나
gen=0, spouse       → 남편/아내
gen=+1, direct      → 아버지/어머니
gen=-1, direct      → 아들/딸
gen=+2, direct      → 할아버지/할머니
gen=-2, direct      → 손자/손녀
gen=0, sharedParent → 형/누나/오빠/언니/남동생/여동생
gen=+1, parentSib   → 삼촌/고모/이모/외삼촌
gen=-1, nibSib      → 조카/조카딸
gen=0, cousinCheck  → 사촌/여사촌
gen=+1, spouseParent→ 장인/장모/시아버지/시어머니
```

### 7.6 인명 파싱 (`parseKoreanName`)

복성 처리 (남궁, 선우, 황보, 제갈, 독고, 동방, 사공, 서문 등) 및 임시·미상 이름 특수 처리.

### 7.7 삭제 안전 검사

인물 삭제 시 root 도달 가능성 BFS 검사:
- 삭제 대상을 제거한 가상 그래프에서 연결된 인물들이 root에 도달 가능한지 확인
- 고아(orphan) 발생 시 삭제 차단, 선행 삭제 대상 이름 표시

---

## 8. 컴포넌트 구조

```
App.tsx (라우팅·인증 허브)
├── LoginScreen              로그인 폼
├── RegisterScreen           회원가입 폼
├── InvitePage               /invite/:token 랜딩
│   └── InviteVerifyScreen   이름 검증 (초대 매핑)
├── FamilyGroupRequestScreen 가족 트리 개설 신청
├── NewFamilyRequestView     개설 승인 대기 화면
├── AdminView                관리자 대시보드
└── Main Layout
    ├── FamilyTreeView        트리 캔버스 (탭·레이아웃)
    │   ├── CoupleNode        부부 헥사곤 쌍
    │   │   └── PersonNode    개인 헥사곤 노드
    │   ├── PersonDetail      인물 상세·편집 패널
    │   │   └── DateInput     날짜 입력 (음력 체크박스)
    │   ├── AddPersonModal    가족 추가 모달
    │   └── InfoRequestPanel  비공개 정보 요청 패널
    ├── AnniversaryView       기념일 목록 슬라이드 패널
    ├── SearchView            인물 검색 슬라이드 패널
    ├── MyMenuView            My 메뉴 (요청 관리·비밀번호)
    └── HelpView              사용 안내 아코디언 패널
```

---

## 9. 상태 관리 (Zustand Store)

`familyStore.ts` 단일 스토어. 주요 상태:

### 전역 상태

| 상태 | 타입 | 설명 |
|------|------|------|
| `persons` | `Person[]` | 현재 가족 인물 목록 (실시간 동기) |
| `relationships` | `Relationship[]` | 관계 목록 (실시간 동기) |
| `loading` | `boolean` | 초기 데이터 로드 여부 |
| `selectedPersonId` | `string \| null` | 선택된 인물 (상세 패널 표시용) |
| `viewpointPersonId` | `string \| null` | 뷰포인트 인물 ID |
| `currentFamilyId` | `string \| null` | 현재 로드된 가족 ID |
| `grantedPersonIds` | `Set<string>` | 정보공개 승인된 인물 ID 집합 |
| `infoRequestPersonId` | `string \| null` | InfoRequestPanel 대상 |
| `focusRequest` | `{personId, branchId} \| null` | 트리 포커스 이동 요청 |

### 초기화 (`init`)

Firestore `onSnapshot` 리스너 2개 등록:
1. `persons` 컬렉션 (`family_id ==` 필터)
2. `relationships` 컬렉션 (`family_id ==` 필터)

초기 로드 시 자동 보정:
- 이름 파싱 누락 보정 (`last_name`, `first_name`)
- 공통 자녀로 배우자 관계 추론
- 배우자 파트너에게 parent_child 엣지 전파

---

## 10. 유틸리티

### anniversary.ts

```typescript
buildAnniversaries(
  persons: Person[],
  relationships: Relationship[],
  chusuBasePerson?: Person   // 뷰포인트 기준 (없으면 is_root=1)
): Promise<AnniversaryItem[]>
```

- `solarlunar` 라이브러리 동적 임포트 (ESM 호환)
- 음력 날짜 → 올해 또는 내년 양력 날짜로 변환
- `daysUntil` 기준 오름차순 정렬
- 2촌 이하 인물에 관계명 태그 (`relationLabel`) 부착

### crypto.ts

```typescript
hashPassword(password: string): Promise<string>
// SHA-256("famliytree-2024" + password) → hex string
```

### age.ts

```typescript
getManAge(birthDate: string): number | null   // 만 나이
getAgeAtDeath(birthDate, deathDate): number | null
```

### nameParser.ts

```typescript
parseKoreanName(fullName: string): { lastName: string; firstName: string }
// 복성 목록 기반 파싱, 특수 이름 예외 처리
```

### relationLabel.ts

```typescript
getRelationLabel(
  targetId: string,
  base: Person,
  persons: Person[],
  rels: Relationship[]
): string
// 기본값 '동년배' / 'N세대 위/아래' (복잡한 경우 폴백)
```

---

## 11. 화면 흐름 (라우팅)

앱은 단일 페이지(SPA)로, URL path 및 localStorage 상태로 화면을 전환합니다.

```
접속
 ├─ /invite/:token  ──────────────────────────────► InvitePage
 │                                                     │
 │   로그인 없음                                         ▼
 ├─ needsLogin=true ──────────────────────────────► LoginScreen
 │                                                  (회원가입 링크)
 │   isAdmin=true                                   RegisterScreen
 ├──────────────────────────────────────────────► AdminView
 │
 │   showFamilyGroupRequest=true
 ├──────────────────────────────────────────────► FamilyGroupRequestScreen
 │
 │   pendingInviteMemberId 있음
 ├──────────────────────────────────────────────► InviteVerifyScreen
 │
 │   loading && hasFamilyId
 ├──────────────────────────────────────────────► 로딩 스피너
 │
 └── 정상 로그인 + 가족 로드 완료 ──────────────► Main App
                                                   ├── FamilyTreeView (메인)
                                                   ├── AnniversaryView (모달)
                                                   ├── SearchView (모달)
                                                   ├── MyMenuView (모달)
                                                   └── HelpView (모달)
```

### 초대 링크 흐름

```
/invite/:token 접속
  → Firestore invites 조회
  → sessionStorage에 invite 컨텍스트 저장
  → 로그인 or 회원가입
  → InviteVerifyScreen (이름 확인)
  → mapMemberToPerson 호출
  → FamilyTreeView (인물 연결 완료)
```

---

## 12. 배포 구성

### firebase.json

```json
{
  "hosting": {
    "public": "client/dist",
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

### 배포 명령

```bash
cd client && npm run build
cd .. && firebase deploy --only hosting --project famliytree-dfb80
```

### Firebase 프로젝트

- **Project ID**: `famliytree-dfb80`
- **Hosting URL**: https://famliytree-dfb80.web.app
- **Firestore**: us-central1 (기본)

### 환경 변수

Firebase 설정은 `client/src/lib/firebase.ts`에 하드코딩 (public config — Firebase API Key는 공개해도 안전, 보안은 Firestore rules로 처리).

---

## 13. 보안 고려사항

### 현재 상태 (v1.0 — 가족 내부 서비스)

| 항목 | 현황 | 권고 |
|------|------|------|
| Firestore rules | `allow read, write: if true` | 가족 내 신뢰 환경 가정. 실서비스화 시 rules 강화 필요 |
| 비밀번호 | SHA-256 클라이언트 해싱 | PBKDF2/bcrypt + 서버 사이드 해싱 권고 |
| 초대 토큰 | UUID v4, 30일 만료 | 현행 유지 |
| 세션 | localStorage (영구) | 탈취 위험 — 민감 환경에서는 httpOnly cookie 권고 |
| HTTPS | Firebase Hosting 기본 제공 | ✅ |

### 데이터 격리

- 모든 `persons`, `relationships`는 `family_id`로 파티셔닝
- 가족 간 데이터 교차 접근은 클라이언트 코드 레벨에서 차단

---

## 14. 알려진 제한 사항

| # | 항목 | 내용 |
|---|------|------|
| 1 | 권한 시스템 | `PersonPermissions` 타입 정의 완료, `canPerform()` 구현 스텁 상태 — 세밀한 role-based 편집 권한 미구현 |
| 2 | 사진 업로드 | `photo_url` 필드 존재하나 업로드 UI 미구현 |
| 3 | 모바일 UX | 반응형 대응 부분적 — 대형 트리 모바일 조작성 개선 여지 있음 |
| 4 | 복수 가족 구성원 동시 편집 | 실시간 동기화로 기본 처리되나 충돌 해결 로직 없음 |
| 5 | 비밀번호 해싱 | 클라이언트 사이드 SHA-256 — 서버 사이드 해싱으로 전환 권고 |
| 6 | 서버 폴더 | `server/` (Express + SQLite) 미사용 잔재 — 제거 필요 |

---

*이 문서는 v1.0.0 기준으로 작성되었습니다.*
