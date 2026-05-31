import { useState } from 'react';
import './HelpView.css';

interface Props { onClose: () => void; }

interface Section {
  id: string;
  icon: string;
  title: string;
  content: React.ReactNode;
}

export function HelpView({ onClose }: Props) {
  const [open, setOpen] = useState<string | null>('tree');

  const toggle = (id: string) => setOpen(p => p === id ? null : id);

  const sections: Section[] = [
    {
      id: 'tree',
      icon: '🌳',
      title: '가계도 보기',
      content: (
        <>
          <p className="help-para">화면 중앙에 가족 구성원들이 나무 형태로 표시됩니다.</p>
          <ul className="help-list">
            <li>상단 탭 <b>친가 · 외가 · 처가 · 처외가</b>를 눌러 가계 계통을 전환할 수 있습니다.</li>
            <li>두 손가락으로 확대/축소, 드래그로 이동할 수 있습니다.</li>
            <li>인물 노드를 클릭하면 상세 정보 패널이 열립니다.</li>
          </ul>
          <div className="help-tip">
            💡 배우자가 없는 경우 처가/시가 탭은 표시되지 않습니다.
          </div>
        </>
      ),
    },
    {
      id: 'add',
      icon: '➕',
      title: '가족 추가하기',
      content: (
        <>
          <p className="help-para">트리에 새로운 가족을 추가할 수 있습니다.</p>
          <ol className="help-steps">
            <li><span className="step-num">1</span> 트리에서 인물 노드를 클릭합니다.</li>
            <li><span className="step-num">2</span> 상세 패널에서 <b>가족 추가</b> 버튼을 누릅니다.</li>
            <li><span className="step-num">3</span> 관계를 선택합니다: <b>부모 · 배우자 · 자녀</b></li>
            <li><span className="step-num">4</span> 이름, 생년월일 등 정보를 입력하고 저장합니다.</li>
          </ol>
          <div className="help-tip">
            💡 생년월일은 양력·음력을 선택할 수 있습니다. 정확히 모를 경우 비워둬도 됩니다.
          </div>
        </>
      ),
    },
    {
      id: 'private',
      icon: '🔒',
      title: '비공개 인물 정보 보기',
      content: (
        <>
          <p className="help-para">자물쇠 아이콘이 있는 인물은 비공개 상태로, 이름 외 정보가 숨겨져 있습니다.</p>
          <div className="help-tip">
            💡 나와 <b>1촌(부모·자녀)</b>인 인물은 별도 요청 없이 자동으로 공개됩니다.
          </div>
          <ol className="help-steps">
            <li><span className="step-num">1</span> 비공개 인물 노드를 클릭합니다.</li>
            <li><span className="step-num">2</span> <b>정보공개 요청하기</b> 버튼을 누릅니다.</li>
            <li><span className="step-num">3</span> 권한자가 승인하면 상세 정보를 열람할 수 있습니다.</li>
          </ol>
          <div className="help-warn">
            ⚠️ 정보공개는 <b>양방향</b>입니다. 상대방의 정보를 공유받으면, 나의 정보도 상대방에게 공유됩니다.
          </div>
        </>
      ),
    },
    {
      id: 'invite',
      icon: '🔗',
      title: '가족 초대하기',
      content: (
        <>
          <p className="help-para">가족 구성원을 앱에 초대해 직접 본인 정보를 관리하게 할 수 있습니다.</p>
          <ol className="help-steps">
            <li><span className="step-num">1</span> 트리에서 초대할 인물 노드를 클릭합니다.</li>
            <li><span className="step-num">2</span> <b>초대 링크 만들기</b> 버튼을 누릅니다.</li>
            <li><span className="step-num">3</span> 생성된 링크를 카카오톡 등으로 가족에게 공유합니다.</li>
            <li><span className="step-num">4</span> 가족이 링크로 접속해 회원가입하면 자동으로 연결됩니다.</li>
          </ol>
          <div className="help-tip">
            💡 초대 링크는 <b>30일간</b> 유효합니다.
          </div>
        </>
      ),
    },
    {
      id: 'anniversary',
      icon: '📅',
      title: '기념일 확인',
      content: (
        <>
          <p className="help-para">가족의 생일과 기일을 한눈에 확인할 수 있습니다.</p>
          <ul className="help-list">
            <li>상단의 <b>📅</b> 버튼을 누르면 기념일 목록이 열립니다.</li>
            <li>가까운 날짜 순으로 정렬되어 표시됩니다.</li>
            <li>이름 옆에 관계명(<b>아버지 · 어머니 · 나</b> 등)이 표시됩니다.</li>
            <li><span className="badge-sample today-s">오늘</span> <span className="badge-sample soon-s">D-7 이내</span> <span className="badge-sample near-s">D-30 이내</span> 색상으로 구분됩니다.</li>
          </ul>
          <div className="help-tip">
            💡 음력 생일은 매년 양력으로 자동 환산되어 표시됩니다.
          </div>
        </>
      ),
    },
    {
      id: 'push',
      icon: '🔔',
      title: '알림 설정',
      content: (
        <>
          <p className="help-para">앱을 홈 화면에 설치하면 자동으로 알림을 받을 수 있습니다.</p>
          <div className="help-tip">
            💡 <b>PWA로 설치한 경우에만</b> 알림이 동작합니다. 일반 브라우저에서는 알림이 오지 않아요.
          </div>
          <div className="help-sub">
            <span className="help-sub-icon">📬</span>
            <div>
              <b>정보공개 요청 알림</b>
              <p>다른 가족이 내 정보를 요청하면 즉시 알림이 발송됩니다.</p>
            </div>
          </div>
          <div className="help-sub">
            <span className="help-sub-icon">🎂</span>
            <div>
              <b>기념일 알림 (매일 오전 8시)</b>
              <p>6촌 이내 가족의 생일·기일을 <b>7일 전, 3일 전, 1일 전, 당일</b> 알려드립니다. 양력·음력 모두 지원합니다.</p>
            </div>
          </div>
          <div className="help-warn">
            ⚠️ 알림을 받으려면 앱 설치 후 첫 실행 시 뜨는 권한 요청에서 <b>허용</b>을 눌러야 합니다.
          </div>
        </>
      ),
    },
    {
      id: 'search',
      icon: '🔍',
      title: '인물 검색',
      content: (
        <>
          <p className="help-para">이름으로 가족 구성원을 빠르게 찾을 수 있습니다.</p>
          <ol className="help-steps">
            <li><span className="step-num">1</span> 상단의 <b>🔍</b> 버튼을 누릅니다.</li>
            <li><span className="step-num">2</span> 이름을 입력하면 실시간으로 검색됩니다.</li>
            <li><span className="step-num">3</span> 검색 결과를 클릭하면 해당 인물의 상세 정보로 이동합니다.</li>
          </ol>
        </>
      ),
    },
    {
      id: 'mymenu',
      icon: '👤',
      title: 'My 메뉴',
      content: (
        <>
          <p className="help-para">상단(또는 하단) <b>👤 My</b> 버튼을 누르면 My 메뉴가 열립니다.</p>
          <div className="help-sub">
            <span className="help-sub-icon">📬</span>
            <div>
              <b>정보공개 요청</b>
              <p>다른 구성원에게 받은 정보공개 요청을 확인하고 수락 또는 거절할 수 있습니다. 처리할 요청이 있으면 버튼에 빨간 표시가 나타납니다.</p>
            </div>
          </div>
          <div className="help-sub">
            <span className="help-sub-icon">🔒</span>
            <div>
              <b>비밀번호 변경</b>
              <p>현재 비밀번호를 확인한 후 새 비밀번호로 변경할 수 있습니다. 새 비밀번호는 6자 이상이어야 합니다.</p>
            </div>
          </div>
          <div className="help-sub">
            <span className="help-sub-icon">🔗</span>
            <div>
              <b>구글 계정 연결</b>
              <p>구글 계정을 연결해두면 비밀번호를 잊어버려도 구글로 로그인할 수 있습니다. 연결되지 않은 경우 탭에 <b>!</b> 표시가 나타납니다.</p>
            </div>
          </div>
        </>
      ),
    },
    {
      id: 'login',
      icon: '🔑',
      title: '로그인 방법',
      content: (
        <>
          <p className="help-para">두 가지 방법으로 로그인할 수 있습니다.</p>
          <div className="help-sub">
            <span className="help-sub-icon">G</span>
            <div>
              <b>Google로 로그인</b>
              <p>구글 계정이 연결되어 있으면 비밀번호 없이 바로 로그인됩니다. <b>비밀번호를 잊어버린 경우에도 사용 가능합니다.</b></p>
            </div>
          </div>
          <div className="help-sub">
            <span className="help-sub-icon">ID</span>
            <div>
              <b>아이디 / 비밀번호</b>
              <p>가입 시 설정한 아이디와 비밀번호로 로그인합니다.</p>
            </div>
          </div>
          <div className="help-tip">
            💡 비밀번호 분실 시를 대비해 My 메뉴 → 구글 탭에서 미리 구글 계정을 연결해두세요.
          </div>
        </>
      ),
    },
    {
      id: 'account',
      icon: '🆕',
      title: '처음 가입했는데 트리가 없어요',
      content: (
        <>
          <p className="help-para">가족 트리는 초대를 통해 연결하거나, 관리자 승인을 받아 새로 생성할 수 있습니다.</p>
          <div className="help-sub">
            <span className="help-sub-icon">1</span>
            <div>
              <b>초대 링크로 가입한 경우</b>
              <p>이미 등록된 가족 트리에 자동으로 연결됩니다.</p>
            </div>
          </div>
          <div className="help-sub">
            <span className="help-sub-icon">2</span>
            <div>
              <b>초대 링크 없이 가입한 경우</b>
              <p>가족 트리 생성을 신청할 수 있습니다. 관리자가 승인하면 새 트리가 만들어집니다.</p>
            </div>
          </div>
          <div className="help-tip">
            💡 가족 중 누군가가 이미 가입해 있다면, 그 분께 <b>초대 링크</b>를 요청하세요.
          </div>
        </>
      ),
    },
  ];

  return (
    <div className="help-backdrop" onClick={onClose}>
      <div className="help-panel" onClick={e => e.stopPropagation()}>
        <div className="help-header">
          <div className="help-header-title">
            <span className="help-logo">📖</span>
            <div>
              <h2>사용 안내</h2>
              <p>우리 가족 가계도 이용 방법</p>
            </div>
          </div>
          <button className="help-close" onClick={onClose}>✕</button>
        </div>

        <div className="help-body">
          {sections.map(s => (
            <div key={s.id} className={`help-section ${open === s.id ? 'open' : ''}`}>
              <button className="help-section-header" onClick={() => toggle(s.id)}>
                <span className="help-section-icon">{s.icon}</span>
                <span className="help-section-title">{s.title}</span>
                <span className="help-chevron">{open === s.id ? '▲' : '▼'}</span>
              </button>
              {open === s.id && (
                <div className="help-section-body">{s.content}</div>
              )}
            </div>
          ))}

          <div className="help-footer">
            문의 사항은 가계도 관리자에게 연락하세요.
          </div>
        </div>
      </div>
    </div>
  );
}
