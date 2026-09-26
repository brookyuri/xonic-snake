/**
 * localStorage может быть недоступен (приватный режим, запрет cookies, квота) —
 * игра при этом должна работать, поэтому любое обращение обёрнуто в try/catch.
 */
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // хранилище недоступно — просто не сохраняем
  }
}
