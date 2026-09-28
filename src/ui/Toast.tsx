import { useEffect } from 'react'

export interface ToastMessage {
  /** Новый id — новый тост (и новый таймер), даже с тем же текстом. */
  id: number
  text: string
  action?: { label: string; onClick: () => void }
}

/** Без кнопки — 5 с, с кнопкой — 8 с: успеть прочитать и нажать. */
const TOAST_MS = 5000
const TOAST_ACTION_MS = 8000

/**
 * Короткое сообщение поверх экрана: не забирает фокус, озвучивается как polite,
 * закрывается само. Кнопки — с зоной касания 44px.
 */
export function Toast({ toast, onClose }: { toast: ToastMessage | null; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(onClose, toast.action ? TOAST_ACTION_MS : TOAST_MS)
    return () => clearTimeout(id)
  }, [toast, onClose])

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+52px)] z-30 flex justify-center px-4">
      {toast && (
        <div
          key={toast.id}
          data-testid="toast"
          className="pointer-events-auto flex max-w-[448px] items-center gap-2 border-2 border-ts-border bg-ts-bg px-3 py-1 font-mono text-sm text-ts-text"
        >
          <span className="flex-1">{toast.text}</span>
          {toast.action && (
            <button
              type="button"
              className="btn min-h-11 shrink-0 px-2 text-[10px] text-ts-timer"
              onClick={() => {
                toast.action!.onClick()
                onClose()
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button type="button" aria-label="Close" className="min-h-11 min-w-11 shrink-0 text-ts-text2" onClick={onClose}>
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
