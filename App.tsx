
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Ayah, QuranApiResponse } from './types';
import { RepeatMode } from './types';
import { allSurahs, getSurah, splitBasmala, DEFAULT_SURAH_NUMBER, type SurahInfo } from './surahs';

const RECITER_NAME = 'الشيخ عبد الباسط عبد الصمد';

const STORAGE_KEYS = {
  memorized: 'quranMemorizer_memorized_by_surah',
  bookmarked: 'quranMemorizer_bookmarked_by_surah',
  eyeComfort: 'quranMemorizer_eye_comfort',
  lastSurah: 'quranMemorizer_last_surah',
  positions: 'quranMemorizer_positions',
  playbackRate: 'quranMemorizer_playback_rate',
  fontSize: 'quranMemorizer_font_size',
};

const PLAYBACK_RATES = [0.75, 1, 1.25];

const FONT_SIZE_CLASSES = [
  'text-2xl sm:text-3xl md:text-4xl',
  'text-3xl sm:text-4xl md:text-5xl',
  'text-4xl sm:text-5xl md:text-6xl',
  'text-5xl sm:text-6xl md:text-7xl',
];
const DEFAULT_FONT_SIZE = 1;

// --- STORAGE HELPERS ---

const readJSON = <T,>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key);
    return saved !== null ? (JSON.parse(saved) as T) : fallback;
  } catch (e) {
    console.error(`Failed to read ${key} from localStorage`, e);
    return fallback;
  }
};

