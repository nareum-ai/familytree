import { createPortal } from 'react-dom';
import './AvatarPicker.css';

const AVATARS = [
  {
    group: '인물',
    items: [
      { key: 'm_baby',         label: '남 아기'    },
      { key: 'f_infant',       label: '여 아기'    },
      { key: 'm_infant',       label: '남 유아'    },
      { key: 'm_child',        label: '남 어린이'  },
      { key: 'f_child',        label: '여 어린이'  },
      { key: 'f_child_2',      label: '여 어린이2' },
      { key: 'f_teen',         label: '여 하이틴'  },
      { key: 'm_student',      label: '남 학생'    },
      { key: 'f_student',      label: '여 학생'    },
      { key: 'm_young',        label: '남 청년'    },
      { key: 'f_young',        label: '여 청년'    },
      { key: 'm_college',      label: '남 대학생'  },
      { key: 'f_college',      label: '여 대학생'  },
      { key: 'm_jobseeker',    label: '남 취준생'  },
      { key: 'f_jobseeker',    label: '여 취준생'  },
      { key: 'm_newcomer',     label: '남 신입사원' },
      { key: 'f_newcomer',     label: '여 신입사원' },
      { key: 'm_rapper',       label: '남 래퍼'    },
      { key: 'f_rapper',       label: '여 래퍼'    },
      { key: 'm_chef',         label: '남 셰프'    },
      { key: 'f_cook',         label: '여 요리사'  },
      { key: 'f_artist',       label: '여 예술가'  },
      { key: 'f_doctor',       label: '여 의사'    },
      { key: 'f_professor',    label: '여 교수'    },
      { key: 'm_adult',        label: '남 장년'    },
      { key: 'f_adult',        label: '여 장년'    },
      { key: 'm_professor',    label: '남 교수'    },
      { key: 'm_developer',    label: '남 개발자'  },
      { key: 'm_elder',        label: '남 노년'    },
      { key: 'f_elder',        label: '여 노년'    },
      { key: 'm_elder_2',      label: '남 노년2'   },
      { key: 'f_elder_2',      label: '여 노년2'   },
      { key: 'm_hanbok_elder', label: '남 한복'    },
      { key: 'f_hanbok_elder', label: '여 한복'    },
      { key: 'm_gardener',     label: '남 정원사'  },
      { key: 'f_knitter',      label: '여 뜨개질'  },
      { key: 'm_athlete',      label: '남 운동선수' },
      { key: 'f_athlete',      label: '여 운동선수' },
    ],
  },
  {
    group: '동물',
    items: [
      { key: 'cat',        label: '고양이' },
      { key: 'dog',        label: '강아지' },
      { key: 'rabbit',     label: '토끼'   },
      { key: 'bear',       label: '곰'     },
      { key: 'owl',        label: '부엉이' },
      { key: 'fox',        label: '여우'   },
      { key: 'dog_white',  label: '강아지(흰색)' },
      { key: 'dog_yorkie', label: '강아지(요크셔)' },
      { key: 'chameleon',  label: '카멜레온' },
      { key: 'toad',       label: '두꺼비' },
      { key: 'pig',        label: '돼지'   },
      { key: 'cow',        label: '소'     },
      { key: 'mouse',      label: '쥐'     },
    ],
  },
  {
    group: '식물',
    items: [
      { key: 'rose',      label: '장미'   },
      { key: 'sunflower', label: '해바라기' },
      { key: 'palm',      label: '야자수'  },
    ],
  },
];

interface Props {
  current: string | null;
  onSelect: (url: string | null) => void;
  onClose: () => void;
}

export function AvatarPicker({ current, onSelect, onClose }: Props) {
  return createPortal(
    <div className="avpick-backdrop" onClick={onClose}>
      <div className="avpick-panel" onClick={e => e.stopPropagation()}>
        <div className="avpick-header">
          <span className="avpick-title">아바타 선택</span>
          <button className="avpick-close" onClick={onClose}>✕</button>
        </div>

        <div className="avpick-body">
          {current && (
            <button
              className="avpick-remove"
              onClick={() => { onSelect(null); onClose(); }}
            >
              🗑️ 현재 아바타 제거
            </button>
          )}

          {AVATARS.map(({ group, items }) => (
            <div key={group} className="avpick-group">
              <div className="avpick-grid">
                {items.map(({ key, label }) => {
                  const url = `/avatars/${key}.png`;
                  const selected = current === url;
                  return (
                    <button
                      key={key}
                      className={`avpick-item ${selected ? 'selected' : ''}`}
                      onClick={() => { onSelect(url); onClose(); }}
                      title={label}
                    >
                      <img src={url} alt={label} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
