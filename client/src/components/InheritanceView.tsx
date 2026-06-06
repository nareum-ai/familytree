import { useState, useMemo } from 'react';
import { useFamilyStore } from '../store/familyStore';
import type { Person, Relationship } from '../types';
import './InheritanceView.css';

const GEMINI_KEY = 'REMOVED_SECRET';

async function callGemini(prompt: string): Promise<string> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 },
      }),
    }
  );
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `HTTP ${resp.status}`);
  }
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '결과를 받지 못했습니다.';
}

interface Props {
  onClose: () => void;
}

function formatKrw(value: number): string {
  if (value === 0) return '0원';
  const eok = Math.floor(value / 100000000);
  const man = Math.floor((value % 100000000) / 10000);
  const rest = value % 10000;
  const parts: string[] = [];
  if (eok > 0) parts.push(`${eok.toLocaleString()}억`);
  if (man > 0) parts.push(`${man.toLocaleString()}만`);
  if (rest > 0) parts.push(`${rest.toLocaleString()}`);
  return parts.join(' ') + '원';
}

function buildFamilyContext(
  deceased: Person,
  persons: Person[],
  relationships: Relationship[],
): string {
  const fmt = (p: Person) => {
    const g = p.gender === 'male' ? '남' : p.gender === 'female' ? '여' : '성별불명';
    const b = p.birth_date ? `${p.birth_date} 출생` : p.birth_year ? `${p.birth_year}년생` : '생년불명';
    const s = p.is_deceased ? '사망' : '생존';
    return `${p.name} (${g}, ${b}, ${s})`;
  };

  const spouseIds = [...new Set(relationships
    .filter(r => r.type === 'spouse' && (r.person1_id === deceased.id || r.person2_id === deceased.id))
    .map(r => r.person1_id === deceased.id ? r.person2_id : r.person1_id))];
  const spouses = spouseIds.map(id => persons.find(p => p.id === id)).filter(Boolean) as Person[];

  const childIds = [...new Set(relationships
    .filter(r => r.type === 'parent_child' && r.person1_id === deceased.id)
    .map(r => r.person2_id))];
  const children = childIds.map(id => persons.find(p => p.id === id)).filter(Boolean) as Person[];

  const parentIds = [...new Set(relationships
    .filter(r => r.type === 'parent_child' && r.person2_id === deceased.id)
    .map(r => r.person1_id))];
  const parents = parentIds.map(id => persons.find(p => p.id === id)).filter(Boolean) as Person[];

  const siblingSet = new Set<string>();
  for (const pid of parentIds) {
    relationships
      .filter(r => r.type === 'parent_child' && r.person1_id === pid && r.person2_id !== deceased.id)
      .forEach(r => siblingSet.add(r.person2_id));
  }
  const siblings = [...siblingSet].map(id => persons.find(p => p.id === id)).filter(Boolean) as Person[];

  let ctx = `피상속인: ${fmt(deceased)}\n\n가족 관계:\n`;

  if (spouses.length > 0) {
    ctx += spouses.map(s => `- 배우자: ${fmt(s)}`).join('\n') + '\n';
  } else {
    ctx += '- 배우자: 없음\n';
  }

  if (children.length > 0) {
    for (let i = 0; i < children.length; i++) {
      const c = children[i];
      ctx += `- 자녀 ${i + 1}: ${fmt(c)}\n`;
      if (c.is_deceased) {
        const gcIds = relationships
          .filter(r => r.type === 'parent_child' && r.person1_id === c.id)
          .map(r => r.person2_id);
        const gcs = gcIds.map(id => persons.find(p => p.id === id)).filter(Boolean) as Person[];
        if (gcs.length > 0) {
          ctx += gcs.map(gc => `  └ ${c.name}의 자녀(대습상속인): ${fmt(gc)}`).join('\n') + '\n';
        }
      }
    }
  } else {
    ctx += '- 자녀: 없음\n';
  }

  if (parents.length > 0) {
    ctx += parents.map(p => `- 부/모: ${fmt(p)}`).join('\n') + '\n';
  } else {
    ctx += '- 부모: 모두 사망 또는 미등록\n';
  }

  if (siblings.length > 0) {
    ctx += siblings.map(s => `- 형제자매: ${fmt(s)}`).join('\n') + '\n';
  } else {
    ctx += '- 형제자매: 없음\n';
  }

  return ctx;
}