const writeJSON = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to save ${key} to localStorage`, e);
  }
};

const readSetMap = (key: string): Record<number, Set<number>> => {
  const parsed = readJSON<Record<string, number[]>>(key, {});
  const result: Record<number, Set<number>> = {};
  for (const surahNum in parsed) {
    result[Number(surahNum)] = new Set(parsed[surahNum]);
  }
  return result;
};

const writeSetMap = (key: string, map: Record<number, Set<number>>) => {
  const forStorage: Record<number, number[]> = {};
  for (const surahNum in map) {
    forStorage[surahNum] = Array.from(map[surahNum]);
  }
  writeJSON(key, forStorage);
};

const EMPTY_SET: ReadonlySet<number> = new Set();

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
  isEyeComfortMode?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ memorized, total, isEyeComfortMode }) => {
  const percentage = total > 0 ? (memorized / total) * 100 : 0;
  return (
    <div className="w-full px-4 md:px-0">
      <div className={`flex justify-between mb-2 text-sm font-medium transition-colors ${
        isEyeComfortMode ? 'text-amber-300/90' : 'text-cyan-400/80'
      }`}>
        <span>التقدم في الحفظ</span>
        <span>{memorized} / {total} آيات</span>
      </div>
      <div className={`w-full rounded-full h-3 shadow-inner ${
        isEyeComfortMode ? 'bg-stone-800' : 'bg-slate-800'
      }`}>
        <div 
          className={`h-3 rounded-full transition-all duration-700 ease-out ${
            isEyeComfortMode
              ? 'bg-gradient-to-r from-amber-500 to-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
              : 'bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
          }`} 
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
  onToggleMemorized: () => void;
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
  isEyeComfortMode?: boolean;
}

const PlayerControls: React.FC<PlayerControlsProps> = ({ isPlaying, onPlayPause, onNext, onPrev, onToggleMemorized, repeatMode, onRepeatToggle, isFirst, isLast, isCurrentMemorized, isCurrentBookmarked, onToggleBookmark, isReviewModeActive, onToggleReviewMode, memorizedCount, isEyeComfortMode }) => {
  const getRepeatIcon = () => {
    switch (repeatMode) {
      case RepeatMode.Verse:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 transition-colors ${isEyeComfortMode ? 'text-amber-300' : 'text-cyan-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 12A8 8 0 1013 5.36M1 1v5h5M23 12a8 8 0 10-7 5.36M17 10h.01" /><text x="12" y="19" fontSize="10" textAnchor="middle" fill="currentColor">1</text></svg>
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
          <button onClick={onRepeatToggle} className={`text-white p-2 rounded-full transition-colors duration-300 ${isEyeComfortMode ? 'hover:bg-amber-900/30' : 'hover:bg-white/20'}`} aria-label={repeatMode === RepeatMode.Verse ? 'إيقاف تكرار الآية' : 'تكرار الآية'} aria-pressed={repeatMode === RepeatMode.Verse}>
            {getRepeatIcon()}
          </button>
          <div className="absolute bottom-full mb-2 w-max bg-black/90 backdrop-blur-sm text-white text-xs rounded-md py-1 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-30">
            {repeatMode === RepeatMode.Verse ? 'إيقاف تكرار الآية' : 'تكرار الآية'} (R)
          </div>
        </div>

        <div className="relative group flex items-center justify-center">
          <button onClick={onPrev} disabled={isFirst} className={`text-white p-2 rounded-full transition-colors duration-300 disabled:opacity-40 disabled:cursor-not-allowed ${isEyeComfortMode ? 'hover:bg-amber-900/30' : 'hover:bg-white/20'}`} aria-label="الآية السابقة">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
          </button>
          <div className="absolute bottom-full mb-2 w-max bg-black/90 backdrop-blur-sm text-white text-xs rounded-md py-1 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-30">
            الآية السابقة (→)
          </div>
        </div>
        
        <div className="relative group flex items-center justify-center">
          <button onClick={onPlayPause} className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-300 mx-1 ${
            isEyeComfortMode
              ? 'bg-amber-400 text-stone-950 hover:bg-amber-300 shadow-amber-950/50'
              : 'text-gray-800 bg-cyan-300 hover:bg-cyan-200 shadow-cyan-950/40'
          }`} aria-label={isPlaying ? 'إيقاف' : 'تشغيل'}>
            {isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-10 sm:w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-10 sm:w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
            )}
          </button>
          <div className="absolute bottom-full mb-2 w-max bg-black/90 backdrop-blur-sm text-white text-xs rounded-md py-1 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-30">
            {isPlaying ? 'إيقاف' : 'تشغيل'} (مسافة)
          </div>
        </div>

        <div className="relative group flex items-center justify-center">
          <button onClick={onNext} disabled={isLast} className={`text-white p-2 rounded-full transition-colors duration-300 disabled:opacity-40 disabled:cursor-not-allowed ${isEyeComfortMode ? 'hover:bg-amber-900/30' : 'hover:bg-white/20'}`} aria-label="الآية التالية">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
          </button>
          <div className="absolute bottom-full mb-2 w-max bg-black/90 backdrop-blur-sm text-white text-xs rounded-md py-1 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-30">
            الآية التالية (←)
          </div>
        </div>

        <div className="relative group flex items-center justify-center">
          <button onClick={onToggleBookmark} className={`text-white p-2 rounded-full transition-colors duration-300 ${isEyeComfortMode ? 'hover:bg-amber-900/30' : 'hover:bg-white/20'}`} aria-label={isCurrentBookmarked ? 'إزالة العلامة المرجعية' : 'إضافة علامة مرجعية'}>
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
          <div className="absolute bottom-full mb-2 w-max bg-black/90 backdrop-blur-sm text-white text-xs rounded-md py-1 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-30">
            {isCurrentBookmarked ? 'إزالة العلامة المرجعية' : 'إضافة علامة مرجعية'} (B)
          </div>
        </div>
        
        <div className="relative group flex items-center justify-center">
         <button onClick={onToggleReviewMode} disabled={memorizedCount === 0} className={`text-white p-2 rounded-full transition-colors duration-300 disabled:opacity-40 disabled:cursor-not-allowed ${isEyeComfortMode ? 'hover:bg-amber-900/30' : 'hover:bg-white/20'}`} aria-label={isReviewModeActive ? 'إيقاف المراجعة' : 'بدء مراجعة المحفوظات'}>
           <svg xmlns="http://www.w3.org/2000/svg" className={`h-7 w-7 transition-colors ${isReviewModeActive ? (isEyeComfortMode ? 'text-amber-300' : 'text-cyan-300') : 'text-white/70'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z"></path>
              <path d="M10.5 11l4 2.5-4 2.5v-5z"></path>
           </svg>
        </button>
        <div className="absolute bottom-full mb-2 w-max bg-black/90 backdrop-blur-sm text-white text-xs rounded-md py-1 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-30">
          {isReviewModeActive ? 'إيقاف المراجعة' : 'بدء مراجعة المحفوظات'}
        </div>
        </div>

        <div className="relative group flex items-center justify-center">
        <button onClick={onToggleMemorized} className={`text-white p-2 rounded-full transition-colors duration-300 ${isEyeComfortMode ? 'hover:bg-amber-900/30' : 'hover:bg-white/20'}`} aria-label={isCurrentMemorized ? 'إلغاء تحديد الآية كمحفوظة' : 'تحديد كمحفوظة'} aria-pressed={isCurrentMemorized}>
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
        <div className="absolute bottom-full mb-2 w-max bg-black/90 backdrop-blur-sm text-white text-xs rounded-md py-1 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-30">
          {isCurrentMemorized ? 'محفوظة ✓ (اضغط للإلغاء)' : 'تحديد كمحفوظة'} (M)
        </div>
        </div>

      </div>
    </div>
  );
};

interface VerseDisplayProps {
  ayah: Ayah;
  isMemorized: boolean;
  fontSizeClass: string;
  isEyeComfortMode?: boolean;
}

const VerseDisplay: React.FC<VerseDisplayProps> = ({ ayah, isMemorized, fontSizeClass, isEyeComfortMode }) => (
  <div
    className={`p-6 sm:p-8 my-4 transition-all duration-500 rounded-2xl border ${
      isEyeComfortMode
        ? 'border-amber-900/40 bg-stone-900/80 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]'
        : 'border-slate-700/50 bg-slate-800/40 shadow-inner'
    }`}
  >
    {ayah.basmala && (
      <p className={`font-amiri text-center text-2xl sm:text-3xl mb-6 pb-5 border-b transition-colors duration-500 ${
        isEyeComfortMode ? 'text-amber-300/90 border-amber-900/40' : 'text-cyan-300/90 border-slate-700/50'
      }`}>
        {ayah.basmala}
      </p>
    )}
    <p className={`font-amiri ${fontSizeClass} leading-[2] sm:leading-[2.1] text-right transition-colors duration-500 ${
      isEyeComfortMode
        ? 'text-[#fef3c7] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]'
        : 'text-cyan-50 drop-shadow-sm'
    }`}>
      {ayah.text}
      <span className={`relative inline-flex items-center justify-center text-sm font-sans font-bold mr-4 sm:mr-6 border rounded-full w-9 h-9 sm:w-10 sm:h-10 transition-colors ${
        isEyeComfortMode
          ? 'border-amber-500/40 text-amber-300 bg-stone-950/70 shadow-sm'
          : 'border-cyan-500/30 text-cyan-400/90 bg-slate-900/50'
      }`}>
        {ayah.numberInSurah}
        {isMemorized && (
             <span className="absolute -top-1 -right-1 flex h-4 w-4 sm:h-5 sm:w-5">
                <span className="relative inline-flex rounded-full h-4 w-4 sm:h-5 sm:w-5 bg-yellow-500 items-center justify-center shadow-lg shadow-yellow-500/50">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                    </svg>
                </span>
            </span>
        )}
      </span>
    </p>
    {ayah.transliteration && (
        <p className={`mt-6 text-sm sm:text-base md:text-lg text-left transition-colors duration-500 font-sans italic ${
          isEyeComfortMode ? 'text-stone-400' : 'text-slate-400'
        }`} dir="ltr">
            {ayah.transliteration}
        </p>
    )}
    {ayah.translation && (
        <p className={`mt-4 pt-6 border-t text-sm sm:text-base md:text-lg text-left transition-colors duration-500 leading-relaxed ${
          isEyeComfortMode ? 'border-amber-900/40 text-stone-300' : 'border-slate-700/50 text-slate-300'
        }`}>
            {ayah.translation}
        </p>
    )}
  </div>
);

interface BookmarksListProps {
  ayahs: Ayah[];
  bookmarkedAyahs: ReadonlySet<number>;
  onJumpToAyah: (ayahNumberInSurah: number) => void;
  onClose: () => void;
  isEyeComfortMode?: boolean;
}

const BookmarksList: React.FC<BookmarksListProps> = ({ ayahs, bookmarkedAyahs, onJumpToAyah, onClose, isEyeComfortMode }) => {
  const bookmarked = ayahs.filter(ayah => bookmarkedAyahs.has(ayah.numberInSurah));

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="bookmarks-title">
      <div className={`border rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col ${
        isEyeComfortMode
          ? 'bg-[#181411] border-amber-900/40 text-stone-200'
          : 'bg-slate-900 border-slate-800 text-slate-200'
      }`} onClick={e => e.stopPropagation()}>
        <div className={`p-5 border-b flex justify-between items-center ${
          isEyeComfortMode ? 'border-amber-900/30' : 'border-slate-800'
        }`}>
          <h2 id="bookmarks-title" className={`text-xl font-bold ${
            isEyeComfortMode ? 'text-amber-300' : 'text-cyan-400'
          }`}>العلامات المرجعية</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl transition-colors" aria-label="إغلاق العلامات المرجعية">&times;</button>
        </div>
        <div className="overflow-y-auto p-4">
          {bookmarked.length > 0 ? (
            <ul className="space-y-3">
              {bookmarked.map(ayah => (
                <li key={ayah.numberInSurah}>
                    <button 
                      onClick={() => onJumpToAyah(ayah.numberInSurah)} 
                      className={`w-full text-right p-4 rounded-xl border cursor-pointer transition-all duration-200 focus:outline-none ${
                        isEyeComfortMode
                          ? 'bg-stone-800/60 hover:bg-stone-800 border-amber-900/30 focus:ring-2 focus:ring-amber-500'
                          : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/50 focus:ring-2 focus:ring-cyan-500'
                      }`}
                    >
                      <p className={`font-amiri text-xl ${
                        isEyeComfortMode ? 'text-amber-100' : 'text-cyan-50'
                      }`}>{ayah.text}</p>
                      <p className={`text-sm mt-2 ${
                        isEyeComfortMode ? 'text-amber-400/80' : 'text-cyan-500/70'
                      }`}>آية {ayah.numberInSurah}</p>
                    </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-slate-500 py-12">لا توجد علامات مرجعية في هذه السورة بعد.</p>
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
  isEyeComfortMode?: boolean;
}

const ReviewReminderModal: React.FC<ReviewReminderModalProps> = ({ count, onConfirm, onDismiss, isEyeComfortMode }) => {
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
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-opacity duration-300 animate-fadeIn" 
      onClick={onDismiss} 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="reminder-title"
    >
      <div 
        className={`border rounded-2xl shadow-2xl w-full max-w-sm text-center p-8 sm:p-10 transform transition-transform duration-300 animate-scaleUp ${
          isEyeComfortMode ? 'bg-[#181411] border-amber-900/40' : 'bg-slate-900 border-slate-800'
        }`} 
        onClick={e => e.stopPropagation()}
      >
        <div className="text-yellow-400 mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 mx-auto drop-shadow-[0_0_15px_rgba(250,204,21,0.4)]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
          </svg>
        </div>
        <h2 id="reminder-title" className={`text-3xl font-bold mb-3 ${
          isEyeComfortMode ? 'text-amber-300' : 'text-cyan-400'
        }`}>ما شاء الله!</h2>
        <p className="text-slate-300 mb-6 text-lg">لقد أتممت حفظ {count} آيات. عمل رائع!</p>
        <p className="text-slate-400 mb-8 sm:mb-10">هل تود بدء مراجعة ما حفظت الآن؟</p>
        <div className="flex flex-col gap-3">
          <button 
            onClick={onConfirm} 
            className={`w-full py-3 rounded-xl font-bold transition-all shadow-lg active:scale-[0.98] ${
              isEyeComfortMode
                ? 'bg-amber-400 text-stone-950 hover:bg-amber-300 shadow-amber-500/20'
                : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-cyan-500/20'
            }`}
          >
            بدء المراجعة
          </button>
          <button 
            onClick={onDismiss} 
            className={`w-full py-3 rounded-xl font-semibold transition-colors ${
              isEyeComfortMode
                ? 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            لاحقاً
          </button>
        </div>
      </div>
    </div>
  );
};

