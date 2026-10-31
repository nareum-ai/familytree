import { Icon } from './Icon';
import { iosBrowser } from '../lib/device';

/**
 * iOS 홈 화면 추가 안내 — 브라우저별 공유 버튼 위치가 달라 단계를 나눠 보여준다.
 * iOS 웹푸시는 홈 화면에 추가한 앱에서만 동작한다 (iOS 16.4+).
 */
const STEPS: Record<ReturnType<typeof iosBrowser>, { steps: string[]; hint: string }> = {
  safari: {
    steps: [
      'Safari 하단의 <strong>공유 버튼(□↑)</strong>을 누르세요',
      '스크롤해서 <strong>홈 화면에 추가</strong>를 선택하세요',
      '오른쪽 상단 <strong>추가</strong>를 눌러 완료하세요',
    ],
    hint: '↓ Safari 하단 공유 버튼',
  },
  chrome: {
    steps: [
      '주소창 오른쪽의 <strong>공유 버튼(□↑)</strong>을 누르세요',
      '<strong>홈 화면에 추가</strong>를 선택하세요 (안 보이면 <strong>더보기</strong>)',
      '<strong>추가</strong>를 눌러 완료하세요',
    ],
    hint: '↑ 크롬 주소창 오른쪽 공유 버튼',
  },
  edge: {
    steps: [
      '하단 가운데 <strong>메뉴(≡)</strong>를 누르세요',
      '<strong>공유</strong> → <strong>홈 화면에 추가</strong>를 선택하세요',
      '<strong>추가</strong>를 눌러 완료하세요',
    ],
    hint: '↓ 엣지 하단 메뉴',
  },
  firefox: {
    steps: [
      '하단 <strong>메뉴(≡)</strong> → <strong>공유</strong>를 누르세요',
      '<strong>홈 화면에 추가</strong>를 선택하세요',
      '<strong>추가</strong>를 눌러 완료하세요',
    ],
    hint: '↓ 파이어폭스 하단 메뉴',
  },
  other: {
    steps: [
      '브라우저의 <strong>공유 버튼(□↑)</strong>을 누르세요',
      '<strong>홈 화면에 추가</strong>를 선택하세요',
      '안 보이면 <strong>Safari</strong>에서 이 주소를 열어 진행하세요',
    ],
    hint: '',
  },
};

export function IOSInstallGuide({ onClose }: { onClose: () => void }) {
  const { steps, hint } = STEPS[iosBrowser()];
  return (
    <div className="ios-install-backdrop" onClick={onClose}>
      <div className="ios-install-guide" onClick={e => e.stopPropagation()}>
        <button className="ios-install-close" onClick={onClose}>✕</button>
        <div className="ios-install-icon"><Icon name="install" /></div>
        <p className="ios-install-title">홈 화면에 추가</p>
        <ol className="ios-install-steps">
          {steps.map((s, i) => <li key={i} dangerouslySetInnerHTML={{ __html: s }} />)}
          <li>홈 화면의 <strong>가계도 아이콘</strong>으로 열고 <strong>알림 켜기</strong>를 누르세요</li>
        </ol>
        {hint && <div className="ios-install-arrow-hint">{hint}</div>}
      </div>
    </div>
  );
}
