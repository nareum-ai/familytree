# 우리 가족 가계도 — 프로그램 명세서

**버전**: 1.1.0  
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

### 주요 사용자 시나리오

| 시나리오 | 설명 |
|----------|------|
| 가족 트리 생성 | 관리자 승인 후 본인을 root로 트리 개설 |
| CSV 일괄 등록 | 관리자가 CSV 파일로 가족 트리 전체를 한번에 등록 |
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

---

## 3. 프로젝트 구조

```
FamilyTree/
├── client/                         # React 프론트엔드
│   ├── src/
│   │   ├── components/             # UI 컴포넌트 (20개)
│   │   ├── hooks/
│   │   │   └── useTreeLayout.ts    # 트리 레이아웃 엔진
│   │   ├── store/
│   │   │   └── familyStore.ts      # Zustand 전역 스토어
│   │   ├── utils/
│   │   │   ├── anniversary.ts      # 기념일 계산
│   │   │   ├── csvExport.ts        # CSV 내보내기
│   │   │   ├── csvImport.ts        # CSV 파싱·검증·업로드 빌드
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
├── firebase.json                   # Firebase 호스팅·Firestore 설정
├── firestore.rules                 # Firestore 보안 규칙
├── firestore.indexes.json          # 복합 인덱스 정의
├── .firebaserc                     # Firebase 프로젝트 연결
├── package.json                    # 루트 스크립트 (dev, build, deploy)
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
  family_id: string;          // UUID
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
  member_id: string;
  member_username: string;
  description: string;
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
| `info_requests` | 정보공개 요청 | `where holder_member_id ==` |
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
[A가 B의 정보 요청]
  → info_requests { requester_person_id: A, target_person_id: B, ... }

[권한자 승인]
  → info_access (A → B 접근권)
  → person_access_pairs (A ↔ B 양방향 합의)
  → B에 계정 있으면 즉시 info_access (B → A 접근권)

[C가 B에 매핑될 때]
  → person_access_pairs 조회 → 즉시 info_access (C → A 접근권)
```

---

## 6. 인증 및 권한 모델

### 비밀번호 해싱

```
hash = SHA-256("famliytree-2024" + password)
```
> Web Crypto API(`SubtleCrypto`) 사용, 클라이언트 사이드 해싱

### 세션 관리

| 키 (LS.*) | 저장소 | 내용 |
|-----------|--------|------|
| `familyTreeUser` | localStorage | 인물 이름 (표시·뷰포인트) |
| `familyTreeFamilyId` | localStorage | 소속 가족 UUID |
| `familyTreeMemberId` | localStorage | 계정 document ID |
| `familyTreeAccountName` | localStorage | 로그인 아이디 |
| `familyTreeIsAdmin` | localStorage | 관리자 플래그 |
| `familyTreeAdminReturn` | localStorage | 관리자 가족뷰 전환 상태 |
| `viewpointPersonId` | sessionStorage | 현재 뷰포인트 인물 ID |
| `invitePersonId/Name/FamilyId` | sessionStorage | 초대 링크 컨텍스트 |

> 모든 키는 `src/lib/storageKeys.ts`의 `LS` / `SS` 객체로 중앙 관리

### 가시성 규칙 (`canSeeFull`)

아래 조건 중 하나라도 충족하면 전체 정보 열람:

1. `person.created_by === currentUserAccountName`
2. `person.id === viewpointPersonId`
3. `person.id === root.id`
4. `grantedPersonIds.has(person.id)`

미충족 시 익명 처리 (이름만 표시, 🔒 아이콘).

### 계정 역할

| 역할 | 조건 | 권한 |
|------|------|------|
| 관리자 | `is_admin: true` | AdminView 전체, 가족 삭제, CSV 업로드/내보내기 |
| 일반 회원 | `person_id` 연결됨 | 가족 트리 편집, 초대, 기념일·검색 |
| 미매핑 회원 | `person_id: null` | 가족 트리 개설 신청만 가능 |

---

## 7. 핵심 알고리즘

### 7.1 가계 계통 분류 (`classifyBranch`)

Root 부부 기준 4개 계통 BFS 탐색. 반대쪽 부모를 경계로 차단하여 계통 오염 방지.

```
친가 (paternal)   : root의 아버지 쪽
외가 (maternal)   : root의 어머니 쪽
처가 (spouse-pat) : root 배우자의 아버지 쪽
처외가(spouse-mat): root 배우자의 어머니 쪽
```

### 7.2 촌수 계산 (`getChusu`)

BFS 그래프 거리. **배우자 = 0 hop** (부부는 같은 촌수).

