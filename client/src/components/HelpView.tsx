import { useMemo, useState } from 'react';
import { useAdminEmailStatus } from '../hooks/useAdminEmail';
import { formatSendTime, usePushSendTime } from '../hooks/usePushSendTime';
import { AI_ENABLED } from '../lib/appConfig';
import './HelpView.css';
import { Icon, type IconName } from './Icon';

interface Props { onClose: () => void; }
interface Item {
  id: string;
  icon: IconName;
  title: string;
  /** 검색용 단어 (제목 외에 사용자가 떠올릴 만한 표현) */
  keywords: string;
  content: React.ReactNode;
}
interface Group { id: string; label: string; items: Item[]; }

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <li><span className="step-num">{n}</span>{children}</li>
);

/** 관리자가 정한 기념일 알림 발송 시각 */
const SendTime = () => <>{formatSendTime(usePushSendTime())}</>;

const ALL_GROUPS: Group[] = [
  {
    id: 'basic',
    label: '둘러보기',
    items: [
      {
        id: 'tree',
        icon: 'tree',
        title: '가계도 화면 보는 법',
        keywords: '탭 친가 외가 처가 시가 처외가 시외가 색상 확대 축소 줌 이동 미니맵 나 버튼 고인',
        content: (
          <>
            <p className="help-para">가족이 나무 모양으로 연결되어 보여요. 손가락 두 개로 <b>확대·축소</b>하고, 끌어서 <b>이동</b>할 수 있어요.</p>

            <b className="help-label">위쪽 탭으로 집안 바꿔 보기</b>
            <ul className="help-list">
              <li><b>친가</b> — 아버지 쪽 가족</li>
              <li><b>외가</b> — 어머니 쪽 가족</li>
              <li><b>처가·시가 / 처외가·시외가</b> — 배우자 쪽 가족 (배우자가 등록된 경우에만 보여요)</li>
            </ul>

            <b className="help-label">색깔의 의미</b>
            <ul className="help-list">
              <li><span className="help-node-dot male"></span> 파란색 — 남성</li>
              <li><span className="help-node-dot female"></span> 분홍색 — 여성</li>
              <li><span className="help-node-dot me"></span> 보라색 + <span className="help-node-badge">나</span> — 나</li>
              <li><span className="help-node-dot deceased"></span> 회갈색 테두리와 이름 앞 故 — 돌아가신 분</li>
              <li><Icon name="lock" /> 비공개 — 아직 정보가 공개되지 않은 분</li>
            </ul>

            <b className="help-label">길을 잃었을 때</b>
            <ul className="help-list">
              <li>오른쪽 위 <b>"나"</b> 버튼을 누르면 내 위치로 돌아와요.</li>
              <li>오른쪽 아래 <b>미니맵</b>으로 전체 모습을 보고 원하는 곳으로 이동할 수 있어요.</li>
            </ul>
          </>
        ),
      },
      {
        id: 'detail',
        icon: 'user',
        title: '가족 정보 보기',
        keywords: '상세 나이 촌수 관계 연락처 전화 메일 근황 결혼기념일 기일',
        content: (
          <>
            <p className="help-para">가계도에서 사람을 <b>누르면</b> 자세한 정보가 열려요.</p>
            <ul className="help-list">
              <li><b>나이·생일</b> — 만 나이로 보여요. 음력 생일은 날짜 옆에 "(음)"이 붙어요.</li>
              <li><b>촌수·관계</b> — "3촌 (삼촌)"처럼 나와의 관계를 자동으로 계산해 줘요.</li>
              <li><b><Icon name="chat" /> 근황</b> — 가족이 남긴 최근 소식이에요.</li>
              <li><b><Icon name="phone" /> 연락처</b> — 번호나 메일을 누르면 바로 전화·메일을 보낼 수 있어요.</li>
              <li><b><Icon name="ring" /> 배우자</b> — 결혼기념일이 있으면 함께 보여요.</li>
            </ul>
          </>
        ),
      },
      {
        id: 'search',
        icon: 'search',
        title: '가족 찾기 (검색)',
        keywords: '검색 이름 찾기',
        content: (
          <>
            <ol className="help-steps">
              <Step n={1}>메뉴에서 <b><Icon name="search" /> 검색</b>을 누르세요.</Step>
              <Step n={2}>이름을 입력하면 바로 결과가 나와요.</Step>
              <Step n={3}>결과를 누르면 가계도에서 그 사람 위치로 이동해요.</Step>
            </ol>
            <div className="help-tip"><Icon name="bulb" /> 비공개인 분은 검색되지 않아요. 정보공개 요청이 수락되면 검색할 수 있어요.</div>
          </>
        ),
      },
    ],
  },
  {
    id: 'build',
    label: '가계도 만들기',
    items: [
      {
        id: 'add',
        icon: 'plus',
        title: '가족 추가하기',
        keywords: '추가 등록 아버지 어머니 형제 자매 배우자 자녀 아들 딸',
        content: (
          <>
            <ol className="help-steps">
              <Step n={1}>가계도에서 <b>기준이 될 사람</b>을 누르세요. (예: 내 아버지를 추가하려면 "나")</Step>
              <Step n={2}>아래쪽 <b>"○○의 가족 추가하기"</b>를 누르세요.</Step>
              <Step n={3}>관계(아버지·어머니·형제/자매·배우자·자녀)를 고르세요.</Step>
              <Step n={4}>이름과 생년월일을 넣고 저장하면 끝!</Step>
            </ol>
            <div className="help-tip"><Icon name="bulb" /> 추가한 사람을 다시 눌러 같은 방법으로 계속 넓혀 가면 돼요. 부모를 둘 다 추가하면 두 분은 자동으로 부부로 연결돼요.</div>
            <div className="help-warn"><Icon name="alert" /> <b>형제/자매</b>는 부모가 먼저 등록되어 있어야 추가할 수 있어요.</div>
          </>
        ),
      },
      {
        id: 'edit',
        icon: 'edit',
        title: '정보 수정 · 사진 바꾸기',
        keywords: '편집 수정 사진 아바타 프로필 근황 삭제 권한 관리 결혼기념일 연락처',
        content: (
          <>
            <p className="help-para">사람을 누른 뒤 <b><Icon name="edit" /> 편집</b>을 누르면 이름, 생년월일, 연락처, 근황, 결혼기념일 등을 고칠 수 있어요.</p>

            <b className="help-label">사진 · 아바타</b>
            <ul className="help-list">
              <li>편집 화면에서 동그란 사진 영역을 누르세요.</li>
              <li><b><Icon name="camera" /> 사진 올리기</b>로 실제 사진을 넣거나, 인물·동물·식물 캐릭터 중에서 고를 수 있어요.</li>
            </ul>

            <b className="help-label"><Icon name="chat" /> 근황 남기기</b>
            <p className="help-para">편집 화면의 근황 칸에 적으면 오늘 날짜로 기록돼요. 최근 소식 몇 개만 남아요.</p>

            <b className="help-label">누가 수정할 수 있나요?</b>
            <ul className="help-list">
              <li><b>본인</b>의 정보</li>
              <li>내가 추가했고, 아직 <b>본인이 가입하지 않은</b> 사람</li>
              <li>다른 사람에게 <b>편집 권한</b>을 받은 경우</li>
            </ul>
            <div className="help-tip"><Icon name="bulb" /> <b><Icon name="key" /> 권한 관리</b>를 누르면 다른 가족에게 편집을 맡길 수 있어요. 예: 부모님 정보를 자녀가 대신 관리</div>
            <div className="help-warn"><Icon name="alert" /> 이미 가입한 분은 <b>삭제할 수 없어요</b>. 또 삭제하면 연결이 끊기는 사람이 있으면, 그 사람을 먼저 정리해야 해요.</div>
          </>
        ),
      },
    ],
  },
  {
    id: 'together',
    label: '가족과 함께',
    items: [
      {
        id: 'invite',
        icon: 'link',
        title: '가족 초대하기',
        keywords: '초대 링크 카카오톡 카톡 문자 SMS 이메일 가입 공유',
        content: (
          <>
            <p className="help-para">가족이 직접 가입하면 자기 정보를 스스로 관리하고, 기념일 알림도 받을 수 있어요.</p>
            <ol className="help-steps">
              <Step n={1}>메뉴의 <b><Icon name="mail" /> 초대</b>를 누르면 아직 가입하지 않은 가족이 모여 있어요.</Step>
              <Step n={2}>초대할 사람 옆의 <b>초대</b> 버튼을 누르세요.</Step>
              <Step n={3}><b>카카오톡·문자·링크 복사</b> 중 편한 방법으로 보내세요.</Step>
              <Step n={4}>가족이 링크를 열고 가입하면, 가계도의 그 자리에 자동으로 연결돼요.</Step>
            </ol>
            <div className="help-tip"><Icon name="bulb" /> 가족을 새로 추가하면 바로 초대할 수 있고, 가계도에서 사람을 눌러 <b>"○○ 님을 가계도로 초대하기"</b>로 보내도 돼요.</div>
            <div className="help-tip"><Icon name="bulb" /> 연락처가 등록된 분은 정보 화면의 <b>SMS 초대 / 이메일 초대</b> 버튼으로 더 빠르게 보낼 수 있어요.</div>
            <div className="help-tip"><Icon name="bulb" /> 초대 링크는 <b>30일 동안</b>, <b>한 번만</b> 쓸 수 있어요.</div>
          </>
        ),
      },
      {
        id: 'private',
        icon: 'lock',
        title: '비공개인 분 정보 보기',
        keywords: '비공개 자물쇠 정보공개 요청 수락 거절 숨김',
        content: (
          <>
            <p className="help-para">먼 친척은 개인정보 보호를 위해 처음엔 <b><Icon name="lock" /> 비공개</b>로 보여요. 가까운 가족(부모·자녀·형제·배우자 등 <b>2촌 이내</b>)은 처음부터 보여요.</p>
            <ol className="help-steps">
              <Step n={1}>비공개인 분을 누르세요.</Step>
              <Step n={2}><b>정보공개 요청하기</b>를 누르세요.</Step>
              <Step n={3}>상대방이 수락하면 이름과 정보를 볼 수 있어요.</Step>
            </ol>
            <div className="help-warn"><Icon name="alert" /> 정보공개는 <b>서로</b> 하는 거예요. 상대 정보를 보게 되면 내 정보도 상대에게 보여요.</div>
            <div className="help-tip"><Icon name="bulb" /> 내가 받은 요청은 <b><Icon name="user" /> My → <Icon name="inbox" /> 정보공개 요청</b>에서 수락·거절할 수 있어요. 새 요청이 있으면 My 버튼에 빨간 숫자가 떠요.</div>
          </>
        ),
      },
      {
        id: 'ai',
        icon: 'sparkle',
        title: 'AI 서비스',
        keywords: 'AI 인공지능 유명인 연예인 생일 역사 오늘',
        content: (
          <>
            <p className="help-para">메뉴의 <b><Icon name="sparkle" /> AI</b>에서 재미있는 정보를 찾아볼 수 있어요.</p>
            <div className="help-sub">
              <span className="help-sub-icon"><Icon name="cake" /></span>
              <div>
                <b>나와 같은 날 태어난 유명인</b>
                <p>내 생일에 태어난 연예인·유명인을 알려줘요. 내 정보에 <b>생년월일</b>이 등록되어 있어야 해요.</p>
              </div>
            </div>
            <div className="help-sub">
              <span className="help-sub-icon"><Icon name="scroll" /></span>
              <div>
                <b>오늘 일어난 역사적 사건</b>
                <p>오늘 날짜에 있었던 한국사·세계사 사건을 알려줘요.</p>
              </div>
            </div>
            <div className="help-warn"><Icon name="alert" /> AI가 만든 내용이라 틀릴 수 있어요. 재미로 참고해 주세요.</div>
          </>
        ),
      },
    ],
  },
  {
    id: 'remind',
    label: '기념일 · 알림',
    items: [
      {
        id: 'anniversary',
        icon: 'calendar',
        title: '기념일 보기',
        keywords: '기념일 생일 기일 제사 음력 디데이 D-day',
        content: (
          <>
            <p className="help-para">메뉴의 <b><Icon name="calendar" /> 기념일</b>을 누르면 가족의 생일과 기일이 <b>가까운 날짜 순</b>으로 나와요.</p>
            <div className="help-badge-grid">
              <span className="badge-sample ann-today">오늘</span>
              <span className="help-badge-desc">오늘이에요</span>
              <span className="badge-sample ann-soon">D-3</span>
              <span className="help-badge-desc">일주일 안</span>
              <span className="badge-sample ann-near">D-20</span>
              <span className="help-badge-desc">한 달 안</span>
              <span className="badge-sample ann-far">D-60</span>
              <span className="help-badge-desc">그 이후</span>
            </div>
            <ul className="help-list">
              <li>생일은 <b>만 나이</b>, 기일은 <b>몇 주기</b>인지 함께 보여요.</li>
              <li>음력 날짜는 올해 양력으로 자동으로 바꿔서 보여줘요.</li>
              <li>항목을 누르면 가계도에서 그 사람에게 이동해요.</li>
            </ul>
          </>
        ),
      },
      {
        id: 'push',
        icon: 'bell',
        title: '알림 받기',
        keywords: '알림 푸시 설정 끄기 켜기 차단 설치 앱',
        content: (
          <>
            <p className="help-para">생일·기일을 미리 알려주고, 정보공개 요청이 오면 바로 알려줘요.</p>
            <p className="help-para">기념일 알림은 <b>매일 <SendTime /></b>에 하루 한 번 모아서 와요. "내일은 사촌형 ○○○님의 생일"처럼 <b>나와의 관계</b>도 함께 보여줘요.</p>
            <div className="help-warn"><Icon name="alert" /> 안드로이드 폰과 컴퓨터는 인터넷 창으로 열어도 알림이 와요. <b>아이폰</b>은 <b>홈 화면에 추가</b>한 앱으로 열어야만 알림이 와요.</div>

            <b className="help-label">켜는 방법</b>
            <ol className="help-steps">
              <Step n={1}>알림 켜기 안내가 나오면 버튼을 누르고, 알림 권한 창에서 <b>허용</b>을 누르세요.</Step>
              <Step n={2}><b><Icon name="user" /> My</b> 아래쪽의 <b>기념일 알림</b>을 <b>ON</b>으로 켜세요.</Step>
              <Step n={3}>테스트 알림이 뜨는지 확인하세요. 안 보이면 "아니요"를 눌러 안내를 따라 주세요.</Step>
            </ol>

            <b className="help-label">내게 맞게 조정하기</b>
            <p className="help-para"><b><Icon name="calendar" /> 기념일</b> 화면 오른쪽 위 <b><Icon name="bell" /></b>를 누르면 바꿀 수 있어요.</p>
            <ul className="help-list">
              <li><b>알림 시기</b> — 당일 / 1일 전 / 3일 전 / 7일 전 (여러 개 선택 가능)</li>
              <li><b>촌수 범위</b> — 몇 촌까지 받을지 (3~8촌)</li>
              <li><b>알림 종류</b> — 생일 <Icon name="cake" /> / 기일 <Icon name="candle" /></li>
            </ul>
          </>
        ),
      },
    ],
  },
  {
    id: 'account',
    label: '내 계정',
    items: [
      {
        id: 'login',
        icon: 'key',
        title: '로그인 · 비밀번호',
        keywords: '로그인 비밀번호 찾기 분실 변경 구글 아이디 기억',
        content: (
          <>
            <ul className="help-list">
              <li><b>구글로 로그인</b> — 구글 계정을 연결해 두면 비밀번호 없이 들어올 수 있어요.</li>
              <li><b>아이디·비밀번호</b> — "아이디 기억하기"를 체크하면 다음에 자동으로 입력돼요.</li>
            </ul>
            <div className="help-tip"><Icon name="bulb" /> 비밀번호를 잊을 때를 대비해 <b><Icon name="user" /> My → <Icon name="link" /> 구글</b>에서 구글 계정을 미리 연결해 두세요.</div>

            <b className="help-label">비밀번호를 잊었다면</b>
            <ol className="help-steps">
              <Step n={1}>로그인 화면의 <b>비밀번호를 잊으셨나요?</b>를 누르세요.</Step>
              <Step n={2}>아이디, 가계도에 등록된 이름, 생년월일, 이메일을 입력하세요.</Step>
              <Step n={3}>정보가 맞으면 이메일로 <b>재설정 링크</b>가 와요 (1시간 안에 사용).</Step>
            </ol>
            <div className="help-tip"><Icon name="bulb" /> 정보가 맞지 않으면 그 화면에서 <b>관리자에게 요청</b>할 수 있어요.</div>

            <b className="help-label">비밀번호 바꾸기</b>
            <p className="help-para"><b><Icon name="user" /> My → <Icon name="lock" /> 비밀번호</b>에서 바꿀 수 있어요. (6자 이상)</p>
          </>
        ),
      },
      {
        id: 'mymenu',
        icon: 'user',
        title: 'My 메뉴에서 할 수 있는 일',
        keywords: 'My 마이 내 정보 요청 비밀번호 구글 연결 해제 알림 앱 설치',
        content: (
          <ul className="help-list">
            <li><b><Icon name="inbox" /> 정보공개 요청</b> — 받은 요청 수락·거절</li>
            <li><b><Icon name="lock" /> 비밀번호</b> — 비밀번호 변경</li>
            <li><b><Icon name="link" /> 구글</b> — 구글 계정 연결·해제 (연결 안 되어 있으면 <b>!</b> 표시)</li>
            <li><b>기념일 알림</b> — 알림 켜기·끄기</li>
            <li><b>탈퇴 및 문의</b> — 관리자 이메일 확인</li>
          </ul>
        ),
      },
    ],
  },
  {
    id: 'faq',
    label: '자주 묻는 질문',
    items: [
      {
        id: 'faq-edit',
        icon: 'help',
        title: '편집 버튼이 안 보여요',
        keywords: '편집 수정 안됨 권한',
        content: (
          <p className="help-para">본인, 또는 내가 추가했지만 아직 가입하지 않은 사람만 고칠 수 있어요. 다른 분의 정보를 고치려면 그 분(또는 등록한 분)에게 <b><Icon name="key" /> 권한 관리</b>로 편집 권한을 달라고 부탁하세요.</p>
        ),
      },
      {
        id: 'faq-notif',
        icon: 'help',
        title: '알림이 오지 않아요',
        keywords: '알림 안옴 푸시 차단',
        content: (
          <ul className="help-list">
            <li>아이폰은 <b>홈 화면에 추가</b>한 앱으로 열어야 알림이 와요.</li>
            <li>기념일 알림은 <SendTime />에 와요. 알림 범위(촌수) 안에 다가오는 생일·기일이 없으면 오지 않아요.</li>
            <li>휴대폰 설정에서 이 앱의 <b>알림이 허용</b>되어 있는지 확인하세요.</li>
            <li><Icon name="bell-off" /> 표시가 보이면 눌러서 안내를 따라 주세요.</li>
          </ul>
        ),
      },
      {
        id: 'faq-kakao',
        icon: 'help',
        title: '카카오톡에서 링크가 잘 안 열려요',
        keywords: '카카오톡 카톡 구글 로그인 차단 크롬 사파리 아이폰 안드로이드',
        content: (
          <>
            <p className="help-para">카카오톡 안에서 열면 구글 로그인 등이 막혀요. 다른 브라우저로 열어 주세요.</p>
            <ul className="help-list">
              <li><b>안드로이드</b> — 화면의 <b>Chrome으로 열기</b> 버튼을 누르세요.</li>
              <li><b>아이폰</b> — <b>링크 복사</b> 후 Safari 주소창에 붙여넣으세요.</li>
            </ul>
          </>
        ),
      },
      {
        id: 'faq-tab',
        icon: 'help',
        title: '탭을 눌렀는데 아무도 없어요',
        keywords: '외가 처가 비어 있음 빈 화면',
        content: (
          <p className="help-para">그 집안의 기준이 되는 사람이 아직 없어서 그래요. 예를 들어 <b>외가</b>는 어머니를, <b>처가·시가</b>는 배우자를 먼저 추가하면 보이기 시작해요.</p>
        ),
      },
      {
        id: 'faq-delete',
        icon: 'help',
        title: '삭제 버튼이 없어요',
        keywords: '삭제 지우기 안됨',
        content: (
          <p className="help-para">이미 가입해서 계정이 연결된 분은 삭제할 수 없어요. 잘못 등록된 경우 관리자에게 문의해 주세요.</p>
        ),
      },
    ],
  },
];

