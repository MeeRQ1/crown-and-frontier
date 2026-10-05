// Player preferences (presentation only — never affects simulation results).
// Stored in localStorage when available; defaults otherwise.

export interface UISettings {
  volume: number; // 0..1
  sound: boolean;
  reducedMotion: boolean;
  uiScale: number; // 0.85..1.3
  patterns: boolean; // realm hatch patterns (ownership beyond colour)
  showNames: boolean;
  autoPauseWar: boolean;
  autoPauseEvent: boolean;
  autoPauseBattle: boolean;
  autoPauseProposal: boolean;
  /** when our research or national focus finishes and the next must be chosen */
  autoPauseChoice: boolean;
  autosaveMonths: number; // 0 = off
  tutorial: boolean;
  /** map presentation */
  showLegend: boolean;
  labelDensity: 'few' | 'normal' | 'many';
  terrainDetail: 'full' | 'reduced' | 'off';
  borderEmphasis: 'subtle' | 'normal' | 'strong';
  armyMarkers: 'all' | 'relevant' | 'mine';
  mapMode: string;
}

export const DEFAULT_SETTINGS: UISettings = {
  volume: 0.6,
  sound: true,
  reducedMotion: false,
  uiScale: 1,
  patterns: false,
  showNames: true,
  autoPauseWar: true,
  autoPauseEvent: true,
  autoPauseBattle: false,
  autoPauseProposal: true,
  autoPauseChoice: true,
  autosaveMonths: 6,
  tutorial: true,
  showLegend: true,
  labelDensity: 'normal',
  terrainDetail: 'full',
  borderEmphasis: 'normal',
  armyMarkers: 'relevant',
  mapMode: 'political',
};

const KEY = 'cnf-settings';

export function loadSettings(): UISettings {
  const s = { ...DEFAULT_SETTINGS };
  try {
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) s.reducedMotion = true;
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(s, JSON.parse(raw));
  } catch {
    /* storage blocked: defaults */
  }
  return s;
}

export function saveSettings(s: UISettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
