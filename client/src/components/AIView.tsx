import { useState, useMemo } from 'react';
import { useFamilyStore } from '../store/familyStore';
import { callGemini } from '../lib/gemini';
import { getMyPersonId } from '../lib/session';
import './AIView.css';
import { Icon } from './Icon';

interface Props {
  onClose: () => void;
}

type Service = 'birthday' | 'history' | null;

function birthdayPrompt(month: number, day: number) {
  return `${month}월 ${day}일에 태어난 유명인사와 연예인을 알려주세요.
한국 연예인·유명인 위주로 5명 내외, 해외 유명인사도 2~3명 섞어서 알려주세요.
각 인물마다 "이름 (출생연도, 분야) - 한 줄 설명" 형식으로 목록을 작성하세요.
정확한 정보 위주로, 확실하지 않으면 포함하지 마세요.`;
}

function historyPrompt(month: number, day: number) {
  return `${month}월 ${day}일에 일어난 역사적 사건을 알려주세요.
한국사와 세계사를 균형있게 섞어서 5~7개 정도 골라주세요.
각 사건마다 "연도 - 사건명 : 한두 줄 설명" 형식으로 목록을 작성하세요.
정확한 정보 위주로, 확실하지 않으면 포함하지 마세요.`;
}

export function AIView({ onClose }: Props) {
  const persons           = useFamilyStore(s => s.persons);
  const viewpointPersonId = useFamilyStore(s => s.viewpointPersonId);
  const [service, setService] = useState<Service>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const myPerson = useMemo(() => {
    const myId = viewpointPersonId ?? getMyPersonId();
    return (myId ? persons.find(p => p.id === myId) : null)
      ?? persons.find(p => p.is_root === 1)
      ?? null;
  }, [persons, viewpointPersonId]);

  const myBirth = useMemo(() => {
    if (!myPerson?.birth_date) return null;
    const d = new Date(myPerson.birth_date);
    if (isNaN(d.getTime())) return null;
    return { month: d.getMonth() + 1, day: d.getDate() };
  }, [myPerson]);

  const today = useMemo(() => {
    const d = new Date();
    return { month: d.getMonth() + 1, day: d.getDate() };
  }, []);

  const runService = async (target: Service) => {
    setService(target);
    setResult('');
    setError('');
    if (!target) return;

    if (target === 'birthday' && !myBirth) {
      setError('내 정보에 생년월일이 등록되어 있지 않습니다. 먼저 내 인물 정보에 생년월일을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const { month, day } = target === 'birthday' ? myBirth! : today;
      const prompt = target === 'birthday' ? birthdayPrompt(month, day) : historyPrompt(month, day);
      const text = await callGemini(prompt, 0.4);
      setResult(text);
    } catch (e: unknown) {
      setError(`AI 조회 중 오류가 발생했습니다:\n${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    } finally {
      setLoading(false);
    }
  };

  const title = service === 'birthday' ? '나와 같은 날 태어난 유명인'
    : service === 'history'  ? '오늘 일어난 역사적 사건'
    : 'AI 서비스';

  return (
    <div className="ai-backdrop" onClick={onClose}>
      <div className="ai-panel" onClick={e => e.stopPropagation()}>

        <div className="ai-header">
          {service && (
            <button className="ai-back" onClick={() => runService(null)}>‹</button>
          )}
          <span className="ai-title">{title}</span>
          <button className="ai-close" onClick={onClose}>✕</button>
        </div>

        <div className="ai-body">
          {!service && (
            <div className="ai-menu">
              <button className="ai-menu-card" onClick={() => runService('birthday')}>
                <span className="ai-menu-icon"><Icon name="cake" /></span>
                <span className="ai-menu-text">
                  <span className="ai-menu-name">나와 같은 날 태어난 유명인 및 연예인</span>
                  <span className="ai-menu-desc">
                    {myBirth ? `내 생일(${myBirth.month}월 ${myBirth.day}일)에 태어난 인물을 찾아드려요` : '내 생년월일을 기준으로 찾아드려요'}
                  </span>
                </span>
              </button>
              <button className="ai-menu-card" onClick={() => runService('history')}>
                <span className="ai-menu-icon"><Icon name="scroll" /></span>
                <span className="ai-menu-text">
                  <span className="ai-menu-name">오늘 일어난 역사적 사건</span>
                  <span className="ai-menu-desc">{`오늘(${today.month}월 ${today.day}일)의 역사를 알려드려요`}</span>
                </span>
              </button>
            </div>
          )}

          {service && (
            <>
              {loading && (
                <div className="ai-loading">
                  <span className="ai-spinner" />
                  <span>AI가 찾아보는 중...</span>
                </div>
              )}

              {error && (
                <div className="ai-error">
                  <pre>{error}</pre>
                </div>
              )}

              {result && (
                <div className="ai-result">
                  <pre className="ai-result-text">{result}</pre>
                  <p className="ai-disclaimer">
                    * Gemini AI가 생성한 정보로 사실과 다를 수 있습니다. 참고용으로만 활용하세요.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
