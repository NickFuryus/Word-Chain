import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sfx } from './audio/soundFx';
import { CityThemeId, drawSkyscraperBlueprint } from './canvas/towerRenderer';
import {
  DICTIONARY_BY_LENGTH,
  EXTRA_COMMON_WORDS,
  STARTER_WORDS,
  TIERS,
  TierConfig,
  getTierForFloor,
} from './data/baseDictionary';
import {
  LevelBlueprint,
  MILESTONE_LANDMARKS,
  MilestoneLandmarkDef,
  MilestoneLandmarkId,
  getLevelBlueprint,
} from './data/landmarks';

// --- GLOBAL WINDOW TYPES FOR PACKED DICTIONARY & YOUTUBE PLAYABLES SDK ---
declare global {
  interface Window {
    PACKED_DICTIONARY?: string;
    ytgame?: {
      game?: {
        firstFrameReady?: () => void;
        gameReady?: () => void;
        saveData?: (data: string) => Promise<void>;
        loadData?: () => Promise<string>;
      };
      engagement?: {
        sendScore?: (score: { value: number }) => Promise<void>;
      };
      system?: {
        isAudioEnabled?: () => boolean;
        onAudioEnabledChange?: (cb: (isAudioEnabled: boolean) => void) => void;
        onPause?: (cb: () => void) => void;
        onResume?: (cb: () => void) => void;
      };
    };
    SkylineSDK?: {
      onGameReady: () => void;
      onFirstFrameReady: () => void;
      onGameStart: () => void;
      onFloorBuilt: (floors: number, word: string, cash: number, tier: number) => void;
      onTierUnlocked: (tier: number, tierName: string) => void;
      onLandmarkCompleted: (landmarkId: string, landmarkName: string, level: number) => void;
      onGameOver: (stats: Record<string, unknown>) => void;
      onAdOpportunity: (placement: string) => void;
    };
  }
}

// --- MODE & ARCHIVE DATA TYPES ---
type GameState = 'MENU' | 'PLAYING' | 'GAMEOVER';
type GameMode = 'arcade' | 'zen';
type ArchiveTab = 'arcade' | 'zen' | 'landmarks' | 'lexicon';

interface ModeProgressStats {
  bestFloors: number;
  bestScore: number;
  longestChain: number;
  highestLevel: number;
}

interface AllModeProgress {
  arcade: ModeProgressStats;
  zen: ModeProgressStats;
}

interface LandmarkUnlockRecord {
  goldUnlocked: boolean;
  zenUnlocked: boolean;
  highestPrestige: number;
  unlockedAt: number;
}

interface CompletedLandmarkMeta {
  landmarkId: MilestoneLandmarkId;
  name: string;
  city: string;
  icon: string;
  levelNum: number;
  mode: GameMode;
  prestigeName: string;
}

interface ArchiveEntry {
  id: string;
  timestamp: number;
  dateStr: string;
  floors: number;
  heightMeters: number;
  cash: number;
  words: number;
  longestWord: string;
  levelReached: number;
  blueprintName: string;
  landmarkId?: MilestoneLandmarkId;
  landmarkIcon: string;
  levelProgressRatio: number;
  completedLandmarks: CompletedLandmarkMeta[];
  mode: GameMode;
  theme: CityThemeId;
}

interface DailyMission {
  id: string;
  type: string;
  scope: 'arcade' | 'both';
  icon: string;
  title: string;
  desc: string;
  target: number;
  progress: number;
  rewardGems: number;
  claimed: boolean;
}

interface FailedWordEntry {
  word: string;
  reason: string;
  timestamp: number;
}

interface CityThemeDef {
  id: CityThemeId;
  name: string;
  cost: number;
  gradientCss: string;
}

const CITY_THEMES: CityThemeDef[] = [
  { id: 'metropolis', name: 'Metropolis Classic', cost: 0, gradientCss: 'linear-gradient(135deg, #0284c7, #1e3a8a)' },
  { id: 'cyberpunk', name: 'Cyberpunk 2099', cost: 10, gradientCss: 'linear-gradient(135deg, #a855f7, #ec4899)' },
  { id: 'sunset', name: 'Sunset Bay', cost: 15, gradientCss: 'linear-gradient(135deg, #f97316, #db2777)' },
  { id: 'ecocity', name: 'Emerald Eco-City', cost: 20, gradientCss: 'linear-gradient(135deg, #10b981, #065f46)' },
];

// Daily Contracts: timer/streak/survival restricted to Arcade; lexical/letter-discovery shared across both
const MISSION_TEMPLATES: Array<{
  type: string;
  scope: 'arcade' | 'both';
  icon: string;
  title: string;
  desc: string;
  targets: number[];
  reward: number;
}> = [
  { type: 'combo_streak', scope: 'arcade', icon: '🔥', title: 'Unbroken Chain', desc: 'Achieve a {target}x chain streak (Arcade)', targets: [4, 5, 6], reward: 20 },
  { type: 'speed_master', scope: 'arcade', icon: '⏱️', title: 'Speed Architect', desc: 'Submit {target} words with 10s+ left (Arcade)', targets: [5, 8, 12], reward: 20 },
  { type: 'survival_floors', scope: 'arcade', icon: '🛡️', title: 'Iron Will', desc: 'Build {target} floors with no life lost (Arcade)', targets: [15, 25, 35], reward: 25 },
  { type: 'long_words', scope: 'both', icon: '⭐', title: 'Lexical Reach', desc: 'Submit {target} words of 5+ letters', targets: [6, 10, 14], reward: 20 },
  { type: 'super_word', scope: 'both', icon: '👑', title: 'Architectural Genius', desc: 'Submit {target} master-word of 7+ letters', targets: [1, 2, 3], reward: 25 },
  { type: 'vowel_end', scope: 'both', icon: '🪶', title: 'Vowel Finisher', desc: 'End words on a vowel (A,E,I,O,U) {target} times', targets: [5, 8, 12], reward: 15 },
  { type: 'st_end', scope: 'both', icon: '⚡', title: 'Sharp Endings', desc: "End words on 'S' or 'T' {target} times", targets: [6, 9, 12], reward: 15 },
  { type: 'rare_discovery', scope: 'both', icon: '📖', title: 'Lexicon Explorer', desc: 'Discover {target} rare or 6+ letter words', targets: [3, 5, 8], reward: 20 },
];

function getTodayDateStr(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

function generateDailyMissions(dateStr: string): DailyMission[] {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) & 0xffffffff;
  }
  const absHash = Math.abs(hash);

  const arcadePool = MISSION_TEMPLATES.filter((t) => t.scope === 'arcade');
  const sharedPool = MISSION_TEMPLATES.filter((t) => t.scope === 'both');

  // Always select 1 Arcade-only contract + 2 shared lexical/discovery contracts
  const picked = [
    arcadePool[absHash % arcadePool.length],
    sharedPool[absHash % sharedPool.length],
    sharedPool[(absHash + 2) % sharedPool.length],
  ];
  if (picked[1].type === picked[2].type) {
    const alt = sharedPool.find((t) => t.type !== picked[1].type) || sharedPool[0];
    picked[2] = alt;
  }

  return picked.map((tmpl, slot) => {
    const target = tmpl.targets[(absHash + slot) % tmpl.targets.length];
    return {
      id: `${dateStr}_slot_${slot}_${tmpl.type}`,
      type: tmpl.type,
      scope: tmpl.scope,
      icon: tmpl.icon,
      title: tmpl.title,
      desc: tmpl.desc.replace('{target}', String(target)),
      target,
      progress: 0,
      rewardGems: tmpl.reward,
      claimed: false,
    };
  });
}

function isRareLexiconWord(word: string): boolean {
  return word.length >= 6 || /[QXZJK]/.test(word);
}

// --- CANVAS VISUAL TYPES ---
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
}

interface FloatingText {
  text: string;
  x: number;
  y: number;
  vy: number;
  alpha: number;
  color: string;
}

interface CloudAsset {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  opacity: number;
}

interface StarAsset {
  x: number;
  y: number;
  size: number;
  alpha: number;
  twinkleSpeed: number;
}

interface FallingBeam {
  y: number;
  vy: number;
  width: number;
  color: string;
}

interface MilestoneCardData {
  milestone: MilestoneLandmarkDef;
  levelNum: number;
  mode: GameMode;
  prestigeName: string;
  nextBlueprint: LevelBlueprint;
}

