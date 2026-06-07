import { useRef, useState } from 'react';
import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { LS } from '../lib/storageKeys';
import { parseCSVText, detectNameMatches, buildImportData } from '../utils/csvImport';
import { downloadCSV, CSV_TEMPLATE } from '../utils/csvExport';
import type { CSVRow, ImportError, NameMatch } from '../utils/csvImport';
import type { Person } from '../types';
import { v4 as uuidv4 } from 'uuid';
import './BulkUploadView.css';

interface TargetFamily { id: string; rootName: string; }

interface Props {
  targetFamily?: TargetFamily; // 기존 가족에 추가 시
  onClose: () => void;
  onDone: () => void;
}

type Step = 'upload' | 'preview' | 'match' | 'uploading' | 'done';

export function BulkUploadView({ targetFamily, onClose, onDone }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [rows, setRows]   = useState<CSVRow[]>([]);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [matches, setMatches] = useState<NameMatch[]>([]);
  const [mergeChecked, setMergeChecked] = useState<Set<string>>(new Set()); // checked = 기존 인물로 처리
  const [, setExistingPersons] = useState<Person[]>([]);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<{ persons: number; rels: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const createdBy = localStorage.getItem(LS.ACCOUNT_NAME) ?? localStorage.getItem(LS.USER_NAME) ?? 'admin';

  // ── 파일 읽기 ────────────────────────────────────────────────────────────
  const readCsvText = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      // 한국 Excel 기본 저장 인코딩(EUC-KR) 폴백
      return new TextDecoder('euc-kr').decode(buffer);
    }
  };

  const handleFile = async (file: File) => {
    const text = await readCsvText(file);
    const { rows: parsed, errors: errs } = parseCSVText(text);
    setRows(parsed);
    setErrors(errs);
    setStep('preview');

    // 기존 가족이면 이름 매칭 미리 계산
    if (targetFamily && parsed.length > 0) {
      const snap = await getDocs(query(collection(db, 'persons'), where('family_id', '==', targetFamily.id)));
      const existing = snap.docs.map(d => ({ ...(d.data() as Omit<Person, 'id'>), id: d.id })) as Person[];
      setExistingPersons(existing);
      const detected = detectNameMatches(parsed, existing);
      setMatches(detected);
      setMergeChecked(new Set(detected.map(m => m.csvRef)));
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── 업로드 실행 ──────────────────────────────────────────────────────────
  const handleUpload = async () => {
    setStep('uploading');
    try {
      const familyId = targetFamily?.id ?? uuidv4();

      // 기존 인물 매핑: csvRef → existing Firestore ID
      const mergeMap = new Map<string, string>();
      for (const m of matches) {
        if (mergeChecked.has(m.csvRef)) mergeMap.set(m.csvRef, m.existingId);
      }

      const { newPersonDocs, newRelDocs } = buildImportData(rows, familyId, createdBy, mergeMap);

      // 기존 가족 추가 시 중복 관계 필터링
      let existingRelKeys = new Set<string>();
      if (targetFamily) {
        setProgress('기존 관계 확인 중...');
        const relSnap = await getDocs(query(collection(db, 'relationships'), where('family_id', '==', familyId)));
        existingRelKeys = new Set(relSnap.docs.map(d => {
          const r = d.data();
          return r.type === 'spouse'
            ? `s|${[r.person1_id, r.person2_id].sort().join('|')}`
            : `pc|${r.person1_id}|${r.person2_id}`;
        }));
      }
      const filteredRels = newRelDocs.filter(r => {
        const key = r.type === 'spouse'
          ? `s|${[r.person1_id, r.person2_id].sort().join('|')}`
          : `pc|${r.person1_id}|${r.person2_id}`;
        return !existingRelKeys.has(key);
      });

      // Firestore batch 쓰기 (최대 500 ops/배치)
      const allOps = [
        ...newPersonDocs.map(p => ({ col: 'persons', id: p.id, data: p.data })),
        ...filteredRels.map(r => ({ col: 'relationships', id: uuidv4(), data: r })),
      ];

      for (let i = 0; i < allOps.length; i += 499) {
        const chunk = allOps.slice(i, i + 499);
        const batch = writeBatch(db);
        chunk.forEach(op => batch.set(doc(collection(db, op.col), op.id), op.data));
        setProgress(`저장 중... ${Math.min(i + 499, allOps.length)} / ${allOps.length}`);
        await batch.commit();
      }

      setResult({ persons: newPersonDocs.length, rels: filteredRels.length });
      setStep('done');
    } catch (e) {
      setErrors([{ line: 0, ref: '', message: `업로드 실패: ${String(e)}` }]);
      setStep('preview');
    }
  };

  const hasErrors = errors.length > 0;
  const isExisting = !!targetFamily;

  return (
    <div className="bulk-backdrop" onClick={onClose}>
      <div className="bulk-panel" onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="bulk-header">
          <div>
            <h2>📥 {isExisting ? `"${targetFamily.rootName}" 에 추가` : '새 가족 일괄 등록'}</h2>
            <p className="bulk-sub">CSV 파일로 가족 구성원을 한번에 등록합니다</p>
          </div>
          <button className="bulk-close" onClick={onClose}>✕</button>
        </div>

        <div className="bulk-body">

          {/* ── STEP: upload ── */}
          {step === 'upload' && (
            <>
              <div
                className={`bulk-dropzone ${dragOver ? 'drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={onFileChange} />
                <span className="drop-icon">📂</span>
                <p>CSV 파일을 드래그하거나 클릭해서 선택</p>
                <p className="drop-hint">UTF-8 인코딩 권장</p>
              </div>

              <div className="bulk-template-box">
                <p>📋 <strong>CSV 형식이 처음이라면 템플릿을 먼저 다운로드하세요</strong></p>
                <button className="btn-template" onClick={() => downloadCSV('가계도_업로드_템플릿.csv', CSV_TEMPLATE)}>
                  템플릿 다운로드
                </button>
              </div>

              <div className="bulk-cols">
                <p className="bulk-cols-title">열 설명</p>
                <table className="col-table">
                  <tbody>
                    {[
                      ['ref',         '임시 식별자 (예: P001)', '필수'],
                      ['name',        '이름',                    '필수'],
                      ['gender',      'male / female',           ''],
                      ['birth_date',  'YYYY-MM-DD',              ''],
                      ['birth_lunar', 'true / false',            '기본 false'],
                      ['is_root',     'true / false',            '신규 가족 시 1명 필수'],
                      ['is_deceased', 'true / false',            '기본 false'],
                      ['death_date',  'YYYY-MM-DD',              ''],
                      ['death_lunar', 'true / false',            '기본 false'],
                      ['father_ref',  '아버지의 ref',             ''],
                      ['mother_ref',  '어머니의 ref',             ''],
                      ['spouse_ref',  '배우자의 ref',             ''],
                    ].map(([col, desc, note]) => (
                      <tr key={col}>
                        <td className="col-name">{col}</td>
                        <td className="col-desc">{desc}</td>
                        <td className="col-note">{note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── STEP: preview ── */}
          {step === 'preview' && (
            <>
              <div className="preview-summary">
                <span className="summary-chip ok">{rows.length}명</span>
                {hasErrors && <span className="summary-chip err">{errors.length}개 오류</span>}
                {!hasErrors && <span className="summary-chip ok">✓ 오류 없음</span>}
              </div>

              {hasErrors && (
                <div className="err-list">
                  {errors.map((e, i) => (
                    <div key={i} className="err-row">
                      {e.line > 0 && <span className="err-line">{e.line}행</span>}
                      {e.ref && <span className="err-ref">{e.ref}</span>}
                      <span>{e.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {rows.length > 0 && (
                <div className="preview-table-wrap">
                  <table className="preview-table">
                    <thead>
                      <tr>
                        <th>ref</th><th>이름</th><th>성별</th><th>생년월일</th>
                        <th>사망</th><th>아버지ref</th><th>어머니ref</th><th>배우자ref</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => (
                        <tr key={r.ref}>
                          <td><code>{r.ref}</code></td>
                          <td>{r.name}{r.is_root && <span className="root-badge">root</span>}</td>
                          <td>{r.gender === 'male' ? '남' : r.gender === 'female' ? '여' : '-'}</td>
                          <td>{r.birth_date ?? '-'}</td>
                          <td>{r.is_deceased ? '✓' : ''}</td>
                          <td><code>{r.father_ref || '-'}</code></td>
                          <td><code>{r.mother_ref || '-'}</code></td>
                          <td><code>{r.spouse_ref || '-'}</code></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="bulk-actions">
                <button className="btn-back" onClick={() => { setStep('upload'); setErrors([]); setRows([]); }}>← 다시 선택</button>
                {!hasErrors && rows.length > 0 && (
                  <button className="btn-next" onClick={() => isExisting && matches.length > 0 ? setStep('match') : handleUpload()}>
                    {isExisting && matches.length > 0 ? '다음: 인물 연결 확인 →' : '업로드 시작'}
                  </button>
                )}
              </div>
            </>
          )}

          {/* ── STEP: match (기존 가족 추가 시 이름 매칭) ── */}
          {step === 'match' && (
            <>
              <p className="match-desc">
                CSV에 기존 트리와 <strong>같은 이름의 인물</strong>이 있습니다.<br />
                체크된 항목은 새로 생성하지 않고 기존 인물과 연결됩니다.
              </p>
              <div className="match-list">
                {matches.map(m => (
                  <label key={m.csvRef} className="match-row">
                    <input
                      type="checkbox"
                      checked={mergeChecked.has(m.csvRef)}
                      onChange={e => {
                        const next = new Set(mergeChecked);
                        if (e.target.checked) next.add(m.csvRef);
                        else next.delete(m.csvRef);
                        setMergeChecked(next);
                      }}
                    />
                    <span className="match-ref"><code>{m.csvRef}</code></span>
                    <span className="match-name">{m.csvName}</span>
                    <span className="match-arrow">→ 기존 인물로 연결</span>
                  </label>
                ))}
              </div>
              {rows.filter(r => !mergeChecked.has(r.ref)).length === 0 && matches.length === rows.length && (
                <div className="match-warn">⚠️ 전체가 기존 인물로 처리됩니다. 새로 등록될 인원이 없습니다.</div>
              )}
              <div className="bulk-actions">
                <button className="btn-back" onClick={() => setStep('preview')}>← 이전</button>
                <button className="btn-next" onClick={handleUpload}>업로드 시작</button>
              </div>
            </>
          )}

          {/* ── STEP: uploading ── */}
          {step === 'uploading' && (
            <div className="uploading-box">
              <div className="uploading-spinner" />
              <p>{progress || '업로드 준비 중...'}</p>
            </div>
          )}

          {/* ── STEP: done ── */}
          {step === 'done' && result && (
            <div className="done-box">
              <div className="done-icon">✅</div>
              <h3>업로드 완료!</h3>
              <p>
                <strong>{result.persons}명</strong> 신규 등록&nbsp;·&nbsp;
                <strong>{result.rels}개</strong> 관계 생성
              </p>
              <button className="btn-next" onClick={() => { onDone(); onClose(); }}>닫기</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