### 7.3 세대 계산 (`getGeneration`)

부모-자녀 관계만 사용하는 방향성 BFS. 양수 = 조상, 음수 = 후손.

### 7.4 트리 레이아웃 (`useTreeLayout`)

1. 뷰포인트 기준 세대 필터링 (상 4대 / 하 3대)
2. 부부를 `CoupleNode`로 묶음
3. 서브트리 너비 재귀 계산 → X 좌표
4. 형제 정렬: 생년월일 오름차순
5. react-flow `Node[]` / `Edge[]` 반환

### 7.5 한국어 관계명 (`getRelationLabel`)

세대 거리 + 직계 여부 + 성별 조합:

```
gen=0, self          → 나
gen=0, spouse        → 남편/아내
gen=±1, direct       → 아버지/어머니/아들/딸
gen=±2, direct       → 할아버지/할머니/손자/손녀
gen=0, sharedParent  → 형/누나/오빠/언니/남동생/여동생
gen=+1, parentSib    → 삼촌/고모/이모/외삼촌
gen=-1, nibSib       → 조카/조카딸
gen=0, cousinCheck   → 사촌/여사촌
gen=+1, spouseParent → 장인/장모/시아버지/시어머니
```

기념일 목록에서 2촌 이하는 관계명 표시, 3촌 이상은 "N촌" 표시.

### 7.6 인명 파싱 (`parseKoreanName`)

복성 처리 (남궁, 선우, 황보, 제갈, 독고, 동방, 사공, 서문 등) + 임시·미상 이름 예외.

### 7.7 삭제 안전 검사

삭제 대상 제거 후 가상 그래프에서 연결된 인물들의 root 도달 가능성 BFS 검사. 고아 발생 시 차단.

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
│   └── BulkUploadView       CSV 일괄 업로드 모달
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

### 전역 상태

| 상태 | 타입 | 설명 |
|------|------|------|
| `persons` | `Person[]` | 현재 가족 인물 목록 (실시간 동기) |
| `relationships` | `Relationship[]` | 관계 목록 (실시간 동기) |
| `loading` | `boolean` | 초기 데이터 로드 여부 |
| `selectedPersonId` | `string \| null` | 선택된 인물 |
| `viewpointPersonId` | `string \| null` | 뷰포인트 인물 ID |
| `currentFamilyId` | `string \| null` | 현재 로드된 가족 ID |
| `grantedPersonIds` | `Set<string>` | 정보공개 승인된 인물 ID 집합 |
| `infoRequestPersonId` | `string \| null` | InfoRequestPanel 대상 |
| `focusRequest` | `{personId, branchId} \| null` | 트리 포커스 이동 요청 |

### 주요 함수

| 함수 | 설명 |
|------|------|
| `init()` | Firestore 실시간 리스너 등록, 자동 보정 |
| `addPerson / updatePerson / deletePerson` | 인물 CRUD |
| `addRelationship / deleteRelationshipsByPerson` | 관계 CRUD |
| `createInfoRequest / approveInfoRequest / rejectInfoRequest` | 정보공개 요청 |
| `mapMemberToPerson` | 계정↔인물 연결 (양방향 접근권 자동 부여) |
| `loginMember / registerMember` | 인증 |
| `deleteFamily` | 가족 완전 삭제 (persons + relationships cascade) |

---

## 10. 유틸리티

### csvExport.ts

```typescript
exportFamilyToCSV(persons, relationships): string
// persons → ref 맵(P001...) → 부모/배우자 관계 역추적 → CSV 문자열

downloadCSV(filename, content): void
// UTF-8 BOM 포함 (Excel 한글 호환)

CSV_TEMPLATE: string  // 샘플 6행 포함 템플릿
```

### csvImport.ts

```typescript
parseCSVText(text): { rows: CSVRow[]; errors: ImportError[] }
// 헤더 검증, ref 중복, 관계 ref 유효성, is_root 수 검사

detectNameMatches(rows, existingPersons): NameMatch[]
// CSV 이름과 기존 인물 이름 자동 매칭

buildImportData(rows, familyId, createdBy, mergeMap): { newPersonDocs, newRelDocs }
// 임시 ref → UUID 할당, 관계 중복 방지
```

### anniversary.ts

```typescript
buildAnniversaries(persons, relationships, chusuBasePerson?): Promise<AnniversaryItem[]>
// 음력→양력 변환, daysUntil 정렬, 2촌 이하 relationLabel 태그
```

### 기타

