import { SPEEDS, type Speed } from '../game/config'
import type { Theme } from '../render/createRenderer'
import { readJSON, writeJSON } from './storage'

export const SETTINGS_KEY = 'ts_settings'

export type Difficulty = 'easy' | 'normal'

/** Duel — против бота (GAME_RULES.md), Solo — против шариков (SOLO_RULES.md). */
export type Mode = 'duel' | 'solo'

export interface Settings {
  mode: Mode
  /** Только для Duel. */
  difficulty: Difficulty
  speed: Speed
  /** Вид поля: 2026 (PixiJS) по умолчанию, 1986 — классический 8-bit. */
  theme: Theme
}

export const DEFAULT_SETTINGS: Settings = { mode: 'duel', difficulty: 'easy', speed: 'normal', theme: '2026' }

/** Сохранённый выбор меню; мусор в хранилище заменяется значениями по умолчанию. */
export function loadSettings(): Settings {
  const raw = readJSON<Partial<Settings> | null>(SETTINGS_KEY, null)
  const difficulty: Difficulty =
    raw?.difficulty === 'easy' || raw?.difficulty === 'normal' ? raw.difficulty : DEFAULT_SETTINGS.difficulty
  const speed: Speed = raw?.speed && raw.speed in SPEEDS ? raw.speed : DEFAULT_SETTINGS.speed
  const mode: Mode = raw?.mode === 'duel' || raw?.mode === 'solo' ? raw.mode : DEFAULT_SETTINGS.mode
  const theme: Theme = raw?.theme === '1986' || raw?.theme === '2026' ? raw.theme : DEFAULT_SETTINGS.theme
  return { mode, difficulty, speed, theme }
}

export function saveSettings(settings: Settings): void {
  writeJSON(SETTINGS_KEY, settings)
}
