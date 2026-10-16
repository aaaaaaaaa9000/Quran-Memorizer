export type SurahInfo = {
  number: number;
  name: string;
  englishName: string;
};

const NAMES: [string, string][] = [
  ['الفاتحة', 'Al-Fatihah'], ['البقرة', 'Al-Baqarah'], ['آل عمران', 'Al-Imran'], ['النساء', 'An-Nisa'],
  ['المائدة', "Al-Ma'idah"], ['الأنعام', "Al-An'am"], ['الأعراف', "Al-A'raf"], ['الأنفال', 'Al-Anfal'],
  ['التوبة', 'At-Tawbah'], ['يونس', 'Yunus'], ['هود', 'Hud'], ['يوسف', 'Yusuf'],
  ['الرعد', "Ar-Ra'd"], ['إبراهيم', 'Ibrahim'], ['الحجر', 'Al-Hijr'], ['النحل', 'An-Nahl'],
  ['الإسراء', 'Al-Isra'], ['الكهف', 'Al-Kahf'], ['مريم', 'Maryam'], ['طه', 'Taha'],
  ['الأنبياء', 'Al-Anbiya'], ['الحج', 'Al-Hajj'], ['المؤمنون', "Al-Mu'minun"], ['النور', 'An-Nur'],
  ['الفرقان', 'Al-Furqan'], ['الشعراء', "Ash-Shu'ara"], ['النمل', 'An-Naml'], ['القصص', 'Al-Qasas'],
  ['العنكبوت', 'Al-Ankabut'], ['الروم', 'Ar-Rum'], ['لقمان', 'Luqman'], ['السجدة', 'As-Sajdah'],
  ['الأحزاب', 'Al-Ahzab'], ['سبأ', 'Saba'], ['فاطر', 'Fatir'], ['يس', 'Ya-Sin'],
  ['الصافات', 'As-Saffat'], ['ص', 'Sad'], ['الزمر', 'Az-Zumar'], ['غافر', 'Ghafir'],
  ['فصلت', 'Fussilat'], ['الشورى', 'Ash-Shura'], ['الزخرف', 'Az-Zukhruf'], ['الدخان', 'Ad-Dukhan'],
  ['الجاثية', 'Al-Jathiyah'], ['الأحقاف', 'Al-Ahqaf'], ['محمد', 'Muhammad'], ['الفتح', 'Al-Fath'],
  ['الحجرات', 'Al-Hujurat'], ['ق', 'Qaf'], ['الذاريات', 'Adh-Dhariyat'], ['الطور', 'At-Tur'],
  ['النجم', 'An-Najm'], ['القمر', 'Al-Qamar'], ['الرحمن', 'Ar-Rahman'], ['الواقعة', "Al-Waqi'ah"],
  ['الحديد', 'Al-Hadid'], ['المجادلة', 'Al-Mujadilah'], ['الحشر', 'Al-Hashr'], ['الممتحنة', 'Al-Mumtahanah'],
  ['الصف', 'As-Saff'], ['الجمعة', "Al-Jumu'ah"], ['المنافقون', 'Al-Munafiqun'], ['التغابن', 'At-Taghabun'],
  ['الطلاق', 'At-Talaq'], ['التحريم', 'At-Tahrim'], ['الملك', 'Al-Mulk'], ['القلم', 'Al-Qalam'],
  ['الحاقة', 'Al-Haqqah'], ['المعارج', "Al-Ma'arij"], ['نوح', 'Nuh'], ['الجن', 'Al-Jinn'],
  ['المزمل', 'Al-Muzzammil'], ['المدثر', 'Al-Muddaththir'], ['القيامة', 'Al-Qiyamah'], ['الإنسان', 'Al-Insan'],
  ['المرسلات', 'Al-Mursalat'], ['النبأ', 'An-Naba'], ['النازعات', "An-Nazi'at"], ['عبس', 'Abasa'],
  ['التكوير', 'At-Takwir'], ['الانفطار', 'Al-Infitar'], ['المطففين', 'Al-Mutaffifin'], ['الانشقاق', 'Al-Inshiqaq'],
  ['البروج', 'Al-Buruj'], ['الطارق', 'At-Tariq'], ['الأعلى', "Al-A'la"], ['الغاشية', 'Al-Ghashiyah'],
  ['الفجر', 'Al-Fajr'], ['البلد', 'Al-Balad'], ['الشمس', 'Ash-Shams'], ['الليل', 'Al-Layl'],
  ['الضحى', 'Ad-Duha'], ['الشرح', 'Ash-Sharh'], ['التين', 'At-Tin'], ['العلق', 'Al-Alaq'],
  ['القدر', 'Al-Qadr'], ['البينة', 'Al-Bayyinah'], ['الزلزلة', 'Az-Zalzalah'], ['العاديات', 'Al-Adiyat'],
  ['القارعة', "Al-Qari'ah"], ['التكاثر', 'At-Takathur'], ['العصر', 'Al-Asr'], ['الهمزة', 'Al-Humazah'],
  ['الفيل', 'Al-Fil'], ['قريش', 'Quraysh'], ['الماعون', "Al-Ma'un"], ['الكوثر', 'Al-Kawthar'],
  ['الكافرون', 'Al-Kafirun'], ['النصر', 'An-Nasr'], ['المسد', 'Al-Masad'], ['الإخلاص', 'Al-Ikhlas'],
  ['الفلق', 'Al-Falaq'], ['الناس', 'An-Nas'],
];

export const allSurahs: SurahInfo[] = NAMES.map(([name, englishName], i) => ({
  number: i + 1,
  name: `سورة ${name}`,
  englishName,
}));

export const DEFAULT_SURAH_NUMBER = 76;

export const getSurah = (number: number): SurahInfo =>
  allSurahs[number - 1] ?? allSurahs[DEFAULT_SURAH_NUMBER - 1];

// alquran.cloud prepends the Basmala to the first ayah of every surah except
// Al-Fatihah (where it is ayah 1) and At-Tawbah (which has none). The audio
// does not include it, so we strip it from the text and show it separately.
const stripMarks = (s: string) =>
  s.replace(/[ً-ٰٟۖ-ۭـ]/g, '').replace(/[ٱأإآ]/g, 'ا');

const BASMALA_WORDS = ['بسم', 'الله', 'الرحمن', 'الرحيم'];

export const splitBasmala = (surahNumber: number, text: string): { basmala: string | null; text: string } => {
  if (surahNumber === 1 || surahNumber === 9) return { basmala: null, text };
  const words = text.trim().split(/\s+/);
  const matches = words.length > 4 && BASMALA_WORDS.every((w, i) => stripMarks(words[i]) === w);
  if (!matches) return { basmala: null, text };
  return { basmala: words.slice(0, 4).join(' '), text: words.slice(4).join(' ') };
};
