export interface Ayah {
  number: number;
  audio: string;
  text: string;
  translation?: string;
  basmala?: string;
  transliteration?: string;
  numberInSurah: number;
  juz: number;
  manzil: number;
  page: number;
  ruku: number;
  hizbQuarter: number;
  sajda: boolean;
}

export interface Edition {
  identifier: string;
  language: string;
  name: string;
  englishName: string;
  format: string;
  type: string;
  direction: string;
}

export interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: string;
  numberOfAyahs: number;
  ayahs: Ayah[];
  edition: Edition;
}

export interface QuranApiResponse {
  code: number;
  status: string;
  data: Surah[];
}

export enum RepeatMode {
  None = 'none',
  Verse = 'verse',
}