const DEFAULT_MODE_STATS: ModeProgressStats = {
  bestFloors: 0,
  bestScore: 0,
  longestChain: 0,
  highestLevel: 1,
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dictionaryRef = useRef<Set<string>>(new Set());
  const firstFrameFiredRef = useRef(false);
  const lastTouchTimeRef = useRef(0);

  // --- SHARED ECONOMY & COSMETICS (Shared between Arcade & Zen) ---
  const [accountGems, setAccountGems] = useState<number>(() =>
    parseInt(localStorage.getItem('skyline_gems') || '0', 10)
  );
  const [activeTheme, setActiveTheme] = useState<CityThemeId>(
    () => (localStorage.getItem('skyline_theme') as CityThemeId) || 'metropolis'
  );
  const [unlockedThemes, setUnlockedThemes] = useState<Set<CityThemeId>>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('skyline_unlocked_themes') || '["metropolis"]');
      return new Set<CityThemeId>(Array.isArray(raw) ? raw : ['metropolis']);
    } catch {
      return new Set<CityThemeId>(['metropolis']);
    }
  });
  const [rareLexicon, setRareLexicon] = useState<string[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('skyline_rare_lexicon') || '[]');
      if (!Array.isArray(raw)) return [];
      const unique = Array.from(
        new Set(raw.map((w) => String(w || '').trim().toUpperCase()).filter((w) => w.length >= 3))
      );
      return unique;
    } catch {
      return [];
    }
  });

  // --- SEPARATE MODE PROGRESSION (Arcade vs Zen) ---
  const [modeProgress, setModeProgress] = useState<AllModeProgress>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('skyline_mode_progress_v2') || 'null');
      if (raw && raw.arcade && raw.zen) return raw;
    } catch {
      // fallback
    }
    const legacyBest = parseInt(localStorage.getItem('skyline_best_floors') || '0', 10);
    return {
      arcade: { ...DEFAULT_MODE_STATS, bestFloors: legacyBest },
      zen: { ...DEFAULT_MODE_STATS },
    };
  });

  const [arcadeArchive, setArcadeArchive] = useState<ArchiveEntry[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('skyline_archive_arcade') || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  });

  const [zenArchive, setZenArchive] = useState<ArchiveEntry[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('skyline_archive_zen') || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  });

  const [landmarkUnlocks, setLandmarkUnlocks] = useState<Record<string, LandmarkUnlockRecord>>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('skyline_unlocked_landmarks_v2') || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    } catch {
      return {};
    }
  });

  // --- CORE GAMEPLAY STATE ---
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const [currentWord, setCurrentWord] = useState<string>('SKYLINE');
  const [inputVal, setInputVal] = useState<string>('');
  const [isShaking, setIsShaking] = useState<boolean>(false);

  const [floorsCount, setFloorsCount] = useState<number>(0);
  const [levelNumber, setLevelNumber] = useState<number>(1);
  const [levelFloors, setLevelFloors] = useState<number>(0);
  const [completedLandmarks, setCompletedLandmarks] = useState<CompletedLandmarkMeta[]>([]);

  const [cash, setCash] = useState<number>(0);
  const [lives, setLives] = useState<number>(3);
  const [timerLimit, setTimerLimit] = useState<number>(15);
  const [remainingTimer, setRemainingTimer] = useState<number>(15);
  const [architectBoostTurns, setArchitectBoostTurns] = useState<number>(0);
  const [comboStreak, setComboStreak] = useState<number>(0);
  const [wordsChained, setWordsChained] = useState<number>(0);
  const [longWordStreak, setLongWordStreak] = useState<number>(0);
  const [survivalFloorsStreak, setSurvivalFloorsStreak] = useState<number>(0);
  const [longestWordThisRun, setLongestWordThisRun] = useState<string>('');
  const [hasRevivedThisRun, setHasRevivedThisRun] = useState<boolean>(false);
  const [sessionGemsEarned, setSessionGemsEarned] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [dictCount, setDictCount] = useState<number>(274216);

  // Modals & Overlays
  const [showShopModal, setShowShopModal] = useState<boolean>(false);
  const [shopTab, setShopTab] = useState<'boosters' | 'themes'>('boosters');
  const [showMissionsModal, setShowMissionsModal] = useState<boolean>(false);
  const [showArchiveModal, setShowArchiveModal] = useState<boolean>(false);
  const [archiveTab, setArchiveTab] = useState<ArchiveTab>('arcade');
  const [isInspectMode, setIsInspectMode] = useState<boolean>(false);
  const [inspectSource, setInspectSource] = useState<'gameover' | 'archive'>('gameover');

  // Milestone Cards & Toasts
  const [tierBanner, setTierBanner] = useState<{ show: boolean; title: string; desc: string }>({
    show: false,
    title: '',
    desc: '',
  });
  const [milestoneCard, setMilestoneCard] = useState<MilestoneCardData | null>(null);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'normal' | 'error' | 'success' | 'special';
  }>({
    visible: false,
    message: '',
    type: 'normal',
  });
  const toastTimerRef = useRef<number | null>(null);
  const milestoneTimerRef = useRef<number | null>(null);

  // Rewarded Ad Simulation
  const [adOverlay, setAdOverlay] = useState<{
    active: boolean;
    progress: number;
    remainingSec: number;
    canClaim: boolean;
  }>({
    active: false,
    progress: 0,
    remainingSec: 2,
    canClaim: false,
  });
  const adCallbackRef = useRef<(() => void) | null>(null);
  const adIntervalRef = useRef<number | null>(null);

  // Daily Missions
  const [missionsState, setMissionsState] = useState<{ dateStr: string; missions: DailyMission[] }>(() => {
    const today = getTodayDateStr();
    try {
      const raw = JSON.parse(localStorage.getItem('skyline_daily_missions_v2') || 'null');
      if (raw && raw.dateStr === today && Array.isArray(raw.missions) && raw.missions.length === 3) {
        return raw;
      }
    } catch {
      // ignore
    }
    const fresh = { dateStr: today, missions: generateDailyMissions(today) };
    try {
      localStorage.setItem('skyline_daily_missions_v2', JSON.stringify(fresh));
    } catch {
      // ignore
    }
    return fresh;
  });

  // --- DEV-ONLY CREATOR DEBUG VAULT (Stripped from production `dist/`) ---
  const [devUnlocked, setDevUnlocked] = useState<boolean>(() => {
    if (!import.meta.env.DEV) return false;
    try {
      const params = new URLSearchParams(window.location.search);
      return (
        params.get('debug') === '1' ||
        params.has('dev') ||
        window.location.hash.includes('debug') ||
        localStorage.getItem('skyline_dev_unlocked') === 'true'
      );
    } catch {
      return false;
    }
  });
  const [showDebugModal, setShowDebugModal] = useState<boolean>(false);
  const [failedVault, setFailedVault] = useState<Record<string, FailedWordEntry>>(() => {
    if (!import.meta.env.DEV) return {};
    try {
      const raw = localStorage.getItem('skyline_failed_words_vault');
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      const deduped: Record<string, FailedWordEntry> = {};
      const entries: unknown[] = Array.isArray(parsed) ? parsed : Object.values(parsed || {});
      entries.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const rec = item as Partial<FailedWordEntry>;
        const clean = String(rec.word || '')
          .trim()
          .toUpperCase()
          .replace(/[^A-Z]/g, '');
        if (clean.length < 2 || deduped[clean]) return;
        deduped[clean] = {
          word: clean,
          reason: String(rec.reason || 'Unrecognized'),
          timestamp: typeof rec.timestamp === 'number' ? rec.timestamp : Date.now(),
        };
      });
      return deduped;
    } catch {
      return {};
    }
  });
  const [debugTestInput, setDebugTestInput] = useState<string>('');
  const [debugTestResult, setDebugTestResult] = useState<{ text: string; ok: boolean } | null>(null);
  const [debugFilter, setDebugFilter] = useState<string>('');
  const [expandedDebugFolders, setExpandedDebugFolders] = useState<Record<number, boolean>>({});
  const titleTapRef = useRef<{ count: number; lastTap: number }>({ count: 0, lastTap: 0 });

  // Refs for game loop & state tracking
  const usedWordsRef = useRef<Set<string>>(new Set());
  const currentTierRef = useRef<TierConfig>(TIERS[0]);
  const lastTickedSecondRef = useRef<number>(15);
  const inputValRef = useRef<string>('');
  useEffect(() => {
    inputValRef.current = inputVal;
  }, [inputVal]);

  const currentBlueprint = useMemo(() => getLevelBlueprint(levelNumber), [levelNumber]);
  const currentTier = useMemo(() => getTierForFloor(floorsCount), [floorsCount]);
  const targetChar = useMemo(() => currentWord.slice(-1).toUpperCase(), [currentWord]);
  const activeModeStats = gameMode ? modeProgress[gameMode] : modeProgress.arcade;
  const hasUnclaimedMission = useMemo(
    () => missionsState.missions.some((m) => !m.claimed && m.progress >= m.target),
    [missionsState]
  );

  const animRef = useRef<{
    blueprint: LevelBlueprint;
    levelProgressTarget: number;
    levelProgressAnimated: number;
    completedList: CompletedLandmarkMeta[];
    floorsCount: number;
    theme: CityThemeId;
    tierName: string;
    isInspect: boolean;
    inspectZoom: number;
    inspectPanY: number;
    isDragging: boolean;
    lastDragY: number;
    screenShake: number;
    fallingBeams: FallingBeam[];
    particles: Particle[];
    floatingTexts: FloatingText[];
    clouds: CloudAsset[];
    stars: StarAsset[];
  }>({
    blueprint: getLevelBlueprint(1),
    levelProgressTarget: 0,
    levelProgressAnimated: 0,
    completedList: [],
    floorsCount: 0,
    theme: 'metropolis',
    tierName: TIERS[0].name,
    isInspect: false,
    inspectZoom: 1,
    inspectPanY: 0,
    isDragging: false,
    lastDragY: 0,
    screenShake: 0,
    fallingBeams: [],
    particles: [],
    floatingTexts: [],
    clouds: Array.from({ length: 6 }, () => ({
      x: Math.random() * 600,
      y: Math.random() * 200,
      width: Math.random() * 90 + 70,
      height: Math.random() * 24 + 18,
      speed: Math.random() * 0.25 + 0.1,
      opacity: Math.random() * 0.35 + 0.15,
    })),
    stars: Array.from({ length: 75 }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.8 + 0.2,
      twinkleSpeed: Math.random() * 0.04 + 0.01,
    })),
  });

  useEffect(() => {
    if (isInspectMode) return;
    animRef.current.blueprint = currentBlueprint;
    animRef.current.levelProgressTarget = Math.min(1, levelFloors / currentBlueprint.targetFloors);
    animRef.current.floorsCount = floorsCount;
    animRef.current.completedList = completedLandmarks;
  }, [currentBlueprint, levelFloors, floorsCount, completedLandmarks, isInspectMode]);

  useEffect(() => {
    animRef.current.theme = activeTheme;
    animRef.current.tierName = currentTier.name;
    animRef.current.isInspect = isInspectMode;
  }, [activeTheme, currentTier, isInspectMode]);

  // --- HELPERS ---
  const triggerHaptic = useCallback((duration = 15) => {
    if (navigator && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(duration);
      } catch {
        // ignore
      }
    }
  }, []);

  const showToast = useCallback(
    (message: string, type: 'normal' | 'error' | 'success' | 'special' = 'normal') => {
      setToast({ visible: true, message, type });
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => {
        setToast((prev) => ({ ...prev, visible: false }));
      }, 1800);
    },
    []
  );

  const spawnParticles = useCallback((x: number, y: number, count = 14, color = '#38bdf8') => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3.5 + 1;
      animRef.current.particles.push({
        x: x + (Math.random() - 0.5) * 60,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.4,
        size: Math.random() * 3 + 1.5,
        color,
        alpha: 1,
        decay: Math.random() * 0.04 + 0.02,
      });
    }
  }, []);

  const spawnFloatingText = useCallback((text: string, x: number, y: number, color = '#38bdf8') => {
    animRef.current.floatingTexts.push({
      text,
      x,
      y,
      vy: -1.1,
      alpha: 1,
      color,
    });
  }, []);

  // --- DICTIONARY UNPACKING & SDK MOUNT ---
  useEffect(() => {
    window.SkylineSDK = {
      onGameReady: () => window.ytgame?.game?.gameReady?.(),
      onFirstFrameReady: () => window.ytgame?.game?.firstFrameReady?.(),
      onGameStart: () => {},
      onFloorBuilt: () => {},
      onTierUnlocked: () => {},
      onLandmarkCompleted: () => {},
      onGameOver: (stats) => {
        const floorsVal = typeof stats.floors === 'number' ? stats.floors : 0;
        if (floorsVal > 0) {
          window.ytgame?.engagement?.sendScore?.({ value: floorsVal }).catch(() => {});
        }
      },
      onAdOpportunity: () => {},
    };

    const unpackDictionary = () => {
      const dict = new Set<string>();
      Object.values(DICTIONARY_BY_LENGTH).forEach((list) => list.forEach((w) => dict.add(w)));
      EXTRA_COMMON_WORDS.forEach((w) => dict.add(w));
      STARTER_WORDS.forEach((w) => dict.add(w));

      if (typeof window.PACKED_DICTIONARY === 'string' && window.PACKED_DICTIONARY.length > 0) {
        const tokens = window.PACKED_DICTIONARY.split(' ');
        let prev = '';
        for (let i = 0; i < tokens.length; i++) {
          const token = tokens[i];
          if (!token) continue;
          const prefixLen = parseInt(token[0], 36);
          if (Number.isNaN(prefixLen)) continue;
          const word = prev.slice(0, prefixLen) + token.slice(1);
          prev = word;
          if (word.length >= 3) dict.add(word);
        }
      }

      if (import.meta.env.DEV) {
        try {
          const customWords: string[] = JSON.parse(localStorage.getItem('skyline_custom_words') || '[]');
          customWords.forEach((w) => dict.add(w.toUpperCase()));
        } catch {
          // ignore
        }
      }

      dictionaryRef.current = dict;
      setDictCount(dict.size);
    };

    unpackDictionary();

    if (window.ytgame?.system) {
      if (typeof window.ytgame.system.isAudioEnabled === 'function') {
        const enabled = window.ytgame.system.isAudioEnabled();
        sfx.setEnabled(enabled);
        setSoundEnabled(enabled);
      }
      window.ytgame.system.onAudioEnabledChange?.((enabled: boolean) => {
        sfx.setEnabled(enabled);
        setSoundEnabled(enabled);
      });
      window.ytgame.system.onPause?.(() => {
        setIsPaused(true);
        isPausedRef.current = true;
        sfx.suspend();
      });
      window.ytgame.system.onResume?.(() => {
        setIsPaused(false);
        isPausedRef.current = false;
        sfx.resume();
      });
    }

    window.SkylineSDK.onGameReady();
  }, []);

  // --- DEV-ONLY FAILED WORD VAULT ---
  const recordFailedWord = useCallback((rawWord: string, reason: string) => {
    if (!import.meta.env.DEV) return;
    const clean = (rawWord || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
    if (clean.length < 2) return;
    setFailedVault((prev) => {
      if (prev[clean]) return prev;
      const next = { ...prev, [clean]: { word: clean, reason, timestamp: Date.now() } };
      try {
        localStorage.setItem('skyline_failed_words_vault', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const handleDevHotkey = (e: KeyboardEvent) => {
      if (e.key === '`' || e.key === '~' || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd')) {
        e.preventDefault();
        setDevUnlocked(true);
        try {
          localStorage.setItem('skyline_dev_unlocked', 'true');
        } catch {
          // ignore
        }
        setShowDebugModal((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleDevHotkey);
    return () => window.removeEventListener('keydown', handleDevHotkey);
  }, []);

  const handleTitleTap = () => {
    if (!import.meta.env.DEV) return;
    const now = Date.now();
    if (now - titleTapRef.current.lastTap > 1200) titleTapRef.current.count = 0;
    titleTapRef.current.count += 1;
    titleTapRef.current.lastTap = now;
    if (titleTapRef.current.count >= 3) {
      titleTapRef.current.count = 0;
      setDevUnlocked(true);
      try {
        localStorage.setItem('skyline_dev_unlocked', 'true');
      } catch {
        // ignore
      }
      setShowDebugModal(true);
    }
  };

  // --- DAILY MISSIONS TRACKER (Arcade-only vs Shared) ---
  const trackMissionProgress = useCallback(
    (eventType: string, value: number, mode: GameMode) => {
      setMissionsState((prev) => {
        let changed = false;
        const nextMissions = prev.missions.map((m) => {
          if (m.claimed || m.type !== eventType) return m;
          if (m.scope === 'arcade' && mode !== 'arcade') return m;

          if (eventType === 'combo_streak' || eventType === 'survival_floors') {
            if (value >= m.target && m.progress < m.target) {
              changed = true;
              return { ...m, progress: m.target };
            }
            if (eventType === 'survival_floors' && value > m.progress) {
              changed = true;
              return { ...m, progress: Math.min(m.target, value) };
            }
            return m;
          }

          const nextProg = Math.min(m.target, m.progress + value);
          if (nextProg !== m.progress) {
            changed = true;
            return { ...m, progress: nextProg };
          }
          return m;
        });

        if (!changed) return prev;
        const updated = { ...prev, missions: nextMissions };
        try {
          localStorage.setItem('skyline_daily_missions_v2', JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
    },
    []
  );

  const claimMissionReward = (missionId: string) => {
    const target = missionsState.missions.find((m) => m.id === missionId);
    if (!target || target.claimed || target.progress < target.target) return;

    setMissionsState((prev) => {
      const updated = {
        ...prev,
        missions: prev.missions.map((m) => (m.id === missionId ? { ...m, claimed: true } : m)),
      };
      try {
        localStorage.setItem('skyline_daily_missions_v2', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });

    setAccountGems((g) => {
      const next = g + target.rewardGems;
      try {
        localStorage.setItem('skyline_gems', String(next));
      } catch {
        // ignore
      }
      return next;
    });

    sfx.playTierUp();
    triggerHaptic(40);
    showToast(`🎯 Contract Claimed! +${target.rewardGems} Gems 💎`, 'special');
  };

  // --- MODE STATS & ARCHIVE SAVING (Independent Arcade vs Zen) ---
  const saveRunAndProgress = useCallback(
    (runStats: {
      floors: number;
      cash: number;
      words: number;
      longestWord: string;
      blueprint: LevelBlueprint;
      levelFloors: number;
      completed: CompletedLandmarkMeta[];
      mode: GameMode;
      theme: CityThemeId;
    }) => {
      // 1. Update independent mode high scores & level progression
      setModeProgress((prev) => {
        const cur = prev[runStats.mode];
        const nextMode: ModeProgressStats = {
          bestFloors: Math.max(cur.bestFloors, runStats.floors),
          bestScore: Math.max(cur.bestScore, runStats.cash),
          longestChain: Math.max(cur.longestChain, runStats.words),
          highestLevel: Math.max(cur.highestLevel, runStats.blueprint.level),
        };
        const updated: AllModeProgress = { ...prev, [runStats.mode]: nextMode };
        try {
          localStorage.setItem('skyline_mode_progress_v2', JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });

      if (runStats.floors < 1) return;

      const entry: ArchiveEntry = {
        id: `run_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        timestamp: Date.now(),
        dateStr: new Date().toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        floors: runStats.floors,
        heightMeters: runStats.floors * 3,
        cash: runStats.cash,
        words: runStats.words,
        longestWord: runStats.longestWord || 'SKYLINE',
        levelReached: runStats.blueprint.level,
        blueprintName: runStats.blueprint.name,
        landmarkId: runStats.blueprint.milestone?.id,
        landmarkIcon: runStats.blueprint.icon,
        levelProgressRatio: Math.min(1, Math.max(0.18, runStats.levelFloors / runStats.blueprint.targetFloors)),
        completedLandmarks: runStats.completed,
        mode: runStats.mode,
        theme: runStats.theme,
      };

      if (runStats.mode === 'arcade') {
        setArcadeArchive((prev) => {
          const next = [...prev, entry].sort((a, b) => b.floors - a.floors).slice(0, 5);
          try {
            localStorage.setItem('skyline_archive_arcade', JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
      } else {
        setZenArchive((prev) => {
          const next = [...prev, entry].sort((a, b) => b.floors - a.floors).slice(0, 5);
          try {
            localStorage.setItem('skyline_archive_zen', JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
      }
    },
    []
  );

  const revisitArchiveBuild = (entry: ArchiveEntry) => {
    const bp = getLevelBlueprint(entry.levelReached || 1);
    animRef.current.blueprint = bp;
    animRef.current.levelProgressTarget = entry.levelProgressRatio || 1;
    animRef.current.levelProgressAnimated = entry.levelProgressRatio || 1;
    animRef.current.floorsCount = entry.floors;
    animRef.current.completedList = entry.completedLandmarks || [];
    animRef.current.theme = entry.theme || activeTheme;
    animRef.current.inspectZoom = 1;
    animRef.current.inspectPanY = 0;

    setShowArchiveModal(false);
    setInspectSource('archive');
    setIsInspectMode(true);
    showToast(`Inspecting ${entry.mode.toUpperCase()} Tower: ${entry.floors}F ${bp.name}! 🔭`, 'special');
  };

  const shareTextPayload = useCallback(
    (text: string, title: string, fallbackToast: string) => {
      if (navigator.share) {
        navigator.share({ title, text, url: window.location.href }).catch(() => {});
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
        showToast(fallbackToast, 'success');
      } else {
        showToast('Stats ready to share! 📋', 'success');
      }
    },
    [showToast]
  );

  // --- REWARDED AD SIMULATION ---
  const showRewardedAd = (placement: string, onReward: () => void) => {
    window.SkylineSDK?.onAdOpportunity(placement);
    adCallbackRef.current = onReward;
    setAdOverlay({ active: true, progress: 0, remainingSec: 2, canClaim: false });

    if (adIntervalRef.current) window.clearInterval(adIntervalRef.current);
    let elapsed = 0;
    const total = 2000;
    adIntervalRef.current = window.setInterval(() => {
      elapsed += 100;
      const pct = Math.min(100, (elapsed / total) * 100);
      const rem = Math.max(0, Math.ceil((total - elapsed) / 1000));
      setAdOverlay({ active: true, progress: pct, remainingSec: rem, canClaim: rem === 0 });
      if (elapsed >= total && adIntervalRef.current) {
        window.clearInterval(adIntervalRef.current);
      }
    }, 100);
  };

  const claimRewardedAd = () => {
    if (!adOverlay.canClaim) return;
    if (adIntervalRef.current) window.clearInterval(adIntervalRef.current);
    setAdOverlay({ active: false, progress: 0, remainingSec: 2, canClaim: false });
    sfx.playPurchase();
    triggerHaptic(30);
    const cb = adCallbackRef.current;
    adCallbackRef.current = null;
    cb?.();
  };

  // --- CANVAS RENDER LOOP ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastTime = performance.now();
    let simTime = 0;

    const syncCanvasResolution = () => {
      const rect = (canvas.parentElement ?? canvas).getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const targetW = Math.max(1, Math.round(rect.width * dpr));
      const targetH = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      return { dpr, w: rect.width, h: rect.height };
    };

    syncCanvasResolution();
    window.addEventListener('resize', syncCanvasResolution);
    window.visualViewport?.addEventListener('resize', syncCanvasResolution);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        syncCanvasResolution();
      });
      resizeObserver.observe(canvas.parentElement ?? canvas);
    }

    const renderFrame = (timestamp: number) => {
      const paused = isPausedRef.current;
      const dt = paused ? 0 : Math.min((timestamp - lastTime) / 1000, 0.1);
      lastTime = timestamp;
      if (!paused) {
        simTime += dt * 1000;
      }

      const { dpr, w, h } = syncCanvasResolution();
      if (w <= 1 || h <= 1) {
        rafId = requestAnimationFrame(renderFrame);
        return;
      }

      const st = animRef.current;
      if (!paused) {
        st.levelProgressAnimated += (st.levelProgressTarget - st.levelProgressAnimated) * Math.min(1, dt * 8);
      }

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      let sx = 0;
      let sy = 0;
      if (!paused && st.screenShake > 0) {
        sx = (Math.random() - 0.5) * st.screenShake;
        sy = (Math.random() - 0.5) * st.screenShake;
        st.screenShake = Math.max(0, st.screenShake - dt * 26);
      }
      ctx.translate(sx, sy);

      // 1. Dynamic Theme Sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      if (st.theme === 'cyberpunk') {
        skyGrad.addColorStop(0, '#1e1b4b');
        skyGrad.addColorStop(0.5, '#4c1d95');
        skyGrad.addColorStop(1, '#831843');
      } else if (st.theme === 'sunset') {
        skyGrad.addColorStop(0, '#431407');
        skyGrad.addColorStop(0.5, '#9a3412');
        skyGrad.addColorStop(1, '#f97316');
      } else if (st.theme === 'ecocity') {
        skyGrad.addColorStop(0, '#022c22');
        skyGrad.addColorStop(0.6, '#065f46');
        skyGrad.addColorStop(1, '#10b981');
      } else {
        if (st.floorsCount < 10) {
          skyGrad.addColorStop(0, '#0284c7');
          skyGrad.addColorStop(0.7, '#38bdf8');
          skyGrad.addColorStop(1, '#bae6fd');
        } else if (st.floorsCount < 30) {
          skyGrad.addColorStop(0, '#312e81');
          skyGrad.addColorStop(0.5, '#db2777');
          skyGrad.addColorStop(1, '#f97316');
        } else {
          skyGrad.addColorStop(0, '#020617');
          skyGrad.addColorStop(0.6, '#1e1b4b');
          skyGrad.addColorStop(1, '#312e81');
        }
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Stars
      const starAlpha = Math.min(Math.max((st.floorsCount - 5) / 14, st.theme !== 'metropolis' ? 0.55 : 0.12), 1);
      if (starAlpha > 0) {
        st.stars.forEach((star) => {
          if (!paused) {
            star.alpha = Math.max(0.2, Math.min(1, star.alpha + (Math.random() - 0.5) * star.twinkleSpeed));
          }
          ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha * starAlpha})`;
          ctx.fillRect(star.x * w, star.y * h * 0.78, star.size, star.size);
        });
      }

      // Clouds
      st.clouds.forEach((c) => {
        if (!paused) {
          c.x += c.speed;
          if (c.x > w + 120) c.x = -120;
        }
        ctx.fillStyle =
          st.theme === 'cyberpunk' ? `rgba(244, 63, 94, ${c.opacity * 0.45})` : `rgba(255, 255, 255, ${c.opacity})`;
        ctx.beginPath();
        ctx.ellipse(c.x, (c.y % (h * 0.55)) + 28, c.width * 0.5, c.height * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      });

      // 2. Responsive Aspect-Ratio-Preserving Viewport Scaling (16:9, 19.5:9, 20:9, 1:1, landscape)
      const topSafePadding = Math.min(48, Math.max(28, h * 0.16));
      const bottomSafePadding = Math.min(34, Math.max(22, h * 0.11));
      const craneClearance = st.isInspect ? 6 : Math.min(24, Math.max(12, h * 0.08));
      const groundY = h - bottomSafePadding + (st.isInspect ? st.inspectPanY : 0);

      const maxDrawH = Math.max(56, h - topSafePadding - bottomSafePadding - craneClearance);
      const maxDrawW = Math.max(56, w * 0.78);
      const towerH = Math.min(maxDrawH, maxDrawW * 1.45) * (st.isInspect ? st.inspectZoom : 1);
      const towerW = Math.min(maxDrawW, towerH * 0.78);

      // Parallax City Backdrop & Flanking Cleared Landmarks
      ctx.fillStyle = 'rgba(15, 23, 42, 0.42)';
      for (let bx = 6; bx < w + 40; bx += 34) {
        const bH = Math.min(h * 0.25, 24 + ((bx * 9301 + 49297) % 48));
        ctx.fillRect(bx, groundY - bH, 26, bH);
      }

      if (st.completedList.length > 0) {
        const miniH = Math.min(110, towerH * 0.36);
        const miniW = miniH * 0.62;
        st.completedList.slice(-4).forEach((meta, idx) => {
          const bp = getLevelBlueprint(meta.levelNum);
          const side = idx % 2 === 0 ? -1 : 1;
          const slot = Math.floor(idx / 2) + 1;
          const offsetX = w / 2 + side * (towerW * 0.56 + slot * Math.max(26, miniW * 0.85));
          if (offsetX < miniW * 0.4 || offsetX > w - miniW * 0.4) return;
          ctx.save();
          ctx.translate(offsetX, groundY);
          drawSkyscraperBlueprint(ctx, bp, miniW, miniH, 1, st.theme, simTime, {
            isMini: true,
            alpha: 0.45,
          });
          ctx.restore();
        });
      }

      // Ground Pad
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, groundY, w, h - groundY + 400);
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, groundY, w, 5);
      const padW = Math.min(w * 0.88, Math.max(96, towerW * 1.12));
      ctx.fillStyle = '#475569';
      ctx.fillRect(w / 2 - padW / 2, groundY - 8, padW, 8);
      for (let i = -padW / 2 + 6; i < padW / 2 - 10; i += 18) {
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(w / 2 + i, groundY - 8);
        ctx.lineTo(w / 2 + i + 7, groundY - 8);
        ctx.lineTo(w / 2 + i - 2, groundY);
        ctx.lineTo(w / 2 + i - 9, groundY);
        ctx.fill();
      }

      // 4. Active Procedural or Milestone Tower Vector Silhouette
      ctx.save();
      ctx.translate(w / 2, groundY - 8);
      drawSkyscraperBlueprint(ctx, st.blueprint, towerW, towerH, st.levelProgressAnimated, st.theme, simTime);

      const activeTopY = -(towerH * st.levelProgressAnimated);

      // Falling Construction Beams
      for (let i = st.fallingBeams.length - 1; i >= 0; i--) {
        const beam = st.fallingBeams[i];
        if (!paused) {
          beam.vy += 28 * dt;
          beam.y += beam.vy * 60 * dt;
          if (beam.y >= activeTopY) {
            st.fallingBeams.splice(i, 1);
            st.screenShake = 5.5;
            sfx.playImpact();
            triggerHaptic(18);
            for (let p = 0; p < 12; p++) {
              const ang = Math.random() * Math.PI * 2;
              const spd = Math.random() * 3 + 1;
              st.particles.push({
                x: (Math.random() - 0.5) * beam.width,
                y: activeTopY,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd - 1.5,
                size: Math.random() * 2.8 + 1.5,
                color: st.blueprint.accentColor,
                alpha: 1,
                decay: 0.03,
              });
            }
            continue;
          }
        }
        ctx.fillStyle = beam.color;
        ctx.fillRect(-beam.width / 2, beam.y - 8, beam.width, 8);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(-beam.width / 2, beam.y - 8, beam.width, 8);
      }

      // Construction Crane above active elevation (bounded within craneClearance)
      if (st.levelProgressAnimated < 0.99 && !st.isInspect) {
        const craneH = Math.min(22, Math.max(12, craneClearance - 2));
        const craneTopY = activeTopY - craneH;
        const craneReach = Math.min(28, Math.max(16, towerW * 0.16));
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-craneReach * 0.58, activeTopY);
        ctx.lineTo(-craneReach * 0.58, craneTopY);
        ctx.lineTo(craneReach, craneTopY);
        ctx.moveTo(-craneReach * 0.92, craneTopY);
        ctx.lineTo(-craneReach * 0.58, craneTopY - 6);
        ctx.lineTo(craneReach, craneTopY);
        ctx.stroke();

        const hookX = craneReach * 0.5 + Math.sin(simTime * 0.0025) * 5;
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hookX, craneTopY);
        ctx.lineTo(hookX, craneTopY + Math.max(8, craneH * 0.55));
        ctx.stroke();
        ctx.fillStyle = '#f97316';
        ctx.fillRect(hookX - 3, craneTopY + Math.max(8, craneH * 0.55), 6, 4);
      }

      // Particles
      for (let i = st.particles.length - 1; i >= 0; i--) {
        const p = st.particles[i];
        if (!paused) {
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= p.decay;
          if (p.alpha <= 0) {
            st.particles.splice(i, 1);
            continue;
          }
        }
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Floating Texts
      for (let i = st.floatingTexts.length - 1; i >= 0; i--) {
        const ft = st.floatingTexts[i];
        if (!paused) {
          ft.y += ft.vy;
          ft.alpha -= 0.018;
          if (ft.alpha <= 0) {
            st.floatingTexts.splice(i, 1);
            continue;
          }
        }
        ctx.save();
        ctx.globalAlpha = ft.alpha;
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 4;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }
      ctx.restore();

      // Altitude HUD
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${st.floorsCount * 3}m • ${st.tierName}`, w - 10, h - 10);
      ctx.restore();

      ctx.restore();

      if (!firstFrameFiredRef.current) {
        firstFrameFiredRef.current = true;
        window.SkylineSDK?.onFirstFrameReady();
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', syncCanvasResolution);
      window.visualViewport?.removeEventListener('resize', syncCanvasResolution);
      resizeObserver?.disconnect();
    };
  }, [triggerHaptic]);

  // --- GAME OVER & LIFE DEDUCTION ---
  const triggerGameOver = useCallback(
    (
      finalFloors: number,
      finalCash: number,
      finalWords: number,
      finalLongest: string,
      finalBlueprint: LevelBlueprint,
      finalLevelFloors: number,
      finalCompleted: CompletedLandmarkMeta[]
    ) => {
      const resolvedMode: GameMode = gameMode ?? 'arcade';
      setGameState('GAMEOVER');
      sfx.playGameOver();
      triggerHaptic(50);

      saveRunAndProgress({
        floors: finalFloors,
        cash: finalCash,
        words: finalWords,
        longestWord: finalLongest,
        blueprint: finalBlueprint,
        levelFloors: finalLevelFloors,
        completed: finalCompleted,
        mode: resolvedMode,
        theme: activeTheme,
      });

      window.SkylineSDK?.onGameOver({
        mode: resolvedMode,
        floors: finalFloors,
        cash: finalCash,
        words: finalWords,
        gems: sessionGemsEarned,
      });
    },
    [activeTheme, gameMode, saveRunAndProgress, sessionGemsEarned, triggerHaptic]
  );

  const deductLife = useCallback(
    (reason: string) => {
      triggerHaptic(40);
      setComboStreak(0);
      setLongWordStreak(0);
      setSurvivalFloorsStreak(0);
      sfx.playError();
      setIsShaking(true);
      window.setTimeout(() => setIsShaking(false), 400);
      showToast(reason, 'error');

      if (gameMode === 'zen') return;

      setLives((prevLives) => {
        const nextLives = prevLives - 1;
        if (nextLives <= 0) {
          triggerGameOver(
            floorsCount,
            cash,
            wordsChained,
            longestWordThisRun,
            currentBlueprint,
            levelFloors,
            completedLandmarks
          );
          return 0;
        }
        return nextLives;
      });
    },
    [
      cash,
      completedLandmarks,
      currentBlueprint,
      floorsCount,
      gameMode,
      levelFloors,
      longestWordThisRun,
      showToast,
      triggerGameOver,
      triggerHaptic,
      wordsChained,
    ]
  );

  // --- ARCADE TURN TIMER ---
  useEffect(() => {
    if (
      isPaused ||
      gameState !== 'PLAYING' ||
      gameMode === 'zen' ||
      showShopModal ||
      showMissionsModal ||
      showArchiveModal ||
      showDebugModal
    ) {
      return;
    }

    const timerId = window.setInterval(() => {
      setRemainingTimer((prev) => {
        const next = Math.max(0, prev - 0.1);
        if (next <= 4) {
          const curSec = Math.ceil(next);
          if (curSec !== lastTickedSecondRef.current && curSec > 0) {
            sfx.playTick();
            lastTickedSecondRef.current = curSec;
          }
        }
        if (next <= 0) {
          const pending = inputValRef.current.trim().toUpperCase();
          if (pending.length >= 2) {
            recordFailedWord(pending, 'Timed out during entry');
          }
          lastTickedSecondRef.current = timerLimit;
          window.setTimeout(() => {
            deductLife("Time's Up! -1 Life");
          }, 0);
          return timerLimit;
        }
        return next;
      });
    }, 100);

    return () => window.clearInterval(timerId);
  }, [
    deductLife,
    gameMode,
    gameState,
    isPaused,
    recordFailedWord,
    showArchiveModal,
    showDebugModal,
    showMissionsModal,
    showShopModal,
    timerLimit,
  ]);

  const startNewGame = (modeOverride?: GameMode) => {
    const targetMode: GameMode = modeOverride ?? gameMode ?? 'arcade';
    setGameMode(targetMode);

    const starter = STARTER_WORDS[Math.floor(Math.random() * STARTER_WORDS.length)];
    usedWordsRef.current = new Set([starter]);
    currentTierRef.current = TIERS[0];

    setGameState('PLAYING');
    setIsInspectMode(false);
    setMilestoneCard(null);
    setFloorsCount(0);
    setLevelNumber(1);
    setLevelFloors(0);
    setCompletedLandmarks([]);
    setCash(0);
    setComboStreak(0);
    setWordsChained(0);
    setLongWordStreak(0);
    setSurvivalFloorsStreak(0);
    setArchitectBoostTurns(0);
    setLongestWordThisRun('');
    setHasRevivedThisRun(false);
    setSessionGemsEarned(0);
    setCurrentWord(starter);
    setInputVal('');

    if (targetMode === 'zen') {
      setLives(999);
      setTimerLimit(9999);
      setRemainingTimer(9999);
    } else {
      setLives(3);
      setTimerLimit(15);
      setRemainingTimer(15);
      lastTickedSecondRef.current = 15;
    }

    const lvl1 = getLevelBlueprint(1);
    animRef.current.blueprint = lvl1;
    animRef.current.levelProgressTarget = 0;
    animRef.current.levelProgressAnimated = 0;
    animRef.current.completedList = [];
    animRef.current.fallingBeams = [];
    animRef.current.particles = [];
    animRef.current.floatingTexts = [];

    showToast(targetMode === 'zen' ? 'Zen Mode: Build at your pace! 🧘' : 'Arcade Mode: Race the clock! ⚡', 'success');
    window.SkylineSDK?.onGameStart();
  };

  const handlePlayAgain = () => {
    usedWordsRef.current = new Set();
    currentTierRef.current = TIERS[0];

    setGameMode(null);
    setGameState('MENU');
    setIsInspectMode(false);
    setMilestoneCard(null);
    setFloorsCount(0);
    setLevelNumber(1);
    setLevelFloors(0);
    setCompletedLandmarks([]);
    setCash(0);
    setComboStreak(0);
    setWordsChained(0);
    setLongWordStreak(0);
    setSurvivalFloorsStreak(0);
    setArchitectBoostTurns(0);
    setLongestWordThisRun('');
    setHasRevivedThisRun(false);
    setSessionGemsEarned(0);
    setLives(3);
    setTimerLimit(15);
    setRemainingTimer(15);
    lastTickedSecondRef.current = 15;
    setCurrentWord('SKYLINE');
    setInputVal('');

    const lvl1 = getLevelBlueprint(1);
    animRef.current.blueprint = lvl1;
    animRef.current.levelProgressTarget = 0;
    animRef.current.levelProgressAnimated = 0;
    animRef.current.completedList = [];
    animRef.current.fallingBeams = [];
    animRef.current.particles = [];
    animRef.current.floatingTexts = [];
  };

  const provideHint = () => {
    if (gameState !== 'PLAYING') return;
    const dict = dictionaryRef.current;
    const candidates: string[] = [];
    for (const w of dict) {
      if (w.startsWith(targetChar) && !usedWordsRef.current.has(w) && w.length >= 3 && w.length <= 7) {
        candidates.push(w);
        if (candidates.length >= 40) break;
      }
    }
    if (candidates.length === 0) {
      showToast(`No more words found starting with "${targetChar}"!`, 'error');
      return;
    }
    const hintWord = candidates[Math.floor(Math.random() * candidates.length)];
    setInputVal(hintWord);
    sfx.playPurchase();
    triggerHaptic(20);

    if (cash >= 10) {
      setCash((c) => c - 10);
      showToast(`💡 Hint: "${hintWord}" (-$10)`, 'special');
    } else {
      showToast(`💡 Hint: "${hintWord}" (Free!)`, 'special');
    }
  };

  const submitWord = useCallback(() => {
    if (gameState !== 'PLAYING' || !gameMode) return;
    const raw = inputValRef.current.trim().toUpperCase().replace(/[^A-Z]/g, '');
    setInputVal('');

    if (raw.length < 3) {
      recordFailedWord(raw, 'Word too short (<3 letters)');
      deductLife('Word too short! (Min 3 letters)');
      return;
    }
    if (raw[0] !== targetChar) {
      recordFailedWord(raw, `Wrong starting letter (Expected "${targetChar}")`);
      deductLife(`Must start with "${targetChar}"! (You typed "${raw[0]}")`);
      return;
    }
    if (usedWordsRef.current.has(raw)) {
      recordFailedWord(raw, 'Already built this run');
      deductLife(`"${raw}" was already built this run!`);
      return;
    }
    if (!dictionaryRef.current.has(raw)) {
      recordFailedWord(raw, 'Not recognized in dictionary');
      deductLife(`"${raw}" not recognized in dictionary!`);
      return;
    }

    // --- VALID WORD SUCCESS! ---
    triggerHaptic(20);
    usedWordsRef.current.add(raw);
    setCurrentWord(raw);

    const nextWordsChained = wordsChained + 1;
    const nextCombo = comboStreak + 1;
    setWordsChained(nextWordsChained);
    setComboStreak(nextCombo);

    const isLongWord = raw.length >= 5;
    let baseFloors = 1;
    if (raw.length >= 7) baseFloors = 3;
    else if (raw.length >= 5) baseFloors = 2;

    let floorsEarned = baseFloors;
    if (isLongWord && currentTier.multiplier > 1.0) {
      floorsEarned = Math.round(baseFloors * currentTier.multiplier);
    }

    if (architectBoostTurns > 0) {
      floorsEarned *= 2;
      setArchitectBoostTurns((t) => Math.max(0, t - 1));
    }

    const nextTotalFloors = floorsCount + floorsEarned;
    setFloorsCount(nextTotalFloors);

    const nextSurvivalFloors = survivalFloorsStreak + floorsEarned;
    setSurvivalFloorsStreak(nextSurvivalFloors);

    const prestigeMult = currentBlueprint.prestige.multiplier;
    const cashEarned = Math.round(floorsEarned * 10 * prestigeMult);
    const streakBonusCash = nextCombo >= 2 ? Math.round(cashEarned * (nextCombo * 0.15)) : 0;
    const totalCashDelta = cashEarned + streakBonusCash;
    setCash((c) => c + totalCashDelta);

    // Discover Rare-Word Lexicon (Shared across both Arcade & Zen!)
    let discoveredNewRare = false;
    if (isRareLexiconWord(raw) && !rareLexicon.includes(raw)) {
      discoveredNewRare = true;
      setRareLexicon((prev) => {
        if (prev.includes(raw)) return prev;
        const next = [raw, ...prev].slice(0, 200);
        try {
          localStorage.setItem('skyline_rare_lexicon', JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    }

    // Long-word gem streak
    let bonusGemEarned = 0;
    if (isLongWord) {
      const nextLws = longWordStreak + 1;
      setLongWordStreak(nextLws);
      if (nextLws >= 2) {
        bonusGemEarned += 1;
        showToast('🔥 Long Word Streak! +1 Gem 💎', 'special');
      }
    } else {
      setLongWordStreak(0);
    }

    if (raw.length > longestWordThisRun.length) {
      setLongestWordThisRun(raw);
    }

    // Track Daily Contracts (Arcade-only vs Shared)
    if (gameMode === 'arcade') {
      trackMissionProgress('combo_streak', nextCombo, 'arcade');
      trackMissionProgress('survival_floors', nextSurvivalFloors, 'arcade');
      if (remainingTimer >= 10) trackMissionProgress('speed_master', 1, 'arcade');
    }
    if (raw.length >= 5) trackMissionProgress('long_words', 1, gameMode);
    if (raw.length >= 7) trackMissionProgress('super_word', 1, gameMode);
    const lastCh = raw[raw.length - 1];
    if ('AEIOU'.includes(lastCh)) trackMissionProgress('vowel_end', 1, gameMode);
    if (lastCh === 'S' || lastCh === 'T') trackMissionProgress('st_end', 1, gameMode);
    if (discoveredNewRare) trackMissionProgress('rare_discovery', 1, gameMode);

    if (gameMode === 'arcade') {
      setRemainingTimer(timerLimit);
      lastTickedSecondRef.current = Math.ceil(timerLimit);
    }

    // Canvas construction animation
    sfx.playSuccess(nextWordsChained);
    const currentBeamY = -(Math.min(1, levelFloors / currentBlueprint.targetFloors) * 200);
    animRef.current.fallingBeams.push({
      y: currentBeamY - 120,
      vy: 0,
      width: 68,
      color: currentBlueprint.accentColor,
    });

    const bonusTag = isLongWord && currentTier.multiplier > 1 ? ` (${currentTier.multiplier}x!)` : '';
    spawnFloatingText(`+${floorsEarned}F ${raw}${bonusTag}`, 0, currentBeamY - 26, '#38bdf8');
    if (streakBonusCash > 0) {
      spawnFloatingText(`🔥 ${nextCombo}x +$${streakBonusCash}`, 0, currentBeamY - 44, '#fde047');
    }

    // Tier Progression
    const newTier = getTierForFloor(nextTotalFloors);
    if (newTier.tierNum > currentTierRef.current.tierNum) {
      currentTierRef.current = newTier;
      bonusGemEarned += 5;
      sfx.playTierUp();
      setTierBanner({ show: true, title: `${newTier.name} UNLOCKED!`, desc: `${newTier.desc} +5 GEMS 💎` });
      window.setTimeout(() => setTierBanner((b) => ({ ...b, show: false })), 3200);
      spawnParticles(0, currentBeamY - 15, 24, '#c084fc');
      window.SkylineSDK?.onTierUnlocked(newTier.tierNum, newTier.name);
    }

    // Level Completion & Milestone Landmark Handling (Infinite Level Scaling!)
    let remFloors = levelFloors + floorsEarned;
    let activeLvl = levelNumber;
    let activeBp = currentBlueprint;
    let clearedMilestone: { milestone: MilestoneLandmarkDef; levelNum: number; prestigeName: string } | null = null;

    while (remFloors >= activeBp.targetFloors) {
      remFloors -= activeBp.targetFloors;

      if (activeBp.isMilestone && activeBp.milestone) {
        const ms = activeBp.milestone;
        clearedMilestone = {
          milestone: ms,
          levelNum: activeLvl,
          prestigeName: activeBp.prestige.name,
        };
        const unlockedMeta: CompletedLandmarkMeta = {
          landmarkId: ms.id,
          name: ms.name,
          city: ms.city,
          icon: ms.icon,
          levelNum: activeLvl,
          mode: gameMode,
          prestigeName: activeBp.prestige.name,
        };
        setCompletedLandmarks((prev) => [...prev, unlockedMeta]);

        // Gate Gold Landmark unlocks behind Arcade Mode; Zen awards Zen Blueprint badge
        setLandmarkUnlocks((prev) => {
          const cur = prev[ms.id] || {
            goldUnlocked: false,
            zenUnlocked: false,
            highestPrestige: 0,
            unlockedAt: Date.now(),
          };
          const updated: Record<string, LandmarkUnlockRecord> = {
            ...prev,
            [ms.id]: {
              goldUnlocked: cur.goldUnlocked || gameMode === 'arcade',
              zenUnlocked: cur.zenUnlocked || gameMode === 'zen',
              highestPrestige: Math.max(cur.highestPrestige, activeBp.prestige.cycle),
              unlockedAt: cur.unlockedAt || Date.now(),
            },
          };
          try {
            localStorage.setItem('skyline_unlocked_landmarks_v2', JSON.stringify(updated));
          } catch {
            // ignore
          }
          return updated;
        });

        bonusGemEarned += gameMode === 'arcade' ? 5 : 3;
        sfx.playLandmarkComplete();
        triggerHaptic(55);
        spawnParticles(0, -140, 32, activeBp.accentColor);
        window.SkylineSDK?.onLandmarkCompleted(ms.id, ms.name, activeLvl);
      } else {
        bonusGemEarned += 1;
        sfx.playTierUp();
      }

      activeLvl += 1;
      activeBp = getLevelBlueprint(activeLvl);
    }

    if (clearedMilestone) {
      setMilestoneCard({
        milestone: clearedMilestone.milestone,
        levelNum: clearedMilestone.levelNum,
        mode: gameMode,
        prestigeName: clearedMilestone.prestigeName,
        nextBlueprint: activeBp,
      });
      if (milestoneTimerRef.current) window.clearTimeout(milestoneTimerRef.current);
      milestoneTimerRef.current = window.setTimeout(() => {
        setMilestoneCard(null);
      }, 6500);
    }

    setLevelNumber(activeLvl);
    setLevelFloors(remFloors);

    // Also update highest level immediately if beaten
    setModeProgress((prev) => {
      const cur = prev[gameMode];
      if (activeLvl <= cur.highestLevel && nextTotalFloors <= cur.bestFloors) return prev;
      const updated: AllModeProgress = {
        ...prev,
        [gameMode]: {
          ...cur,
          bestFloors: Math.max(cur.bestFloors, nextTotalFloors),
          highestLevel: Math.max(cur.highestLevel, activeLvl),
        },
      };
      try {
        localStorage.setItem('skyline_mode_progress_v2', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });

    if (bonusGemEarned > 0) {
      setAccountGems((g) => {
        const next = g + bonusGemEarned;
        try {
          localStorage.setItem('skyline_gems', String(next));
        } catch {
          // ignore
        }
        return next;
      });
      setSessionGemsEarned((s) => s + bonusGemEarned);
    }

    showToast(
      streakBonusCash > 0
        ? `+${floorsEarned} Floor${floorsEarned > 1 ? 's' : ''}! (+$${totalCashDelta} 🔥)`
        : `+${floorsEarned} Floor${floorsEarned > 1 ? 's' : ''}! (+$${cashEarned})`,
      'success'
    );

    window.SkylineSDK?.onFloorBuilt(nextTotalFloors, raw, cash + totalCashDelta, newTier.tierNum);
  }, [
    architectBoostTurns,
    cash,
    comboStreak,
    currentBlueprint,
    currentTier.multiplier,
    deductLife,
    floorsCount,
    gameMode,
    gameState,
    levelFloors,
    levelNumber,
    longWordStreak,
    longestWordThisRun.length,
    rareLexicon,
    recordFailedWord,
    remainingTimer,
    showToast,
    spawnFloatingText,
    spawnParticles,
    survivalFloorsStreak,
    targetChar,
    timerLimit,
    trackMissionProgress,
    triggerHaptic,
    wordsChained,
  ]);

  // --- VIRTUAL KEYBOARD & PHYSICAL DESKTOP KEYBOARD HANDLERS ---
  const handleVirtualKey = useCallback(
    (key: string) => {
      if (isPaused || gameState !== 'PLAYING') return;
      sfx.init();
      triggerHaptic(10);
      if (key === 'BACKSPACE') {
        setInputVal((v) => v.slice(0, -1));
      } else if (key === 'ENTER') {
        submitWord();
      } else {
        setInputVal((v) => (v.length < 10 ? v + key : v));
      }
    },
    [gameState, isPaused, submitWord, triggerHaptic]
  );

  // Allow hardware typing on desktop without ever needing a focusable mobile OS keyboard input
  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (isPaused || gameState !== 'PLAYING' || showShopModal || showMissionsModal || showArchiveModal || showDebugModal) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        submitWord();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setInputVal((v) => v.slice(0, -1));
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        const ch = e.key.toUpperCase();
        setInputVal((v) => (v.length < 10 ? v + ch : v));
      }
    };
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, [gameState, isPaused, showArchiveModal, showDebugModal, showMissionsModal, showShopModal, submitWord]);

  const handleKeyTouchStart = (e: React.TouchEvent<HTMLButtonElement>, key: string) => {
    e.preventDefault();
    lastTouchTimeRef.current = Date.now();
    handleVirtualKey(key);
  };

  const handleKeyClick = (e: React.MouseEvent<HTMLButtonElement>, key: string) => {
    e.preventDefault();
    if (Date.now() - lastTouchTimeRef.current < 450) return;
    handleVirtualKey(key);
  };

  // --- SHOP HANDLERS ---
  const buyTime = () => {
    if (cash < 50 || gameMode === 'zen') return;
    setCash((c) => c - 50);
    setTimerLimit((t) => t + 2);
    setRemainingTimer((t) => t + 2);
    sfx.playPurchase();
    triggerHaptic(20);
    showToast('+2s Turn Timer Purchased!', 'success');
  };

  const buyBoost = () => {
    if (cash < 100) return;
    setCash((c) => c - 100);
    setArchitectBoostTurns((t) => t + 3);
    sfx.playPurchase();
    triggerHaptic(20);
    showToast('Architect Boost Active! (3 Turns)', 'success');
  };

  const buyLife = () => {
    if (cash < 150 || lives >= 5 || gameMode === 'zen') return;
    setCash((c) => c - 150);
    setLives((l) => Math.min(5, l + 1));
    sfx.playPurchase();
    triggerHaptic(20);
    showToast('+1 Life Restored!', 'success');
  };

  const handleThemeSelect = (themeDef: CityThemeDef) => {
    if (unlockedThemes.has(themeDef.id)) {
      setActiveTheme(themeDef.id);
      try {
        localStorage.setItem('skyline_theme', themeDef.id);
      } catch {
        // ignore
      }
      sfx.playPurchase();
      triggerHaptic(20);
      showToast(`Theme Applied: ${themeDef.name}`, 'success');
    } else if (accountGems >= themeDef.cost) {
      const nextGems = accountGems - themeDef.cost;
      const nextSet = new Set(unlockedThemes);
      nextSet.add(themeDef.id);
      setAccountGems(nextGems);
      setUnlockedThemes(nextSet);
      setActiveTheme(themeDef.id);
      try {
        localStorage.setItem('skyline_gems', String(nextGems));
        localStorage.setItem('skyline_unlocked_themes', JSON.stringify(Array.from(nextSet)));
        localStorage.setItem('skyline_theme', themeDef.id);
      } catch {
        // ignore
      }
      sfx.playPurchase();
      triggerHaptic(30);
      showToast(`Unlocked ${themeDef.name}!`, 'special');
    } else {
      sfx.playError();
      triggerHaptic(40);
      showToast(`Need ${themeDef.cost} Gems!`, 'error');
    }
  };

  // --- INSPECT PANNING ---
  const onCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isInspectMode) return;
    animRef.current.isDragging = true;
    animRef.current.lastDragY = e.clientY;
  };
  const onCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isInspectMode || !animRef.current.isDragging) return;
    const dy = e.clientY - animRef.current.lastDragY;
    animRef.current.lastDragY = e.clientY;
    animRef.current.inspectPanY = Math.max(-120, Math.min(180, animRef.current.inspectPanY + dy));
  };
  const onCanvasPointerUp = () => {
    animRef.current.isDragging = false;
  };

  // --- DEV-ONLY VAULT COMPUTED ---
  const devVaultByLength = useMemo(() => {
    if (!import.meta.env.DEV) return [] as Array<{ len: number; entries: FailedWordEntry[] }>;
    const q = debugFilter.trim().toUpperCase();
    const groups = new Map<number, FailedWordEntry[]>();
    const seenWords = new Set<string>();
    Object.values(failedVault).forEach((entry) => {
      const cleanWord = (entry.word || '').trim().toUpperCase();
      if (!cleanWord || seenWords.has(cleanWord)) return;
      seenWords.add(cleanWord);
      if (q && !cleanWord.includes(q)) return;
      const list = groups.get(cleanWord.length) || [];
      list.push({ ...entry, word: cleanWord });
      groups.set(cleanWord.length, list);
    });
    return Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([len, entries]) => ({
        len,
        entries: entries.sort((a, b) => a.word.localeCompare(b.word)),
      }));
  }, [debugFilter, failedVault]);

  const devAllowWord = (word: string) => {
    if (!import.meta.env.DEV) return;
    dictionaryRef.current.add(word);
    setDictCount(dictionaryRef.current.size);
    try {
      const existing: string[] = JSON.parse(localStorage.getItem('skyline_custom_words') || '[]');
      if (!existing.includes(word)) {
        localStorage.setItem('skyline_custom_words', JSON.stringify([...existing, word]));
      }
    } catch {
      // ignore
    }
    setFailedVault((prev) => {
      const next = { ...prev };
      delete next[word];
      try {
        localStorage.setItem('skyline_failed_words_vault', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    showToast(`Added "${word}" to dictionary!`, 'success');
  };

  const missionCountdown = useMemo(() => {
    const now = new Date();
    const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const diff = midnight.getTime() - now.getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `Resets in ${h}h ${m}m (UTC)`;
  }, [showMissionsModal]);

  const timerPct = gameMode === 'zen' ? 100 : Math.min(100, (remainingTimer / timerLimit) * 100);
  const timerClass =
    gameMode === 'zen' ? '' : remainingTimer <= 4 ? 'critical' : remainingTimer <= 7 ? 'warning' : '';
  const levelPct = Math.min(100, Math.round((levelFloors / currentBlueprint.targetFloors) * 100));
  const nextMilestoneLvl = Math.ceil(levelNumber / 5) * 5;

  return (
    <div id="app-container">
      {/* TOP (MOBILE PORTRAIT) / LEFT (DESKTOP LANDSCAPE): SKYSCRAPER CANVAS */}
      <section id="canvas-section">
        <canvas
          id="game-canvas"
          ref={canvasRef}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerLeave={onCanvasPointerUp}
        />

        {/* Canvas HUD Overlay */}
        <div className="canvas-top-bar">
          <div className="canvas-badges-left">
            <div className="canvas-badge tier-badge" title={currentBlueprint.subtitle}>
              <span>{currentBlueprint.icon}</span>
              <span className="tier-badge-text">
                LVL {levelNumber} • {currentBlueprint.name}
              </span>
            </div>
            <div className="canvas-badge gem-badge">
              <span>💎</span>
              <span>{accountGems}</span>
            </div>
            {comboStreak >= 2 && (
              <div className="canvas-badge streak-badge">
                <span>🔥</span>
                <span>{comboStreak}x</span>
              </div>
            )}
          </div>

          <div className="canvas-actions-right">
            <button
              className="canvas-badge mission-badge"
              onClick={() => setShowMissionsModal(true)}
              title="Daily Word Contracts"
            >
              <span>🎯</span>
              <span>GOALS</span>
              {hasUnclaimedMission && <span className="mission-dot" />}
            </button>

            {gameState === 'PLAYING' && gameMode === 'zen' && (
              <button
                className="canvas-badge"
                style={{
                  background: 'rgba(34, 197, 94, 0.85)',
                  borderColor: '#4ade80',
                  color: '#fff',
                  cursor: 'pointer',
                }}
                onClick={() =>
                  triggerGameOver(
                    floorsCount,
                    cash,
                    wordsChained,
                    longestWordThisRun,
                    currentBlueprint,
                    levelFloors,
                    completedLandmarks
                  )
                }
                title="Finish Zen Tower"
              >
                <span>🏁</span>
                <span>FINISH</span>
              </button>
            )}

            <button
              className="btn-icon"
              onClick={() => {
                const next = !soundEnabled;
                sfx.setEnabled(next);
                setSoundEnabled(next);
                showToast(next ? 'Sound: ON' : 'Sound: OFF');
              }}
              title="Toggle Sound"
            >
              {soundEnabled ? '🔊' : '🔇'}
            </button>

            <button
              className="btn-icon"
              style={{ borderColor: cash >= 50 ? '#4ade80' : undefined }}
              onClick={() => {
                if (gameState !== 'PLAYING') return;
                setShowShopModal(true);
              }}
              title="Upgrades & Themes Shop"
            >
              🛒
            </button>
          </div>
        </div>

        {/* DEV-ONLY FLOATING VAULT BUTTON */}
        {import.meta.env.DEV && devUnlocked && (
          <button className="floating-dev-btn" onClick={() => setShowDebugModal(true)}>
            🛠️ DEV ({Object.keys(failedVault).length})
          </button>
        )}

        {/* Blueprint Level Progress Pill */}
        {!isInspectMode && (
          <div className="landmark-progress-pill">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, fontSize: 9, fontWeight: 800, whiteSpace: 'nowrap' }}>
              <span style={{ color: '#bae6fd' }}>
                {currentBlueprint.isMilestone ? '⭐ MILESTONE' : `NEXT LANDMARK: LVL ${nextMilestoneLvl}`}
              </span>
              <span style={{ color: '#64748b' }}>&bull;</span>
              <span style={{ color: '#fbbf24' }}>
                {levelFloors}/{currentBlueprint.targetFloors}F ({levelPct}%)
              </span>
            </div>
            <div className="landmark-progress-track">
              <div className="landmark-progress-fill" style={{ width: `${levelPct}%` }} />
            </div>
            {currentBlueprint.prestige.cycle > 0 && (
              <div style={{ fontSize: 8, color: currentBlueprint.prestige.accentColor, fontWeight: 800 }}>
                {currentBlueprint.prestige.badgeIcon} {currentBlueprint.prestige.name} ({currentBlueprint.prestige.multiplier}x Cash)
              </div>
            )}
          </div>
        )}

        {/* Active Architect Boost Pill */}
        {architectBoostTurns > 0 && (
          <div id="active-buff-banner">⚡ 2X FLOORS BOOST ({architectBoostTurns})</div>
        )}

        {/* Exit Inspect Mode */}
        {isInspectMode && (
          <button
            className="btn-icon"
            style={{
              position: 'absolute',
              bottom: 12,
              right: 12,
              zIndex: 50,
              width: 'auto',
              padding: '6px 14px',
              borderRadius: 20,
              fontWeight: 800,
              fontSize: 11,
              background: 'rgba(15, 23, 42, 0.92)',
              border: '1px solid #38bdf8',
            }}
            onClick={() => {
              setIsInspectMode(false);
              if (inspectSource === 'archive') {
                setShowArchiveModal(true);
              }
            }}
          >
            {inspectSource === 'archive' ? '✕ EXIT ARCHIVE VIEW' : '✕ CLOSE VIEW'}
          </button>
        )}

        {/* Tier Up Banner */}
        <div id="tier-up-banner" className={tierBanner.show ? 'show' : ''}>
          <div className="tier-title">{tierBanner.title}</div>
          <div className="tier-desc">{tierBanner.desc}</div>
        </div>

        {/* Milestone Landmark Completion Card + Pre-Verified Trivia Fact */}
        <div
          id="landmark-milestone-card"
          className={milestoneCard ? 'show' : ''}
          onClick={() => {
            if (milestoneTimerRef.current) window.clearTimeout(milestoneTimerRef.current);
            setMilestoneCard(null);
          }}
        >
          {milestoneCard && (
            <>
              <div style={{ fontSize: 10, fontWeight: 900, color: '#fbbf24', letterSpacing: 0.8 }}>
                LVL {milestoneCard.levelNum} LANDMARK CLEARED •{' '}
                {milestoneCard.mode === 'arcade' ? '🏆 GOLD UNLOCKED' : '🧘 ZEN BLUEPRINT'}
              </div>
              <div style={{ fontSize: 28, margin: '4px 0 2px' }}>{milestoneCard.milestone.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#f8fafc' }}>
                {milestoneCard.milestone.name}
              </div>
              <div style={{ fontSize: 10, color: '#38bdf8', fontWeight: 700, marginBottom: 6 }}>
                {milestoneCard.milestone.city} • {milestoneCard.prestigeName}
              </div>
              <div className="landmark-fact-box" style={{ textAlign: 'left', marginBottom: 8 }}>
                {milestoneCard.milestone.fact}
              </div>
              <div style={{ fontSize: 9, color: '#94a3b8' }}>
                Next: <strong>{milestoneCard.nextBlueprint.name}</strong> ({milestoneCard.nextBlueprint.targetFloors}F) • Tap to dismiss
              </div>
            </>
          )}
        </div>
      </section>

      {/* BOTTOM (MOBILE PORTRAIT) / RIGHT (DESKTOP LANDSCAPE): GAMEPLAY HUD & VIRTUAL KEYBOARD */}
      <section id="ui-section">
        <div
          id="toast-message"
          className={`${toast.visible ? 'show' : ''} ${toast.type !== 'normal' ? toast.type : ''}`}
        >
          {toast.message}
        </div>

        <div className="ui-top-group">
          <div className="hud-grid">
            <div className="hud-card">
              <span className="hud-label">Floors</span>
              <span className="hud-value floors">{floorsCount} F</span>
            </div>
            <div className="hud-card">
              <span className="hud-label">Cash</span>
              <span className="hud-value cash">${cash}</span>
            </div>
            <div className="hud-card">
              <span className="hud-label">Timer</span>
              <span className="hud-value">{gameMode === 'zen' ? '∞' : `${Math.ceil(remainingTimer)}s`}</span>
              <div className="timer-container">
                <div id="timer-bar" className={timerClass} style={{ width: `${timerPct}%` }} />
              </div>
            </div>
            <div className="hud-card">
              <span className="hud-label">Lives</span>
              <span className="hud-value lives">
                {gameMode === 'zen' ? '∞' : '❤️'.repeat(Math.max(0, lives)) || '💀'}
              </span>
            </div>
          </div>

          <div className="word-target-container">
            <div className="word-target-header">
              <span className="word-subtitle">
                {gameMode === 'arcade' ? '⚡ ARCADE' : '🧘 ZEN'} &bull; Target Word
              </span>
              <span className="tier-multiplier-tag">
                TIER {currentTier.tierNum} ({currentTier.multiplier.toFixed(1)}x)
              </span>
            </div>
            <div className="word-display">
              <span className="letter-base">{currentWord.slice(0, -1)}</span>
              <span className="letter-target">{targetChar}</span>
            </div>
            <div className="chain-instruction">
              Next word starts with <strong>{targetChar}</strong> (3+ letters)
            </div>
          </div>
        </div>

        {/* Locked Read-Only Word Capture Display (Zero Mobile OS Keyboard Popup) */}
        <div className="input-row">
          <div className="input-wrapper">
            <input
              type="text"
              id="word-input"
              className={isShaking ? 'shake' : ''}
              inputMode="none"
              readOnly
              tabIndex={-1}
              maxLength={10}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={inputVal}
              onFocus={(e) => e.currentTarget.blur()}
              placeholder={`Starts with "${targetChar}"...`}
            />
          </div>
          <button
            id="btn-hint"
            onTouchStart={(e) => {
              e.preventDefault();
              lastTouchTimeRef.current = Date.now();
              provideHint();
            }}
            onClick={(e) => {
              e.preventDefault();
              if (Date.now() - lastTouchTimeRef.current < 450) return;
              provideHint();
            }}
            title="Suggest a word"
          >
            💡 HINT
          </button>
          <button
            id="btn-build"
            onTouchStart={(e) => {
              e.preventDefault();
              lastTouchTimeRef.current = Date.now();
              submitWord();
            }}
            onClick={(e) => {
              e.preventDefault();
              if (Date.now() - lastTouchTimeRef.current < 450) return;
              submitWord();
            }}
          >
            BUILD 🏗️
          </button>
        </div>

        {/* Custom Virtual Keyboard (Strict e.preventDefault() on onTouchStart & onClick) */}
        <div className="virtual-keyboard">
          <div className="kbd-row">
            {['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map((k) => (
              <button
                key={k}
                type="button"
                className={`kbd-key ${k === targetChar ? 'required-key' : ''}`}
                onTouchStart={(e) => handleKeyTouchStart(e, k)}
                onClick={(e) => handleKeyClick(e, k)}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="kbd-row">
            {['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map((k) => (
              <button
                key={k}
                type="button"
                className={`kbd-key ${k === targetChar ? 'required-key' : ''}`}
                onTouchStart={(e) => handleKeyTouchStart(e, k)}
                onClick={(e) => handleKeyClick(e, k)}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="kbd-row">
            <button
              type="button"
              className="kbd-key key-wide"
              onTouchStart={(e) => handleKeyTouchStart(e, 'BACKSPACE')}
              onClick={(e) => handleKeyClick(e, 'BACKSPACE')}
              title="Backspace"
            >
              ⌫
            </button>
            {['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map((k) => (
              <button
                key={k}
                type="button"
                className={`kbd-key ${k === targetChar ? 'required-key' : ''}`}
                onTouchStart={(e) => handleKeyTouchStart(e, k)}
                onClick={(e) => handleKeyClick(e, k)}
              >
                {k}
              </button>
            ))}
            <button
              type="button"
              className="kbd-key key-wide key-enter"
              onTouchStart={(e) => handleKeyTouchStart(e, 'ENTER')}
              onClick={(e) => handleKeyClick(e, 'ENTER')}
              title="Submit"
            >
              BUILD
            </button>
          </div>
        </div>
      </section>

      {/* MODAL: MAIN MENU (Displayed whenever gameMode === null or in MENU) */}
      <div className={`modal-overlay ${(gameMode === null || gameState === 'MENU') && !isInspectMode ? 'active' : ''}`}>
        <div className="modal-card">
          <div style={{ fontSize: 30, marginBottom: 2 }}>🏙️</div>
          <h1
            className="modal-title"
            style={{ cursor: import.meta.env.DEV ? 'pointer' : 'default' }}
            onClick={handleTitleTap}
          >
            WORD CHAIN
          </h1>
          <p className="modal-subtitle">
            {gameMode
              ? `${gameMode === 'arcade' ? '⚡ ARCADE' : '🧘 ZEN'} BEST: ${activeModeStats.bestFloors}F • LVL ${activeModeStats.highestLevel} • ${accountGems} 💎`
              : `CHOOSE YOUR MODE • ${accountGems} 💎`}
          </p>

          <div className="rules-grid">
            <div className="rule-item">
              <span className="rule-icon">🏛️</span>
              <div>
                <strong>Infinite Blueprints</strong>: Clear procedural towers &amp; unlock 15 real-world landmarks every 5 levels + Prestige tiers!
              </div>
            </div>
            <div className="rule-item">
              <span className="rule-icon">🏆</span>
              <div>
                <strong>Arcade vs. Zen</strong>: Arcade unlocks Gold Landmarks &amp; streak contracts; Zen builds at your pace for Zen Blueprints.
              </div>
            </div>
            <div className="rule-item">
              <span className="rule-icon">💎</span>
              <div>
                <strong>Shared Vault</strong>: Gems, City Themes, and your rare-word Lexicon carry across both modes!
              </div>
            </div>
          </div>

          <div className="mode-select-container">
            <button
              className={`mode-btn ${gameMode === 'arcade' ? 'active' : ''}`}
              onClick={() => startNewGame('arcade')}
            >
              <span>⚡ ARCADE</span>
              <span className="mode-sub">
                Best: {modeProgress.arcade.bestFloors}F &bull; Lvl {modeProgress.arcade.highestLevel}
              </span>
              <span className="mode-sub" style={{ color: '#38bdf8', marginTop: 2 }}>
                PLAY TIMED 🚀
              </span>
            </button>
            <button
              className={`mode-btn ${gameMode === 'zen' ? 'active' : ''}`}
              onClick={() => startNewGame('zen')}
            >
              <span>🧘 ZEN MODE</span>
              <span className="mode-sub">
                Best: {modeProgress.zen.bestFloors}F &bull; Lvl {modeProgress.zen.highestLevel}
              </span>
              <span className="mode-sub" style={{ color: '#4ade80', marginTop: 2 }}>
                PLAY RELAXED 🌿
              </span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: 6, width: '100%', marginTop: 6 }}>
            <button
              className="btn-secondary"
              style={{ flex: 1, marginTop: 0, padding: 8 }}
              onClick={() => setShowMissionsModal(true)}
            >
              <span>🎯</span>
              <span>CONTRACTS</span>
            </button>
            <button
              className="btn-secondary"
              style={{ flex: 1, marginTop: 0, padding: 8 }}
              onClick={() => {
                setArchiveTab(gameMode ?? 'arcade');
                setShowArchiveModal(true);
              }}
            >
              <span>🏛️</span>
              <span>ARCHIVE</span>
            </button>
          </div>
        </div>
      </div>

      {/* MODAL: ARCHITECT WORKSHOP (BOOSTERS & SHARED CITY THEMES) */}
      <div className={`modal-overlay ${showShopModal ? 'active' : ''}`}>
        <div className="modal-card">
          <h2 className="modal-title">ARCHITECT WORKSHOP</h2>
          <p className="modal-subtitle">
            Cash: <strong style={{ color: '#4ade80' }}>${cash}</strong> &bull; Gems:{' '}
            <strong style={{ color: '#c084fc' }}>{accountGems} 💎</strong>
          </p>

          <div className="shop-tabs">
            <button
              className={`shop-tab-btn ${shopTab === 'boosters' ? 'active' : ''}`}
              onClick={() => setShopTab('boosters')}
            >
              BOOSTERS
            </button>
            <button
              className={`shop-tab-btn ${shopTab === 'themes' ? 'active' : ''}`}
              onClick={() => setShopTab('themes')}
            >
              CITY THEMES
            </button>
          </div>

          {shopTab === 'boosters' ? (
            <div className="shop-items">
              <div className="shop-card">
                <div className="shop-info">
                  <div className="shop-name">⏱️ Bonus Time</div>
                  <div className="shop-desc">
                    +2s to turn timer limit (Now: {gameMode === 'zen' ? '∞' : `${timerLimit}s`})
                  </div>
                </div>
                <button className="btn-buy" disabled={cash < 50 || gameMode === 'zen'} onClick={buyTime}>
                  <span>$50</span>
                  <span style={{ fontSize: 8, opacity: 0.8 }}>BUY</span>
                </button>
              </div>

              <div className="shop-card">
                <div className="shop-info">
                  <div className="shop-name">⚡ Architect Boost</div>
                  <div className="shop-desc">Double floors per word for next 3 turns</div>
                </div>
                <button className="btn-buy" disabled={cash < 100} onClick={buyBoost}>
                  <span>$100</span>
                  <span style={{ fontSize: 8, opacity: 0.8 }}>BUY</span>
                </button>
              </div>

              <div className="shop-card">
                <div className="shop-info">
                  <div className="shop-name">🛡️ Safety Net</div>
                  <div className="shop-desc">Instantly restore 1 lost Life (Max 5)</div>
                </div>
                <button className="btn-buy" disabled={cash < 150 || lives >= 5 || gameMode === 'zen'} onClick={buyLife}>
                  <span>$150</span>
                  <span style={{ fontSize: 8, opacity: 0.8 }}>BUY</span>
                </button>
              </div>

              <button
                className="btn-reward"
                onClick={() =>
                  showRewardedAd('rewarded_gems', () => {
                    setAccountGems((g) => {
                      const next = g + 25;
                      try {
                        localStorage.setItem('skyline_gems', String(next));
                      } catch {
                        // ignore
                      }
                      return next;
                    });
                    showToast('Claimed +25 Gems 💎!', 'special');
                  })
                }
              >
                <span>🎁</span>
                <span>Claim +25 Free Gems 💎 (Ad)</span>
              </button>
            </div>
          ) : (
            <div className="theme-grid">
              {CITY_THEMES.map((t) => {
                const isSelected = activeTheme === t.id;
                const isUnlocked = unlockedThemes.has(t.id);
                return (
                  <div
                    key={t.id}
                    className={`theme-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleThemeSelect(t)}
                  >
                    <div className="theme-preview-box" style={{ background: t.gradientCss }} />
                    <span className="theme-name">{t.name}</span>
                    <span
                      className="theme-status"
                      style={{
                        color: isSelected
                          ? '#38bdf8'
                          : isUnlocked
                          ? '#4ade80'
                          : accountGems >= t.cost
                          ? '#c084fc'
                          : '#64748b',
                      }}
                    >
                      {isSelected ? 'ACTIVE' : isUnlocked ? 'SELECT' : `${t.cost} 💎`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <button className="btn-primary" onClick={() => setShowShopModal(false)}>
            CONTINUE BUILDING
          </button>
        </div>
      </div>

      {/* MODAL: GAME OVER */}
      <div
        className={`modal-overlay ${
          gameMode !== null && gameState === 'GAMEOVER' && !isInspectMode && !showArchiveModal ? 'active' : ''
        }`}
      >
        <div className="modal-card">
          <div style={{ fontSize: 30, marginBottom: 2 }}>{gameMode === 'zen' ? '🏁' : '🚧'}</div>
          <h2 className="modal-title">
            {gameMode === 'zen' ? 'ZEN RUN COMPLETED' : 'ARCADE RUN ENDED'}
          </h2>
          <p className="modal-subtitle">
            Level {levelNumber}: {currentBlueprint.name} &bull; {completedLandmarks.length} Milestones Cleared
          </p>

          <div className="stats-summary">
            <div className="stat-box">
              <div className="stat-label">HEIGHT ({(gameMode ?? 'arcade').toUpperCase()})</div>
              <div className="stat-val">{floorsCount} F</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">{(gameMode ?? 'arcade').toUpperCase()} BEST</div>
              <div className="stat-val">{activeModeStats.bestFloors} F</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">CASH / SCORE</div>
              <div className="stat-val cash">${cash}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">WORDS CHAINED</div>
              <div className="stat-val">{wordsChained}</div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: '#c084fc', fontWeight: 800, margin: '2px 0 4px' }}>
            +{sessionGemsEarned} 💎 EARNED THIS RUN
          </div>

          {gameMode === 'arcade' && !hasRevivedThisRun && (
            <button
              className="btn-reward"
              onClick={() =>
                showRewardedAd('revive', () => {
                  setHasRevivedThisRun(true);
                  setLives(1);
                  setRemainingTimer(timerLimit);
                  setGameState('PLAYING');
                  showToast('Revived with 1 Heart ❤️!', 'success');
                })
              }
            >
              <span>❤️</span>
              <span>Revive with 1 Heart (Watch Ad)</span>
            </button>
          )}

          {cash > 0 && (
            <button
              className="btn-reward"
              style={{
                background: 'linear-gradient(135deg, #15803d 0%, #166534 100%)',
                borderColor: '#4ade80',
              }}
              onClick={() =>
                showRewardedAd('double_cash', () => {
                  setCash((c) => c * 2);
                  setAccountGems((g) => {
                    const next = g + 5;
                    try {
                      localStorage.setItem('skyline_gems', String(next));
                    } catch {
                      // ignore
                    }
                    return next;
                  });
                  setSessionGemsEarned((s) => s + 5);
                  showToast('2x Cash & +5 Gems Claimed! 💰', 'special');
                })
              }
            >
              <span>💰</span>
              <span>Double Cash +5 Gems 💎 (Watch Ad)</span>
            </button>
          )}

          <button
            className="btn-share"
            onClick={() => {
              const modeLabel = (gameMode ?? 'arcade').toUpperCase();
              const text = `🏙️ WORD CHAIN: SKYLINE BUILDER (${modeLabel})\nReached Level ${levelNumber} (${currentBlueprint.name}) at ${floorsCount} floors (${floorsCount * 3}m)!\n🏛️ Milestones: ${completedLandmarks.length} | 🔤 Chain: ${wordsChained}\nCan you outbuild my skyline?`;
              shareTextPayload(text, 'Word Chain: Skyline Builder', 'Skyline Stats Copied! 📋');
            }}
          >
            <span>📸</span>
            <span>SHARE SKYLINE TO SOCIAL</span>
          </button>

          <button
            className="btn-secondary"
            onClick={() => {
              setInspectSource('gameover');
              setIsInspectMode(true);
            }}
          >
            <span>🔭</span>
            <span>INSPECT TOWER</span>
          </button>

          <button
            className="btn-secondary"
            style={{ borderColor: 'rgba(234, 179, 8, 0.5)', color: '#fef08a' }}
            onClick={() => {
              setArchiveTab(gameMode ?? 'arcade');
              setShowArchiveModal(true);
            }}
          >
            <span>🏛️</span>
            <span>SKYLINE ARCHIVE &amp; TRIVIA</span>
          </button>

          <button className="btn-primary" onClick={handlePlayAgain}>
            PLAY AGAIN 🔄
          </button>
        </div>
      </div>

      {/* MODAL: DAILY ARCHITECT CONTRACTS */}
      <div className={`modal-overlay ${showMissionsModal ? 'active' : ''}`}>
        <div className="modal-card mission-card-modal">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              paddingBottom: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
              <span style={{ fontSize: 22 }}>🎯</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: '#f8fafc' }}>DAILY CONTRACTS</div>
                <div style={{ fontSize: 10, color: '#38bdf8' }}>{missionCountdown}</div>
              </div>
            </div>
            <button
              className="btn-icon"
              style={{ width: 28, height: 28, fontSize: 13 }}
              onClick={() => setShowMissionsModal(false)}
            >
              ✕
            </button>
          </div>

          <div className="missions-list">
            {missionsState.missions.map((m) => {
              const isCompleted = m.progress >= m.target;
              const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
              return (
                <div
                  key={m.id}
                  className={`mission-item-card ${isCompleted && !m.claimed ? 'ready' : ''} ${
                    m.claimed ? 'claimed' : ''
                  }`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 22 }}>{m.icon}</span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>{m.title}</span>
                          <span
                            style={{
                              fontSize: 8,
                              fontWeight: 800,
                              padding: '1px 5px',
                              borderRadius: 4,
                              background:
                                m.scope === 'arcade' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(56, 189, 248, 0.16)',
                              color: m.scope === 'arcade' ? '#fbbf24' : '#38bdf8',
                            }}
                          >
                            {m.scope === 'arcade' ? '⚡ ARCADE ONLY' : '🌐 ARCADE + ZEN'}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{m.desc}</div>
                      </div>
                    </div>
                    {m.claimed ? (
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#4ade80' }}>CLAIMED ✓</span>
                    ) : isCompleted ? (
                      <button className="btn-claim-mission ready" onClick={() => claimMissionReward(m.id)}>
                        CLAIM +{m.rewardGems} 💎
                      </button>
                    ) : (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#64748b',
                          background: 'rgba(255,255,255,0.05)',
                          padding: '3px 7px',
                          borderRadius: 6,
                        }}
                      >
                        +{m.rewardGems} 💎
                      </span>
                    )}
                  </div>
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 10,
                        color: '#cbd5e1',
                        marginBottom: 3,
                      }}
                    >
                      <span>
                        Progress: {m.progress} / {m.target}
                      </span>
                      <span style={{ fontWeight: 700, color: isCompleted ? '#38bdf8' : '#94a3b8' }}>{pct}%</span>
                    </div>
                    <div className="mission-progress-bar">
                      <div className="mission-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button className="btn-primary" style={{ marginTop: 4 }} onClick={() => setShowMissionsModal(false)}>
            BACK TO SKYLINE
          </button>
        </div>
      </div>

      {/* MODAL: SKYLINE ARCHIVE (SEPARATE ARCADE/ZEN RUNS, 15 LANDMARKS + TRIVIA, SHARED LEXICON) */}
      <div className={`modal-overlay ${showArchiveModal ? 'active' : ''}`}>
        <div className="modal-card archive-card-modal">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              paddingBottom: 8,
              marginBottom: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
              <span style={{ fontSize: 22 }}>🏛️</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: '#f8fafc' }}>SKYLINE ARCHIVE</div>
                <div style={{ fontSize: 10, color: '#eab308' }}>
                  Landmarks, Mode Records &amp; Shared Lexicon
                </div>
              </div>
            </div>
            <button
              className="btn-icon"
              style={{ width: 28, height: 28, fontSize: 13 }}
              onClick={() => setShowArchiveModal(false)}
            >
              ✕
            </button>
          </div>

          <div className="shop-tabs" style={{ marginBottom: 6 }}>
            <button
              className={`shop-tab-btn ${archiveTab === 'arcade' ? 'active' : ''}`}
              onClick={() => setArchiveTab('arcade')}
            >
              ⚡ ARCADE
            </button>
            <button
              className={`shop-tab-btn ${archiveTab === 'zen' ? 'active' : ''}`}
              onClick={() => setArchiveTab('zen')}
            >
              🧘 ZEN
            </button>
            <button
              className={`shop-tab-btn ${archiveTab === 'landmarks' ? 'active' : ''}`}
              onClick={() => setArchiveTab('landmarks')}
            >
              🏛️ MONUMENTS
            </button>
            <button
              className={`shop-tab-btn ${archiveTab === 'lexicon' ? 'active' : ''}`}
              onClick={() => setArchiveTab('lexicon')}
            >
              📖 LEXICON
            </button>
          </div>

          {/* Independent Mode Progression Banner */}
          {(archiveTab === 'arcade' || archiveTab === 'zen') && (
            <div className="archive-meta-grid" style={{ width: '100%', marginBottom: 4 }}>
              <div className="archive-meta-stat">
                <span className="label">BEST FLOORS</span>
                <span className="val" style={{ color: '#38bdf8' }}>
                  {modeProgress[archiveTab].bestFloors} F
                </span>
              </div>
              <div className="archive-meta-stat">
                <span className="label">HIGHEST LEVEL</span>
                <span className="val" style={{ color: '#fbbf24' }}>
                  LVL {modeProgress[archiveTab].highestLevel}
                </span>
              </div>
              <div className="archive-meta-stat">
                <span className="label">HIGHEST SCORE</span>
                <span className="val" style={{ color: '#4ade80' }}>
                  ${modeProgress[archiveTab].bestScore}
                </span>
              </div>
              <div className="archive-meta-stat">
                <span className="label">LONGEST CHAIN</span>
                <span className="val" style={{ color: '#c084fc' }}>
                  {modeProgress[archiveTab].longestChain} Words
                </span>
              </div>
            </div>
          )}

          <div className="archive-list">
            {(archiveTab === 'arcade' || archiveTab === 'zen') &&
              (() => {
                const list = archiveTab === 'arcade' ? arcadeArchive : zenArchive;
                if (list.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '24px 12px', color: '#64748b', fontSize: 12 }}>
                      <div style={{ fontSize: 28, marginBottom: 6 }}>🏗️</div>
                      <div style={{ fontWeight: 800, color: '#94a3b8', fontSize: 13 }}>
                        NO {archiveTab.toUpperCase()} RUNS ARCHIVED YET
                      </div>
                      <div>Complete a run in {archiveTab.toUpperCase()} mode to record your top builds!</div>
                    </div>
                  );
                }
                const badges = ['🥇 #1', '🥈 #2', '🥉 #3', '#4', '#5'];
                const colors = ['#eab308', '#94a3b8', '#b45309', '#64748b', '#64748b'];
                return list.map((entry, idx) => (
                  <div key={`${entry.id}_${idx}`} className="archive-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                        <span
                          className="archive-rank-badge"
                          style={{
                            background: 'rgba(255,255,255,0.08)',
                            color: colors[idx],
                            border: `1px solid ${colors[idx]}`,
                          }}
                        >
                          {badges[idx]}
                        </span>
                        <span style={{ fontSize: 14 }}>{entry.landmarkIcon}</span>
                        <span style={{ fontSize: 12, fontWeight: 900, color: '#f8fafc' }}>
                          Lvl {entry.levelReached} • {entry.blueprintName}
                        </span>
                      </div>
                      <span style={{ fontSize: 9, color: '#64748b' }}>{entry.dateStr}</span>
                    </div>

                    <div className="archive-meta-grid">
                      <div className="archive-meta-stat">
                        <span className="label">HEIGHT</span>
                        <span className="val" style={{ color: '#38bdf8' }}>
                          {entry.floors} F ({entry.heightMeters}m)
                        </span>
                      </div>
                      <div className="archive-meta-stat">
                        <span className="label">SCORE / CASH</span>
                        <span className="val" style={{ color: '#4ade80' }}>
                          ${entry.cash}
                        </span>
                      </div>
                      <div className="archive-meta-stat">
                        <span className="label">CHAIN</span>
                        <span className="val" style={{ color: '#fde047' }}>
                          {entry.words} Words
                        </span>
                      </div>
                      <div className="archive-meta-stat">
                        <span className="label">LONGEST WORD</span>
                        <span className="val" style={{ color: '#c084fc', fontSize: 10 }}>
                          {entry.longestWord}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn-archive-action"
                        style={{
                          background: 'rgba(56,189,248,0.15)',
                          border: '1px solid #38bdf8',
                          color: '#38bdf8',
                        }}
                        onClick={() => revisitArchiveBuild(entry)}
                      >
                        🔭 REVISIT TOWER
                      </button>
                      <button
                        className="btn-archive-action"
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          color: '#f1f5f9',
                        }}
                        onClick={() => {
                          const shareText = `🏛️ SKYLINE ARCHIVE (${entry.mode.toUpperCase()}): Level ${entry.levelReached} ${entry.blueprintName} — ${entry.floors} floors (${entry.heightMeters}m), $${entry.cash}, ${entry.words} words!`;
                          shareTextPayload(shareText, `Word Chain Archive`, 'Archive Record Copied! 📋');
                        }}
                      >
                        📤 SHARE
                      </button>
                    </div>
                  </div>
                ));
              })()}

            {archiveTab === 'landmarks' &&
              MILESTONE_LANDMARKS.map((lm) => {
                const unlock = landmarkUnlocks[lm.id];
                const isGold = Boolean(unlock?.goldUnlocked);
                const isZen = Boolean(unlock?.zenUnlocked);
                const isAnyUnlocked = isGold || isZen;
                return (
                  <div
                    key={lm.id}
                    className={`archive-item ${isGold ? 'unlocked-gold' : isZen ? 'unlocked-zen' : ''}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 18 }}>{lm.icon}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 900, color: '#f8fafc' }}>
                            Lvl {lm.milestoneLevel} — {lm.name}
                          </div>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>
                            {lm.city} &bull; {lm.heightM}m
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        {isGold && (
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 900,
                              color: '#fbbf24',
                              background: 'rgba(251, 191, 36, 0.16)',
                              padding: '2px 6px',
                              borderRadius: 4,
                            }}
                          >
                            🏆 GOLD UNLOCK
                          </span>
                        )}
                        {isZen && (
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 900,
                              color: '#38bdf8',
                              background: 'rgba(56, 189, 248, 0.16)',
                              padding: '2px 6px',
                              borderRadius: 4,
                            }}
                          >
                            🧘 ZEN BLUEPRINT
                          </span>
                        )}
                        {!isAnyUnlocked && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b' }}>🔒 LOCKED</span>
                        )}
                      </div>
                    </div>
                    {isAnyUnlocked ? (
                      <div className="landmark-fact-box">{lm.fact}</div>
                    ) : (
                      <div style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic' }}>
                        Clear Level {lm.milestoneLevel} in Arcade Mode for Gold Unlock, or Zen Mode for Zen Blueprint.
                      </div>
                    )}
                  </div>
                );
              })}

            {archiveTab === 'lexicon' && (
              <div className="archive-item">
                <div style={{ fontSize: 12, fontWeight: 800, color: '#f3e8ff' }}>
                  📖 Shared Rare-Word Lexicon ({rareLexicon.length} Discovered)
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>
                  Words with 6+ letters or rare letters (Q, X, Z, J, K) discovered in either Arcade or Zen Mode.
                </div>
                {rareLexicon.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#64748b', padding: '12px 0' }}>
                    Chain 6+ letter or Q/X/Z/J/K words to populate your shared Lexicon!
                  </div>
                ) : (
                  <div className="lexicon-grid">
                    {rareLexicon.map((w, idx) => (
                      <span key={`${w}_${idx}`} className="lexicon-word-chip">
                        {w}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button className="btn-primary" style={{ marginTop: 4 }} onClick={() => setShowArchiveModal(false)}>
            CLOSE ARCHIVE
          </button>
        </div>
      </div>

      {/* REWARDED AD SIMULATION OVERLAY */}
      {adOverlay.active && (
        <div id="ad-overlay">
          <div style={{ fontSize: 38, marginBottom: 6 }}>📺</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: 0.5 }}>SPONSORED REWARD</div>
          <div style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 14px' }}>
            Simulating YouTube Playables Reward Ad...
          </div>
          <div
            style={{
              width: 180,
              height: 6,
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 9999,
              overflow: 'hidden',
              marginBottom: 14,
            }}
          >
            <div
              style={{
                width: `${adOverlay.progress}%`,
                height: '100%',
                background: '#38bdf8',
                transition: 'width 0.1s linear',
              }}
            />
          </div>
          <button
            className="btn-secondary"
            disabled={!adOverlay.canClaim}
            style={{ width: 'auto', padding: '6px 16px', fontSize: 11, opacity: adOverlay.canClaim ? 1 : 0.5 }}
            onClick={claimRewardedAd}
          >
            {adOverlay.canClaim ? 'CLAIM REWARD 🎁' : `WATCHING (${adOverlay.remainingSec}s)...`}
          </button>
        </div>
      )}

      {/* DEV-ONLY CREATOR DEBUG VAULT (Strictly stripped from production `dist/`) */}
      {import.meta.env.DEV && showDebugModal && (
        <div className="modal-overlay active">
          <div className="modal-card debug-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#f8fafc' }}>🛠️ DEVELOPER VAULT</div>
                <div style={{ fontSize: 10, color: '#38bdf8' }}>{dictCount.toLocaleString()} Words Loaded</div>
              </div>
              <button
                className="btn-icon"
                style={{ width: 26, height: 26, fontSize: 12 }}
                onClick={() => setShowDebugModal(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', gap: 6, width: '100%', marginBottom: 8 }}>
              <input
                type="text"
                placeholder="Test word..."
                value={debugTestInput}
                onChange={(e) => setDebugTestInput(e.target.value.toUpperCase())}
                style={{
                  flex: 1,
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  padding: '5px 8px',
                  color: '#f8fafc',
                  fontSize: 11,
                }}
              />
              <button
                className="btn-mini-action allow"
                onClick={() => {
                  const w = debugTestInput.trim().toUpperCase();
                  if (!w) return;
                  const exists = dictionaryRef.current.has(w);
                  setDebugTestResult({
                    text: exists ? `"${w}" IS VALID IN DICTIONARY` : `"${w}" NOT FOUND`,
                    ok: exists,
                  });
                }}
              >
                TEST
              </button>
              <button
                className="btn-mini-action"
                onClick={() => {
                  const w = debugTestInput.trim().toUpperCase();
                  if (w) recordFailedWord(w, 'Manual test entry');
                }}
              >
                + FAIL
              </button>
            </div>

            {debugTestResult && (
              <div
                style={{
                  width: '100%',
                  fontSize: 10,
                  fontWeight: 800,
                  marginBottom: 8,
                  color: debugTestResult.ok ? '#4ade80' : '#f87171',
                }}
              >
                {debugTestResult.text}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1' }}>
                Failed Words: <strong style={{ color: '#f87171' }}>{Object.keys(failedVault).length}</strong>
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  className="btn-mini-action"
                  onClick={() => {
                    const summary = devVaultByLength
                      .map((g) => `[${g.len} LETTERS]\n${g.entries.map((e) => `${e.word} (${e.reason})`).join('\n')}`)
                      .join('\n\n');
                    navigator.clipboard?.writeText(summary || 'Empty vault').catch(() => {});
                    showToast('Vault report copied!', 'success');
                  }}
                >
                  📋 Copy
                </button>
                <button
                  className="btn-mini-action"
                  onClick={() => {
                    setFailedVault({});
                    try {
                      localStorage.removeItem('skyline_failed_words_vault');
                    } catch {
                      // ignore
                    }
                  }}
                >
                  🧹 Clear
                </button>
              </div>
            </div>

            <input
              type="text"
              placeholder="🔍 Filter failed words..."
              value={debugFilter}
              onChange={(e) => setDebugFilter(e.target.value)}
              style={{
                width: '100%',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 6,
                padding: '5px 8px',
                color: '#f8fafc',
                fontSize: 11,
                marginBottom: 8,
              }}
            />

            <div className="debug-folders-list">
              {devVaultByLength.length === 0 ? (
                <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center', padding: 16 }}>
                  No failed words captured yet.
                </div>
              ) : (
                devVaultByLength.map((group) => {
                  const isOpen = expandedDebugFolders[group.len] ?? true;
                  return (
                    <div key={group.len} className="debug-folder-item">
                      <div
                        className="debug-folder-header"
                        onClick={() => setExpandedDebugFolders((prev) => ({ ...prev, [group.len]: !isOpen }))}
                      >
                        <span>
                          📁 {group.len}-Letter Words ({group.entries.length})
                        </span>
                        <span>{isOpen ? '▾' : '▸'}</span>
                      </div>
                      {isOpen && (
                        <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {group.entries.map((entry, idx) => (
                            <div key={`${entry.word}_${idx}`} className="debug-word-row">
                              <div>
                                <strong style={{ color: '#f8fafc' }}>{entry.word}</strong>{' '}
                                <span style={{ color: '#94a3b8', fontSize: 9 }}>({entry.reason})</span>
                              </div>
                              <button className="btn-mini-action allow" onClick={() => devAllowWord(entry.word)}>
                                + ALLOW
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