const SYSTEM_PROMPT = `아래 가족 관계와 상속재산 정보를 바탕으로 현행 한국 상속법에 따라 계산해주세요.

결과 형식:
① 법정 상속인 확정
② 상속 지분표 (분수 + 퍼센트 + 금액)
③ 상속공제 계산
④ 상속세 계산
⑤ 주의사항 (한두 줄)

숫자는 한국식(억/만원)으로 표기하고, 간결하되 정확하게 작성하세요.`;

export function InheritanceView({ onClose }: Props) {
  const { persons, relationships } = useFamilyStore();
  const [selectedId, setSelectedId] = useState<string>('');
  const [assetInput, setAssetInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const sortedPersons = useMemo(() =>
    [...persons].sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [persons]
  );

  const assetValue = useMemo(() => {
    const raw = assetInput.replace(/,/g, '').trim();
    const n = Number(raw);
    return isNaN(n) ? 0 : n;
  }, [assetInput]);

  const assetDisplay = useMemo(() =>
    assetValue > 0 ? formatKrw(assetValue) : '',
    [assetValue]
  );

  const selectedPerson = useMemo(() =>
    persons.find(p => p.id === selectedId) ?? null,
    [persons, selectedId]
  );

  const handleHello = async () => {
    setLoading(true);
    setResult('');
    setError('');
    try {
      const text = await callGemini('헬로~!');
      setResult(text);
    } catch (e: unknown) {
      setError(`오류: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = async () => {
    if (!selectedPerson || assetValue <= 0) return;
    setLoading(true);
    setResult('');
    setError('');

    try {
      const ctx = buildFamilyContext(selectedPerson, persons, relationships);
      const userMsg = `${ctx}\n상속재산 총액: ${formatKrw(assetValue)}\n\n위 정보를 바탕으로 상속 지분과 상속세를 계산해주세요.`;

      const text = await callGemini(`${SYSTEM_PROMPT}\n\n${userMsg}`);
      setResult(text);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류';
      if (msg.includes('API_NOT_ENABLED') || msg.includes('not been used') || msg.includes('403')) {
        setError('Firebase AI Logic이 이 프로젝트에 활성화되어 있지 않습니다.\nFirebase 콘솔 → AI Logic에서 활성화해주세요.');
      } else {
        setError(`AI 계산 중 오류가 발생했습니다:\n${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const canCalculate = selectedPerson && assetValue > 0 && !loading;

  return (
    <div className="inherit-backdrop" onClick={onClose}>
      <div className="inherit-panel" onClick={e => e.stopPropagation()}>

        <div className="inherit-header">
          <span className="inherit-title">⚖️ 상속 계산기</span>
          <button className="inherit-close" onClick={onClose}>✕</button>
        </div>

        <div className="inherit-body">
          <div className="inherit-field">
            <label className="inherit-label">피상속인 (사망자) 선택</label>
            <select
              className="inherit-select"
              value={selectedId}
              onChange={e => { setSelectedId(e.target.value); setResult(''); setError(''); }}
            >
              <option value="">-- 인물을 선택하세요 --</option>
              {sortedPersons.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.is_deceased ? ' (고인)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="inherit-field">
            <label className="inherit-label">상속재산 총액 (원)</label>
            <div className="inherit-asset-wrap">
              <input
                className="inherit-input"
                type="text"
                inputMode="numeric"
                placeholder="예: 1000000000"
                value={assetInput}
                onChange={e => {
                  const v = e.target.value.replace(/[^0-9]/g, '');
                  setAssetInput(v ? Number(v).toLocaleString('ko-KR') : '');
                  setResult('');
                  setError('');
                }}
              />
              {assetDisplay && <span className="inherit-asset-label">{assetDisplay}</span>}
            </div>
          </div>

          <button
            className="inherit-hello-btn"
            onClick={handleHello}
            disabled={loading}
          >
            {loading ? <span className="inherit-spinner" /> : '🤖 AI 연결 테스트 (헬로~!)'}
          </button>

          <button
            className="inherit-calc-btn"
            onClick={handleCalculate}
            disabled={!canCalculate}
          >
            {loading ? <span className="inherit-spinner" /> : '계산하기'}
          </button>

          {error && (
            <div className="inherit-error">
              <pre>{error}</pre>
            </div>
          )}

          {result && (
            <div className="inherit-result">
              <div className="inherit-result-header">AI 계산 결과</div>
              <pre className="inherit-result-text">{result}</pre>
              <p className="inherit-disclaimer">
                * 이 결과는 AI의 참고용 계산이며, 법률적 효력이 없습니다. 실제 상속 처리는 전문가와 상담하세요.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
