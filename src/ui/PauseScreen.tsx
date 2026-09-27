interface Props {
  onResume: () => void
  onRestart: () => void
  onMenu: () => void
}

/** Пауза: поле под затемнением, возврат в игру — снова через отсчёт 3-2-1. */
export function PauseScreen({ onResume, onRestart, onMenu }: Props) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-ts-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
      data-testid="pause-screen"
    >
      <div className="mx-4 flex w-full max-w-xs flex-col gap-3 border-2 border-ts-border bg-ts-bg p-5">
        <h2 id="pause-title" className="text-center text-2xl font-bold tracking-widest text-ts-text">
          PAUSED
        </h2>
        <button
          type="button"
          autoFocus
          onClick={onResume}
          className="min-h-14 btn text-lg text-ts-timer"
        >
          RESUME
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="min-h-14 btn text-lg"
        >
          RESTART
        </button>
        <button
          type="button"
          onClick={onMenu}
          className="min-h-14 btn text-lg"
        >
          MENU
        </button>
      </div>
    </div>
  )
}