const GROUPS: Group[] = AI_ENABLED ? ALL_GROUPS
  : ALL_GROUPS.map(g => ({ ...g, items: g.items.filter(i => i.id !== 'ai') })).filter(g => g.items.length > 0);

const QUICK_START: Array<{ icon: IconName; text: string }> = [
  { icon: 'hand', text: '"나"를 눌러 내 정보 채우기' },
  { icon: 'plus', text: '부모님·배우자·자녀 추가하기' },
  { icon: 'link', text: '가족에게 초대 링크 보내기' },
];

export function HelpView({ onClose }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const { email: adminEmail, loading: emailLoading } = useAdminEmailStatus();
  const toggle = (id: string) => setOpen(p => p === id ? null : id);

  const q = query.trim().toLowerCase();
  const groups = useMemo(() => {
    if (!q) return GROUPS;
    return GROUPS
      .map(g => ({ ...g, items: g.items.filter(i => `${i.title} ${i.keywords}`.toLowerCase().includes(q)) }))
      .filter(g => g.items.length > 0);
  }, [q]);
  const resultCount = groups.reduce((n, g) => n + g.items.length, 0);
  // 검색 중에는 결과가 하나뿐이면 바로 펼쳐 보여준다
  const isOpen = (id: string) => open === id || (!!q && resultCount === 1);

  return (
    <div className="help-backdrop" onClick={onClose}>
      <div className="help-panel" onClick={e => e.stopPropagation()}>
        <div className="help-header">
          <div className="help-header-title">
            <span className="help-logo"><Icon name="book" /></span>
            <div>
              <h2>도움말</h2>
              <p>궁금한 내용을 찾아보세요</p>
            </div>
          </div>
          <button className="help-close" onClick={onClose}>✕</button>
        </div>

        <div className="help-search">
          <span className="help-search-icon"><Icon name="search" /></span>
          <input
            className="help-search-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="예: 알림, 초대, 사진, 비밀번호"
          />
          {query && <button className="help-search-clear" onClick={() => setQuery('')}>✕</button>}
        </div>

        <div className="help-body">
          {!q && (
            <div className="help-quickstart">
              <p className="help-quickstart-title">처음이신가요? 이렇게 시작해 보세요</p>
              <ol className="help-quickstart-list">
                {QUICK_START.map((s, i) => (
                  <li key={i}>
                    <span className="help-quickstart-num">{i + 1}</span>
                    <span className="help-quickstart-icon"><Icon name={s.icon} /></span>
                    <span>{s.text}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {groups.map(g => (
            <div key={g.id} className="help-group">
              <p className="help-group-label">{g.label}</p>
              {g.items.map(s => (
                <div key={s.id} className={`help-section ${isOpen(s.id) ? 'open' : ''}`}>
                  <button className="help-section-header" onClick={() => toggle(s.id)}>
                    <span className="help-section-icon"><Icon name={s.icon} /></span>
                    <span className="help-section-title">{s.title}</span>
                    <span className="help-chevron">{isOpen(s.id) ? '▲' : '▼'}</span>
                  </button>
                  {isOpen(s.id) && (
                    <div className="help-section-body">{s.content}</div>
                  )}
                </div>
              ))}
            </div>
          ))}

          {q && resultCount === 0 && (
            <p className="help-empty">"{query}"에 대한 도움말이 없어요.<br />아래 이메일로 문의해 주세요.</p>
          )}

          <div className="help-contact">
            <p className="help-contact-title"><Icon name="chat" /> 해결되지 않았나요?</p>
            <p className="help-contact-desc">불편한 점, 오류, 계정 탈퇴 요청은 관리자에게 메일로 보내 주세요. 탈퇴 시 아이디를 함께 적어 주세요. (탈퇴해도 가계도의 인물 정보는 남아요)</p>
            {adminEmail
              ? <a href={`mailto:${adminEmail}?subject=[가계도] 문의`} className="help-contact-link">{adminEmail}</a>
              : <span className="help-contact-loading">{emailLoading ? '이메일 불러오는 중...' : '가계도를 처음 만든 가족(관리자)에게 직접 연락해 주세요.'}</span>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
