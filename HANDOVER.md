# 인수인계 — 우리 가족 가계도

> **이 문서는 다음 Claude Code 세션이 문맥 없이 바로 작업을 이어받기 위한 인수인계서입니다.**  
> 상세 명세는 [SPEC.md](./SPEC.md) 참조.

---

## 프로젝트 정체성

| 항목 | 값 |
|------|-----|
| 서비스명 | 우리 가족 가계도 |
| URL | https://familytree-3221b.web.app |
| Firebase 프로젝트 | `familytree-3221b` |
| 작업 디렉토리 | `c:\Users\nareu\Project\FamilyTree` |
| 플랫폼 | Firebase Hosting (SPA) + PWA, Cloud Functions |

---

## 빌드 & 배포 — 필독

**소스를 수정했으면 반드시 이 두 단계를 실행해야 반영된다. dev server가 없고 배포 파일을 직접 서빙한다.**

```bash
# 1. 빌드
cd client
npm run build

# 2. 배포
cd ..
firebase deploy --only hosting

# Functions 변경 시 (functions/src/index.ts 수정 후)
firebase deploy --only functions

# 둘 다 한번에
firebase deploy --only hosting,functions
```

빌드 없이 배포하면 이전 버전이 그대로 서빙된다. 사용자가 "변경이 안 보여요"라고 하면 빌드+배포가 빠진 경우다.

---

## 기술 스택 한 줄 요약

- **Frontend**: React 19 + TypeScript + Vite + Zustand + @xyflow/react (트리 렌더링) + dagre (레이아웃)
- **Backend**: Firebase Firestore (DB) + Firebase Auth (Google OAuth) + Cloud Functions (푸시 알림·로그 정리)
- **PWA**: vite-plugin-pwa, FCM 푸시 알림 (PWA 설치 시에만 작동)
- **서버 없음**: Express 같은 전통적 백엔드 없음. 모든 로직은 클라이언트 + Cloud Functions.

---

## 디렉토리 구조 (핵심만)

```
FamilyTree/
├── client/src/
│   ├── App.tsx                  ← 라우팅 허브, 인증 상태 관리
│   ├── components/              ← 21개 컴포넌트 (각각 .tsx + .css 쌍)
│   ├── hooks/
│   │   ├── useTreeLayout.ts     ← 트리 레이아웃 엔진 (핵심 알고리즘)
│   │   ├── useFCMToken.ts       ← PWA 푸시 토큰 등록
│   │   └── useAdminEmail.ts     ← 관리자 구글 이메일 조회 (공용 훅)
│   ├── store/familyStore.ts     ← Zustand 전역 스토어 (모든 Firestore 작업)
│   ├── lib/
│   │   ├── firebase.ts          ← Firebase 초기화
│   │   └── storageKeys.ts       ← localStorage/sessionStorage 키 상수 (LS.*, SS.*)
│   └── sw.ts                    ← Service Worker (백그라운드 푸시 처리)
├── functions/src/index.ts       ← Cloud Functions 3개
├── firestore.rules              ← 현재: allow read, write: if true (전체 공개)
├── SPEC.md                      ← 상세 명세서 (v1.4.0)
└── HANDOVER.md                  ← 이 파일
```

---

## 핵심 파일별 역할

### App.tsx
라우팅 허브. 모든 화면 전환이 여기서 일어남. 주요 상태:
- `showFamilyGroupRequest` — family_id 없는 유저에게 신청 화면 표시
- `googleLinkData` — 구글 로그인 후 계정 연결 선택 화면
- `logoutPending` / `backTimerRef` — 안드로이드 뒤로가기 이중확인 토스트

> **주의**: `applyMemberLogin`에서 `await recordLogin()` 후 `window.location.reload()` 순서 중요. 뒤집으면 로그인 이력이 안 쌓인다.

### familyStore.ts
모든 Firestore CRUD가 여기 있음. 컴포넌트는 이 store를 통해서만 데이터 접근.

### useTreeLayout.ts
촌수 계산(`getChusu`), 계통 분류(`classifyBranch`), 가시성(`canSeeFull`), 레이아웃 전체가 여기에. 건드리면 트리 렌더링에 광범위한 영향.

### functions/src/index.ts
Cloud Functions 3개:
1. `onInfoRequestCreated` — 정보공개 요청 즉시 FCM 알림
2. `sendAnniversaryReminders` — 매시 실행, KST 설정 시각에만 발송
3. `cleanupLoginLogs` — 매월 1일, 1년 초과 로그 삭제

---

## 인증 구조 (헷갈리는 부분)

