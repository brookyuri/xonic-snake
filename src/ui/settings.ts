import { SPEEDS, type Speed } from '../game/config'
import type { Theme } from '../render/createRenderer'
import { readJSON, writeJSON } from './storage'

export const SETTINGS_KEY = 'ts_settings'

export type Difficulty = 'easy' | 'normal'

/** Duel — против бота (GAME_RULES.md), Solo — против шариков (SOLO_RULES.md). */
export type Mode = 'duel' | 'solo'

export interface Settings {
  mode: Mode
  /** Сложность Duel (бот Easy / Normal). */
  difficulty: Difficulty
  /** Сложность Solo (SOLO_RULES v0.3, раздел 13) — запоминается отдельно от Duel. */
  soloDifficulty: Difficulty
  speed: Speed
  /** Вид поля: 2026 (PixiJS) по умолчанию, 1986 — классический 8-bit. */
  theme: Theme
}

/** Новый игрок: Easy в обоих режимах (раздел 13). */
export const DEFAULT_SETTINGS: Settings = { mode: 'duel', difficulty: 'easy', soloDifficulty: 'easy', speed: 'normal', theme: '2026' }

const isDifficulty = (v: unknown): v is Difficulty => v === 'easy' || v === 'normal'

/** Сохранённый выбор меню; мусор в хранилище заменяется значениями по умолчанию. */
export function loadSettings(): Settings {
  const raw = readJSON<Partial<Settings> | null>(SETTINGS_KEY, null)
  const difficulty: Difficulty = isDifficulty(raw?.difficulty) ? raw.difficulty : DEFAULT_SETTINGS.difficulty
  // Новый игрок — Easy; игрок, у которого настройки уже были (до v0.3), играл Solo на Normal —
  // так и остаётся, пока сам не переключит.
  const soloDifficulty: Difficulty = isDifficulty(raw?.soloDifficulty) ? raw.soloDifficulty : raw ? 'normal' : DEFAULT_SETTINGS.soloDifficulty
  const speed: Speed = raw?.speed && raw.speed in SPEEDS ? raw.speed : DEFAULT_SETTINGS.speed
  const mode: Mode = raw?.mode === 'duel' || raw?.mode === 'solo' ? raw.mode : DEFAULT_SETTINGS.mode
  const theme: Theme = raw?.theme === '1986' || raw?.theme === '2026' ? raw.theme : DEFAULT_SETTINGS.theme
  return { mode, difficulty, soloDifficulty, speed, theme }
}

/** Сложность выбранного режима. */
export function modeDifficulty(settings: Settings): Difficulty {
  return settings.mode === 'solo' ? settings.soloDifficulty : settings.difficulty
}

/** Новая сложность — для выбранного режима, сложность другого режима не меняется. */
export function withModeDifficulty(settings: Settings, value: Difficulty): Settings {
  return settings.mode === 'solo' ? { ...settings, soloDifficulty: value } : { ...settings, difficulty: value }
}

export function saveSettings(settings: Settings): void {
  writeJSON(SETTINGS_KEY, settings)
}