| 파일 | 주요 함수 |
|------|-----------|
| `crypto.ts` | `hashPassword(pw)` — SHA-256 |
| `age.ts` | `getManAge(birthDate)`, `getAgeAtDeath` |
| `nameParser.ts` | `parseKoreanName(name)` — 복성 처리 |
| `relationLabel.ts` | `getRelationLabel(targetId, base, persons, rels)` |

---

## 11. 화면 흐름 (라우팅)

```
접속
 ├─ /invite/:token  ──────────────────────────────► InvitePage
 │                                                     │
 │   로그인 없음                                         ▼
 ├─ needsLogin=true ──────────────────────────────► LoginScreen
 │                                                  (회원가입 링크)
 │   isAdmin=true                                   RegisterScreen
 ├──────────────────────────────────────────────► AdminView
 │                                                  └ BulkUploadView (모달)
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
                                                   ├── FamilyTreeView
                                                   ├── AnniversaryView
                                                   ├── SearchView
                                                   ├── MyMenuView
                                                   └── HelpView
```

---

## 12. CSV 대량 업로드 / 내보내기

### CSV 포맷

```
ref, name, gender, birth_date, birth_lunar, is_root,
is_deceased, death_date, death_lunar, father_ref, mother_ref, spouse_ref
```

| 열 | 설명 | 필수 |
|----|------|------|
| `ref` | 파일 내 임시 식별자 (예: P001) | ✅ |
| `name` | 이름 | ✅ |
| `gender` | `male` / `female` / 빈칸 | |
| `birth_date` | `YYYY-MM-DD` | |
| `birth_lunar` | `true` / `false` (기본 false) | |
| `is_root` | `true` / `false` — 신규 가족 시 1명 필수 | |
| `is_deceased` | `true` / `false` | |
| `death_date` | `YYYY-MM-DD` | |
| `father_ref` / `mother_ref` / `spouse_ref` | 관계 대상의 `ref` | |

### 업로드 단계

```
1. 드래그&드롭 또는 파일 선택
2. 파싱 + 유효성 검사 (오류 행 표시)
3. 이름 매칭 (기존 가족 추가 시) — 체크박스로 기존 인물 연결 여부 결정
4. Firestore batch write (499ops/배치)
```

### 내보내기

가족 행 **📤** 버튼 → persons + relationships Firestore 조회 → CSV 즉시 다운로드 (UTF-8 BOM).

### 가족 트리 병합 (수동)

두 가족을 병합하려면:
1. 각각 내보내기 → CSV 2개
2. 한쪽 ref 전부 변경 (P→Q 등)
3. 연결 지점 관계 행 추가
4. 한 가족에 "📥 추가 업로드" → 이름 매칭으로 중복 처리

---

## 13. 배포 구성

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
npm run deploy
# 내부적으로: cd client && npm run build && firebase deploy --only hosting
```

### Firebase 프로젝트

- **Project ID**: `famliytree-dfb80`
- **Hosting URL**: https://famliytree-dfb80.web.app

---

## 14. 보안 고려사항

| 항목 | 현황 | 권고 |
|------|------|------|
| Firestore rules | `allow read, write: if true` | 가족 내 신뢰 환경 가정. 실서비스화 시 rules 강화 |
| 비밀번호 | SHA-256 클라이언트 해싱 | PBKDF2/bcrypt + 서버 사이드 해싱 권고 |
| 초대 토큰 | UUID v4, 30일 만료 | ✅ |
| 세션 | localStorage (영구) | 민감 환경에서는 httpOnly cookie 권고 |
| HTTPS | Firebase Hosting 기본 제공 | ✅ |

---

## 15. 알려진 제한 사항

| # | 항목 | 내용 |
|---|------|------|
| 1 | 권한 시스템 | `PersonPermissions` 정의 완료, `canPerform()` 스텁 상태 — role-based 편집 권한 미구현 |
| 2 | 사진 업로드 | `photo_url` 필드 존재, 업로드 UI 미구현 |
| 3 | 모바일 UX | 반응형 부분적 대응 — 대형 트리 모바일 조작성 개선 여지 |
| 4 | 동시 편집 충돌 | 실시간 동기화로 기본 처리, 충돌 해결 로직 없음 |
| 5 | CSV 복수 배우자 | 배우자 1명만 지원 — 복수 배우자는 업로드 후 UI에서 직접 추가 |
| 6 | 가족 병합 자동화 | 수동 CSV 편집으로 가능, 전용 merge UI 미구현 |

---

*v1.0.0 — 2026-05-31 최초 작성*  
*v1.1.0 — 2026-05-31 server/ 제거, CSV 업로드/내보내기 추가*