const normalizeSearch = (text: string) =>
  text
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/['’\-\s]/g, '')
    .toLowerCase();

const SurahSelector: React.FC<{
  currentSurah: SurahInfo;
  surahs: SurahInfo[];
  onSelect: (surah: SurahInfo) => void;
  isEyeComfortMode?: boolean;
}> = ({ currentSurah, surahs, onSelect, isEyeComfortMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const currentItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    currentItemRef.current?.scrollIntoView({ block: 'center' });
    searchRef.current?.focus();
  }, [isOpen]);

  const normalizedQuery = normalizeSearch(query.replace(/^سورة\s*/, ''));
  const filtered = normalizedQuery
    ? surahs.filter(surah =>
        String(surah.number) === normalizedQuery ||
        normalizeSearch(surah.name).includes(normalizedQuery) ||
        normalizeSearch(surah.englishName).includes(normalizedQuery))
    : surahs;

  const select = (surah: SurahInfo) => {
    onSelect(surah);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`text-2xl sm:text-3xl font-bold font-amiri tracking-wide flex items-center gap-2 sm:gap-3 transition-colors ${
          isEyeComfortMode
            ? 'text-amber-300 hover:text-amber-200'
            : 'text-cyan-400 hover:text-cyan-300'
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {currentSurah.name}
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 sm:h-6 sm:w-6 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      {isOpen && (
        <div className={`absolute top-full mt-3 left-1/2 -translate-x-1/2 w-64 border rounded-xl shadow-2xl z-30 animate-fadeIn origin-top overflow-hidden flex flex-col ${
          isEyeComfortMode
            ? 'bg-[#181411] border-amber-900/40 text-stone-200'
            : 'bg-slate-900 border-slate-800 text-slate-300'
        }`}>
          <div className={`p-2 border-b ${isEyeComfortMode ? 'border-amber-900/30' : 'border-slate-800'}`}>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && filtered.length > 0) select(filtered[0]);
                if (e.key === 'Escape') setIsOpen(false);
              }}
              placeholder="ابحث باسم السورة أو رقمها"
              aria-label="البحث عن سورة"
              className={`w-full rounded-lg px-3 py-2 text-sm outline-none border focus:ring-2 ${
                isEyeComfortMode
                  ? 'bg-stone-900 border-amber-900/40 placeholder-stone-500 focus:ring-amber-500/50'
                  : 'bg-slate-800 border-slate-700 placeholder-slate-500 focus:ring-cyan-500/50'
              }`}
            />
          </div>
          <ul className="py-2 max-h-72 overflow-y-auto" role="listbox" aria-label="السور">
            {filtered.map(surah => {
              const isCurrent = currentSurah.number === surah.number;
              return (
                <li key={surah.number} role="option" aria-selected={isCurrent}>
                  <button
                    ref={isCurrent ? currentItemRef : undefined}
                    onClick={() => select(surah)}
                    className={`w-full text-right px-4 py-2.5 transition-all flex items-center gap-3 ${
                      isEyeComfortMode
                        ? isCurrent
                          ? 'bg-amber-950/60 text-amber-300 font-bold'
                          : 'text-stone-300 hover:bg-stone-800/80 hover:text-amber-300'
                        : isCurrent
                          ? 'bg-slate-800/50 text-cyan-400 font-bold'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-cyan-400'
                    }`}
                  >
                    <span className="text-xs font-sans opacity-50 w-6 text-center tabular-nums">{surah.number}</span>
                    <span className="font-amiri text-lg flex-grow">{surah.name}</span>
                    <span className="text-xs font-sans opacity-50">{surah.englishName}</span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-4 py-6 text-center text-sm opacity-60">لا توجد نتائج</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

interface SettingsBarProps {
  fontSize: number;
  onFontSizeChange: (delta: number) => void;
  playbackRate: number;
  onCyclePlaybackRate: () => void;
  canReset: boolean;
  onResetProgress: () => void;
  isEyeComfortMode?: boolean;
}

const SettingsBar: React.FC<SettingsBarProps> = ({ fontSize, onFontSizeChange, playbackRate, onCyclePlaybackRate, canReset, onResetProgress, isEyeComfortMode }) => {
  const chip = `px-3 py-1 rounded-full border text-xs sm:text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
    isEyeComfortMode
      ? 'border-amber-900/40 text-amber-200/80 hover:bg-amber-900/30'
      : 'border-slate-700 text-slate-300 hover:bg-slate-800'
  }`;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 px-4 md:px-0">
      <div className="flex items-center gap-1" role="group" aria-label="حجم الخط">
        <button className={chip} onClick={() => onFontSizeChange(-1)} disabled={fontSize <= 0} aria-label="تصغير الخط">أ−</button>
        <button className={chip} onClick={() => onFontSizeChange(1)} disabled={fontSize >= FONT_SIZE_CLASSES.length - 1} aria-label="تكبير الخط">أ+</button>
      </div>
      <button className={chip} onClick={onCyclePlaybackRate} aria-label={`سرعة التلاوة ${playbackRate}x، اضغط للتغيير`} title="سرعة التلاوة">
        السرعة <span dir="ltr" className="tabular-nums">{playbackRate}x</span>
      </button>
      <button className={chip} onClick={onResetProgress} disabled={!canReset} title="حذف كل الآيات المحددة كمحفوظة في هذه السورة">
        تصفير التقدم
      </button>
    </div>
  );
};

interface NightModeToggleProps {
  isEyeComfortMode: boolean;
  onToggle: () => void;
}

const NightModeToggle: React.FC<NightModeToggleProps> = ({ isEyeComfortMode, onToggle }) => {
  return (
    <div className="relative group flex items-center">
      <button
        onClick={onToggle}
        className={`relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full transition-all duration-300 border text-xs sm:text-sm font-medium ${
          isEyeComfortMode
            ? 'bg-amber-950/50 border-amber-500/50 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)] hover:bg-amber-900/50'
            : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:text-cyan-300 hover:border-slate-600'
        }`}
        aria-label="تبديل وضع راحة العين الليلي"
        title="تبديل وضع راحة العين الليلي"
      >
        {isEyeComfortMode ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400 animate-pulse" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21.64 13a1 1 0 00-1.05-.14 8.05 8.05 0 01-3.37.73A8.15 8.15 0 019.08 5.49a8.59 8.59 0 01.25-2A1 1 0 008 2.36a10.14 10.14 0 1014 11.69 1 1 0 00-.36-1.05z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        )}
        <span className="hidden sm:inline">
          {isEyeComfortMode ? 'راحة العين' : 'ليلي قياسي'}
        </span>
        <span
          className={`w-2 h-2 rounded-full transition-colors duration-300 ${
            isEyeComfortMode ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)]' : 'bg-slate-500'
          }`}
        />
      </button>
      <div className="absolute top-full mt-2 right-0 w-max bg-black/90 backdrop-blur-md text-white text-xs rounded-lg py-1.5 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-40 shadow-xl border border-white/10 whitespace-nowrap text-right">
        {isEyeComfortMode
          ? 'وضع راحة العين مفعّل: إضاءة دافئة مريحة تقلل الضوء الأزرق وإجهاد القراءة ليلاً'
          : 'الوضع الداكن القياسي: اضغط لتفعيل الوضع الدافئ المخصص لراحة العين'}
      </div>
    </div>
  );
};


// --- MAIN APP COMPONENT ---

function App() {
  const [currentSurah, setCurrentSurah] = useState<SurahInfo>(() =>
    getSurah(readJSON<number>(STORAGE_KEYS.lastSurah, DEFAULT_SURAH_NUMBER)));
  const positionsRef = useRef<Record<number, number>>(readJSON(STORAGE_KEYS.positions, {}));
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [currentAyahIndex, setCurrentAyahIndex] = useState(() => positionsRef.current[currentSurah.number] ?? 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(RepeatMode.None);
  const [memorizedAyahs, setMemorizedAyahs] = useState(() => readSetMap(STORAGE_KEYS.memorized));
  const [bookmarkedAyahs, setBookmarkedAyahs] = useState(() => readSetMap(STORAGE_KEYS.bookmarked));
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isReviewModeActive, setIsReviewModeActive] = useState(false);
  const [isReviewReminderOpen, setIsReviewReminderOpen] = useState(false);
  const [isEyeComfortMode, setIsEyeComfortMode] = useState<boolean>(() =>
    readJSON(STORAGE_KEYS.eyeComfort, true)); // Default to eye comfort mode for enhanced nighttime reading
  const [playbackRate, setPlaybackRate] = useState<number>(() => {
    const saved = readJSON(STORAGE_KEYS.playbackRate, 1);
    return PLAYBACK_RATES.includes(saved) ? saved : 1;
  });
  const [fontSize, setFontSize] = useState<number>(() => {
    const saved = readJSON(STORAGE_KEYS.fontSize, DEFAULT_FONT_SIZE);
    return saved >= 0 && saved < FONT_SIZE_CLASSES.length ? saved : DEFAULT_FONT_SIZE;
  });

  const toggleEyeComfortMode = useCallback(() => {
    setIsEyeComfortMode(prev => !prev);
  }, []);

  const audioRef = useRef<HTMLAudioElement>(null);
  const repeatTimeoutRef = useRef<number | null>(null);

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

  // Persist preferences and progress
  useEffect(() => writeSetMap(STORAGE_KEYS.memorized, memorizedAyahs), [memorizedAyahs]);
  useEffect(() => writeSetMap(STORAGE_KEYS.bookmarked, bookmarkedAyahs), [bookmarkedAyahs]);
  useEffect(() => writeJSON(STORAGE_KEYS.eyeComfort, isEyeComfortMode), [isEyeComfortMode]);
  useEffect(() => writeJSON(STORAGE_KEYS.lastSurah, currentSurah.number), [currentSurah.number]);
  useEffect(() => writeJSON(STORAGE_KEYS.playbackRate, playbackRate), [playbackRate]);
  useEffect(() => writeJSON(STORAGE_KEYS.fontSize, fontSize), [fontSize]);

  // Remember the last ayah reached in each surah so the child resumes where they stopped
  useEffect(() => {
    if (ayahs.length === 0 || currentAyahIndex >= ayahs.length) return;
    if (positionsRef.current[currentSurah.number] === currentAyahIndex) return;
    positionsRef.current = { ...positionsRef.current, [currentSurah.number]: currentAyahIndex };
    writeJSON(STORAGE_KEYS.positions, positionsRef.current);
  }, [currentAyahIndex, ayahs, currentSurah.number]);

  useEffect(() => {
    const surahNumber = currentSurah.number;
    const controller = new AbortController();

    const fetchSurahData = async () => {
      setIsLoading(true);
      setError(null);
      setAyahs([]);
      try {
        const response = await fetch(
          `https://api.alquran.cloud/v1/surah/${surahNumber}/editions/ar.abdulbasitmurattal,en.sahih,en.transliteration`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as QuranApiResponse;
        if (data.code !== 200 || data.data.length !== 3) {
          throw new Error('Invalid data format received from API.');
        }
        const [arabicData, englishData, transliterationData] = data.data;

        const mergedAyahs = arabicData.ayahs.map((ayah, index) => {
          const { basmala, text } = index === 0 ? splitBasmala(surahNumber, ayah.text) : { basmala: null, text: ayah.text };
          return {
            ...ayah,
            text,
            basmala: basmala ?? undefined,
            translation: englishData.ayahs[index]?.text || 'Translation not found.',
            transliteration: transliterationData.ayahs[index]?.text || 'Transliteration not found.',
          };
        });
        setAyahs(mergedAyahs);
        setCurrentAyahIndex(prev => Math.min(prev, mergedAyahs.length - 1));
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Failed to fetch surah', err);
        setError('تعذّر تحميل السورة. تأكد من الاتصال بالإنترنت ثم حاول مرة أخرى.');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    fetchSurahData();
    return () => controller.abort();
  }, [currentSurah.number, reloadKey]);

  const currentSurahMemorizedSet = memorizedAyahs[currentSurah.number] ?? EMPTY_SET;
  const currentSurahBookmarkedSet = bookmarkedAyahs[currentSurah.number] ?? EMPTY_SET;

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
                if (nextIndex === currentAyahIndex) {
                    // Only one memorized ayah: replay it instead of a no-op index change
                    audio.currentTime = 0;
                    audio.play().catch(e => console.error("Audio replay failed:", e));
                } else {
                    setCurrentAyahIndex(nextIndex);
                }
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
    const audio = audioRef.current;
    const ayah = ayahs[currentAyahIndex];
    if (!audio || !ayah) return;
    
    // Do not clear timeout if we are in the pause phase of review mode
    const isPausedInReview = isReviewModeActive && !isPlaying && repeatTimeoutRef.current;
    if (!isPausedInReview) {
      clearRepeatTimeout();
    }
    
    if (audio.src !== ayah.audio) {
      audio.src = ayah.audio;
    }
    audio.playbackRate = playbackRate;
    if (isPlaying) {
      audio.play().catch(e => {
        console.error("Audio play failed:", e);
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [currentAyahIndex, isPlaying, ayahs, isReviewModeActive]);

  // Changing the source resets playbackRate to defaultPlaybackRate, so keep both in sync
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.defaultPlaybackRate = playbackRate;
    audio.playbackRate = playbackRate;
  }, [playbackRate]);

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
  
  const handleToggleMemorized = () => {
    const currentAyah = ayahs[currentAyahIndex];
    if (!currentAyah) return;
    stopReviewMode();
    clearRepeatTimeout();

    if (currentSurahMemorizedSet.has(currentAyah.numberInSurah)) {
        // Undo an accidental "memorized" tap; stay on the same ayah
        setMemorizedAyahs(prev => {
            const newSurahSet = new Set(prev[currentSurah.number] ?? []);
            newSurahSet.delete(currentAyah.numberInSurah);
            return { ...prev, [currentSurah.number]: newSurahSet };
        });
        return;
    }

    setMemorizedAyahs(prev => {
        const newSurahSet = new Set(prev[currentSurah.number] ?? []);
        newSurahSet.add(currentAyah.numberInSurah);
        return { ...prev, [currentSurah.number]: newSurahSet };
    });
    setIsPlaying(false);

    // Suggest a review every 3 newly memorized ayahs
    const newSize = currentSurahMemorizedSet.size + 1;
    if (newSize % 3 === 0) {
        setIsReviewReminderOpen(true);
    }

    if (currentAyahIndex < ayahs.length - 1) {
        setCurrentAyahIndex(currentAyahIndex + 1);
    }
  };

  const handleToggleBookmark = () => {
    const currentAyah = ayahs[currentAyahIndex];
    if (currentAyah) {
        setBookmarkedAyahs(prev => {
            const newSurahSet = new Set(prev[currentSurah.number] ?? []);
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
    setIsLoading(true);
    setAyahs([]);
    setCurrentAyahIndex(positionsRef.current[surah.number] ?? 0);
    setCurrentSurah(surah);
  };

  const handleResetProgress = () => {
    if (currentSurahMemorizedSet.size === 0) return;
    const confirmed = window.confirm(`هل تريد تصفير التقدم في ${currentSurah.name}؟\nسيتم حذف كل الآيات المحددة كمحفوظة في هذه السورة.`);
    if (!confirmed) return;
    stopReviewMode();
    setMemorizedAyahs(prev => {
        const next = { ...prev };
        delete next[currentSurah.number];
        return next;
    });
  };

  const handleFontSizeChange = (delta: number) => {
    setFontSize(prev => Math.min(Math.max(prev + delta, 0), FONT_SIZE_CLASSES.length - 1));
  };

  const handleCyclePlaybackRate = () => {
    setPlaybackRate(prev => PLAYBACK_RATES[(PLAYBACK_RATES.indexOf(prev) + 1) % PLAYBACK_RATES.length]);
  };
  
  const currentAyah = ayahs[currentAyahIndex];
  const isCurrentMemorized = currentAyah ? currentSurahMemorizedSet.has(currentAyah.numberInSurah) : false;
  const isCurrentBookmarked = currentAyah ? currentSurahBookmarkedSet.has(currentAyah.numberInSurah) : false;
  const memorizedCount = currentSurahMemorizedSet.size;

  // Keep the latest handlers reachable from long-lived listeners (keyboard, lock screen)
  const actionsRef = useRef({ handlePlayPause, handleNext, handlePrev, handleToggleMemorized, handleToggleBookmark, handleRepeatToggle, setIsPlaying });
  actionsRef.current = { handlePlayPause, handleNext, handlePrev, handleToggleMemorized, handleToggleBookmark, handleRepeatToggle, setIsPlaying };

  const isModalOpen = isBookmarksOpen || isReviewReminderOpen;

  // Keyboard shortcuts (physical key codes, so they work with an Arabic layout too)
  useEffect(() => {
    if (isModalOpen || !currentAyah) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const actions = actionsRef.current;
      switch (event.code) {
        case 'Space':
          event.preventDefault();
          if (!event.repeat) actions.handlePlayPause();
          break;
        case 'ArrowLeft': // RTL: next ayah is to the left
          event.preventDefault();
          actions.handleNext();
          break;
        case 'ArrowRight':
          event.preventDefault();
          actions.handlePrev();
          break;
        case 'KeyM':
          actions.handleToggleMemorized();
          break;
        case 'KeyB':
          actions.handleToggleBookmark();
          break;
        case 'KeyR':
          actions.handleRepeatToggle();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, currentAyah]);

  // Lock screen / headphone controls
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => { clearRepeatTimeout(); actionsRef.current.setIsPlaying(true); }],
      ['pause', () => { clearRepeatTimeout(); actionsRef.current.setIsPlaying(false); }],
      ['nexttrack', () => actionsRef.current.handleNext()],
      ['previoustrack', () => actionsRef.current.handlePrev()],
    ];
    for (const [action, handler] of handlers) {
      try { session.setActionHandler(action, handler); } catch { /* unsupported action */ }
    }
    return () => {
      for (const [action] of handlers) {
        try { session.setActionHandler(action, null); } catch { /* unsupported action */ }
      }
    };
  }, []);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentAyah || typeof MediaMetadata === 'undefined') return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${currentSurah.name} - آية ${currentAyah.numberInSurah}`,
      artist: RECITER_NAME,
      album: 'مُحفِّظ القرآن الكريم',
      artwork: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
  }, [currentAyah, currentSurah.name]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  return (
    <div className={`min-h-screen font-sans flex flex-col items-center justify-center p-3 sm:p-4 relative overflow-hidden transition-colors duration-500 ${
      isEyeComfortMode
        ? 'bg-gradient-to-br from-[#0c0a09] via-[#14110e] to-[#1c1611] text-amber-50'
        : 'bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-slate-100'
    }`}>
      {/* Ambient Atmospheric Lighting */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden transition-opacity duration-700">
        {isEyeComfortMode ? (
          <>
            <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-amber-600/15 blur-[140px] rounded-full"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-yellow-700/15 blur-[140px] rounded-full"></div>
          </>
        ) : (
          <>
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/15 blur-[130px] rounded-full"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-500/15 blur-[130px] rounded-full"></div>
          </>
        )}
      </div>

      <div className={`w-full max-w-4xl mx-auto backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[90vh] relative z-10 border transition-colors duration-500 ${
        isEyeComfortMode
          ? 'bg-[#181411]/90 border-amber-900/35 shadow-[0_20px_60px_rgba(0,0,0,0.8)]'
          : 'bg-slate-900/90 border-slate-800 shadow-[0_20px_60px_rgba(0,0,0,0.6)]'
      }`}>
        
        {/* Header Bar */}
        <div className={`p-4 sm:p-6 border-b flex justify-between items-center transition-colors duration-300 ${
          isEyeComfortMode ? 'border-amber-900/30 bg-[#14110e]/70' : 'border-slate-800 bg-slate-900/50'
        }`}>
            {/* Left: Custom Night Mode (Eye Comfort) Switch */}
            <NightModeToggle
              isEyeComfortMode={isEyeComfortMode}
              onToggle={toggleEyeComfortMode}
            />

            {/* Center: Surah Selector & Reciter */}
            <div className="text-center flex flex-col items-center">
                 <SurahSelector
                  currentSurah={currentSurah}
                  surahs={allSurahs}
                  onSelect={handleSurahChange}
                  isEyeComfortMode={isEyeComfortMode}
                />
                <p className={`mt-1 sm:mt-1.5 text-xs sm:text-sm font-medium transition-colors ${
                  isEyeComfortMode ? 'text-amber-300/70' : 'text-slate-400'
                }`}>
                  {RECITER_NAME}
                </p>
            </div>

            {/* Right: Bookmarks Button */}
            <div className="relative group flex items-center">
              <button 
                onClick={() => setIsBookmarksOpen(true)} 
                className={`p-2.5 sm:p-3 rounded-full sm:rounded-xl transition-all duration-300 border shadow-sm ${
                  isEyeComfortMode
                    ? 'text-amber-300/80 hover:text-amber-300 hover:bg-amber-900/30 border-amber-900/40'
                    : 'text-slate-400 hover:text-cyan-400 hover:bg-slate-800 border-slate-800 hover:border-slate-700'
                }`} 
                aria-label="فتح العلامات المرجعية"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
              </button>
              <div className="absolute top-full mt-2 left-0 sm:left-auto sm:right-0 w-max bg-black/90 backdrop-blur-md text-white text-xs rounded-md py-1 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-30">
                العلامات المرجعية
              </div>
            </div>
        </div>
        
        <audio ref={audioRef} />

        {isBookmarksOpen && (
            <BookmarksList 
                ayahs={ayahs}
                bookmarkedAyahs={currentSurahBookmarkedSet}
                onJumpToAyah={handleJumpToAyah}
                onClose={() => setIsBookmarksOpen(false)}
                isEyeComfortMode={isEyeComfortMode}
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
                isEyeComfortMode={isEyeComfortMode}
            />
        )}

        {isLoading ? (
          <LoadingSpinner />
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-4 h-full p-6 text-center">
            <p className="text-red-400 text-lg">{error}</p>
            <button
              onClick={() => setReloadKey(k => k + 1)}
              className={`px-6 py-2.5 rounded-xl font-bold transition-colors ${
                isEyeComfortMode ? 'bg-amber-400 text-stone-950 hover:bg-amber-300' : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
              }`}
            >
              إعادة المحاولة
            </button>
          </div>
        ) : currentAyah ? (
          <>
            <div className="flex-grow p-4 sm:p-6 overflow-y-auto flex flex-col">
              {/* m-auto centers the card but lets it scroll from the top when it is taller than the area */}
              <div className="m-auto max-w-full">
                 <VerseDisplay
                   ayah={currentAyah}
                   isMemorized={isCurrentMemorized}
                   fontSizeClass={FONT_SIZE_CLASSES[fontSize]}
                   isEyeComfortMode={isEyeComfortMode}
                 />
              </div>
            </div>

            <div className={`p-4 sm:p-6 space-y-4 border-t transition-colors ${
              isEyeComfortMode ? 'bg-[#120f0d]/80 border-amber-900/30' : 'bg-black/30 border-slate-800/60'
            }`}>
              <ProgressBar 
                memorized={memorizedCount} 
                total={ayahs.length} 
                isEyeComfortMode={isEyeComfortMode} 
              />
              <PlayerControls 
                isPlaying={isPlaying}
                onPlayPause={handlePlayPause}
                onNext={handleNext}
                onPrev={handlePrev}
                onToggleMemorized={handleToggleMemorized}
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
                isEyeComfortMode={isEyeComfortMode}
              />
              <SettingsBar
                fontSize={fontSize}
                onFontSizeChange={handleFontSizeChange}
                playbackRate={playbackRate}
                onCyclePlaybackRate={handleCyclePlaybackRate}
                canReset={memorizedCount > 0}
                onResetProgress={handleResetProgress}
                isEyeComfortMode={isEyeComfortMode}
              />
            </div>
          </>
        ) : (
            <div className="flex items-center justify-center h-full text-white/70 text-lg">لا توجد آيات لعرضها.</div>
        )}
      </div>
       <footer className={`text-center mt-3 text-xs sm:text-sm transition-colors ${
         isEyeComfortMode ? 'text-amber-300/40' : 'text-slate-500'
       }`}>
        <p>تطبيق تحفيظ وتلاوة القرآن الكريم للأطفال والناشئة بصوت {RECITER_NAME}</p>
      </footer>
    </div>
  );
}

export default App;
