import { useState } from 'react';
import { useAdminEmail } from '../hooks/useAdminEmail';
import './HelpView.css';

interface Props { onClose: () => void; }
interface Section { id: string; icon: string; title: string; content: React.ReactNode; }

export function HelpView({ onClose }: Props) {
  const [open, setOpen] = useState<string | null>('tree');
  const adminEmail = useAdminEmail();
  const toggle = (id: string) => setOpen(p => p === id ? null : id);

  const sections: Section[] = [
    {
      id: 'tree',
      icon: '🌳',
      title: '가계도 보기',
      content: (
        <>
          <p className="help-para">화면 중앙에 가족 구성원들이 나무 형태로 표시됩니다.</p>

          <b className="help-label">상단 탭</b>
          <ul className="help-list">
            <li><b>친가</b> — 아버지(남편) 쪽 직계 가족</li>
            <li><b>외가</b> — 어머니(아내) 쪽 직계 가족</li>
            <li><b>처가 / 시가</b> — 배우자의 아버지 쪽 가족</li>
            <li><b>처외가 / 시외가</b> — 배우자의 어머니 쪽 가족</li>
          </ul>
          <div className="help-tip">💡 탭 레이블은 보는 사람(뷰포인트)의 성별에 따라 자동으로 바뀝니다. 배우자가 없으면 처가·처외가 탭은 표시되지 않습니다.</div>

          <b className="help-label">노드 색상</b>
          <ul className="help-list">
            <li><span className="help-node-dot male"></span> <b>파란색</b> — 남성</li>
            <li><span className="help-node-dot female"></span> <b>분홍색</b> — 여성</li>
            <li><span className="help-node-dot me"></span> <b>보라색</b> + <span className="help-node-badge">나</span> — 나 (현재 기준 인물)</li>
            <li><span className="help-node-dot deceased"></span> <b>탈색</b> — 고인 (남/여 색이 흐리게 표시)</li>
            <li><b>🔒 비공개</b> — 이름과 정보가 모두 숨겨진 인물</li>
          </ul>

          <b className="help-label">화면 컨트롤</b>
          <ul className="help-list">
            <li><b>우측 상단 "나" 버튼</b> — 내 위치로 화면을 자동 이동·줌 조정</li>
            <li><b>우측 하단 슬라이더</b> — − · + 버튼 또는 슬라이더로 줌 조절</li>
            <li><b>우측 하단 미니맵</b> — 슬라이더 바로 위, 전체 트리 위치를 한눈에 확인·드래그 이동 가능</li>
            <li>두 손가락으로 확대/축소, 드래그로 이동</li>
          </ul>
        </>
      ),
    },
    {
      id: 'detail',
      icon: '🧑',
      title: '인물 상세 정보',
      content: (
        <>
          <p className="help-para">인물 노드를 클릭하면 오른쪽(또는 하단)에 상세 패널이 열립니다.</p>
          <ul className="help-list">
            <li><b>나이</b> — 만 나이로 표시 (생년월일 등록 시)</li>
            <li><b>생년월일</b> — 양력 또는 음력 표시, 음력인 경우 "(음)" 표기</li>
            <li><b>결혼기념일</b> — 배우자 관계에 기념일이 등록된 경우 💍 표시</li>
            <li><b>관계·촌수</b> — "아버지", "어머니", "3촌" 등 자동 계산</li>
            <li><b>연락처</b> — 등록된 휴대폰·이메일·메모 (클릭하면 전화·메일 앱 연결)</li>
            <li><b>기일</b> — 고인인 경우 기일 날짜 표시</li>
          </ul>

          <b className="help-label">패널 버튼</b>
          <ul className="help-list">
            <li><b>편집 / 삭제</b> — 본인 노드이거나, 아직 아무도 연결하지 않은 경우 내가 추가한 인물만 수정·삭제할 수 있습니다. 이름·생년월일·고인 여부·연락처·메모 외에, 배우자가 있는 경우 <b>결혼기념일</b>도 입력할 수 있습니다. 편집 화면에서 <b>🖼️ 아바타 선택</b>으로 노드 이미지를 지정할 수 있습니다.</li>
            <li><b>SMS 초대 / 이메일 초대</b> — 연락처가 등록된 미연결 인물에게 해당 매체로 바로 초대 링크를 보낼 수 있습니다.</li>
            <li><b>"이름의 가족 추가하기"</b> — 이 인물과 연결되는 새 가족 추가</li>
            <li><b>"이름 님을 가계도로 초대하기"</b> — 아직 가입하지 않은 생존 인물에게 초대 링크 발송</li>
          </ul>
          <div className="help-tip">💡 다른 계정과 이미 연결된 인물은 해당 본인만 편집할 수 있으며, 삭제 버튼도 표시되지 않습니다.</div>
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
            <li><span className="step-num">3</span> 관계를 선택합니다.</li>
            <li><span className="step-num">4</span> 이름, 생년월일 등 정보를 입력하고 저장합니다.</li>
            <li><span className="step-num">5</span> 추가된 인물을 다시 클릭해 같은 방법으로 반복하면 가계도를 계속 확장할 수 있습니다.</li>
          </ol>

          <b className="help-label">추가 가능한 관계</b>
          <ul className="help-list">
            <li><b>아버지 / 어머니</b> — 성별이 자동으로 지정됨</li>
            <li><b>형제 / 자매</b> — 부모가 등록된 경우에만 추가 가능</li>
            <li><b>배우자</b></li>
            <li><b>자녀</b></li>
          </ul>
          <div className="help-tip">💡 생년월일은 양력·음력을 선택할 수 있습니다. 부모를 추가하면 기존 부모와 배우자 관계가 자동으로 연결됩니다.</div>

          <b className="help-label">아바타 선택</b>
          <p className="help-para">추가 화면(또는 편집 화면)에서 <b>🖼️ 아바타</b>를 탭하면 캐릭터를 고를 수 있습니다. 세 가지 카테고리를 제공합니다.</p>
          <ul className="help-list">
            <li><b>인물</b> — 아기부터 노년까지 남녀 다양한 직업·연령대</li>
            <li><b>동물</b> — 고양이·강아지·토끼·곰·부엉이·여우</li>
            <li><b>식물</b> — 장미·해바라기·야자수</li>
          </ul>
        </>
      ),
    },
    {
      id: 'private',
      icon: '🔒',
      title: '비공개 인물 정보 보기',
      content: (
        <>
          <p className="help-para">트리에 🔒 자물쇠와 함께 <b>"비공개"</b>로 표시된 인물은 이름을 포함한 모든 정보가 숨겨진 상태입니다.</p>
          <div className="help-tip">💡 나와 <b>2촌 이내(부모·자녀·배우자 포함)</b>인 인물은 별도 요청 없이 자동으로 공개됩니다.</div>
          <ol className="help-steps">
            <li><span className="step-num">1</span> 비공개 인물 노드를 클릭합니다.</li>
            <li><span className="step-num">2</span> <b>정보공개 요청하기</b> 버튼을 누릅니다.</li>
            <li><span className="step-num">3</span> 해당 인물(또는 가족)이 <b>My 메뉴 → 정보공개 요청</b>에서 수락하면 이름과 상세 정보를 볼 수 있습니다.</li>
          </ol>
          <div className="help-warn">⚠️ 정보공개는 <b>양방향</b>입니다. 상대방 정보를 열람하게 되면 나의 정보도 상대방에게 공개됩니다.</div>
        </>
      ),
    },
    {
      id: 'invite',
      icon: '🔗',
      title: '가족 초대하기',
      content: (
        <>
          <p className="help-para">아직 가입하지 않은 가족 구성원을 앱에 초대해 직접 본인 계정을 연결하게 할 수 있습니다.</p>
          <ol className="help-steps">
            <li><span className="step-num">1</span> 트리에서 초대할 인물 노드를 클릭합니다.</li>
            <li><span className="step-num">2</span> 상세 패널에서 <b>초대 링크 만들기</b> 버튼을 누릅니다.</li>
            <li><span className="step-num">3</span> <b>카카오톡 공유</b> 또는 <b>문자 공유</b>, <b>링크 복사</b>로 가족에게 전달합니다.</li>
            <li><span className="step-num">4</span> 가족이 링크를 열면 초대 화면이 표시됩니다.<br />— <b>카카오톡(안드로이드)</b>: <b>Chrome으로 열기</b> 버튼을 눌러 Chrome에서 엽니다.<br />— <b>카카오톡(아이폰)</b>: <b>링크 복사</b> 후 Safari 주소창에 붙여넣기 합니다.<br />— <b>Chrome / Safari 직접 열기</b>: 바로 가입하기 버튼이 표시됩니다.</li>
            <li><span className="step-num">5</span> <b>가입하기</b>를 눌러 회원가입 후 로그인합니다.</li>
            <li><span className="step-num">6</span> <b>가계도에 등록된 본인 이름을 입력</b>해 본인 확인을 완료하면 계정이 자동으로 연결됩니다.</li>
          </ol>
          <div className="help-tip">💡 초대 링크는 <b>30일간</b> 유효하며, 한 번 사용하면 재사용할 수 없습니다.</div>
        </>
      ),
    },
    {
      id: 'anniversary',
      icon: '📅',
      title: '기념일 확인',
      content: (
        <>
          <p className="help-para">상단(또는 하단) <b>📅</b> 버튼을 누르면 가족의 생일·기일 목록이 가까운 날짜 순으로 표시됩니다.</p>

          <b className="help-label">날짜 색상 표시</b>
          <div className="help-badge-grid">
            <span className="badge-sample ann-today">오늘</span>
            <span className="help-badge-desc">D-0 · 빨간색</span>
            <span className="badge-sample ann-soon">D-7 이내</span>
            <span className="help-badge-desc">D-1 ~ D-7 · 주황색</span>
            <span className="badge-sample ann-near">D-30 이내</span>
            <span className="help-badge-desc">D-8 ~ D-30 · 보라색</span>
            <span className="badge-sample ann-far">D-31+</span>
            <span className="help-badge-desc">D-31 이상 · 회색</span>
          </div>

          <b className="help-label">표시 정보</b>
          <ul className="help-list">
            <li>이름 옆에 관계명(<b>아버지 · 어머니 · 할머니</b> 등) 또는 촌수 표시</li>
            <li>생일: <b>만 N세</b> / 기일: <b>N주기</b></li>
            <li>음력 생일은 매년 양력으로 자동 환산, 날짜 옆에 <b>(음 M.D)</b> 표기</li>
            <li>90일 이내 항목과 이후 항목이 구분되어 표시됩니다</li>
          </ul>

          <div className="help-tip">💡 목록에서 항목을 클릭하면 해당 인물이 속한 탭으로 자동 이동하며 포커싱됩니다.</div>
          <b className="help-label">알림 설정</b>
          <p className="help-para" style={{marginTop:4}}>기념일 창 오른쪽 상단 <b>🔔 버튼</b>을 누르면 알림 설정 화면으로 전환됩니다. ← 버튼으로 목록으로 돌아옵니다.</p>
        </>
      ),
    },
    {
      id: 'push',
      icon: '🔔',
      title: '알림 설정',
      content: (
        <>
          <p className="help-para">앱을 설치하면 푸시 알림을 받을 수 있습니다.</p>
          <div className="help-warn">⚠️ 알림은 <b>앱을 설치한 경우에만</b> 동작합니다. 브라우저에서 그냥 열었을 때는 알림이 오지 않습니다.</div>

          <b className="help-label">알림 종류</b>
          <div className="help-sub">
            <span className="help-sub-icon">🎂</span>
            <div>
              <b>생일 · 기일 알림</b>
              <p>매일 정해진 시간에 가족의 생일·기일을 미리 알려줍니다. 양력·음력 모두 지원합니다.</p>
            </div>
          </div>
          <div className="help-sub">
            <span className="help-sub-icon">📬</span>
            <div>
              <b>정보공개 요청 알림</b>
              <p>다른 가족이 내 정보를 요청하면 즉시 알림이 발송됩니다.</p>
            </div>
          </div>

          <b className="help-label">알림 직접 설정하기</b>
          <p className="help-para" style={{marginTop:4}}>기념일 창(📅) → 오른쪽 상단 <b>🔔 버튼</b>에서 아래 항목을 개인별로 조정할 수 있습니다.</p>
          <ul className="help-list">
            <li><b>알림 ON / OFF</b></li>
            <li><b>알림 시기</b> — 당일 / 1일 전 / 3일 전 / 7일 전 (중복 선택 가능)</li>
            <li><b>알림 범위</b> — 몇 촌까지 알림을 받을지 설정 (3~8촌)</li>
            <li><b>알림 종류</b> — 생일(🎂) / 기일(🕯️) 개별 선택</li>
          </ul>
          <div className="help-tip">💡 앱 첫 실행 시 뜨는 권한 요청에서 <b>허용</b>을 눌러야 알림을 받을 수 있습니다. 알림이 차단된 경우 🔕 아이콘을 탭하면 설치 안내를 볼 수 있습니다.</div>
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
            <li><span className="step-num">1</span> 상단(또는 하단) <b>🔍</b> 버튼을 누릅니다.</li>
            <li><span className="step-num">2</span> 이름을 입력하면 실시간으로 검색됩니다.</li>
            <li><span className="step-num">3</span> 결과를 클릭하면 해당 인물이 속한 탭으로 이동하고 포커싱됩니다.</li>
          </ol>
          <div className="help-tip">💡 비공개 인물은 검색 결과에 표시되지 않습니다. 정보공개 요청 후 수락되어야 검색이 가능합니다.</div>
        </>
      ),
    },
    {
      id: 'mymenu',
      icon: '👤',
      title: 'My 메뉴',
      content: (
        <>
          <p className="help-para">상단(또는 하단) <b>👤 My</b> 버튼을 누르면 My 메뉴가 열립니다. 3개의 탭으로 구성됩니다.</p>
          <div className="help-sub">
            <span className="help-sub-icon">📬</span>
            <div>
              <b>정보공개 요청</b>
              <p>다른 구성원에게 받은 정보공개 요청 목록입니다. <b>수락</b> 또는 <b>거절</b>할 수 있습니다. 처리할 요청이 있으면 👤 버튼에 빨간 숫자 배지가 표시됩니다.</p>
            </div>
          </div>
          <div className="help-sub">
            <span className="help-sub-icon">🔒</span>
            <div>
              <b>비밀번호 변경</b>
              <p>현재 비밀번호를 확인한 후 새 비밀번호(6자 이상)로 변경합니다.</p>
            </div>
          </div>
          <div className="help-sub">
            <span className="help-sub-icon">🔗</span>
            <div>
              <b>구글 계정 연결 / 해제</b>
              <p>구글 계정을 연결해두면 비밀번호를 잊어버려도 구글로 로그인할 수 있습니다. 연결되지 않은 경우 탭에 <b>!</b> 배지가 표시됩니다. 연결된 계정은 동일 탭에서 언제든지 해제할 수 있습니다.</p>
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
              <p>구글 계정이 연결되어 있으면 비밀번호 없이 바로 로그인됩니다. 비밀번호를 분실했을 때도 사용 가능합니다.</p>
            </div>
          </div>
          <div className="help-sub">
            <span className="help-sub-icon">ID</span>
            <div>
              <b>아이디 / 비밀번호</b>
              <p>가입 시 설정한 아이디와 비밀번호로 로그인합니다. <b>아이디 기억하기</b>를 체크하면 다음 접속 시 자동 입력됩니다.</p>
            </div>
          </div>
          <div className="help-warn">⚠️ <b>카카오톡 인앱 브라우저</b>에서는 구글 로그인이 차단됩니다. 안드로이드는 <b>Chrome으로 열기</b> 버튼을, 아이폰은 <b>링크 복사 후 Safari</b>를 이용해 주세요.</div>
          <div className="help-tip">💡 비밀번호 분실에 대비해 My 메뉴 → <b>구글 계정 연결</b>을 미리 해두세요.</div>

          <b className="help-label">비밀번호 찾기</b>
          <p className="help-para">로그인 화면 하단 <b>비밀번호를 잊으셨나요?</b>를 누르면 초기화할 수 있습니다.</p>
          <ol className="help-steps">
            <li><span className="step-num">1</span> 아이디 · 가계도에 등록된 이름 · 생년월일 · 이메일을 입력합니다.</li>
            <li><span className="step-num">2</span> 정보가 일치하면 입력한 이메일로 <b>초기화 링크</b>가 발송됩니다 (1시간 유효).</li>
            <li><span className="step-num">3</span> 정보가 일치하지 않으면 <b>관리자에게 직접 요청</b>할 수 있습니다. 연락받을 이메일을 입력하면 관리자 승인 후 링크가 발송됩니다.</li>
          </ol>
        </>
      ),
    },
    {
      id: 'withdraw',
      icon: '🚪',
      title: '탈퇴 및 문의',
      content: (
        <>
          <p className="help-para">계정 탈퇴 및 기타 문의는 관리자 이메일로 연락해 주세요.</p>
          <div className="help-sub">
            <span className="help-sub-icon">📧</span>
            <div>
              <b>탈퇴 요청</b>
              <p>아래 이메일로 <b>아이디와 탈퇴 요청</b>을 보내주시면 처리해 드립니다. 탈퇴 시 계정 정보와 접속 기록은 삭제되며, 가계도 인물 데이터는 유지됩니다.</p>
              {adminEmail
                ? <a href={`mailto:${adminEmail}?subject=계정 탈퇴 요청`} className="help-contact-link">{adminEmail}</a>
                : <span className="help-para" style={{ color: '#aaa' }}>이메일 불러오는 중...</span>
              }
            </div>
          </div>
          <div className="help-sub">
            <span className="help-sub-icon">💬</span>
            <div>
              <b>기타 문의</b>
              <p>앱 이용 중 불편한 점이나 오류가 있으면 동일 이메일로 문의해 주세요.</p>
            </div>
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
            {adminEmail
              ? <>문의 · 탈퇴: <a href={`mailto:${adminEmail}`} className="help-footer-link">{adminEmail}</a></>
              : '문의 사항은 가계도 관리자에게 연락하세요.'
            }
          </div>
        </div>
      </div>
    </div>
  );
}
