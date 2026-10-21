import { Icon } from './Icon';
/** iOS Safari 홈 화면 추가 안내 */
export function IOSInstallGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="ios-install-backdrop" onClick={onClose}>
      <div className="ios-install-guide" onClick={e => e.stopPropagation()}>
        <button className="ios-install-close" onClick={onClose}>✕</button>
        <div className="ios-install-icon"><Icon name="install" /></div>
        <p className="ios-install-title">홈 화면에 추가</p>
        <ol className="ios-install-steps">
          <li>Safari 하단의 <strong>공유 버튼(□↑)</strong>을 누르세요</li>
          <li>스크롤해서 <strong>홈 화면에 추가</strong>를 선택하세요</li>
          <li>오른쪽 상단 <strong>추가</strong>를 눌러 완료하세요</li>
        </ol>
        <div className="ios-install-arrow-hint">↑ Safari 하단 공유 버튼</div>
      </div>
    </div>
  );
}