자체 인증 + Firebase Auth 병행 사용. **Firebase Auth는 Google 로그인 팝업에만 사용**하고, 실제 계정 데이터는 Firestore `members` 컬렉션에 있음.

```
로그인 → Firestore members 조회 → localStorage에 상태 저장 → window.location.reload()
```

localStorage 키는 반드시 `storageKeys.ts`의 `LS.*`, `SS.*` 상수 사용. 문자열 직접 쓰지 말 것.

---

## 관리자 계정

- `members` 컬렉션에 `is_admin: true` 인 단 하나의 계정
- AdminView는 회원 관리, 푸시 설정, 가족집단 관리, 구글 계정 연동 포함
- 관리자 이메일을 여러 화면에서 보여줘야 할 때: `useAdminEmail()` 훅 사용 (3곳에서 공용)

---

## Firestore 컬렉션 목록

```
persons, relationships, members, invites,
approval_requests, info_requests, info_access,
person_access_pairs, login_logs, settings/push
```

`settings/push` — 단일 문서. 푸시 알림 설정값 저장. 관리자 UI에서 수정.

---

## 모바일 대응

- 분기점: `max-width: 640px`
- 하단 네비: `mobile-bottom-nav` (App.css) — 모바일에서만 표시, 높이 76px
- `app-main`에 `padding-bottom: 76px` (모바일) — flow-wrapper가 하단 네비와 겹치지 않게
- FamilyTreeView의 미니맵 + 줌 슬라이더는 한 덩어리로 `bottom: 0` 위치

---

## PWA 주의사항

- `orientation: 'any'` — 가로/세로 모두 지원
- 이미 설치된 PWA는 새 배포 반영이 늦을 수 있음 → 기기에서 앱 제거 후 재설치로 즉시 반영
- 푸시 알림은 PWA 설치 후 첫 실행 시 권한 허용해야만 작동

---

## 사용자 성향 & 협업 스타일

- 코드 변경 후 빌드+배포까지 자동으로 해주길 선호
- 긴 설명보다 결과 중심으로 소통
- UI 변경은 모바일 화면 기준으로 먼저 검토
- 이모지 사용 안 함 (명시적으로 요청할 때만)
- 작업 후 Firebase deploy까지 완료해서 보고

---

## 최근 완료된 주요 작업 (v1.4.0)

| 항목 | 파일 |
|------|------|
| 관리자 푸시 알림 설정 UI | `AdminView.tsx`, `functions/src/index.ts` |
| 관리자 구글 계정 연동 | `AdminView.tsx` |
| 접속 로그 1년 보관 + 월 자동 삭제 | `functions/src/index.ts` (`cleanupLoginLogs`) |
| 안드로이드 뒤로가기 이중확인 토스트 | `App.tsx`, `App.css` |
| 초대 공유 보안 (이름 미포함) | `PersonDetail.tsx` |
| `useAdminEmail` 훅 추출 | `hooks/useAdminEmail.ts` |
| `GoogleLinkScreen` 미사용 prop 제거 | `GoogleLinkScreen.tsx` |
| FamilyGroupRequestScreen hard refresh 버그 수정 | `App.tsx` |
| `recordLogin` await 버그 수정 (로그 미기록 문제) | `App.tsx` |
| SPEC.md v1.4.0 보완 | `SPEC.md` |

---

## 알려진 이슈 / 미구현

| 항목 | 비고 |
|------|------|
| Firestore 보안 규칙 전체 공개 | 현재 `allow read, write: if true`. 확장 시 규칙 강화 필요 |
| 사진 업로드 | `photo_url` 필드 있음, UI 없음 |
| 비밀번호 자체 리셋 | 구글 미연결 시 관리자 이메일 문의로 처리 |
| CSV 배우자 1명 제한 | 복수 배우자 미지원 |
| 가족 병합 UI | 수동 CSV로만 가능 |

---

## 자주 하는 실수

1. **빌드 없이 배포** → 변경 미반영. 항상 `npm run build` 먼저.
2. **Functions 수정 후 hosting만 배포** → `--only functions` 별도 필요.
3. **localStorage 키 하드코딩** → `LS.FAMILY_ID` 같은 상수 사용.
4. **`window.location.reload()` 전에 async 작업** → reload가 Firestore 쓰기를 죽임. 반드시 `await` 후 reload.
5. **모바일 테스트 누락** → AdminView, FamilyTreeView 등은 모바일 레이아웃 별도 확인 필요.

---

*작성: Claude Sonnet 4.6 — 2026-05-31*
