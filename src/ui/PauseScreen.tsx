interface Props {
  onResume: () => void
  onRestart: () => void
  onMenu: () => void
}

/** Пауза: поле под затемнением, возврат в игру — снова через отсчёт 3-2-1. */
export function PauseScreen({ onResume, onRestart, onMenu }: Props) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-black/55"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
      data-testid="pause-screen"
    >
      <div className="mx-4 flex w-full max-w-xs flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-950/95 p-5">
        <h2 id="pause-title" className="text-center text-2xl font-bold tracking-widest text-neutral-100">
          PAUSED
        </h2>
        <button
          type="button"
          autoFocus
          onClick={onResume}
          className="min-h-14 rounded-lg bg-cyan-400 text-lg font-semibold text-neutral-950 active:bg-cyan-300"
        >
          RESUME
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="min-h-14 rounded-lg bg-neutral-800 text-lg text-neutral-100 active:bg-neutral-700"
        >
          RESTART
        </button>
        <button
          type="button"
          onClick={onMenu}
          className="min-h-14 rounded-lg bg-neutral-800 text-lg text-neutral-100 active:bg-neutral-700"
        >
          MENU
        </button>
      </div>
    </div>
  )
}
