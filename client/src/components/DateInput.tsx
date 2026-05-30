import { useRef } from 'react';
import './DateInput.css';

interface Props {
  value: string;
  onChange: (v: string) => void;
  max?: string;
  placeholder?: string;
}

// 숫자만 추출 후 YYYY-MM-DD 자동 포맷
function autoFormat(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

export function DateInput({ value, onChange, max, placeholder = 'YYYY-MM-DD' }: Props) {
  const pickerRef = useRef<HTMLInputElement>(null);

  const handleText = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(autoFormat(e.target.value));
  };

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    el.value = value;
    try {
      (el as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
    } catch {
      el.click();
    }
  };

  return (
    <div className="date-input-wrap">
      <input
        className="date-text"
        type="text"
        inputMode="numeric"
        value={value}
        onChange={handleText}
        placeholder={placeholder}
        maxLength={10}
      />
      <button type="button" className="date-cal-btn" onClick={openPicker} title="날짜 선택">
        📅
      </button>
      {/* 숨긴 native date picker — 캘린더 아이콘 클릭 시 열림 */}
      <input
        ref={pickerRef}
        type="date"
        max={max}
        onChange={e => onChange(e.target.value)}
        className="date-hidden"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
