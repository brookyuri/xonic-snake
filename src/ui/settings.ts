import { SPEEDS, type Speed } from '../game/config'
import { readJSON, writeJSON } from './storage'

export const SETTINGS_KEY = 'ts_settings'

export type Difficulty = 'easy' | 'normal'

export interface Settings {
  difficulty: Difficulty
  speed: Speed
}

export const DEFAULT_SETTINGS: Settings = { difficulty: 'easy', speed: 'normal' }

/** Сохранённый выбор меню; мусор в хранилище заменяется значениями по умолчанию. */
export function loadSettings(): Settings {
  const raw = readJSON<Partial<Settings> | null>(SETTINGS_KEY, null)
  const difficulty: Difficulty =
    raw?.difficulty === 'easy' || raw?.difficulty === 'normal' ? raw.difficulty : DEFAULT_SETTINGS.difficulty
  const speed: Speed = raw?.speed && raw.speed in SPEEDS ? raw.speed : DEFAULT_SETTINGS.speed
  return { difficulty, speed }
}

export function saveSettings(settings: Settings): void {
  writeJSON(SETTINGS_KEY, settings)
}
