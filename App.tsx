
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Ayah, QuranApiResponse } from './types';
import { RepeatMode } from './types';

// --- HELPER TYPES ---
type SurahInfo = {
  number: number;
  name: string;
  englishName: string;
};

const availableSurahs: SurahInfo[] = [
  { number: 76, name: 'سورة الإنسان', englishName: 'Al-Insan' },
  { number: 75, name: 'سورة القيامة', englishName: 'Al-Qiyamah' },
];


// --- HELPER & UI COMPONENTS (Defined outside main component to prevent re-creation on re-renders) ---

const LoadingSpinner: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full text-white">
    <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-cyan-300"></div>
    <p className="mt-4 text-lg">تحميل السورة...</p>
  </div>
);

interface ProgressBarProps {
  memorized: number;
  total: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ memorized, total }) => {
  const percentage = total > 0 ? (memorized / total) * 100 : 0;
  return (
    <div className="w-full px-4 md:px-0">
      <div className="flex justify-between mb-1 text-sm text-cyan-200/80">
        <span>التقدم</span>
        <span>{memorized} / {total} آيات</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2.5">
        <div 
          className="bg-cyan-400 h-2.5 rounded-full transition-all duration-500" 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

interface PlayerControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onMarkAsMemorized: () => void;
  repeatMode: RepeatMode;
  onRepeatToggle: () => void;
  isFirst: boolean;
  isLast: boolean;
  isCurrentMemorized: boolean;
  isCurrentBookmarked: boolean;
  onToggleBookmark: () => void;
  isReviewModeActive: boolean;
  onToggleReviewMode: () => void;
  memorizedCount: number;
}

const PlayerControls: React.FC<PlayerControlsProps> = ({ isPlaying, onPlayPause, onNext, onPrev, onMarkAsMemorized, repeatMode, onRepeatToggle, isFirst, isLast, isCurrentMemorized, isCurrentBookmarked, onToggleBookmark, isReviewModeActive, onToggleReviewMode, memorizedCount }) => {
  const getRepeatIcon = () => {
    switch (repeatMode) {
      case RepeatMode.Verse:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 12A8 8 0 1013 5.36M1 1v5h5M23 12a8 8 0 10-7 5.36M17 10h.01" /><text x="12" y="19" fontSize="10" textAnchor="middle" fill="currentColor">1</text></svg>
        );
      default: // RepeatMode.None
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 12A8 8 0 1013 5.36M1 1v5h5M23 12a8 8 0 10-7 5.36" /></svg>
        );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center">
       <div className="flex items-center justify-center w-full space-x-0 sm:space-x-2">
       
        <div className="relative group flex items-center justify-center">
          <button onClick={onRepeatToggle} className="text-white p-2 rounded-full hover:bg-white/20 transition-colors duration-300" aria-label="تبديل وضع التكرار">
            {getRepeatIcon()}
          </button>
          <div className="absolute bottom-full mb-2 w-max bg-black/80 backdrop-blur-sm text-white text-xs rounded-md py-1 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap">
            تبديل وضع التكرار
          </div>
        </div>

        <div className="relative group flex items-center justify-center">
          <button onClick={onPrev} disabled={isFirst} className="text-white p-2 rounded-full hover:bg-white/20 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed" aria-label="الآية السابقة">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
          </button>
          <div className="absolute bottom-full mb-2 w-max bg-black/80 backdrop-blur-sm text-white text-xs rounded-md py-1 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap">
            الآية السابقة
          </div>
        </div>
        
        <div className="relative group flex items-center justify-center">
          <button onClick={onPlayPause} className="text-gray-800 bg-cyan-300 w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center shadow-lg hover:bg-cyan-200 transform hover:scale-105 transition-all duration-300 mx-1" aria-label={isPlaying ? 'إيقاف' : 'تشغيل'}>
            {isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-10 sm:w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-10 sm:w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
            )}
          </button>
          <div className="absolute bottom-full mb-2 w-max bg-black/80 backdrop-blur-sm text-white text-xs rounded-md py-1 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap">
            {isPlaying ? 'إيقاف' : 'تشغيل'}
          </div>
        </div>

        <div className="relative group flex items-center justify-center">
          <button onClick={onNext} disabled={isLast} className="text-white p-2 rounded-full hover:bg-white/20 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed" aria-label="الآية التالية">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
          </button>
          <div className="absolute bottom-full mb-2 w-max bg-black/80 backdrop-blur-sm text-white text-xs rounded-md py-1 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap">
            الآية التالية
          </div>
        </div>

        <div className="relative group flex items-center justify-center">
          <button onClick={onToggleBookmark} className="text-white p-2 rounded-full hover:bg-white/20 transition-colors duration-300" aria-label={isCurrentBookmarked ? 'إزالة العلامة المرجعية' : 'إضافة علامة مرجعية'}>
             <svg 
               xmlns="http://www.w3.org/2000/svg" 
               className={`h-7 w-7 transition-colors ${isCurrentBookmarked ? 'text-yellow-400' : 'text-white/70'}`} 
               viewBox="0 0 24 24" 
               fill={isCurrentBookmarked ? 'currentColor' : 'none'} 
               stroke="currentColor" 
               strokeWidth="2" 
               strokeLinecap="round" 
               strokeLinejoin="round"
             >
                <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path>
             </svg>
          </button>
          <div className="absolute bottom-full mb-2 w-max bg-black/80 backdrop-blur-sm text-white text-xs rounded-md py-1 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap">
            {isCurrentBookmarked ? 'إزالة العلامة المرجعية' : 'إضافة علامة مرجعية'}
          </div>
        </div>
        
        <div className="relative group flex items-center justify-center">
         <button onClick={onToggleReviewMode} disabled={memorizedCount === 0} className="text-white p-2 rounded-full hover:bg-white/20 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed" aria-label={isReviewModeActive ? 'إيقاف المراجعة' : 'بدء مراجعة المحفوظات'}>
           <svg xmlns="http://www.w3.org/2000/svg" className={`h-7 w-7 transition-colors ${isReviewModeActive ? 'text-cyan-300' : 'text-white/70'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z"></path>
              <path d="M10.5 11l4 2.5-4 2.5v-5z"></path>
           </svg>
        </button>
        <div className="absolute bottom-full mb-2 w-max bg-black/80 backdrop-blur-sm text-white text-xs rounded-md py-1 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap">
          {isReviewModeActive ? 'إيقاف المراجعة' : 'بدء مراجعة المحفوظات'}
        </div>
        </div>

        <div className="relative group flex items-center justify-center">
        <button onClick={onMarkAsMemorized} disabled={isCurrentMemorized} className="text-white p-2 rounded-full hover:bg-white/20 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed" aria-label={isCurrentMemorized ? 'تم حفظ الآية' : 'تحديد كمحفوظة'}>
           <svg 
             xmlns="http://www.w3.org/2000/svg" 
             className={`h-7 w-7 transition-colors ${isCurrentMemorized ? 'text-yellow-400' : 'text-white/70'}`} 
             viewBox="0 0 24 24" 
             fill={isCurrentMemorized ? 'currentColor' : 'none'} 
             stroke="currentColor" 
             strokeWidth="2" 
             strokeLinecap="round" 
             strokeLinejoin="round"
           >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
           </svg>
        </button>
        <div className="absolute bottom-full mb-2 w-max bg-black/80 backdrop-blur-sm text-white text-xs rounded-md py-1 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap">
          {isCurrentMemorized ? 'تم حفظ الآية' : 'تحديد كمحفوظة'}
        </div>
        </div>

      </div>
    </div>
  );
};


interface VerseDisplayProps {
  ayah: Ayah;
  isMemorized: boolean;
}

const VerseDisplay: React.FC<VerseDisplayProps> = ({ ayah, isMemorized }) => (
  <div
    className={`p-6 my-2 transition-all duration-500 rounded-lg border-r-4 bg-cyan-200/20 border-cyan-300`}
  >
    <p className={`font-amiri text-3xl md:text-4xl leading-relaxed text-right transition-colors duration-500 text-cyan-300`}>
      {ayah.text}
      <span className={`relative inline-flex items-center justify-center text-sm font-sans font-bold text-cyan-400/80 mr-4 border border-cyan-400/50 rounded-full w-8 h-8`}>
        {ayah.numberInSurah}
        {isMemorized && (
             <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="relative inline-flex rounded-full h-4 w-4 bg-yellow-500 items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                    </svg>
                </span>
            </span>
        )}
      </span>
    </p>
    {ayah.transliteration && (
        <p className={`mt-4 text-base md:text-lg text-left transition-colors duration-500 text-cyan-200/80 font-sans`} dir="ltr">
            {ayah.transliteration}
        </p>
    )}
    {ayah.translation && (
        <p className={`mt-4 pt-4 border-t border-cyan-200/20 text-base md:text-lg text-left transition-colors duration-500 text-cyan-200`}>
            {ayah.translation}
        </p>
    )}
  </div>
);

interface BookmarksListProps {
  ayahs: Ayah[];
  bookmarkedAyahs: Set<number>;
  onJumpToAyah: (ayahNumberInSurah: number) => void;
  onClose: () => void;
}

const BookmarksList: React.FC<BookmarksListProps> = ({ ayahs, bookmarkedAyahs, onJumpToAyah, onClose }) => {
  const bookmarked = ayahs.filter(ayah => bookmarkedAyahs.has(ayah.numberInSurah));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="bookmarks-title">
      <div className="bg-gray-800 rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
          <h2 id="bookmarks-title" className="text-xl font-bold text-cyan-300">الآيات المحفوظة</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl" aria-label="إغلاق الآيات المحفوظة">&times;</button>
        </div>
        <div className="overflow-y-auto p-4">
          {bookmarked.length > 0 ? (
            <ul className="space-y-2">
              {bookmarked.map(ayah => (
                <li key={ayah.numberInSurah}>
                    <button onClick={() => onJumpToAyah(ayah.numberInSurah)} className="w-full text-right p-3 rounded-md hover:bg-white/10 cursor-pointer transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400">
                      <p className="font-amiri text-lg text-cyan-200">{ayah.text}</p>
                      <p className="text-sm text-cyan-400/80 mt-1">آية {ayah.numberInSurah}</p>
                    </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-white/50 py-8">لم يتم حفظ أي آيات.</p>
          )}
        </div>
      </div>
    </div>
  );
};

interface ReviewReminderModalProps {
  count: number;
  onConfirm: () => void;
  onDismiss: () => void;
}

const ReviewReminderModal: React.FC<ReviewReminderModalProps> = ({ count, onConfirm, onDismiss }) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);
  
  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-300 animate-fadeIn" 
      onClick={onDismiss} 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="reminder-title"
    >
      <div 
        className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-xl w-full max-w-sm text-center p-8 border border-cyan-400/20 transform transition-transform duration-300 animate-scaleUp" 
        onClick={e => e.stopPropagation()}
      >
        <div className="text-yellow-400 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
          </svg>
        </div>
        <h2 id="reminder-title" className="text-2xl font-bold text-cyan-300 mb-2">ما شاء الله!</h2>
        <p className="text-white/80 mb-6 text-lg">لقد أتممت حفظ {count} آيات. عمل رائع!</p>
        <p className="text-white/90 mb-8">هل تود بدء مراجعة ما حفظت الآن؟</p>
        <div className="flex justify-center gap-4">
          <button 
            onClick={onDismiss} 
            className="px-6 py-2 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
          >
            لاحقاً
          </button>
          <button 
            onClick={onConfirm} 
            className="px-6 py-2 rounded-lg bg-cyan-400 text-gray-900 font-semibold hover:bg-cyan-300 transition-colors shadow-lg shadow-cyan-500/20"
          >
            بدء المراجعة
          </button>
        </div>
      </div>
    </div>
  );
};

const SurahSelector: React.FC<{
  currentSurah: SurahInfo;
  availableSurahs: SurahInfo[];
  onSelect: (surah: SurahInfo) => void;
}> = ({ currentSurah, availableSurahs, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-3xl font-bold text-cyan-300 font-amiri tracking-wide flex items-center gap-2 hover:text-cyan-200 transition-colors"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {currentSurah.name}
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute top-full mt-2 w-48 bg-gray-900/80 backdrop-blur-sm border border-white/10 rounded-lg shadow-lg z-10 animate-fadeIn origin-top">
          <ul className="py-1">
            {availableSurahs.map(surah => (
              <li key={surah.number}>
                <button
                  onClick={() => { onSelect(surah); setIsOpen(false); }}
                  className="w-full text-right px-4 py-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                >
                  {surah.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};


// --- MAIN APP COMPONENT ---

function App() {
  const [currentSurah, setCurrentSurah] = useState<SurahInfo>(availableSurahs[0]);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [currentAyahIndex, setCurrentAyahIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(RepeatMode.None);
  const [memorizedAyahs, setMemorizedAyahs] = useState<Record<number, Set<number>>>({});
  const [bookmarkedAyahs, setBookmarkedAyahs] = useState<Record<number, Set<number>>>({});
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isReviewModeActive, setIsReviewModeActive] = useState(false);
  const [isReviewReminderOpen, setIsReviewReminderOpen] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const repeatTimeoutRef = useRef<number | null>(null);
  const lastReminderCount = useRef<Record<number, number>>({});

  const clearRepeatTimeout = () => {
    if (repeatTimeoutRef.current) {
      clearTimeout(repeatTimeoutRef.current);
      repeatTimeoutRef.current = null;
    }
  };
  
  const stopReviewMode = useCallback(() => {
    if (isReviewModeActive) {
        setIsReviewModeActive(false);
        setIsPlaying(false);
        clearRepeatTimeout();
    }
  }, [isReviewModeActive]);

  // Load state from localStorage on initial render
  useEffect(() => {
    try {
      const savedMemorized = localStorage.getItem('quranMemorizer_memorized_by_surah');
      if (savedMemorized) {
        const parsed = JSON.parse(savedMemorized);
        const memorizedWithSets: Record<number, Set<number>> = {};
        for (const surahNum in parsed) {
          memorizedWithSets[surahNum] = new Set(parsed[surahNum]);
        }
        setMemorizedAyahs(memorizedWithSets);
      }
      
      const savedBookmarked = localStorage.getItem('quranMemorizer_bookmarked_by_surah');
      if (savedBookmarked) {
        const parsed = JSON.parse(savedBookmarked);
        const bookmarkedWithSets: Record<number, Set<number>> = {};
        for (const surahNum in parsed) {
          bookmarkedWithSets[surahNum] = new Set(parsed[surahNum]);
        }
        setBookmarkedAyahs(bookmarkedWithSets);
      }
    } catch (e) {
      console.error("Failed to load data from localStorage", e);
    }
  }, []);

  // Save state to localStorage and check for review reminder
  useEffect(() => {
    try {
      const memorizedForStorage: Record<number, number[]> = {};
      for (const surahNum in memorizedAyahs) {
        memorizedForStorage[surahNum] = Array.from(memorizedAyahs[surahNum]);
      }
      localStorage.setItem('quranMemorizer_memorized_by_surah', JSON.stringify(memorizedForStorage));

      const bookmarkedForStorage: Record<number, number[]> = {};
      for (const surahNum in bookmarkedAyahs) {
        bookmarkedForStorage[surahNum] = Array.from(bookmarkedAyahs[surahNum]);
      }
      localStorage.setItem('quranMemorizer_bookmarked_by_surah', JSON.stringify(bookmarkedForStorage));

      // Check for review reminder for the current surah
      const newSize = (memorizedAyahs[currentSurah.number] || new Set()).size;
      if (newSize > 0 && newSize % 3 === 0 && newSize !== lastReminderCount.current[currentSurah.number]) {
          setIsPlaying(false);
          clearRepeatTimeout();
          setIsReviewReminderOpen(true);
          lastReminderCount.current[currentSurah.number] = newSize;
      }

    } catch (e) {
      console.error("Failed to save data to localStorage", e);
    }
  }, [memorizedAyahs, bookmarkedAyahs, currentSurah.number]);


  const fetchSurahData = useCallback(async (surahNumber: number) => {
    setIsLoading(true);
    setError(null);
    setAyahs([]);
    try {
      const response = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/editions/ar.abdulbasitmurattal,en.sahih,en.transliteration`);
      if (!response.ok) {
        throw new Error('Failed to fetch Surah data.');
      }
      const data = (await response.json()) as QuranApiResponse;
      if (data.code === 200 && data.data.length === 3) {
        const arabicData = data.data[0];
        const englishData = data.data[1];
        const transliterationData = data.data[2];

        const mergedAyahs = arabicData.ayahs.map((ayah, index) => ({
            ...ayah,
            translation: englishData.ayahs[index]?.text || 'Translation not found.',
            transliteration: transliterationData.ayahs[index]?.text || 'Transliteration not found.'
        }));
        setAyahs(mergedAyahs);
      } else {
        throw new Error('Invalid data format received from API.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSurahData(currentSurah.number);
  }, [currentSurah, fetchSurahData]);

  const currentSurahMemorizedSet = memorizedAyahs[currentSurah.number] || new Set();

  const handleAudioEnded = useCallback(() => {
    if (isReviewModeActive) {
        const memorizedIndices = ayahs
            .map((ayah, index) => (currentSurahMemorizedSet.has(ayah.numberInSurah) ? index : -1))
            .filter(index => index !== -1);
        
        if (memorizedIndices.length === 0) {
            setIsReviewModeActive(false);
            setIsPlaying(false);
            return;
        }

        const currentPositionInQueue = memorizedIndices.indexOf(currentAyahIndex);
        const nextPositionInQueue = (currentPositionInQueue + 1) % memorizedIndices.length;
        const nextIndex = memorizedIndices[nextPositionInQueue];
        
        const audio = audioRef.current;
        if (audio) {
            const duration = audio.duration;
            const pauseDuration = (isFinite(duration) && duration > 0) ? duration * 1000 : 2000; 
            repeatTimeoutRef.current = window.setTimeout(() => {
                setCurrentAyahIndex(nextIndex);
            }, pauseDuration);
        } else {
            setIsReviewModeActive(false);
            setIsPlaying(false);
        }
    } else if (repeatMode === RepeatMode.Verse && audioRef.current) {
        const audio = audioRef.current;
        const duration = audio.duration;
        if (isFinite(duration) && duration > 0) {
            repeatTimeoutRef.current = window.setTimeout(() => {
                if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                    audioRef.current.play().catch(e => console.error("Audio replay failed:", e));
                }
            }, duration * 1000);
        } else {
            setIsPlaying(false);
        }
    } else {
        setIsPlaying(false);
    }
  }, [isReviewModeActive, repeatMode, ayahs, currentAyahIndex, currentSurahMemorizedSet]);


  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.addEventListener('ended', handleAudioEnded);
      return () => {
        audio.removeEventListener('ended', handleAudioEnded);
        clearRepeatTimeout();
      };
    }
  }, [handleAudioEnded]);


  useEffect(() => {
    if (!audioRef.current || ayahs.length === 0) return;
    
    // Do not clear timeout if we are in the pause phase of review mode
    const isPausedInReview = isReviewModeActive && !isPlaying && repeatTimeoutRef.current;
    if (!isPausedInReview) {
      clearRepeatTimeout();
    }
    
    audioRef.current.src = ayahs[currentAyahIndex].audio;
    if (isPlaying) {
      audioRef.current.play().catch(e => {
        console.error("Audio play failed:", e);
        setIsPlaying(false);
      });
    } else {
      audioRef.current.pause();
    }
  }, [currentAyahIndex, isPlaying, ayahs, isReviewModeActive]);

  const handlePlayPause = () => {
    clearRepeatTimeout();
    setIsPlaying(!isPlaying);
  };
  
  const handleNext = () => {
    stopReviewMode();
    clearRepeatTimeout();
    setCurrentAyahIndex(prev => Math.min(prev + 1, ayahs.length - 1));
  };
  
  const handlePrev = () => {
    stopReviewMode();
    clearRepeatTimeout();
    setCurrentAyahIndex(prev => Math.max(prev - 1, 0));
  };

  const handleRepeatToggle = () => {
    stopReviewMode();
    const wasRepeatingVerse = repeatMode === RepeatMode.Verse;
    const wasInPauseState = audioRef.current?.paused && isPlaying;

    clearRepeatTimeout();
    
    setRepeatMode(prev => prev === RepeatMode.Verse ? RepeatMode.None : RepeatMode.Verse);

    if (wasRepeatingVerse && wasInPauseState) {
        setIsPlaying(false);
    }
  };
  
  const handleMarkAsMemorized = () => {
    stopReviewMode();
    clearRepeatTimeout();
    const currentAyah = ayahs[currentAyahIndex];
    if (currentAyah) {
        setMemorizedAyahs(prev => {
            const newSurahSet = new Set(prev[currentSurah.number] || []);
            newSurahSet.add(currentAyah.numberInSurah);
            return {
                ...prev,
                [currentSurah.number]: newSurahSet
            };
        });
    }

    setIsPlaying(false);

    if (currentAyahIndex < ayahs.length - 1) {
        handleNext();
    }
  };

  const handleToggleBookmark = () => {
    const currentAyah = ayahs[currentAyahIndex];
    if (currentAyah) {
        setBookmarkedAyahs(prev => {
            const newSurahSet = new Set(prev[currentSurah.number] || []);
            if (newSurahSet.has(currentAyah.numberInSurah)) {
                newSurahSet.delete(currentAyah.numberInSurah);
            } else {
                newSurahSet.add(currentAyah.numberInSurah);
            }
            return {
                ...prev,
                [currentSurah.number]: newSurahSet
            };
        });
    }
  };

  const handleToggleReviewMode = () => {
    clearRepeatTimeout();
    if (isReviewModeActive) {
        stopReviewMode();
    } else {
        const memorizedIndices = ayahs
            .map((ayah, index) => (currentSurahMemorizedSet.has(ayah.numberInSurah) ? index : -1))
            .filter(index => index !== -1);

        if (memorizedIndices.length > 0) {
            setRepeatMode(RepeatMode.None);
            setIsReviewModeActive(true);
            setCurrentAyahIndex(memorizedIndices[0]);
            setIsPlaying(true);
        }
    }
  };

  const handleJumpToAyah = (ayahNumberInSurah: number) => {
    stopReviewMode();
    clearRepeatTimeout();
    const index = ayahs.findIndex(a => a.numberInSurah === ayahNumberInSurah);
    if (index !== -1) {
        setCurrentAyahIndex(index);
        setIsBookmarksOpen(false);
    }
  };

  const handleSurahChange = (surah: SurahInfo) => {
    if (surah.number === currentSurah.number) return;
    stopReviewMode();
    clearRepeatTimeout();
    setIsPlaying(false);
    setCurrentAyahIndex(0);
    setCurrentSurah(surah);
  };
  
  const currentAyah = ayahs[currentAyahIndex];
  const isCurrentMemorized = currentAyah ? currentSurahMemorizedSet.has(currentAyah.numberInSurah) : false;
  const isCurrentBookmarked = currentAyah ? (bookmarkedAyahs[currentSurah.number] || new Set()).has(currentAyah.numberInSurah) : false;
  const memorizedCount = currentSurahMemorizedSet.size;

  return (
    <div className="bg-gradient-to-br from-gray-900 to-teal-900 min-h-screen text-white font-sans flex flex-col items-center justify-center p-4"
         style={{backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%230d9488' fill-opacity='0.1'%3E%3Cpath opacity='.5' d='M96 95h4v1h-4v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9zm-1 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm-90-10v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm-90-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm-90-10v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm-90-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm-90-10v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm-90-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm-90-10v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9zm10 0v-9h-9v9h9z'/%3E%3Cpath d='M6 5V0h1v5h9V0h1v5h9V0h1v5h9V0h1v5h9V0h1v5h9V0h1v5h9V0h1v5h9V0h1v5h9V0h1v5h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v5h-1v-5h-9v5h-1v-5h-9v5h-1v-5h-9v5h-1v-5h-9v5h-1v-5h-9v5h-1v-5h-9v5h-1v-5H0v-1h5v-9H0v-1h5v-9H0v-1h5v-9H0v-1h5v-9H0v-1h5v-9H0v-1h5v-9H0v-1h5v-9H0V5h6zm10 0h9V0h1v5h9V0h1v5h9V0h1v5h9V0h1v5h9V0h1v5h9V0h1v5h9V0h1v5h9V0h1v5h3v1h-3v9h3v1h-3v9h3v1h-3v9h3v1h-3v9h3v1h-3v9h3v1h-3v9h3v1h-3v5h-1v-5h-9v5h-1v-5h-9v5h-1v-5h-9v5h-1v-5h-9v5h-1v-5h-9v5h-1v-5h-9v5h-1v-5h-9v-1h9v-9h-9v-1h9v-9h-9v-1h9v-9h-9v-1h9v-9h-9v-1h9v-9h-9v-1h9v-9h-9v-1h9V5zm10 0h9V0h1v5h9V0h1v5h9V0h1v5h9V0h1v5h9V0h1v5h9V0h1v5h9V0h1v5h9V0h1v5h2v1h-2v9h2v1h-2v9h2v1h-2v9h2v1h-2v9h2v1h-2v9h2v1h-2v9h2v1h-2v5h-1v-5h-9v5h-1v-5h-9v5h-1v-5h-9v5h-1v-5h-9v5h-1v-5h-9v5h-1v-5h-9v5h-1v-5h-9v-1h9v-9h-9v-1h9v-9h-9v-1h9v-9h-9v-1h9v-9h-9v-1h9v-9h-9v-1h9v-9h-9v-1h9V5zm10 0h9V0h1v5h9V0h1v5h9V0h1v5h9V0h1v5h9V0h1v5h9V0h1v5h9V0h1v5h1v1h-1v9h1v1h-1v9h1v1h-1v9h1v1h-1v9h1v1h-1v9h1v1h-1v9h1v1h-1v9h1v1h-1v5h-1v-5h-9v5h-1v-5h-9v5h-1v-5h-9v5h-1v-5h-9v5h-1v-5h-9v5h-1v-5h-9v-5h-9v-1h9v-9h-9v-1h9v-9h-9v-1h9v-9h-9v-1h9v-9h-9v-1h9v-9h-9v-1h9v-9h-9v-1h9V5zm10 0h9V0h1v5h9V0h1v5h9V0h1v5h9V0h1v5h9V0h1v5h9V0h1v5h9V0h1v5h-1v1h1v9h-1v1h1v9h-1v1h1v9h-1v1h1v9h-1v1h1v9h-1v1h1v9h-1v1h1v9h-1v1h-1v5h-1v-5h-9v5h-1v-5h-9v5h-1v-5h-9v5h-1v-5h-9v5h-1v-5h-9v5h-1v-5h-9v5h-1v-5h-9v-1h9v-9h-9v-1h9v-9h-9v-1h9v-9h-9v-1h9v-9h-9v-1h9v-9h-9v-1h9v-9h-9v-1h9V5z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`}}>
      <div className="w-full max-w-4xl mx-auto bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-2xl shadow-black/30 overflow-hidden flex flex-col h-[90vh]">
        
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
            <div className="w-10"></div>
            <div className="text-center flex flex-col items-center">
                 <SurahSelector
                  currentSurah={currentSurah}
                  availableSurahs={availableSurahs}
                  onSelect={handleSurahChange}
                />
                <p className="text-white/70 mt-1">الشيخ عبد الباسط عبد الصمد</p>
            </div>
            <button onClick={() => setIsBookmarksOpen(true)} className="text-white p-2 rounded-full hover:bg-white/20 transition-colors duration-300" aria-label="فتح الآيات المحفوظة">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
            </button>
        </div>
        
        <audio ref={audioRef} />

        {isBookmarksOpen && (
            <BookmarksList 
                ayahs={ayahs}
                bookmarkedAyahs={(bookmarkedAyahs[currentSurah.number] || new Set())}
                onJumpToAyah={handleJumpToAyah}
                onClose={() => setIsBookmarksOpen(false)}
            />
        )}
        
        {isReviewReminderOpen && (
            <ReviewReminderModal
                count={memorizedCount}
                onConfirm={() => {
                    setIsReviewReminderOpen(false);
                    handleToggleReviewMode();
                }}
                onDismiss={() => setIsReviewReminderOpen(false)}
            />
        )}

        {isLoading ? (
          <LoadingSpinner />
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-400 text-lg">{error}</div>
        ) : currentAyah ? (
          <>
            <div className="flex-grow p-4 overflow-y-auto flex items-center justify-center">
                 <VerseDisplay
                   ayah={currentAyah}
                   isMemorized={isCurrentMemorized}
                 />
            </div>

            <div className="p-6 bg-black/20 space-y-4">
              <ProgressBar memorized={memorizedCount} total={ayahs.length} />
              <PlayerControls 
                isPlaying={isPlaying}
                onPlayPause={handlePlayPause}
                onNext={handleNext}
                onPrev={handlePrev}
                onMarkAsMemorized={handleMarkAsMemorized}
                repeatMode={repeatMode}
                onRepeatToggle={handleRepeatToggle}
                isFirst={currentAyahIndex === 0}
                isLast={ayahs.length > 0 && currentAyahIndex === ayahs.length - 1}
                isCurrentMemorized={isCurrentMemorized}
                isCurrentBookmarked={isCurrentBookmarked}
                onToggleBookmark={handleToggleBookmark}
                isReviewModeActive={isReviewModeActive}
                onToggleReviewMode={handleToggleReviewMode}
                memorizedCount={memorizedCount}
              />
            </div>
          </>
        ) : (
            <div className="flex items-center justify-center h-full text-white/70 text-lg">لا توجد آيات لعرضها.</div>
        )}
      </div>
       <footer className="text-center mt-4 text-white/40 text-sm">
        <p>Created to help children learn the Holy Quran.</p>
      </footer>
    </div>
  );
}

export default App;
