// relationLabel.ts 가 쓰는 필드만 정의 (client/src/types 의 축약판)
export interface Person {
  id: string;
  name: string;
  birth_year?: number | null;
  birth_date?: string | null;
  gender: 'male' | 'female' | null;
}

export interface Relationship {
  person1_id: string;
  person2_id: string;
  type: string;
}
