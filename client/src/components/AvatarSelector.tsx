import './AvatarSelector.css';

interface Props {
  photoUrl: string | null;
  name: string;
  gender: 'male' | 'female';
  onOpen: () => void;
  /** 있으면 "삭제" 링크 표시 */
  onRemove?: () => void;
}

/** 아바타 미리보기 + 선택 버튼 (가족 추가·인물 편집 공통) */
export function AvatarSelector({ photoUrl, name, gender, onOpen, onRemove }: Props) {
  return (
    <div className="avatar-selector-wrap">
      <button type="button" className={`avatar-selector-btn ${photoUrl ? 'has-photo' : ''}`}
        onClick={onOpen} aria-label="사진·아바타 선택">
        {photoUrl
          ? <img src={photoUrl} alt="아바타" className="avatar-preview" />
          : <span className={`avatar-initial-circle ${gender}`}>{name[0] || '?'}</span>}
        <span className="avatar-camera-badge" aria-hidden>📷</span>
      </button>
      <button type="button" className="avatar-selector-cta" onClick={onOpen}>
        {photoUrl ? '사진·아바타 변경' : '📷 사진·아바타 선택'}
      </button>
      {photoUrl && onRemove && (
        <button type="button" className="avatar-remove-link" onClick={onRemove}>아바타 삭제</button>
      )}
    </div>
  );
}
