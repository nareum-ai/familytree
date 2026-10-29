# 우리 가족 가계도 — 프로그램 명세서

**버전**: 1.10.0  
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
10. [유틸리티 & 커스텀 훅](#10-유틸리티--커스텀-훅)
11. [화면 흐름 (라우팅)](#11-화면-흐름-라우팅)
12. [CSV 대량 업로드 / 내보내기](#12-csv-대량-업로드--내보내기)
13. [푸시 알림 시스템](#13-푸시-알림-시스템)
14. [Cloud Functions](#14-cloud-functions)
15. [배포 구성](#15-배포-구성)
16. [SEO](#16-seo)
17. [보안 고려사항](#17-보안-고려사항)
18. [알려진 제한 사항](#18-알려진-제한-사항)

---

## 1. 프로젝트 개요

**우리 가족 가계도**는 한국 가족 관계를 시각적으로 관리하는 웹 애플리케이션입니다.

### 핵심 목표

- 친가·외가·처가·처외가 4개 계통을 탭으로 구분하여 시각적으로 표현
- 가족 구성원별 계정 연결 및 프라이버시 보호
- 생일·기일 기념일 자동 알림 (음력 지원, 관리자 설정 가능)
- 초대 링크를 통한 가족 온보딩
- CSV 기반 대량 데이터 등록 및 내보내기
- Google OAuth를 통한 소셜 로그인
- 인물 아바타 이미지 지원

### 주요 사용자 시나리오

| 시나리오 | 설명 |
|----------|------|
| 랜딩 페이지 | 미로그인 접속 시 서비스 소개 화면 → 지금 시작하기(가입) / 로그인 분기 |
| 가족 트리 생성 | 관리자 승인 후 본인을 root로 트리 개설 |
| CSV 일괄 등록 | 관리자가 CSV 파일로 가족 트리 전체를 한번에 등록 |
| 가족 초대 | 인물 노드 → 초대 링크 생성(`?from=이름` 포함) → 카카오톡/문자 공유 |
| 비공개 정보 요청 | 잠긴 노드 클릭 → 권한자에게 요청 → 양방향 승인 |
| 2촌 이내 자동 공개 | 부모·자녀·형제자매 등 2촌 이내는 정보공개 요청 없이 자동 열람 |
| 기념일 확인 | 기념일 버튼 → 가까운 순 생일/기일 목록 |
| 구글 로그인 | 구글 계정으로 간편 로그인 / 비밀번호 분실 대체 |
| 관리자 대리 접속 | 관리자가 특정 회원 계정으로 바로 접속 |
| 아바타 설정 | 인물 편집 → 아바타 선택 → 트리 노드에 표시 |
| 탈퇴 | 관리자 이메일로 요청 → 관리자가 회원 삭제 처리 |

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
| 음력 변환 | korean-lunar-calendar | 0.4.x | 음력↔양력 날짜 변환 (한국천문연구원 기준) |
| PWA | vite-plugin-pwa | 1.3.0 | 서비스 워커, 설치, 푸시 |

### Backend / 인프라

| 분류 | 서비스 | 용도 |
|------|--------|------|
| 데이터베이스 | Firebase Firestore | 실시간 NoSQL DB |
| 호스팅 | Firebase Hosting | SPA 정적 배포 |
| 인증 | Firebase Auth (Google OAuth) + 자체 구현 (Firestore + SHA-256) | 계정 관리 |
| 서버리스 | Firebase Cloud Functions (Node.js 20, 2nd Gen) | 푸시 알림, 로그 정리 |
| 푸시 | Firebase Cloud Messaging (FCM) | 기념일·정보공개 요청 알림 |

---

## 3. 프로젝트 구조

```
FamilyTree/
├── client/                         # React 프론트엔드
│   ├── src/
│   │   ├── components/             # UI 컴포넌트 (29개)
│   │   │   ├── LandingPage.tsx     # 미로그인 랜딩 페이지 (서비스 소개)
│   │   │   ├── InAppBrowserBanner.tsx  # 인앱 브라우저 공통 경고 배너
│   │   │   └── InvitePage.tsx      # /invite/:token?from=이름 (인앱 브라우저 조기 종료)
│   │   ├── hooks/
│   │   │   ├── useTreeLayout.ts    # 트리 레이아웃 엔진 + canSeeFull
│   │   │   ├── useFCMToken.ts      # FCM 토큰 등록 및 포그라운드 알림
│   │   │   ├── useAdminEmail.ts    # 관리자 구글 이메일 조회 훅
│   │   │   └── useIdleTimeout.ts   # 30분 비활동 자동 로그아웃
│   │   ├── store/
│   │   │   └── familyStore.ts      # Zustand 전역 스토어
│   │   ├── utils/
│   │   │   ├── anniversary.ts      # 기념일 날짜 계산 (UI용)
│   │   │   ├── csvExport.ts
│   │   │   ├── csvImport.ts        # EUC-KR/UTF-8 자동 감지
│   │   │   ├── relationLabel.ts
│   │   │   ├── nameParser.ts       # 복성 처리
│   │   │   ├── crypto.ts           # SHA-256 해싱
│   │   │   └── age.ts
│   │   ├── types/
│   │   │   ├── index.ts
│   │   │   └── permissions.ts      # PermissionRole, PersonPermissions, DEFAULT_PERMISSIONS
│   │   ├── lib/
│   │   │   ├── firebase.ts         # Firebase 초기화 (Auth 포함)
│   │   │   └── storageKeys.ts      # LS.* / SS.* 상수 (관리자 PWA 모드 시 adm_ prefix 자동 적용)
│   │   ├── sw.ts                   # Service Worker (백그라운드 푸시 처리)
│   │   ├── App.tsx                 # 라우팅·인증 허브, 안드로이드 뒤로가기 인터셉트
│   │   └── main.tsx
│   ├── public/
│   │   ├── favicon.svg
│   │   ├── icons/                  # PWA 아이콘 (192px, 512px)
│   │   ├── avatars/                # 인물 아바타 이미지 (PNG)
│   │   ├── sitemap.xml             # Google 크롤링용 사이트맵
│   │   ├── robots.txt              # 크롤러 규칙 (/invite/ Disallow)
│   │   └── admin-manifest.webmanifest  # 관리자 PWA 전용 manifest
│   ├── index.html                  # SEO 메타태그, OG, JSON-LD, Google 인증
│   └── vite.config.ts              # PWA 설정 (orientation: 'any')
├── functions/
│   ├── scripts/syncShared.js       # 빌드 전 client relationLabel.ts → src/shared/ 복사
│   └── src/
│       ├── index.ts                # Cloud Functions (9개)
│       └── shared/                 # relationLabel.ts(자동 생성)·generation.ts·types.ts
├── firebase.json
├── firestore.rules                 # 현재: allow read, write: if true
├── firestore.indexes.json
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
  birth_date: string | null;       // YYYY-MM-DD
  birth_lunar: boolean;
  birth_year: number | null;
  is_root: number;                 // 1 = 이 가족의 기준 인물
  is_deceased: boolean;
  death_date: string | null;
  death_lunar: boolean;
  photo_url: string | null;        // 아바타 경로 (예: /avatars/m_adult.png)
  created_by: string | null;       // 계정 아이디 or 인물명 (레거시)
  family_id: string;
  family_disabled?: boolean;       // root 인물에만 설정, true면 해당 가족 전체 접근 차단
  permissions: PersonPermissions;
  created_at: string;
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
  password_hash: string;           // SHA-256(salt + password), 구글 전용은 ''
  person_id: string | null;
  family_id: string | null;
  person_name: string | null;
  is_admin: boolean;
  status: 'active' | 'suspended';
  created_at: string;              // ISO 8601
  last_login_at?: string | null;   // ISO 8601, 로그인 시마다 갱신
  google_uid?: string | null;      // Firebase Auth UID
  google_email?: string | null;    // 연결된 구글 계정 이메일
  fcm_tokens?: string[];           // FCM 디바이스 토큰 — 기기별 (일반: 폰 TWA·PC 브라우저 등)
  fcm_tokens_admin?: string[];     // FCM 디바이스 토큰 — 기기별 (관리자 PWA)
  fcm_token?: string | null;       // [하위호환] 마지막 등록 기기 토큰 (Functions가 배열과 합쳐 읽음)
  fcm_token_admin?: string | null; // [하위호환] 관리자 PWA 마지막 등록 토큰
  fcm_tokens_updated_at?: string | null; // 이 회원 기기 토큰 마지막 저장 시각
  push_last_ok_at?: string | null;   // 마지막 푸시 발송 성공 (Functions 기록)
  push_last_fail_at?: string | null; // 마지막 푸시 발송 실패
  push_last_error?: string | null;   // 마지막 실패 코드
}
```

---

## 5. Firestore 컬렉션

| 컬렉션 | 설명 | 주요 쿼리 |
|--------|------|-----------|
| `persons` | 인물 데이터 | `where family_id ==` |
| `relationships` | 관계 엣지 | `where family_id ==` |
| `members` | 계정 | `where username ==`, `where google_uid ==`, `where is_admin ==` |
| `invites` | 초대 토큰 (30일 유효, 사용 후 삭제) | `where token ==` |
| `approval_requests` | 트리 개설 신청 | `where status == 'pending'` |
| `info_requests` | 정보공개 요청 | `where holder_member_id ==` |
| `info_access` | 승인된 정보 접근권 | `where requester_member_id ==` |
| `person_access_pairs` | 양방향 접근 합의 | `where person_a_id ==` |
| `login_logs` | 접속 로그 (1년 보관) | `where member_id ==`, `where logged_in_at <` |
| `activity_logs` | 인물 추가/삭제 활동 로그 | `orderBy at desc` (최근 100건) |
| `settings/push` | 푸시 알림 설정 (단일 문서) | 직접 읽기 |

### settings/push 문서 구조

```typescript
{
  sendHourKST: number;      // 발송 시 (0~23, KST 기준), 기본값 8
  sendMinuteKST: number;    // 발송 분 (0~59), 기본값 0
}
```

알림 시기·촌수·종류는 회원별 `members.push_prefs`(`enabled`, `offsets`, `maxChusu`, `enableBirthday`, `enableDeathDay`)에 저장 — 기본값 `[0,1,3,7]`, 6촌, 생일·기일 모두 ON.

### activity_logs 문서 구조

```typescript
{
  at: string;           // ISO 8601
  action: 'add' | 'delete';
  person_name: string;
  actor_name: string;   // 작업한 계정 이름
  family_id: string;
}
```

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
  ↓ 계정 있음 (관리자) → 바로 관리자 화면으로
  ↓ 계정 있음 (일반) → applyMemberLogin
  ↓ 계정 없음 (초대 컨텍스트 있음) → 새 계정 생성 → InviteVerifyScreen
  ↓ 계정 없음 (초대 없음) → GoogleLinkScreen
      → "기존 계정 연결" (아이디+비밀번호 1회 입력) → google_uid 저장
      → "처음 시작하기" → 새 계정 생성 → 가족그룹 신청 플로우
```

### 로그인 후 처리 (`applyMemberLogin`)

1. `isFamilyDisabled` 확인 → 비활성화된 가족이면 차단 화면 표시
2. `recordLogin` → Firestore 쓰기 완료 후 `window.location.reload()`

### 세션 관리

| 키 | 저장소 | 내용 |
|----|--------|------|
| `familyTreeUser` | localStorage | 인물 이름 |
| `familyTreeFamilyId` | localStorage | 가족 UUID |
| `familyTreeMemberId` | localStorage | 계정 document ID |
| `familyTreeMyPersonId` | localStorage | 내 인물 ID |
| `familyTreeAccountName` | localStorage | 로그인 아이디 |
| `familyTreeIsAdmin` | localStorage | 관리자 플래그 |
| `familyTreeAdminReturn` | localStorage | 관리자 가족뷰 복귀 상태 |
| `familyTreeGoogleEmail` | localStorage | 연결된 구글 이메일 |
| `viewpointPersonId` | sessionStorage | 현재 뷰포인트 인물 ID |

> **관리자 PWA 모드**: `setAdminPWAMode(true)` 시 위 모든 localStorage 키에 `adm_` prefix 자동 적용 → 일반 사용자 세션과 완전 분리

### 가시성 규칙 (`canSeeFull`)

아래 조건 중 하나라도 충족하면 전체 정보 열람:

1. `person.created_by === currentUserAccountName`
2. `person.id === viewpointPersonId`
3. `person.id === root.id` (root 소유자)
4. `grantedPersonIds.has(person.id)`
5. `getChusu(person.id, viewpoint, relationships) <= 2` ← 2촌 이내 자동 공개

### 정보공개 요청 자동 승인 규칙

| 조건 | 동작 |
|------|------|
| 2촌 이내 (`getChusu ≤ 2`) | **즉시 자동 승인** |
| 권한자 없음 | **즉시 자동 승인** |
| created_by = 관리자 | **즉시 자동 승인** |
| 그 외 | 대기 요청 생성 → 상대 승인 필요 |

### 계정 역할

| 역할 | 조건 | 권한 |
|------|------|------|
| 관리자 | `is_admin: true` | AdminView 전체, 대리 접속, CSV 업로드/내보내기, 푸시 설정, 가족 비활성화 |
| 일반 회원 | `person_id` 연결됨 | 가족 트리 편집, 초대, 기념일·검색 |
| 미매핑 회원 | `person_id: null` | 가족 트리 개설 신청만 가능 |

### 인물 노드 편집 권한 (`canEdit`)

| 조건 | 결과 |
|------|------|
| 관리자 (`isAdmin`) | 항상 편집 가능 |
| 본인 노드 (`person.id === myPersonId`) | 편집 가능 |
| 주인 있는 노드 (`alreadyMapped`) | 본인/관리자만 — 내가 만든 노드라도 다른 사람이 연결하면 편집 불가 |
| 주인 없는 노드 + 내가 만든 경우 (`created_by === currentUserAccount`) | 편집 가능 |

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
삭제 실행 시: 로컬 관계 + Firestore 직접 쿼리 병행으로 타이밍 이슈 방지.

### 7.8 포커스 이동 (`requestFocus`)

기념일/검색에서 인물 선택 시:
1. 대상 브랜치로 탭 전환
2. `focusTargetId` 로컬 state에 보관 (store 클리어 이후에도 유지)
3. `FitToMeController`가 100ms 후 해당 노드로 fitView

---

## 8. 컴포넌트 구조

```
App.tsx (라우팅·인증 허브, 안드로이드 뒤로가기 인터셉트, 유휴 자동 로그아웃)
├── LandingPage              미로그인 첫 진입 (서비스 소개, 지금 시작하기→가입 / 로그인 분기)
├── LoginScreen              로그인 (아이디/비밀번호 + Google, 인앱 브라우저시 Google 버튼 숨김)
│   └── InAppBrowserBanner   인앱 브라우저 감지 시 Chrome/Safari 전환 안내
├── RegisterScreen           회원가입 (Google 버튼 포함, 인앱 브라우저시 숨김)
│   └── InAppBrowserBanner
├── GoogleLinkScreen         구글 계정 연결/새로 시작 선택 화면
├── InvitePage               /invite/:token?from=이름 (인앱 브라우저 감지 시 Firestore 건너뜀)
│   └── InviteVerifyScreen   이름 검증
├── FamilyGroupRequestScreen 가족 트리 개설 신청 (관리자 이메일 문의 안내)
├── [FamilyDisabled 화면]    가족 비활성화 시 표시 (App.tsx 인라인)
├── AdminView                관리자 대시보드
│   ├── BulkUploadView       CSV 일괄 업로드 (EUC-KR/UTF-8 자동 감지)
│   ├── [Push Settings UI]   푸시 알림 설정 (시간·오프셋·촌수·종류)
│   ├── [Family List]        가족 목록 (페이징, 비활성화/활성화 토글)
│   ├── [Activity Logs]      인물 추가/삭제 활동 로그 (최근 100건)
│   └── AdminInstallButton   관리자 PWA 설치 버튼
└── Main Layout
    ├── FamilyTreeView        트리 캔버스
    │   ├── ZoomControls      줌 슬라이더 (미니맵과 한 덩어리)
    │   ├── FocusMeButton     나 위치 포커스 버튼
    │   ├── MiniMap           ReactFlow 미니맵
    │   ├── CoupleNode
    │   │   └── PersonNode    (photo_url 있으면 아바타 이미지 표시)
    │   ├── PersonDetail      인물 상세·편집
    │   │   │ · 연락처 행에 SMS/이메일 직접 초대 버튼 (링크 안 된 노드 + 전화번호/이메일 있을 때)
    │   │   │ · 버튼 텍스트: "{이름}의 가족 추가하기" / "{이름} 님을 가계도로 초대하기"
    │   │   │ · 삭제 버튼: 하단 → 편집 버튼 옆으로 이동
    │   │   │ · 편집 권한: 주인 있는 노드(alreadyMapped)는 본인/관리자만 편집 가능
    │   │   ├── DateInput
    │   │   ├── AvatarPicker      아바타 선택 모달 (인물·동물·기호 그룹)
    │   │   └── NotifBlockedModal 알림 차단 안내 모달
    │   │         · Android·PC 브라우저: 사이트 설정 → 알림 허용 안내 (+Play 출시 후: Play 앱 버튼 / 출시 전: PWA 설치 버튼)
    │   │         · iOS 브라우저: 홈 화면에 추가 단계 안내
    │   │         · 이미 설치된 앱(standalone): 시스템 설정 → 알림 허용 안내
    │   ├── AddPersonModal
    │   └── InfoRequestPanel  정보공개 요청 (자동 승인 지원)
    ├── AnniversaryView       기념일 목록 + 🔔/🔕 버튼으로 개인 알림 설정 토글 (관리자·미매핑 계정 제외)
    │   │ · 알림 차단 시 종 아이콘 🔕(빨간색) 표시, 클릭 시 NotifBlockedModal 표시
    ├── SearchView            인물 검색
    ├── MyMenuView            My 메뉴 (정보공개 요청/비밀번호/구글 연결/탈퇴 문의)
    │   └── PushStatusPanel   이 기기 알림 상태·등록 기기 수·마지막 수신, 서버 테스트 알림, (Play 출시 후·Android 브라우저) Play 스토어 앱
    ├── PushPermissionPrompt  알림 켜기 안내 배너 (사용자 클릭으로만 권한 요청, "나중에" 7일 스누즈)
    │                         · 미결정 → 알림 켜기 / iOS 브라우저 → 홈 화면 추가 / Android 브라우저+앱 설치됨 → 앱에서 열기
    ├── ForegroundPushToast   앱을 보고 있을 때 도착한 알림 토스트 (+시스템 알림)
    └── HelpView              사용 안내 (탈퇴 방법 포함)
```

---

## 9. 상태 관리 (Zustand Store)

### 주요 함수

| 함수 | 설명 |
|------|------|
| `loginMember` | 아이디/비밀번호 로그인 |
| `registerMember` | 일반 회원가입 |
| `loginWithGoogle` | 구글 팝업 인증 → member 조회 |
| `registerWithGoogle` | 구글 전용 신규 계정 생성 |
| `linkGoogleToMember` | 기존 계정에 google_uid 연결 (중복 체크 포함) |
| `unlinkGoogleFromMember` | google_uid 연결 해제 |
| `recordLogin` | last_login_at 갱신 + login_logs 기록 |
| `createInfoRequest` | 정보공개 요청 (2촌 이내·관리자 생성·권한자 없음 자동 승인) |
| `saveFcmToken` | 기기 FCM 토큰을 배열에 추가 (다른 회원의 같은 토큰 제거, 이 기기의 이전 토큰 제거) |
| `requestServerPushTest` | `push_tests` 문서 생성 → Functions가 회원 전 기기로 테스트 발송 후 결과 기록 |
| `consumeInviteToken` | 초대 토큰 삭제 (재사용 방지) |
| `isFamilyDisabled` | 가족 비활성화 여부 확인 (root 인물의 `family_disabled` 필드) |
| `mapMemberToPerson` | 계정↔인물 연결 (`ALREADY_MAPPED` 에러로 중복 차단) |

---

## 10. 유틸리티 & 커스텀 훅

### hooks/

| 파일 | 설명 |
|------|------|
| `useTreeLayout.ts` | 트리 레이아웃 엔진, `classifyBranch`, `getChusu`, `canSeeFull` |
| `useFCMToken.ts` | `useFCMToken`: 권한 허용 상태면 앱 시작 시 토큰 동기화 (권한은 묻지 않음, 토큰 변경·회원 변경·7일 경과 시 재저장). `useForegroundPush`: 포그라운드 수신(onMessage) → 시스템 알림 + 토스트 |
| `useAdminEmail.ts` | 관리자 `google_email` 조회 훅 (HelpView·MyMenuView·FamilyGroupRequestScreen·비활성화 화면 공용) |
| `useIdleTimeout.ts` | 30분 비활동 자동 로그아웃 (`mousemove`, `mousedown`, `keydown`, `touchstart`, `scroll` 감지) |

### utils/

| 파일 | 주요 함수 |
|------|-----------|
| `crypto.ts` | `hashPassword(pw)` — SHA-256 |
| `age.ts` | `getManAge(birthDate)`, `getAgeAtDeath(birth, death)` |
| `nameParser.ts` | `parseKoreanName(name)` — 복성 처리 |
| `relationLabel.ts` | `getRelationLabel(...)` — 한국어 관계명 |
| `anniversary.ts` | 기념일 날짜 계산 (클라이언트 UI용) |
| `csvExport.ts` | `exportFamilyToCSV`, `downloadCSV` |
| `csvImport.ts` | `parseCSV` — UTF-8(BOM)/EUC-KR 자동 감지 |

---

## 11. 화면 흐름 (라우팅)

```
접속
 ├─ /invite/:token?from=이름  ───────────────────► InvitePage
 │    └─ 인앱 브라우저 감지 시 Firestore 건너뜀, Chrome/Safari 전환 안내
 │    └─ 일반 브라우저: Firestore에서 초대 정보 로드 → sessionStorage 저장
 │
 │   로그인 없음 (첫 방문)
 ├──────────────────────────────────────────────► LandingPage
 │    └─ 지금 시작하기 → RegisterScreen
 │    └─ 로그인 (nav) → LoginScreen
 │
 │   로그인 없음 (?register=1 or 초대 컨텍스트)
 ├──────────────────────────────────────────────► RegisterScreen
 │
 │   로그인 없음 (일반)
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
 │   family_disabled=true (로그인 후 확인)
 ├──────────────────────────────────────────────► FamilyDisabled 화면
 │                                                  (관리자 이메일 + 로그아웃 버튼)
 │   !hasFamilyId AND !pendingInviteMemberId
 ├──────────────────────────────────────────────► FamilyGroupRequestScreen
 │
 └── 정상 로그인 ────────────────────────────────► Main App
                                                    (유휴 30분 → 자동 로그아웃)
```

### 안드로이드 뒤로가기 동작

1. 모달/패널이 열려 있으면 → 해당 모달 닫기 (우선순위: HelpView → 기념일 → MyMenu → 검색 → InfoRequestPanel → PersonDetail)
2. 모달 없음 → 2.5초 이내 두 번 누르면 앱 종료, 토스트 표시

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

## 13. 푸시 알림 시스템

### 알림 종류

| 종류 | 트리거 | 발송 주체 |
|------|--------|-----------|
| 기념일 알림 | 매분 스케줄 (KST 설정 시각에만 실제 발송, TTL 24시간) | Cloud Functions |
| 정보공개 요청 알림 | `info_requests` 문서 생성 즉시 | Cloud Functions (Firestore 트리거) |
| 관리자 알림 | 가족그룹 신청·비밀번호 초기화 요청 | Cloud Functions → 관리자 PWA 토큰 |
| 공지 | `push_broadcasts` 생성 | Cloud Functions |
| 서버 테스트 | `push_tests` 생성 (내메뉴) | Cloud Functions |

### 기념일 알림 동작

- **발송 시각**: `settings/push`의 `sendHourKST`:`sendMinuteKST` (기본 08:00 KST) — 관리자 화면에서 시·분 선택
- **D-day 오프셋**: `push_prefs.offsets` (기본 [0, 1, 3, 7] — 당일·1일·3일·7일 전)
- **대상 촌수**: `push_prefs.maxChusu` 이내 (기본 6촌)
- **알림 종류**: `push_prefs.enableBirthday`(생일), `enableDeathDay`(기일) 각각 토글
- **묶음 발송**: 회원 1명당 하루 1건. 여러 건이면 "가족 기념일 N건"으로 합침. 클릭 시 기념일 화면(`/?view=anniversary`)
- **관계 표시**: 받는 회원 기준 관계명을 이름 앞에 붙임 ("내일은 사촌형 홍길동님의 생일"). `getRelationLabel` 재사용 + 사촌류 혈족은 생년월일·성별로 형/누나/오빠/언니/동생 접미. 관계를 못 구하면 이름만
- **로그**: 발송 시각에 `기념일 알림 시작` / `완료(건수·대상·성공)` 기록
- **음력 지원**: `korean-lunar-calendar`(KASI 기준)로 양력→음력 변환 후 비교. 중국 음력(solarlunar)은 하루씩 어긋나는 달이 있어 교체
- **수동 실행**: 관리자가 `anniversary_runs` 문서 생성 → `onAnniversaryRunRequested`가 즉시 발송 후 `{done, total, targets, okMembers}` 기록

### FCM 토큰 관리 (다중 기기)

- 일반: `members.fcm_tokens[]`, 관리자 PWA: `members.fcm_tokens_admin[]` (세션 분리)
- 구버전 단일 필드(`fcm_token`/`fcm_token_admin`)도 마지막 토큰으로 계속 기록 — Functions는 배열+단일 필드를 합쳐 중복 제거 후 발송
- 저장 시 같은 토큰이 다른 회원에 있으면 그쪽에서 제거, 이 기기의 이전 토큰(localStorage `FCM_TOKEN_SAVED`)이 바뀌었으면 제거
- `FCM_TOKEN_SAVED`는 `{memberId, scope, token, at}` JSON. 회원·범위·토큰이 같고 7일 이내면 재저장 생략
- 발송(`pushToMember`)은 `sendEach`로 회원 전 기기에 전송 → `registration-token-not-registered`/`invalid-registration-token` 토큰 자동 삭제 → `push_last_ok_at`/`push_last_fail_at`/`push_last_error` 기록
- 로그아웃(유휴 자동 로그아웃 포함) 시 토큰을 지우지 않는다 — 로그아웃 상태에서도 기념일 알림 수신 유지. 기기를 다른 계정이 쓰면 다음 등록 때 이전 계정에서 빠짐

### 권한 요청 정책

- 앱 시작 시 자동 권한 요청 없음 (iOS 홈 화면 앱은 사용자 동작 없이 요청하면 실패, 크롬은 자동 요청을 조용히 숨김)
- 요청 지점: `PushPermissionPrompt` 배너의 "알림 켜기", 기념일 창 알림 토글, 내메뉴 알림 토글
- 토글 ON 표시는 `push_prefs.enabled && 이 기기 권한 허용 && 토큰 저장`일 때만 (설정만 켜져 있고 기기 미등록이면 OFF로 표시)

### 관리자 설정 변경

AdminView → 푸시 알림 설정 섹션에서 실시간 변경 가능.  
변경 즉시 `settings/push` Firestore 문서에 저장 → 다음 정각 실행 시 반영.

### 지원 환경

| 환경 | 수신 | 비고 |
|------|------|------|
| Android Play 스토어 앱(TWA) | ✅ | 앱 알림. **출시 전** — `lib/appConfig.ts`의 `PLAY_STORE_RELEASED=false` 동안 Play 유도 전부 비활성. 출시 후 `true`로 바꾸면 매니페스트 `related_applications`/`prefer_related_applications` 적용 + Android 브라우저에 Play 앱 설치·열기 안내 |
| Android 크롬·PC 브라우저 | ✅ | 설치 불필요 |
| iOS 홈 화면 앱 (16.4+) | ✅ | Safari·크롬·엣지 모두 홈 화면 추가 가능, 안내는 브라우저별 단계 |
| iOS 브라우저 탭 | ❌ | `Notification` API 없음 → 홈 화면 추가 안내 |
| 인앱 브라우저(카카오톡 등) | ❌ | 외부 브라우저 열기 안내 우선 |

알림 클릭 시 열린 창이 있으면 그 창을 알림 링크로 이동(`client.navigate`), 없으면 새 창.

---

## 14. Cloud Functions

| 함수 | 트리거 | 설명 |
|------|--------|------|
| `onPasswordResetTokenCreated` | Firestore 트리거 (`password_reset_tokens/{id}` 생성) | 비밀번호 재설정 메일 자동 발송 (`contact_email` 우선, 없으면 `member.email`) |
| `onPasswordResetRequestCreated` | Firestore 트리거 (`password_reset_requests/{id}` 생성) | 관리자 승인이 필요한 초기화 요청 → 관리자에게 FCM 알림 |
| `onApprovalRequestCreated` | Firestore 트리거 (`approval_requests/{id}` 생성) | 가족그룹 신청 즉시 관리자에게 FCM 알림 |
| `onInfoRequestCreated` | Firestore 트리거 (`info_requests/{id}` 생성) | 권한자에게 즉시 FCM 푸시 |
| `sendAnniversaryReminders` | 매분 스케줄 (`* * * * *` UTC) | `settings/push` 읽어 KST 시·분 일치 시 기념일 알림 발송 |
| `onAnniversaryRunRequested` | Firestore 트리거 (`anniversary_runs/{id}` 생성) | 관리자 수동 기념일 알림 즉시 발송 |
| `onBroadcastPushCreated` | Firestore 트리거 (`push_broadcasts/{id}` 생성) | 관리자가 작성한 수동 공지를 전체 또는 특정 회원에게 FCM 발송 (`sent_count` = 1대 이상 성공한 회원 수) |
| `onPushTestCreated` | Firestore 트리거 (`push_tests/{id}` 생성) | 요청 회원의 전 기기로 테스트 발송 → `{done, ok, fail, tokens}` 기록 |
| `cleanupLoginLogs` | 매월 1일 자정 UTC (`0 0 1 * *`) | `login_logs`·`activity_logs`에서 1년 초과 문서 일괄 삭제 (500건 배치) |

**리전**: `asia-northeast3` (서울)

---

## 15. 인앱 브라우저 대응

카카오톡·네이버·인스타그램 등 인앱 브라우저에서는 Google OAuth 팝업이 차단됨.

### 감지 패턴

```
/KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\/|Twitter/i
```

### 처리 방식

| 화면 | 인앱 브라우저 동작 |
|------|-----------------|
| InvitePage | Firestore 호출 없이 즉시 렌더, `?from=` URL 파라미터로 발신자 이름 표시 |
| LoginScreen | Google 로그인 버튼 숨김, Chrome/Safari 전환 안내 배너 표시 |
| RegisterScreen | Google 가입 버튼 숨김, 배너 표시 |

### InAppBrowserBanner 공통 컴포넌트

- **Android**: "Chrome으로 열기" 버튼 (intent:// 방식) + 하단 메뉴 수동 안내
- **iOS**: "링크 복사" 버튼 + Safari 주소창 붙여넣기 안내

---

## 16. SEO

| 항목 | 내용 |
|------|------|
| 메타 태그 | title, description, keywords, canonical |
| Open Graph | og:title, og:description, og:image, og:url |
| Twitter Card | summary_large_image |
| JSON-LD | WebApplication 구조화 데이터 |
| 사이트맵 | `/sitemap.xml` — 루트 URL 1건 |
| robots.txt | `/invite/*` Disallow (동적 초대 링크 색인 방지) |
| Google Search Console | 소유권 확인 완료 (meta 태그 방식), 사이트맵 제출 |

---

## 17. 배포 구성

### Firebase 프로젝트

- **Project ID**: `familytree-3221b`
- **Hosting URL**: https://familytree-3221b.web.app

### 배포 명령

```bash
# 클라이언트 빌드
cd client && npm run build

# Hosting 배포
firebase deploy --only hosting

# Functions 배포 (functions/src 변경 시)
firebase deploy --only functions

# 전체 배포
firebase deploy --only hosting,functions
```

### 관리자 PWA 설치

관리자는 AdminView 내 관리자 앱 설치 버튼으로 별도 PWA 설치 가능.  
URL: `/?admin_pwa=1` — `admin-manifest.webmanifest` 사용, localStorage 키 `adm_` prefix로 일반 사용자와 세션 완전 분리.

### PWA 설정 (vite.config.ts)

```typescript
manifest: {
  orientation: 'any',   // 가로/세로 모두 지원
  display: 'standalone',
  theme_color: '#2AABE2',
}
```

---

## 18. 보안 고려사항

| 항목 | 현황 |
|------|------|
| Firestore rules | `allow read, write: if true` (가족 내 신뢰 환경 가정) |
| 비밀번호 | SHA-256 클라이언트 해싱 |
| Google OAuth | Firebase Auth 표준 방식 |
| 초대 토큰 | UUID v4, 30일 만료, 공유 시 대상자 이름 미포함, 사용 후 즉시 삭제 |
| 초대 중복 사용 | `ALREADY_MAPPED` 에러로 차단 |
| 가족 비활성화 | 관리자가 특정 가족 전체 접근 차단 가능 |
| 세션 | localStorage (영구) + 유휴 30분 자동 로그아웃 |
| 관리자 세션 분리 | `adm_` prefix로 일반 사용자와 localStorage 키 분리 |
| HTTPS | Firebase Hosting 기본 제공 |
| 접속 로그 | 1년 보관 후 자동 삭제 (monthly Cloud Function) |

---

## 19. 알려진 제한 사항

| # | 항목 | 내용 |
|---|------|------|
| 1 | 권한 시스템 | `PersonPermissions` 정의 완료, role-based 편집 권한 미구현 |
| 2 | 비밀번호 찾기 | 구글 계정 미연결 시 자체 리셋 불가 — 관리자 이메일 문의 필요 |
| 3 | 동시 편집 충돌 | 실시간 동기화로 기본 처리, 충돌 해결 로직 없음 |
| 4 | CSV 복수 배우자 | 배우자 1명만 지원 |
| 5 | 가족 병합 자동화 | 수동 CSV 편집으로 가능, 전용 merge UI 미구현 |
| 6 | Firestore 보안 규칙 | 현재 전체 공개 — 프로덕션 확장 시 규칙 강화 필요 |

---

*v1.0.0 — 2026-05-31 최초 작성*  
*v1.1.0 — 2026-05-31 server/ 제거, CSV 업로드/내보내기 추가*  
*v1.2.0 — 2026-05-31 Google OAuth, 모바일 UX, 인물 연락처, 편집 권한, 1촌 자동 공개, 프로젝트 이전(familytree-3221b)*  
*v1.3.0 — 2026-05-31 PWA 설치, 웹 푸시 알림(PWA 전용), 기념일 알림(D-7/3/1/당일, 6촌이내, 양음력), 관리자 접속 로그, 디자인 전면 개편(인디고 테마, Pretendard)*  
*v1.4.0 — 2026-05-31 푸시 알림 관리자 설정 UI, 관리자 구글 계정 연동, 접속 로그 1년 보관·월 자동 삭제, 안드로이드 뒤로가기 이중 확인, 초대 공유 보안(이름 미포함), 모바일 관리자 레이아웃 개선, 탈퇴·문의 이메일 안내, 가족그룹 신청화면 hard refresh 버그 수정, useAdminEmail 훅 추출, 로그인 이력 기록 버그 수정*  
*v1.5.0 — 2026-06-02 인물 아바타(AvatarPicker), 가족 비활성화/활성화(관리자), 유휴 30분 자동 로그아웃(useIdleTimeout), 관리자 PWA 별도 설치(adm_ 세션 분리), 초대 토큰 사용 후 삭제(재사용 방지), 2촌 이내 정보공개 자동 승인, 인물 활동 로그(activity_logs), 구글 관리자 로그인 직접 처리, 뒤로가기 모달 우선 닫기, 인물 삭제 시 Firestore 직접 쿼리 병행, FCM 토큰 중복 제거*  
*v1.6.0 — 2026-06-02 랜딩 페이지(LandingPage) 추가, 인앱 브라우저 대응 전면 개선(InAppBrowserBanner 공통 컴포넌트, Google 버튼 숨김, 초대링크 ?from= 파라미터, 인앱 Firestore 조기 종료), SEO 설정(메타태그·OG·JSON-LD·sitemap.xml·robots.txt), Google Search Console 등록, 불필요 파일 정리(scripts/ server/ README.md)*  
*v1.7.0 — 2026-06-03 알림 설정을 MyMenu에서 기념일 창으로 이동 (헤더 🔔 버튼 토글)*  
*v1.8.0 — 2026-06-06 인물 상세 UX 개선 (연락처 SMS/이메일 직접 초대, 버튼 텍스트 개인화, 삭제 버튼 편집 옆으로 이동), 편집 권한 강화 (주인 있는 노드는 본인/관리자만), 알림 차단 시 PWA 설치 유도 모달(NotifBlockedModal) 추가, 알림 차단 종 아이콘 🔕 시각화*  
*v1.9.0 — 2026-10-23 푸시 수신율 개선: 다중 기기 토큰(fcm_tokens[]), 무효 토큰 자동 정리·발송 결과 기록, 포그라운드 수신 처리(onMessage), 알림 클릭 시 링크 이동, 자동 권한 요청 제거→알림 켜기 배너(PushPermissionPrompt), Android 브라우저 Play 스토어 앱 유도(PLAY_STORE_RELEASED 플래그, 출시 전 비활성), iOS 크롬·엣지 홈 화면 추가 안내, 내메뉴 수신 상태·서버 테스트(PushStatusPanel), 관리자 회원 목록 알림 상태·미수신 필터, iOS 브라우저 알림 토글 오류 수정*  
*v1.10.0 — 2026-10-29 기념일 알림 발송 시각 분 단위 설정(sendMinuteKST, 매분 스케줄), 알림에 받는 사람 기준 관계명 표시(Functions에서 relationLabel 공유), 음력 변환 KASI 기준 교체·관리자 수동 실행 반영, 발송 로그 추가, 랜딩 페이지 개인정보 안내 문구 제거(미적용 기능), 도움말 알림 안내 갱신(브라우저 수신·발송 시각·관계 표시), 미사용 코드 정리(NewFamilyRequestView, 미사용 export·devDependencies), 린트 오류 수정*
